import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import PersonAdd from "@mui/icons-material/PersonAdd";
import Close from "@mui/icons-material/Close";
import Search from "@mui/icons-material/Search";
import PageHeader from "@components/common/PageHeader";
import PageLoadingSkeleton from "@components/common/PageLoadingSkeleton";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import DashboardLayout from "@components/layout/PrivateLayout";
import { useAuthStore } from "@features/auth/authStore";
import TempPasswordDialog from "../components/TempPasswordDialog";
import UserModal from "../components/UserModal";
import UserTable from "../components/UserTable";
import { useUsers } from "../hooks/useUsers";
import type { AdminUser, CreateUserPayload, UpdateUserPayload } from "../types";

type PasswordDialogState = { open: boolean; title: string; password: string };
type StatusDialogState = {
  open: boolean;
  user: AdminUser | null;
  nextActive: boolean;
};
type ResetDialogState = { open: boolean; user: AdminUser | null };

const dialogTitleSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  px: { xs: 2, sm: 3 },
  py: 2,
  borderBottom: "1px solid",
  borderColor: "divider",
};

const dialogActionsSx = {
  flexDirection: { xs: "column-reverse", sm: "row" },
  alignItems: "stretch",
  px: { xs: 2, sm: 3 },
  py: 2,
  gap: 1,
  borderTop: "1px solid",
  borderColor: "divider",
  "& > .MuiButton-root": { width: { xs: "100%", sm: "auto" } },
};

export default function UserManagementPage() {
  const { user } = useAuthStore();
  const {
    users,
    loading,
    error,
    createUser,
    updateUser,
    updateStatus,
    resetPassword,
    refetch,
  } = useUsers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser>();
  const [search, setSearch] = useState("");
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>({
    open: false,
    title: "",
    password: "",
  });
  const [statusDialog, setStatusDialog] = useState<StatusDialogState>({
    open: false,
    user: null,
    nextActive: false,
  });
  const [resetDialog, setResetDialog] = useState<ResetDialogState>({
    open: false,
    user: null,
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((entry) => {
      const name = [entry.firstName, entry.middleName, entry.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        name.includes(query) ||
        entry.email.toLowerCase().includes(query) ||
        entry.role.toLowerCase().includes(query)
      );
    });
  }, [users, search]);

  const showSnackbar = (
    message: string,
    severity: "success" | "error" = "success",
  ) => setSnackbar({ open: true, message, severity });

  const closeUserModal = () => {
    setModalOpen(false);
    setEditingUser(undefined);
  };

  const handleCreateOrUpdate = async (
    payload: CreateUserPayload | UpdateUserPayload,
  ) => {
    if (editingUser) {
      await updateUser(editingUser.id, payload as UpdateUserPayload);
      showSnackbar("User updated successfully!");
      return;
    }

    const response = await createUser(payload as CreateUserPayload);
    showSnackbar("User created successfully!");
    setPasswordDialog({
      open: true,
      title: "Temporary Password",
      password: response.tempPassword,
    });
  };

  const closeStatusDialog = () => {
    if (!loading) {
      setStatusDialog({ open: false, user: null, nextActive: false });
    }
  };

  const closeResetDialog = () => {
    if (!loading) setResetDialog({ open: false, user: null });
  };

  const handleConfirmStatus = async () => {
    if (!statusDialog.user) return;
    try {
      await updateStatus(statusDialog.user.id, statusDialog.nextActive);
      showSnackbar(
        statusDialog.nextActive
          ? "User reactivated successfully!"
          : "User deactivated successfully!",
      );
    } catch (err) {
      console.error("Failed to update user status:", err);
      showSnackbar("Failed to update user status.", "error");
    } finally {
      setStatusDialog({ open: false, user: null, nextActive: false });
    }
  };

  const handleConfirmReset = async () => {
    if (!resetDialog.user) return;
    try {
      const response = await resetPassword(resetDialog.user.id);
      showSnackbar("Password reset successfully!");
      setPasswordDialog({
        open: true,
        title: "Temporary Password",
        password: response.tempPassword,
      });
    } catch (err) {
      console.error("Failed to reset password:", err);
      showSnackbar("Failed to reset password.", "error");
    } finally {
      setResetDialog({ open: false, user: null });
    }
  };

  if (loading && users.length === 0) {
    return (
      <DashboardLayout>
        <PageLoadingSkeleton showStats={false} filterCount={1} rowCount={6} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
        <PageHeader
          title="User Management"
          description="Manage system users, roles, and account access."
          actions={
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={() => {
                setEditingUser(undefined);
                setModalOpen(true);
              }}
              sx={{ minHeight: 44 }}
            >
              Add User
            </Button>
          }
        />

        <Box
          role="group"
          aria-label="User filters"
          sx={{
            display: "flex",
            alignItems: "stretch",
            mb: 3,
            pb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
            minWidth: 0,
          }}
        >
          <TextField
            size="small"
            label="Search users"
            placeholder="Search by name, email, or role"
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
              width: "100%",
              maxWidth: 480,
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          />
        </Box>

        {error && (
          <RequestErrorAlert message={error} onRetry={() => void refetch()} />
        )}

        {(!error || users.length > 0) && (
          <UserTable
            users={filteredUsers}
            loading={loading}
            currentUserId={user?.id}
            filtered={Boolean(search.trim())}
            onEdit={(selected) => {
              setEditingUser(selected);
              setModalOpen(true);
            }}
            onResetPassword={(selected) =>
              setResetDialog({ open: true, user: selected })
            }
            onToggleStatus={(selected) =>
              setStatusDialog({
                open: true,
                user: selected,
                nextActive: !selected.isActive,
              })
            }
          />
        )}

        <UserModal
          open={modalOpen}
          user={editingUser}
          onClose={closeUserModal}
          onSubmit={handleCreateOrUpdate}
          loading={loading}
        />

        <TempPasswordDialog
          open={passwordDialog.open}
          title={passwordDialog.title}
          password={passwordDialog.password}
          onClose={() =>
            setPasswordDialog({ open: false, title: "", password: "" })
          }
        />

        <Dialog
          open={statusDialog.open}
          onClose={closeStatusDialog}
          maxWidth="xs"
          fullWidth
          aria-labelledby="user-status-dialog-title"
        >
          <DialogTitle id="user-status-dialog-title" sx={dialogTitleSx}>
            <Typography component="span" variant="h5">
              {statusDialog.nextActive ? "Reactivate User" : "Deactivate User"}
            </Typography>
            <IconButton
              aria-label="Close status confirmation"
              onClick={closeStatusDialog}
              disabled={loading}
              sx={{ width: 44, height: 44 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
            <DialogContentText>
              {statusDialog.nextActive
                ? "This user will regain access to the system."
                : "This user will be unable to log in until reactivated."}
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={dialogActionsSx}>
            <Button onClick={closeStatusDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color={statusDialog.nextActive ? "primary" : "error"}
              onClick={() => void handleConfirmStatus()}
              disabled={loading}
            >
              {statusDialog.nextActive ? "Reactivate" : "Deactivate"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={resetDialog.open}
          onClose={closeResetDialog}
          maxWidth="xs"
          fullWidth
          aria-labelledby="reset-password-dialog-title"
        >
          <DialogTitle id="reset-password-dialog-title" sx={dialogTitleSx}>
            <Typography component="span" variant="h5">
              Reset Password
            </Typography>
            <IconButton
              aria-label="Close password reset confirmation"
              onClick={closeResetDialog}
              disabled={loading}
              sx={{ width: 44, height: 44 }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
            <DialogContentText>
              This will generate a new temporary password for the user.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={dialogActionsSx}>
            <Button onClick={closeResetDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleConfirmReset()}
              disabled={loading}
            >
              Reset Password
            </Button>
          </DialogActions>
        </Dialog>

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
