import type React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { Add, Edit, Cancel } from "@mui/icons-material";
import type { MemberFormData, MemberFormProps } from "../types";
import type { Center } from "@features/centers/types";
import { CentersAPI } from "@features/centers/api";

export default function MemberForm({
  member,
  onSubmit,
  onCancel,
  loading = false,
}: MemberFormProps) {
  const [formData, setFormData] = useState<MemberFormData>({
    firstName: "",
    lastName: "",
    middleName: "",
    contactNumber: "",
    address: "",
    birthDate: null,
    centerId: "",
  });

  const [errors, setErrors] = useState<Partial<MemberFormData>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [loadingMoreCenters, setLoadingMoreCenters] = useState(false);
  const [centersPage, setCentersPage] = useState(1);
  const [centersTotalPages, setCentersTotalPages] = useState(1);
  const [centerInput, setCenterInput] = useState("");
  const [centerQuery, setCenterQuery] = useState("");
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const centerRequestControllerRef = useRef<AbortController | null>(null);

  const isEditing = Boolean(member);

  const mergeCenters = (
    existing: Center[],
    items: Center[],
    append: boolean,
    selected: Center | null,
  ) => {
    const merged = append ? [...existing] : [];
    items.forEach((center) => {
      if (!merged.some((existing) => existing.id === center.id)) {
        merged.push(center);
      }
    });
    if (selected && !merged.some((existing) => existing.id === selected.id)) {
      merged.unshift(selected);
    }
    return merged;
  };

  useEffect(() => {
    const controller = new AbortController();
    centerRequestControllerRef.current?.abort();
    centerRequestControllerRef.current = controller;

    const loadCenters = async (
      page: number,
      search: string,
      append = false,
    ) => {
      try {
        if (append) {
          setLoadingMoreCenters(true);
        } else {
          setLoadingCenters(true);
        }
        const centersData = await CentersAPI.getAll(
          { page, limit: 20, search },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const items = Array.isArray(centersData)
          ? centersData
          : (centersData.items ?? []);
        const totalPages = Array.isArray(centersData)
          ? 1
          : (centersData.totalPages ?? 1);
        setCentersTotalPages(totalPages);
        setCenters((prev) => mergeCenters(prev, items, append, selectedCenter));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load centers:", error);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCenters(false);
          setLoadingMoreCenters(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      setCentersPage(1);
      loadCenters(1, centerQuery, false);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [centerQuery, selectedCenter]);

  useEffect(() => {
    if (member) {
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        middleName: member.middleName || "",
        contactNumber: member.contactNumber || "",
        address: member.address || "",
        birthDate: member.birthDate ? new Date(member.birthDate) : null,
        centerId: member.center?.id || "",
      });
      setSelectedCenter(member.center ?? null);
      setCenterInput(member.center?.name ?? "");
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        middleName: "",
        contactNumber: "",
        address: "",
        birthDate: null,
        centerId: "",
      });
      setSelectedCenter(null);
      setCenterInput("");
    }
    setErrors({});
    setSubmitError(null);
  }, [member]);

  useEffect(() => {
    if (!selectedCenter) return;
    setCenters((prev) => mergeCenters(prev, [], true, selectedCenter));
  }, [selectedCenter]);

  //   const validateForm = (): boolean => {
  //     const newErrors: Partial<MemberFormData> = {};

  //     if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
  //     if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
  //     if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required";
  //     if (!formData.address.trim()) newErrors.address = "Address is required";
  //     if (!formData.birthDate) newErrors.birthDate = "Birth date is required";

  //     setErrors(newErrors);
  //     return Object.keys(newErrors).length === 0;
  //   };

  type MemberTextField = Exclude<keyof MemberFormData, "birthDate">;

  const handleInputChange =
    (field: MemberTextField) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

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

  const handleCenterChange = (
    _: React.SyntheticEvent,
    value: Center | null,
  ) => {
    setSelectedCenter(value);
    setCenterInput(value?.name ?? "");
    setFormData((prev) => ({
      ...prev,
      centerId: value?.id || "",
    }));

    if (errors.centerId) {
      setErrors((prev) => ({
        ...prev,
        centerId: undefined,
      }));
    }

    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleCenterScroll = (event: React.UIEvent<HTMLUListElement>) => {
    const listboxNode = event.currentTarget;
    const nearBottom =
      listboxNode.scrollTop + listboxNode.clientHeight >=
      listboxNode.scrollHeight - 32;

    if (
      nearBottom &&
      !loadingCenters &&
      !loadingMoreCenters &&
      centersPage < centersTotalPages
    ) {
      const nextPage = centersPage + 1;
      const controller = new AbortController();
      centerRequestControllerRef.current?.abort();
      centerRequestControllerRef.current = controller;
      setLoadingMoreCenters(true);
      setCentersPage(nextPage);
      CentersAPI.getAll(
        { page: nextPage, limit: 20, search: centerQuery },
        controller.signal,
      )
        .then((centersData) => {
          if (controller.signal.aborted) return;
          const items = Array.isArray(centersData)
            ? centersData
            : (centersData.items ?? []);
          const totalPages = Array.isArray(centersData)
            ? 1
            : (centersData.totalPages ?? 1);
          setCentersTotalPages(totalPages);
          setCenters((prev) => mergeCenters(prev, items, true, selectedCenter));
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error("Failed to load more centers:", error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingMoreCenters(false);
        });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // if (!validateForm()) return;

    try {
      await onSubmit(formData);
      if (!isEditing) {
        setFormData({
          firstName: "",
          lastName: "",
          middleName: "",
          contactNumber: "",
          address: "",
          birthDate: null,
        });
      }
    } catch (err) {
      console.error("Failed to save member:", err);
      setSubmitError("Failed to save member. Please try again.");
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: "",
      lastName: "",
      middleName: "",
      contactNumber: "",
      address: "",
      birthDate: null,
      centerId: "",
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
        {isEditing ? "Edit Member" : "Add New Member"}
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
              label="First Name"
              value={formData.firstName}
              onChange={handleInputChange("firstName")}
              error={Boolean(errors.firstName)}
              helperText={errors.firstName}
              disabled={loading}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.lastName}
              onChange={handleInputChange("lastName")}
              error={Boolean(errors.lastName)}
              helperText={errors.lastName}
              disabled={loading}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Middle Name"
              value={formData.middleName}
              onChange={handleInputChange("middleName")}
              error={Boolean(errors.middleName)}
              helperText={errors.middleName}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Contact Number"
              value={formData.contactNumber}
              onChange={handleInputChange("contactNumber")}
              error={Boolean(errors.contactNumber)}
              helperText={errors.contactNumber}
              disabled={loading}
              required
            />
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
              rows={2}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Birth Date"
                value={formData.birthDate}
                onChange={(newValue) => {
                  setFormData((prev) => ({ ...prev, birthDate: newValue }));
                  if (errors.birthDate) {
                    setErrors((prev) => ({ ...prev, birthDate: undefined }));
                  }
                }}
                maxDate={new Date()} // Cannot be in the future
                minDate={new Date(new Date().getFullYear() - 100, 0, 1)} // Max 100 years ago
                disabled={loading}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: Boolean(errors.birthDate),
                    helperText:
                      typeof errors.birthDate === "string"
                        ? errors.birthDate
                        : "",
                  },
                }}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12}>
            <Autocomplete
              options={centers}
              value={selectedCenter}
              loading={loadingCenters || loadingMoreCenters}
              onChange={handleCenterChange}
              inputValue={centerInput}
              onInputChange={(_, value, reason) => {
                setCenterInput(value);
                if (reason === "input") {
                  setCenterQuery(value);
                }
                if (reason === "clear") {
                  setCenterQuery("");
                }
              }}
              filterOptions={(options) => options}
              getOptionLabel={(option) => option.name || ""}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText={
                centerInput ? "No centers found" : "No centers available"
              }
              ListboxProps={{
                onScroll: handleCenterScroll,
                style: { maxHeight: 240, overflow: "auto" },
              }}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Center"
                  error={Boolean(errors.centerId)}
                  helperText={errors.centerId}
                />
              )}
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
                    ? "Update Member"
                    : "Create Member"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}
