import type React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  Box,
  Typography,
} from "@mui/material";
import { Edit, Cancel, Close, Person, LocationOn } from "@mui/icons-material";
import type { Collection } from "../types";

interface CollectionUpdateModalProps {
  open: boolean;
  collection?: Collection;
  onClose: () => void;
  onSubmit: (
    id: string,
    data: { paymentReceived: number; notes?: string },
  ) => Promise<void>;
  loading?: boolean;
}

export default function CollectionUpdateModal({
  open,
  collection,
  onClose,
  onSubmit,
  loading = false,
}: CollectionUpdateModalProps) {
  const [formData, setFormData] = useState({
    paymentReceived: 0,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && collection) {
      setFormData({
        paymentReceived: collection.paymentReceived,
        notes: collection.notes || "",
      });
      setError(null);
    }
  }, [open, collection]);

  const handleInputChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]:
          field === "paymentReceived"
            ? Number.parseFloat(e.target.value) || 0
            : e.target.value,
      }));

      if (error) {
        setError(null);
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!collection) return;

    if (formData.paymentReceived < 0) {
      setError("Payment received cannot be negative");
      return;
    }

    if (formData.paymentReceived > collection.amount) {
      setError("Payment received cannot exceed the collection amount");
      return;
    }

    try {
      await onSubmit(collection.id, formData);
      onClose();
    } catch (err) {
      console.error("Failed to update collection:", err);
      setError("Failed to update collection. Please try again.");
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const balance = collection ? collection.amount - formData.paymentReceived : 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      scroll="paper"
      aria-labelledby="collection-update-title"
      PaperProps={{
        sx: {
          width: "calc(100% - 32px)",
          maxWidth: 720,
          borderRadius: 2,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        id="collection-update-title"
        sx={{
          fontWeight: 600,
          color: "#1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          p: { xs: 2, sm: 2.5 },
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Edit />
          Update Collection
        </Box>
        <IconButton
          aria-label="Close collection update"
          onClick={handleClose}
          disabled={loading}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      {collection && (
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ p: { xs: 2, sm: 2.5 }, overflowY: "auto" }}>
            {/* Collection Info */}
            <Box
              sx={{
                p: 3,
                mb: 3,
                backgroundColor: "action.hover",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Person sx={{ color: "#64748b", fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      Member
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {collection.member?.firstName} {collection.member?.lastName}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <LocationOn sx={{ color: "#64748b", fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      Center
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {collection.center?.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">
                    Collection Amount
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: "#1e3a8a" }}
                  >
                    ₱{collection.amount.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {collection.collectionDate}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Payment Received"
                  type="number"
                  value={formData.paymentReceived}
                  onChange={handleInputChange("paymentReceived")}
                  disabled={loading}
                  inputProps={{
                    inputMode: "numeric",
                    pattern: "[0-9]*",
                    min: 0,
                    max: collection.amount,
                    step: 0.01,
                  }}
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
                  label="Balance"
                  value={`₱${balance.toLocaleString()}`}
                  disabled
                  sx={{
                    "& .MuiInputLabel-root": {
                      fontWeight: 500,
                    },
                    "& .MuiInputBase-input": {
                      color: balance === 0 ? "#10b981" : "#ef4444",
                      fontWeight: 600,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={handleInputChange("notes")}
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
            </Grid>
          </DialogContent>

          <DialogActions
            sx={{
              p: { xs: 2, sm: 2.5 },
              gap: 1,
              flexDirection: { xs: "column-reverse", sm: "row" },
              borderTop: "1px solid",
              borderColor: "divider",
              "& > :not(style) ~ :not(style)": { ml: 0 },
            }}
          >
            <Button
              onClick={handleClose}
              disabled={loading}
              startIcon={<Cancel />}
              sx={{
                minHeight: 44,
                width: { xs: "100%", sm: "auto" },
              }}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={
                loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <Edit />
                )
              }
              sx={{
                minWidth: 140,
                minHeight: 44,
                width: { xs: "100%", sm: "auto" },
              }}
            >
              {loading ? "Updating..." : "Update Collection"}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
