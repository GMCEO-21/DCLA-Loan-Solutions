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
import PersonAdd from "@mui/icons-material/PersonAdd";
import Close from "@mui/icons-material/Close";
import Edit from "@mui/icons-material/Edit";
import type { AdminUser, CreateUserPayload, UpdateUserPayload } from "../types";
import { USER_ROLE_OPTIONS } from "../types";

interface UserModalProps {
  open: boolean;
  user?: AdminUser;
  onClose: () => void;
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => Promise<void>;
  loading?: boolean;
}

type UserFormState = {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  role: string;
};

const EMPTY_FORM: UserFormState = {
  email: "",
  firstName: "",
  middleName: "",
  lastName: "",
  role: "",
};

export default function UserModal({
  open,
  user,
  onClose,
  onSubmit,
  loading = false,
}: UserModalProps) {
  const [formData, setFormData] = useState<UserFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<UserFormState>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(user);

  useEffect(() => {
    if (!open) return;
    setFormData(
      user
        ? {
            email: user.email,
            firstName: user.firstName ?? "",
            middleName: user.middleName ?? "",
            lastName: user.lastName ?? "",
            role: user.role ?? "",
          }
        : EMPTY_FORM,
    );
    setErrors({});
    setSubmitError(null);
  }, [open, user]);

  const handleInputChange =
    (field: keyof UserFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((current) => ({ ...current, [field]: event.target.value }));
      if (errors[field]) {
        setErrors((current) => ({ ...current, [field]: undefined }));
      }
      if (submitError) setSubmitError(null);
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<UserFormState> = {};
    if (!formData.email.trim()) nextErrors.email = "Email is required";
    if (!formData.firstName.trim()) {
      nextErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      nextErrors.lastName = "Last name is required";
    }
    if (!formData.role.trim()) nextErrors.role = "Role is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      email: formData.email.trim(),
      firstName: formData.firstName.trim(),
      middleName: formData.middleName.trim() || undefined,
      lastName: formData.lastName.trim(),
      role: formData.role as CreateUserPayload["role"],
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      console.error("Failed to save user:", err);
      setSubmitError("Failed to save user. Please try again.");
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
      aria-labelledby="user-dialog-title"
      PaperProps={{ sx: { bgcolor: "background.paper" } }}
    >
      <DialogTitle
        id="user-dialog-title"
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
            <PersonAdd fontSize="small" />
          )}
          <Typography component="span" variant="h5">
            {isEditing ? "Edit User" : "Add User"}
          </Typography>
        </Box>
        <IconButton
          aria-label="Close user form"
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
        <form id="user-form" onSubmit={handleSubmit}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                required
                autoComplete="email"
                label="Email"
                value={formData.email}
                onChange={handleInputChange("email")}
                error={Boolean(errors.email)}
                helperText={errors.email}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                select
                label="Role"
                value={formData.role}
                onChange={handleInputChange("role")}
                error={Boolean(errors.role)}
                helperText={errors.role}
                disabled={loading}
              >
                {USER_ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                required
                autoComplete="given-name"
                label="First Name"
                value={formData.firstName}
                onChange={handleInputChange("firstName")}
                error={Boolean(errors.firstName)}
                helperText={errors.firstName}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                autoComplete="additional-name"
                label="Middle Name"
                value={formData.middleName}
                onChange={handleInputChange("middleName")}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={12} md={4}>
              <TextField
                fullWidth
                required
                autoComplete="family-name"
                label="Last Name"
                value={formData.lastName}
                onChange={handleInputChange("lastName")}
                error={Boolean(errors.lastName)}
                helperText={errors.lastName}
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
          form="user-form"
          variant="contained"
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : isEditing ? (
              <Edit />
            ) : (
              <PersonAdd />
            )
          }
        >
          {loading ? "Saving..." : isEditing ? "Update User" : "Create User"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
