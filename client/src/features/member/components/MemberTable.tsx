import { useState } from "react";
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Avatar,
  Tooltip,
} from "@mui/material";
import {
  Edit,
  Delete,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  Close,
} from "@mui/icons-material";
import type { MemberTableProps, Member } from "../types";

const getInitials = (firstName: string, lastName: string) =>
  `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function MemberTable({
  members,
  onEdit,
  onDelete,
  loading = false,
}: MemberTableProps) {
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    member: Member | null;
  }>({
    open: false,
    member: null,
  });
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (member: Member) => {
    setDeleteDialog({ open: true, member });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.member) return;
    try {
      setDeleting(true);
      await onDelete(deleteDialog.member.id);
      setDeleteDialog({ open: false, member: null });
    } catch (err) {
      console.error("Error deleting member:", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, member: null });
  };

  if (loading && members.length === 0) {
    return (
      <Paper
        sx={{
          p: 4,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid #e2e8f0",
          textAlign: "center",
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="body1" sx={{ mt: 2, color: "text.secondary" }}>
          Loading members...
        </Typography>
      </Paper>
    );
  }

  if (members.length === 0) {
    return (
      <Paper
        sx={{
          p: 4,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid #e2e8f0",
          textAlign: "center",
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Members Found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add your first member using the form above.
        </Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper
        sx={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: 3, borderBottom: "1px solid #e2e8f0" }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: "#1e293b",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            Member List
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f8fafc" }}>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    color: "#1e293b",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  Member
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    color: "#1e293b",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  Contact Info
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    color: "#1e293b",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  Birth Date
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 600,
                    color: "#1e293b",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member, index) => (
                <TableRow
                  key={member.id}
                  sx={{
                    "&:hover": {
                      backgroundColor: "#f8fafc",
                    },
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#fafbfc",
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Avatar sx={{ fontWeight: 600 }}>
                        {getInitials(member.firstName, member.lastName)}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          {member.firstName} {member.middleName}{" "}
                          {member.lastName}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <PhoneIcon sx={{ fontSize: 16, color: "#64748b" }} />
                        <Typography variant="body2">
                          {member.contactNumber}
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <LocationIcon sx={{ fontSize: 16, color: "#64748b" }} />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {member.address}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CalendarIcon sx={{ fontSize: 16, color: "#64748b" }} />
                      <Typography variant="body2">
                        {member.birthDate
                          ? formatDate(member.birthDate)
                          : "N/A"}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box
                      sx={{ display: "flex", justifyContent: "center", gap: 1 }}
                    >
                      <Tooltip title="Edit Member">
                        <IconButton
                          onClick={() => onEdit(member)}
                          size="small"
                          sx={{
                            color: "#3b82f6",
                            "&:hover": {
                              backgroundColor: "#dbeafe",
                            },
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Member">
                        <IconButton
                          onClick={() => handleDeleteClick(member)}
                          size="small"
                          sx={{
                            color: "#ef4444",
                            "&:hover": {
                              backgroundColor: "#fee2e2",
                            },
                          }}
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
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
        aria-labelledby="delete-member-table-title"
      >
        <DialogTitle
          id="delete-member-table-title"
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
            Delete Member
          </Typography>
          <IconButton
            aria-label="Close delete member confirmation"
            onClick={handleDeleteCancel}
            disabled={deleting}
            sx={{ width: 44, height: 44 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
          <DialogContentText>
            Are you sure you want to delete "{deleteDialog.member?.firstName}{" "}
            {deleteDialog.member?.lastName}"? This action cannot be undone.
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
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <Delete />}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
