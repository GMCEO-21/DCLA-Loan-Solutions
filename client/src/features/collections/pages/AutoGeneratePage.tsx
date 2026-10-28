import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
} from "@mui/material";
import collectionsService from "../api";

export default function AutoGeneratePage() {
  const [centerId, setCenterId] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const centers = [
    { id: "1", name: "Center A", day: "Monday" },
    { id: "2", name: "Center B", day: "Tuesday" },
    { id: "3", name: "Center C", day: "Wednesday" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!centerId || !date) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await collectionsService.autoGenerateCollections({ centerId, date });
      setSuccess("Collections generated successfully!");
      setCenterId("");
      setDate("");
    } catch (err) {
      console.error("Failed to auto-generate collections:", err);
      setError("Failed to generate collections");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Auto-Generate Collections
      </Typography>

      <Card sx={{ maxWidth: 600 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <TextField
              select
              fullWidth
              label="Center"
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              sx={{ mb: 2 }}
              required
            >
              {centers.map((center) => (
                <MenuItem key={center.id} value={center.id}>
                  {center.name} ({center.day})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Collection Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              sx={{ mb: 3 }}
              required
              InputLabelProps={{ shrink: true }}
            />

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ minWidth: 200 }}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                "Generate Collections"
              )}
            </Button>
          </form>

          {error && (
            <Alert
              severity="error"
              sx={{ mt: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              sx={{ mt: 2 }}
              onClose={() => setSuccess(null)}
            >
              {success}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
