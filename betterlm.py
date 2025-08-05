from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from geopy.geocoders import ArcGIS
from geopy.distance import geodesic
from itertools import permutations, combinations, chain
from typing import List
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

geolocator = ArcGIS(timeout=10)

model_id = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id, device_map="auto")

class Location(BaseModel):
    id: int
    name: str
    address: str

class Bus(BaseModel):
    id: str
    capacity: int

class TryRoutes(BaseModel):
    Buses: List[Bus]
    Locations: List[Location]
    Destination: str
    Request: str

class ChatQuery(BaseModel):
    message: str

def distance_between(addr1, addr2):
    try:
        loc1 = geolocator.geocode(addr1)
        loc2 = geolocator.geocode(addr2)
        if not loc1 or not loc2:
            print(f"Geocode failed for: {addr1 if not loc1 else addr2}")
            return float('inf')
        coord1 = (loc1.latitude, loc1.longitude)
        coord2 = (loc2.latitude, loc2.longitude)
        return geodesic(coord1, coord2).km
    except Exception as e:
        print(f"Geocoding error: {e}")
        return float('inf')

def generate_exact_partitions(locations, capacities):
    def powerset(iterable):
        s = list(iterable)
        return chain.from_iterable(combinations(s, r) for r in range(1, len(s) + 1))

    def backtrack(index, remaining, current_partition, current_caps):
        if index == len(current_caps):
            if not remaining:
                yield current_partition
            return
        cap = current_caps[index]
        for size in range(0, min(cap, len(remaining)) + 1):
            for combo in combinations(remaining, size):
                rest = [x for x in remaining if x not in combo]
                yield from backtrack(index + 1, rest, current_partition + [list(combo)], current_caps)

    partitions = []
    for caps_subset in powerset(capacities):
        if sum(caps_subset) >= len(locations):
            partitions.extend(backtrack(0, locations, [], list(caps_subset)))
    return partitions

def ask_llm(prompt: str):
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=500)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

def compute_best_route_with_llm(buses: List[Bus], locations: List[Location], destination: str, user_request: str):
    capacities = [bus.capacity for bus in buses]
    if sum(capacities) < len(locations):
        print("Not enough bus capacity for all students")
        return []

    partitions = generate_exact_partitions(locations, capacities)
    print(f"Generated {len(partitions)} valid partitions")

    route_plans = []
    for label, partition in zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", partitions[:25]):
        best_perm = []
        total_distance = 0.0
        num_students = sum(len(group) for group in partition)
        for group in partition:
            if not group:
                best_perm.append(())
                continue
            best_route = min(
                permutations(group),
                key=lambda r: sum(distance_between(r[i].address, r[i + 1].address) for i in range(len(r) - 1)) + distance_between(r[-1].address, destination)
            )
            best_perm.append(best_route)

        plan_lines = []
        for i, route in enumerate(best_perm):
            if not route:
                continue
            names = " -> ".join(stu.name for stu in route)
            distance = sum(distance_between(route[j].address, route[j + 1].address) for j in range(len(route) - 1))
            distance += distance_between(route[-1].address, destination)
            total_distance += distance
            plan_lines.append(f"Bus {i + 1}: {names} -> {destination} (Distance: {distance:.1f} km)")

        avg_distance = total_distance / num_students if num_students else float('inf')
        plan_str = f"Plan {label} (Average Distance: {avg_distance:.2f} km):\n" + "\n".join(plan_lines)
        route_plans.append((label, best_perm, plan_str, avg_distance))

    if not route_plans:
        return {"routes": [], "destination": destination, "llm_output": "No valid plans found."}

    # Optional LLM prompt (not used in final selection)
    prompt = (
        f"You are an intelligent route planner helping assign students to buses based on a special user request.\n"
        f"The final destination is '{destination}'.\n"
        f"The user request is: '{user_request}'.\n"
        f"Choose the plan (A, B, C, ...) that best satisfies the request while keeping the total travel distance minimal.\n"
        f"The best plan balances the user request with the shortest total travel distance for all buses.\n"
        f"Here are the candidate plans:\n\n"
    ) + "\n\n".join(plan[2] for plan in route_plans)
    llm_output = ask_llm(prompt)

    # Choose the plan with the lowest average distance (not total)
    best_plan = min(route_plans, key=lambda x: x[3])
    selected_label, selected, _, selected_avg = best_plan

    dest_loc = geolocator.geocode(destination)
    if not dest_loc:
        print("Destination geocoding failed")
        return []
    dest_point = {
        "name": destination,
        "lat": dest_loc.latitude,
        "lon": dest_loc.longitude
    }

    final_routes = []
    for group in selected:
        enriched_group = []
        for student in group:
            loc = geolocator.geocode(student.address)
            if not loc:
                continue
            enriched_group.append({
                "id": student.id,
                "name": student.name,
                "address": student.address,
                "lat": loc.latitude,
                "lon": loc.longitude
            })
        final_routes.append(enriched_group)

    return {
        "routes": final_routes,
        "destination": dest_point,
        "selected_plan": selected_label,
        "average_distance": selected_avg,
        "llm_output": llm_output  # included for display but not used
    }

@app.post("/find_fastest/")
async def find_fastest(user_data: TryRoutes):
    res = compute_best_route_with_llm(user_data.Buses, user_data.Locations, user_data.Destination, user_data.Request)
    return {"best_route": res}
