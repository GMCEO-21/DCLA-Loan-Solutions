import { useState } from "react";
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Avatar,
  IconButton,
  Grid,
  Card,
  CardContent,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import {
  Edit,
  Delete,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  Business as BusinessIcon,
  ReceiptLong as ReceiptLongIcon,
  Savings as SavingsIcon,
  Close,
} from "@mui/icons-material";
import type { MemberCardsProps, Member } from "../types";

const getInitials = (firstName: string, lastName: string) =>
  `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function MemberCards({
  members,
  onEdit,
  onDelete,
  onViewLoan,
  onAddSavings,
  loading = false,
}: MemberCardsProps) {
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    member: Member | null;
  }>({
    open: false,
    member: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    element: HTMLElement | null;
    member: Member | null;
  }>({
    element: null,
    member: null,
  });

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

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    member: Member,
  ) => {
    setMenuAnchor({ element: event.currentTarget, member });
  };

  const handleMenuClose = () => {
    setMenuAnchor({ element: null, member: null });
  };

  const handleEditClick = (member: Member) => {
    handleMenuClose();
    onEdit(member);
  };

  const handleDeleteClick = (member: Member) => {
    handleMenuClose();
    setDeleteDialog({ open: true, member });
  };

  if (loading && members.length === 0) {
    return (
      <Paper
        sx={{
          p: 4,
          bgcolor: "background.paper",
          boxShadow: "none",
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
      <Box
        sx={{
          p: 4,
          textAlign: "center",
        }}
      >
        <PersonIcon sx={{ fontSize: 40, color: "text.secondary", mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Members Found
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Grid container spacing={2}>
        {members.map((member) => (
          <Grid
            item
            xs={12}
            sm={6}
            md={6}
            lg={6}
            key={member.id}
            sx={{ minWidth: 0 }}
          >
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "8px",
                boxShadow: "none",
                position: "relative",
                minWidth: 0,
                overflow: "visible",
                "& .MuiTypography-root": { overflowWrap: "anywhere" },
                "&:hover": {
                  boxShadow: "none",
                },
              }}
            >
              {/* Menu Button */}
              <Tooltip title="Member actions">
                <IconButton
                  aria-label={`Open actions for ${member.firstName} ${member.lastName}`}
                  onClick={(e) => handleMenuOpen(e, member)}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    width: 44,
                    height: 44,
                    color: "#64748b",
                    "&:hover": {
                      backgroundColor: "rgba(0, 0, 0, 0.04)",
                    },
                  }}
                  size="small"
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                {/* Header with Avatar and Name */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    mb: 2.5,
                    pr: 4,
                  }}
                >
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      fontWeight: 600,
                      fontSize: 14,
                      bgcolor: "action.selected",
                      color: "primary.main",
                      mr: 1.5,
                    }}
                  >
                    {getInitials(member.firstName, member.lastName)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "#1e293b",
                        lineHeight: 1.2,
                      }}
                    >
                      {member.lastName}, {member.firstName}
                    </Typography>
                    {member.middleName && (
                      <Typography variant="body2" color="text.secondary">
                        {member.middleName}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Contact Information */}
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
                    <PhoneIcon
                      sx={{
                        fontSize: 18,
                        color: "#64748b",
                        mr: 1.5,
                        minWidth: 18,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#374151",
                        fontWeight: 500,
                        wordBreak: "break-word",
                      }}
                    >
                      {member.contactNumber}
                    </Typography>
                  </Box>

                  <Box
                    sx={{ display: "flex", alignItems: "flex-start", mb: 1.5 }}
                  >
                    <LocationIcon
                      sx={{
                        fontSize: 18,
                        color: "#64748b",
                        mr: 1.5,
                        mt: 0.1,
                        minWidth: 18,
                      }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        wordBreak: "break-word",
                        lineHeight: 1.4,
                      }}
                    >
                      {member.address}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
                    <CalendarIcon
                      sx={{
                        fontSize: 18,
                        color: "#64748b",
                        mr: 1.5,
                        minWidth: 18,
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {member.birthDate ? formatDate(member.birthDate) : "N/A"}
                    </Typography>
                  </Box>

                  {member.center && (
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <BusinessIcon
                        sx={{
                          fontSize: 18,
                          color: "#64748b",
                          mr: 1.5,
                          minWidth: 18,
                        }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {member.center.name}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>

              {/* Action Buttons */}
              <Box
                sx={{
                  mx: 2.5,
                  py: 2,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  {onAddSavings && (
                    <Button
                      variant="outlined"
                      startIcon={<SavingsIcon />}
                      onClick={() => onAddSavings(member)}
                      sx={{
                        flex: "1 1 132px",
                        color: "primary.main",
                        borderColor: "primary.main",
                        minHeight: 44,
                        px: 1.5,
                        fontWeight: 500,
                      }}
                    >
                      Savings
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<ReceiptLongIcon />}
                    onClick={() => onViewLoan?.(member)}
                    sx={{
                      flex: "1 1 132px",
                      color: "primary.main",
                      borderColor: "primary.main",
                      minHeight: 44,
                      px: 1.5,
                      fontWeight: 500,
                    }}
                  >
                    View Loan
                  </Button>
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Member Actions Menu */}
      <Menu
        anchorEl={menuAnchor.element}
        open={Boolean(menuAnchor.element)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 120,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            border: "1px solid #e2e8f0",
          },
        }}
      >
        <MenuItem
          onClick={() => handleEditClick(menuAnchor.member!)}
          sx={{
            py: 1.5,
            "&:hover": {
              backgroundColor: "#dbeafe",
            },
          }}
        >
          <ListItemIcon>
            <Edit fontSize="small" sx={{ color: "#3b82f6" }} />
          </ListItemIcon>
          <ListItemText
            primary="Edit"
            primaryTypographyProps={{
              sx: { fontWeight: 500, color: "#1e293b" },
            }}
          />
        </MenuItem>
        <MenuItem
          onClick={() => handleDeleteClick(menuAnchor.member!)}
          sx={{
            py: 1.5,
            "&:hover": {
              backgroundColor: "#fee2e2",
            },
          }}
        >
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: "#ef4444" }} />
          </ListItemIcon>
          <ListItemText
            primary="Delete"
            primaryTypographyProps={{
              sx: { fontWeight: 500, color: "#1e293b" },
            }}
          />
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
        aria-labelledby="delete-member-card-title"
      >
        <DialogTitle
          id="delete-member-card-title"
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
