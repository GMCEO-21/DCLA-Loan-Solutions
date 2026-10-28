import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import AddLocationAlt from "@mui/icons-material/AddLocationAlt";
import Search from "@mui/icons-material/Search";
import PageHeader from "@components/common/PageHeader";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import DashboardLayout from "@components/layout/PrivateLayout";
import { getApiErrorMessage } from "@utils/apiError";
import CenterLoadingSkeleton from "../components/CenterLoadingSkeleton";
import CenterModal from "../components/CenterModal";
import CenterTable from "../components/CenterTable";
import { useCenters } from "../hooks/useCenters";
import type { Center, CenterFormData } from "../types";

export default function CentersPage() {
  const {
    centers,
    total,
    page,
    limit,
    setPage,
    setLimit,
    search,
    setSearch,
    loading,
    error,
    createCenter,
    updateCenter,
    deleteCenter,
    refetch,
  } = useCenters();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<Center>();
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const showSnackbar = (
    message: string,
    severity: "success" | "error" = "success",
  ) => setSnackbar({ open: true, message, severity });

  const handleOpenModal = () => {
    setEditingCenter(undefined);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCenter(undefined);
  };

  const handleFormSubmit = async (data: CenterFormData) => {
    try {
      if (editingCenter) {
        await updateCenter(editingCenter.id, data);
        showSnackbar("Center updated successfully!");
      } else {
        await createCenter(data);
        showSnackbar("Center created successfully!");
      }
    } catch (err) {
      console.error("Failed to save center:", err);
      showSnackbar(getApiErrorMessage(err), "error");
      throw err;
    }
  };

  const handleEdit = (center: Center) => {
    setEditingCenter(center);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCenter(id);
      showSnackbar("Center deleted successfully!");
    } catch (err) {
      console.error("Failed to delete center:", err);
      showSnackbar(getApiErrorMessage(err), "error");
      throw err;
    }
  };

  if (loading && centers.length === 0) {
    return (
      <DashboardLayout>
        <CenterLoadingSkeleton rowCount={limit} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
        <PageHeader
          title="Centers"
          description="Manage lending centers and their records."
          actions={
            <Button
              variant="contained"
              startIcon={<AddLocationAlt />}
              onClick={handleOpenModal}
            >
              Add Center
            </Button>
          }
        />

        <Box
          role="group"
          aria-label="Center filters"
          sx={{
            display: "flex",
            alignItems: "stretch",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 3,
            pb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
            minWidth: 0,
          }}
        >
          <TextField
            size="small"
            label="Search centers"
            placeholder="Search by center name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: 0,
              flex: 1,
              maxWidth: { sm: 480 },
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          />

          <FormControl
            size="small"
            sx={{
              width: { xs: "100%", sm: 160 },
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          >
            <InputLabel id="center-page-size-label">Rows per page</InputLabel>
            <Select
              labelId="center-page-size-label"
              value={limit}
              label="Rows per page"
              onChange={(event) => {
                setPage(1);
                setLimit(Number(event.target.value));
              }}
            >
              {[3, 10, 25, 50].map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {error && (
          <RequestErrorAlert message={error} onRetry={() => refetch()} />
        )}

        <Paper
          elevation={0}
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              py: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6">Centers list</Typography>
          </Box>

          <CenterTable
            centers={centers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={loading}
          />

          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              px: 2,
              py: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              overflowX: "auto",
            }}
          >
            <Pagination
              count={Math.ceil(total / limit) || 1}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              sx={{
                "& .MuiPagination-ul": { justifyContent: "center", rowGap: 1 },
                "& .MuiPaginationItem-root": { minHeight: 44 },
              }}
            />
          </Box>
        </Paper>

        <CenterModal
          open={modalOpen}
          center={editingCenter}
          onClose={handleCloseModal}
          onSubmit={handleFormSubmit}
          loading={loading}
        />

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() =>
            setSnackbar((current) => ({ ...current, open: false }))
          }
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() =>
              setSnackbar((current) => ({ ...current, open: false }))
            }
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
