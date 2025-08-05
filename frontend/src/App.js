import React, { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Box,
  Button,
  Container,
  Grid,
  TextField,
  Typography,
  Paper,
  CircularProgress,
} from "@mui/material";

import CheckIcon from "@mui/icons-material/Check";
import SendIcon from "@mui/icons-material/Send";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function App() {
  const [locations, setLocations] = useState([]);
  const [buses, setBuses] = useState([{ id: 1, capacity: 1, count: 1 }]);
  const [destination, setDestination] = useState("");
  const [bestRoute, setBestRoute] = useState(null);
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateNewStudent = () => {
    setLocations((prev) => [
      ...prev,
      { id: prev.length + 1, name: "Student", address: "" },
    ]);
  };

  const handleAddBusType = () => {
    setBuses((prev) => [
      ...prev,
      { id: prev.length + 1, capacity: 1, count: 1 },
    ]);
  };

  const handleSubmit = async () => {
    const expandedBuses = buses.flatMap((bus) =>
      Array.from({ length: bus.count }, (_, idx) => ({
        id: `${bus.id}-${idx + 1}`,
        capacity: bus.capacity,
      }))
    );

    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/find_fastest/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Locations: locations,
          Buses: expandedBuses,
          Destination: destination,
          Request: request,
        }),
      });
      const data = await response.json();
      setBestRoute(data.best_route);
    } catch (err) {
      console.error("Error computing best route:", err);
    }
    setLoading(false);
  };

  const colors = ["red", "blue", "green", "orange", "purple", "brown"];

  return (
    <Container
      sx={{
        py: 4,
        // background: "#62b175ff",
      }}
    >
      <Typography
        variant="h3"
        gutterBottom
        textAlign="center"
      >
        NEED FOR SPEED
      </Typography>

      <Grid
        container
        spacing={4}
      >
        <Grid
          item
          xs={12}
          md={4}
        >
          <Paper
            elevation={3}
            sx={{ p: 3 }}
          >
            <Typography
              variant="h6"
              gutterBottom
            >
              Students
            </Typography>
            {locations.map((loc, i) => (
              <Box
                key={i}
                display="flex"
                gap={1}
                mb={2}
              >
                <TextField
                  label="Name"
                  value={loc.name}
                  fullWidth
                  onChange={(e) => {
                    const updated = [...locations];
                    updated[i].name = e.target.value;
                    setLocations(updated);
                  }}
                />
                <TextField
                  label="Address"
                  value={loc.address}
                  fullWidth
                  onChange={(e) => {
                    const updated = [...locations];
                    updated[i].address = e.target.value;
                    setLocations(updated);
                  }}
                />
              </Box>
            ))}
            <Button
              onClick={handleCreateNewStudent}
              variant="contained"
              color="primary"
            >
              + Add Student
            </Button>
          </Paper>
        </Grid>

        <Grid
          item
          xs={12}
          md={4}
        >
          <Paper
            elevation={3}
            sx={{ p: 3 }}
          >
            <Typography
              variant="h6"
              gutterBottom
            >
              Bus Types
            </Typography>
            {buses.map((bus, i) => (
              <Box
                key={i}
                display="flex"
                gap={1}
                alignItems="center"
                mb={2}
              >
                <TextField
                  label={`Bus ${i + 1} Capacity`}
                  type="number"
                  value={bus.capacity}
                  onChange={(e) => {
                    const updated = [...buses];
                    updated[i].capacity = parseInt(e.target.value) || 0;
                    setBuses(updated);
                  }}
                />
                <TextField
                  label="Count"
                  type="number"
                  value={bus.count}
                  onChange={(e) => {
                    const updated = [...buses];
                    updated[i].count = parseInt(e.target.value) || 0;
                    setBuses(updated);
                  }}
                />
              </Box>
            ))}
            <Button
              onClick={handleAddBusType}
              variant="contained"
              color="secondary"
            >
              + Add Bus Type
            </Button>
          </Paper>
        </Grid>

        <Grid
          item
          xs={12}
          md={4}
        >
          <Paper
            elevation={3}
            sx={{ p: 3 }}
          >
            <Typography
              variant="h6"
              gutterBottom
            >
              Destination
            </Typography>
            <TextField
              fullWidth
              label="Enter destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />

            <Box mt={3}>
              <Typography
                variant="h6"
                gutterBottom
              >
                Special Request
              </Typography>
              <TextField
                multiline
                minRows={3}
                fullWidth
                label="Describe your special request to the AI"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Box
        textAlign="center"
        my={4}
      >
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="success"
          size="large"
          startIcon={
            loading ? (
              <CircularProgress
                size={20}
                color="inherit"
              />
            ) : (
              <SendIcon />
            )
          }
          disabled={loading}
        >
          {loading ? "Computing..." : "Compute"}
        </Button>
      </Box>

      {bestRoute && (
        <Box mt={6}>
          <Typography
            variant="h5"
            gutterBottom
          >
            Best Routes
          </Typography>

          {bestRoute.routes.map((busRoute, i) => (
            <Paper
              key={i}
              elevation={2}
              sx={{ p: 2, mb: 3 }}
            >
              <Typography variant="subtitle1">Bus {i + 1}</Typography>
              <ul>
                {busRoute.map((student, idx) => (
                  <li key={idx}>
                    {student.name} - {student.address}
                  </li>
                ))}
              </ul>
            </Paper>
          ))}

          <MapContainer
            center={[12.97, 77.59]}
            zoom={5}
            style={{ height: "500px", marginTop: "2rem" }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {bestRoute.routes.map((busRoute, i) => {
              const routeColor = colors[i % colors.length];
              const positions = busRoute.map((s) => [s.lat, s.lon]);
              const allPositions = [
                ...positions,
                [bestRoute.destination.lat, bestRoute.destination.lon],
              ];

              return (
                <React.Fragment key={i}>
                  {busRoute.map((student, idx) => (
                    <Marker
                      key={`${i}-${idx}`}
                      position={[student.lat, student.lon]}
                      icon={L.divIcon({
                        className: "custom-div-icon",
                        html: `<div style="background-color:${routeColor};width:12px;height:12px;border-radius:50%"></div>`,
                      })}
                    >
                      <Popup>
                        {student.name} ({student.address})
                      </Popup>
                    </Marker>
                  ))}

                  <Polyline
                    positions={allPositions}
                    color={routeColor}
                  />
                </React.Fragment>
              );
            })}

            {bestRoute.destination && (
              <Marker
                position={[
                  bestRoute.destination.lat,
                  bestRoute.destination.lon,
                ]}
                icon={L.divIcon({
                  className: "custom-div-icon",
                  html: `<div style="background-color:black;width:14px;height:14px;border-radius:50%"></div>`,
                })}
              >
                <Popup>Destination: {bestRoute.destination.name}</Popup>
              </Marker>
            )}
          </MapContainer>

          {bestRoute.llm_output && (
            <Paper
              elevation={3}
              sx={{ p: 3, mt: 4 }}
            >
              <Typography
                variant="h6"
                gutterBottom
              >
                LLM Output
              </Typography>
              <Typography
                variant="body1"
                sx={{ whiteSpace: "pre-wrap" }}
              >
                {bestRoute.llm_output}
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Container>
  );
}

export default App;
