import type React from "react";
import { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import { Add, Edit, Cancel } from "@mui/icons-material";
import type { CenterFormProps, CenterFormData } from "../types";

const COLLECTION_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function CenterForm({
  center,
  onSubmit,
  onCancel,
  loading = false,
}: CenterFormProps) {
  const [formData, setFormData] = useState<CenterFormData>({
    name: "",
    collectionDay: "",
    address: "",
  });
  const [errors, setErrors] = useState<Partial<CenterFormData>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = Boolean(center);

  useEffect(() => {
    if (center) {
      setFormData({
        name: center.name,
        collectionDay: center.collectionDay,
        address: center.address || "",
      });
    } else {
      setFormData({
        name: "",
        collectionDay: "",
        address: "",
      });
    }
    setErrors({});
    setSubmitError(null);
  }, [center]);

  const validateForm = (): boolean => {
    const newErrors: Partial<CenterFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Center name is required";
    }

    if (!formData.collectionDay.trim()) {
      newErrors.collectionDay = "Collection day is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange =
    (field: keyof CenterFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }

      if (submitError) {
        setSubmitError(null);
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await onSubmit(formData);
      if (!isEditing) {
        setFormData({
          name: "",
          collectionDay: "",
          address: "",
        });
      }
    } catch (err) {
      console.error("Failed to save center:", err);
      setSubmitError("Failed to save center. Please try again.");
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      collectionDay: "",
      address: "",
    });
    setErrors({});
    setSubmitError(null);
    onCancel?.();
  };

  return (
    <Paper
      sx={{
        p: 4,
        mb: 4,
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid #e2e8f0",
      }}
    >
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          fontWeight: 600,
          color: "#1e293b",
          mb: 3,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {isEditing ? <Edit /> : <Add />}
        {isEditing ? "Edit Center" : "Add New Center"}
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {submitError}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Center Name"
              value={formData.name}
              onChange={handleInputChange("name")}
              error={Boolean(errors.name)}
              helperText={errors.name}
              disabled={loading}
              required
              sx={{
                "& .MuiInputLabel-root": {
                  fontWeight: 500,
                },
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Collection Day"
              value={formData.collectionDay}
              onChange={handleInputChange("collectionDay")}
              error={Boolean(errors.collectionDay)}
              helperText={errors.collectionDay}
              disabled={loading}
              required
              sx={{
                "& .MuiInputLabel-root": {
                  fontWeight: 500,
                },
              }}
            >
              {COLLECTION_DAYS.map((day) => (
                <MenuItem key={day} value={day}>
                  {day}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={handleInputChange("address")}
              error={Boolean(errors.address)}
              helperText={errors.address}
              disabled={loading}
              multiline
              rows={3}
              sx={{
                "& .MuiInputLabel-root": {
                  fontWeight: 500,
                },
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              {isEditing && (
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  disabled={loading}
                  startIcon={<Cancel />}
                  sx={{
                    borderColor: "#64748b",
                    color: "#64748b",
                    "&:hover": {
                      borderColor: "#475569",
                      backgroundColor: "#f8fafc",
                    },
                  }}
                >
                  Cancel
                </Button>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : isEditing ? (
                    <Edit />
                  ) : (
                    <Add />
                  )
                }
                sx={{
                  minWidth: 140,
                  background:
                    "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                  },
                }}
              >
                {loading
                  ? "Saving..."
                  : isEditing
                  ? "Update Center"
                  : "Create Center"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
