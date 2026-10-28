import { useEffect } from "react";
import { useState } from "react";
import type { ReactNode } from "react";
import FullScreenLoader from "@components/common/FullScreenLoader";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { authService } from "./api";
import { useAuthStore } from "./authStore";

export default function AuthBootstrap({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      if (!token && !refreshToken) {
        if (isMounted) {
          setInitialized(true);
        }
        return;
      }

      try {
        const verifiedUser = await authService.getProfile();

        if (isMounted) {
          const verifiedSession = useAuthStore.getState();
          if (!verifiedSession.token || !verifiedSession.refreshToken) {
            throw new Error("Verified session is incomplete");
          }
          setSession(
            verifiedSession.token,
            verifiedSession.refreshToken,
            verifiedUser,
          );
        }
      } catch {
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setInitialized(true);
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [logout, refreshToken, setInitialized, setSession, token]);

  if (!isInitialized) {
    return <FullScreenLoader />;
  }

  const requiresPasswordChange = Boolean(token && user?.mustChangePassword);

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError("Current and new password are required.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setPasswordError("");
    setPasswordSubmitting(true);

    try {
      const response = await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (response?.user) {
        setUser(response.user);
      } else {
        const refreshedProfile = await authService.getProfile();
        setUser(refreshedProfile);
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch {
      setPasswordError("Failed to change password. Verify current password.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <Dialog
        open={requiresPasswordChange}
        onClose={() => undefined}
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Temporary Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You must change your temporary password before continuing.
          </Typography>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {passwordError}
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              type="password"
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  currentPassword: event.target.value,
                }))
              }
              fullWidth
            />
            <TextField
              type="password"
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  newPassword: event.target.value,
                }))
              }
              fullWidth
            />
            <TextField
              type="password"
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  confirmPassword: event.target.value,
                }))
              }
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            variant="contained"
            onClick={() => void handlePasswordChange()}
            disabled={passwordSubmitting}
          >
            Update Password
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
