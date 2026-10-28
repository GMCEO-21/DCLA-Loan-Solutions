import type React from "react";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import AddLocationAlt from "@mui/icons-material/AddLocationAlt";
import Close from "@mui/icons-material/Close";
import Edit from "@mui/icons-material/Edit";
import type { Center, CenterFormData } from "../types";

interface CenterModalProps {
  open: boolean;
  center?: Center;
  onClose: () => void;
  onSubmit: (data: CenterFormData) => Promise<void>;
  loading?: boolean;
}

const COLLECTION_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const EMPTY_FORM: CenterFormData = {
  name: "",
  collectionDay: "",
  address: "",
  leader: "",
};

export default function CenterModal({
  open,
  center,
  onClose,
  onSubmit,
  loading = false,
}: CenterModalProps) {
  const [formData, setFormData] = useState<CenterFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<CenterFormData>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(center);

  useEffect(() => {
    if (!open) return;

    setFormData(
      center
        ? {
            name: center.name,
            collectionDay: center.collectionDay,
            address: center.address || "",
            leader: center.leader || "",
          }
        : EMPTY_FORM,
    );
    setErrors({});
    setSubmitError(null);
  }, [open, center]);

  const handleInputChange =
    (field: keyof CenterFormData) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((current) => ({
        ...current,
        [field]: event.target.value,
      }));
      if (errors[field]) {
        setErrors((current) => ({ ...current, [field]: undefined }));
      }
      if (submitError) setSubmitError(null);
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<CenterFormData> = {};
    if (!formData.name.trim()) nextErrors.name = "Center name is required";
    if (!formData.collectionDay.trim()) {
      nextErrors.collectionDay = "Collection day is required";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      console.error("Failed to save center:", err);
      setSubmitError("Failed to save center. Please try again.");
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      aria-labelledby="center-dialog-title"
      PaperProps={{ sx: { bgcolor: "background.paper" } }}
    >
      <DialogTitle
        id="center-dialog-title"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isEditing ? (
            <Edit fontSize="small" />
          ) : (
            <AddLocationAlt fontSize="small" />
          )}
          <Typography component="span" variant="h5">
            {isEditing ? "Edit Center" : "Add Center"}
          </Typography>
        </Box>
        <IconButton
          aria-label="Close center form"
          onClick={handleClose}
          disabled={loading}
          sx={{ width: 44, height: 44 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          px: { xs: 2, sm: 3 },
          py: 3,
          overflowY: "auto",
          "&:first-of-type": { pt: 3 },
        }}
      >
        <form id="center-form" onSubmit={handleSubmit}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Center Name"
                value={formData.name}
                onChange={handleInputChange("name")}
                error={Boolean(errors.name)}
                helperText={errors.name}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Center Leader"
                value={formData.leader}
                onChange={handleInputChange("leader")}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                select
                label="Collection Day"
                value={formData.collectionDay}
                onChange={handleInputChange("collectionDay")}
                error={Boolean(errors.collectionDay)}
                helperText={errors.collectionDay}
                disabled={loading}
              >
                {COLLECTION_DAYS.map((day) => (
                  <MenuItem key={day} value={day}>
                    {day}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Address"
                value={formData.address}
                onChange={handleInputChange("address")}
                error={Boolean(errors.address)}
                helperText={errors.address}
                disabled={loading}
              />
            </Grid>
          </Grid>
        </form>
      </DialogContent>

      <DialogActions
        sx={{
          flexDirection: { xs: "column-reverse", sm: "row" },
          alignItems: "stretch",
          px: { xs: 2, sm: 3 },
          py: 2,
          gap: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          "& > .MuiButton-root": { width: { xs: "100%", sm: "auto" } },
        }}
      >
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="center-form"
          variant="contained"
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : isEditing ? (
              <Edit />
            ) : (
              <AddLocationAlt />
            )
          }
        >
          {loading
            ? "Saving..."
            : isEditing
              ? "Update Center"
              : "Create Center"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
