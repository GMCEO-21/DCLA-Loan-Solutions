import type React from "react";
import { useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dclaLogo from "../../../assets/dcla-logo.png";
import { authService } from "../api";
import { useAuthStore } from "../authStore";
import { getDefaultRouteForRole } from "../access";

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  type JwtPayload = {
    sub?: string;
    email?: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  };

  const handleInputChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
      if (error) setError(""); // Clear error when user starts typing
    };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!formData.password.trim()) {
      setError("Password is required");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      const res = await authService.login({
        email: formData.email,
        password: formData.password,
      });

      const { access_token, refresh_token, user } = res;
      if (user) {
        setSession(access_token, refresh_token, {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        });
      } else {
        const decoded = JSON.parse(
          atob(access_token.split(".")[1]),
        ) as JwtPayload;
        setSession(access_token, refresh_token, {
          id: decoded.sub ?? "",
          email: decoded.email ?? "",
          role: decoded.role ?? "user",
          mustChangePassword: false,
        });
      }

      navigate(getDefaultRouteForRole(user?.role), { replace: true });
    } catch (err: unknown) {
      const errorMessage = axios.isAxiosError<{ message?: string }>(err)
        ? (err.response?.data?.message ?? "Invalid credentials")
        : "Invalid credentials";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        background: (theme) =>
          `linear-gradient(145deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 65%, #2563eb 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 420, minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
            mb: 3.5,
            color: "common.white",
          }}
        >
          <Box
            component="img"
            src={dclaLogo}
            alt=""
            sx={{
              width: { xs: 48, sm: 52 },
              height: { xs: 48, sm: 52 },
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <Typography
            component="div"
            sx={{
              minWidth: 0,
              fontSize: { xs: 20, sm: 22 },
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            DCLA Loan Solutions
          </Typography>
        </Box>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: "12px",
            bgcolor: "background.paper",
            border: "1px solid rgba(255, 255, 255, 0.6)",
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.22)",
            "& .MuiOutlinedInput-root": { minHeight: 54 },
            "& .MuiOutlinedInput-root.Mui-focused": {
              boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.16)",
            },
            "& .Mui-focusVisible": {
              outline: "3px solid #3b82f6",
              outlineOffset: 3,
            },
          }}
        >
          <Box sx={{ textAlign: "left", mb: 3 }}>
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                color: "text.primary",
                fontSize: 28,
                fontWeight: 700,
                mb: 1,
              }}
            >
              Welcome Back
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: 14 }}
            >
              Sign in to your account to continue.
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 2,
                "& .MuiAlert-icon": {
                  color: "#ef4444",
                },
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              name="email"
              autoComplete="username"
              margin="normal"
              value={formData.email}
              onChange={handleInputChange("email")}
              disabled={loading}
              sx={{
                mb: 2,
                "& .MuiInputLabel-root": {
                  fontWeight: 500,
                },
              }}
            />

            <TextField
              fullWidth
              label="Password"
              name="password"
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              margin="normal"
              value={formData.password}
              onChange={handleInputChange("password")}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      onClick={togglePasswordVisibility}
                      edge="end"
                      sx={{ color: "text.secondary", width: 44, height: 44 }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 3,
                "& .MuiInputLabel-root": {
                  fontWeight: 500,
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                minHeight: 52,
                py: 1.5,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: "8px",
                background: (theme) => theme.palette.primary.main,
                boxShadow: "0 3px 8px rgba(30, 58, 138, 0.16)",
                "&:hover": {
                  background: (theme) => theme.palette.primary.dark,
                  boxShadow: "0 4px 12px rgba(30, 58, 138, 0.22)",
                },
                "&:active": { boxShadow: "none" },
                "&:disabled": {
                  background: "#94a3b8",
                  boxShadow: "none",
                },
                transition: "all 0.2s ease-in-out",
              }}
            >
              {loading ? (
                <CircularProgress
                  size={24}
                  aria-label="Signing in"
                  sx={{ color: "white" }}
                />
              ) : (
                "Sign In"
              )}
            </Button>
          </Box>
        </Paper>
        <Typography
          sx={{
            mt: 3,
            textAlign: "center",
            color: "common.white",
            fontSize: 12,
          }}
        >
          Internal Lending Management System
        </Typography>
      </Box>
    </Box>
  );
}
