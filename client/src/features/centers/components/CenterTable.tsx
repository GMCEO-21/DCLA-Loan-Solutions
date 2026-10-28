import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import CalendarToday from "@mui/icons-material/CalendarToday";
import Close from "@mui/icons-material/Close";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import LocationOn from "@mui/icons-material/LocationOn";
import type { Center, CenterTableProps } from "../types";

export default function CenterTable({
  centers,
  onEdit,
  onDelete,
  loading = false,
}: CenterTableProps) {
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    center: Center | null;
  }>({ open: false, center: null });
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.center) return;

    try {
      setDeleting(true);
      await onDelete(deleteDialog.center.id);
      setDeleteDialog({ open: false, center: null });
    } catch (err) {
      console.error("Error deleting center:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, center: null });
  };

  if (loading && centers.length === 0) {
    return (
      <Box
        role="status"
        sx={{ py: 8, px: 2, textAlign: "center", color: "text.secondary" }}
      >
        <CircularProgress size={32} />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading centers...
        </Typography>
      </Box>
    );
  }

  if (centers.length === 0) {
    return (
      <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
        <Typography variant="h6">No centers found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          No center records match the current view.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
        <Table sx={{ minWidth: 760 }} aria-label="Centers">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              <TableCell>Center name</TableCell>
              <TableCell>Collection day</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Center leader</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {centers.map((center) => (
              <TableRow
                key={center.id}
                hover
                sx={{
                  "&:last-child td": { borderBottom: 0 },
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <TableCell sx={{ minWidth: 180 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: "text.primary" }}
                  >
                    {center.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={<CalendarToday />}
                    label={center.collectionDay}
                    size="small"
                    variant="outlined"
                    sx={{
                      color: "text.primary",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      "& .MuiChip-icon": { color: "primary.main" },
                    }}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  {center.address ? (
                    <Box
                      sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
                    >
                      <LocationOn
                        sx={{ mt: 0.25, fontSize: 18, color: "text.secondary" }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {center.address}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      Not provided
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  <Typography variant="body2" color="text.secondary">
                    {center.leader || "Not assigned"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Tooltip title="Edit center">
                      <IconButton
                        aria-label={`Edit ${center.name}`}
                        onClick={() => onEdit(center)}
                        sx={{ width: 44, height: 44, color: "primary.main" }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete center">
                      <IconButton
                        aria-label={`Delete ${center.name}`}
                        onClick={() => setDeleteDialog({ open: true, center })}
                        sx={{ width: 44, height: 44, color: "error.main" }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
        aria-labelledby="delete-center-title"
      >
        <DialogTitle
          id="delete-center-title"
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
          <Typography component="span" variant="h5">
            Delete center
          </Typography>
          <IconButton
            aria-label="Close delete center confirmation"
            onClick={handleDeleteCancel}
            disabled={deleting}
            sx={{ width: 44, height: 44 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
          <DialogContentText>
            Delete <strong>{deleteDialog.center?.name}</strong>? This action
            cannot be undone.
          </DialogContentText>
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
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleDeleteConfirm()}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={
              deleting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Delete />
              )
            }
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
