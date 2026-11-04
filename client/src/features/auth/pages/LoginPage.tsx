import type React from "react";
import { useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { ArrowBack, Visibility, VisibilityOff } from "@mui/icons-material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import axios from "axios";
import dclaLogo from "../../../assets/dcla-logo.png";
import LoginBrandOrbit from "./LoginBrandOrbit";
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
        height: { md: "100dvh" },
        overflow: { md: "hidden" },
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 11fr) minmax(0, 9fr)",
          lg: "minmax(0, 3fr) minmax(0, 2fr)",
        },
        bgcolor: "#fffdf9",
      }}
    >
      <Box
        component="section"
        aria-label="DCLA Business Solutions"
        sx={{
          position: "relative",
          display: { xs: "none", md: "flex" },
          minHeight: "100dvh",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          px: { md: 3, lg: 5 },
          py: { md: 5, lg: 7 },
          color: "common.white",
          background:
            "linear-gradient(150deg, #1e3a8a 0%, #193b7b 54%, #123465 100%)",
          boxShadow: "inset -18px 0 34px rgba(3, 16, 42, 0.12)",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 49% 29%, rgba(96, 165, 250, 0.18), transparent 34%), radial-gradient(circle at 50% 58%, rgba(52, 211, 153, 0.1), transparent 30%), linear-gradient(125deg, rgba(52, 211, 153, 0.06), transparent 42%)",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            left: "-10%",
            right: "-10%",
            bottom: "-4%",
            height: "28%",
            opacity: 0.16,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(125, 211, 252, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(125, 211, 252, 0.4) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            transform: "perspective(420px) rotateX(62deg) scale(1.2)",
            transformOrigin: "center bottom",
            maskImage:
              "linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.9))",
          },
        }}
      >
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 740,
          }}
        >
          <LoginBrandOrbit />

          <Typography
            variant="overline"
            sx={{
              display: "block",
              mt: { md: -1, lg: -0.5 },
              color: "#a7edbf",
              fontWeight: 750,
              animation: "loginCopyIn 440ms ease-out 120ms both",
              "@keyframes loginCopyIn": {
                from: { opacity: 0, transform: "translateY(10px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }}
          >
            DCLA BUSINESS SOLUTIONS
          </Typography>
          <Typography
            component="h2"
            sx={{
              mt: 1,
              maxWidth: 520,
              fontSize: { md: "2.15rem", lg: "2.75rem" },
              fontWeight: 750,
              lineHeight: 1.12,
              animation: "loginCopyIn 440ms ease-out 170ms both",
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }}
          >
            Empowering Women.
            <br />
            <Box component="span" sx={{ color: "#80e3a4" }}>
              Building Businesses.
            </Box>
            <br />
            Changing Lives.
          </Typography>

          <Typography
            sx={{
              mt: 2,
              maxWidth: 480,
              color: "rgba(255, 255, 255, 0.86)",
              fontSize: { md: "0.95rem", lg: "1.05rem" },
              lineHeight: 1.65,
              animation: "loginCopyIn 440ms ease-out 220ms both",
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }}
          >
            Accessible financial support for women, entrepreneurs, and growing
            businesses.
          </Typography>
        </Box>
      </Box>

      <Box
        component="section"
        aria-label="Sign in"
        sx={{
          position: "relative",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2.5, sm: 5, md: 5, lg: 8 },
          py: { xs: 4, sm: 6 },
          bgcolor: "#fffdf9",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            top: -170,
            right: -150,
            width: 360,
            height: 360,
            borderRadius: "50%",
            bgcolor: "rgba(219, 234, 254, 0.52)",
            pointerEvents: "none",
          },
          "&::after": {
            content: '""',
            position: "absolute",
            left: -130,
            bottom: -180,
            width: 340,
            height: 340,
            borderRadius: "50%",
            bgcolor: "rgba(209, 250, 229, 0.42)",
            pointerEvents: "none",
          },
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 460,
            minWidth: 0,
            position: "relative",
            zIndex: 1,
            animation: "loginAreaIn 380ms ease-out both",
            "@keyframes loginAreaIn": {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            "& .MuiOutlinedInput-root": {
              minHeight: 56,
              bgcolor: "common.white",
              borderRadius: 2,
              transition: "border-color 160ms ease, box-shadow 160ms ease",
            },
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(30, 58, 138, 0.2)",
            },
            "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "success.dark",
            },
            "& .MuiOutlinedInput-root.Mui-focused": {
              boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.16)",
            },
            "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
              {
                borderColor: "success.main",
              },
          }}
        >
          <Button
            component={RouterLink}
            to="/"
            startIcon={<ArrowBack fontSize="small" />}
            color="inherit"
            sx={{
              position: { xs: "static", md: "fixed" },
              top: { md: 28, lg: 34 },
              right: { md: 32, lg: 44 },
              zIndex: 2,
              minHeight: 44,
              mb: { xs: 2.5, sm: 4, md: 0 },
              px: { xs: 0.5, md: 1.5 },
              color: "text.secondary",
              fontWeight: 600,
              borderRadius: 999,
              border: { md: "1px solid rgba(30, 58, 138, 0.12)" },
              bgcolor: { md: "rgba(255, 253, 249, 0.76)" },
              "&:hover": {
                color: "primary.dark",
                bgcolor: { xs: "transparent", md: "rgba(255, 255, 255, 0.92)" },
              },
              "&.Mui-focusVisible": {
                outline: "3px solid rgba(16, 185, 129, 0.35)",
                outlineOffset: 3,
              },
            }}
          >
            Back to Home
          </Button>

          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              gap: 1.5,
              mb: 3.5,
            }}
          >
            <Box
              component="img"
              src={dclaLogo}
              alt=""
              sx={{
                width: 52,
                height: 52,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{ color: "primary.dark", fontSize: 20, fontWeight: 750 }}
              >
                DCLA Business Solutions
              </Typography>
              <Typography
                sx={{
                  mt: 0.25,
                  color: "success.dark",
                  fontSize: 12.5,
                  fontWeight: 650,
                }}
              >
                Empowering Women. Building Businesses. Changing Lives.
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.75,
              mb: 3.5,
              borderRadius: 1.5,
              bgcolor: "rgba(16, 185, 129, 0.1)",
              color: "#056244",
            }}
          >
            <LockOutlinedIcon aria-hidden="true" sx={{ fontSize: 15 }} />
            <Typography variant="caption" fontWeight={750}>
              SECURE INTERNAL ACCESS
            </Typography>
          </Box>

          <Box sx={{ textAlign: "left", mb: 3.5 }}>
            <Typography
              component="h1"
              sx={{
                color: "primary.dark",
                fontSize: { xs: 30, sm: 36 },
                fontWeight: 750,
                lineHeight: 1.15,
              }}
            >
              Welcome Back
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mt: 1.25, fontSize: 15.5, lineHeight: 1.65 }}
            >
              Sign in to continue to your account.
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
                mb: 2.25,
                "& .MuiInputLabel-root": { fontWeight: 550 },
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
                mb: 3.5,
                "& .MuiInputLabel-root": { fontWeight: 550 },
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
                fontWeight: 700,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "common.white",
                boxShadow: "0 8px 20px rgba(30, 58, 138, 0.18)",
                "&:hover": {
                  bgcolor: "primary.dark",
                  boxShadow: "0 12px 24px rgba(30, 58, 138, 0.25)",
                  transform: "translateY(-1px)",
                },
                "&:active": { boxShadow: "none", transform: "translateY(0)" },
                "&.Mui-focusVisible": {
                  outline: "3px solid rgba(16, 185, 129, 0.34)",
                  outlineOffset: 3,
                },
                "&:disabled": {
                  background: "#94a3b8",
                  boxShadow: "none",
                },
                transition:
                  "background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                "@media (prefers-reduced-motion: reduce)": {
                  transition: "none",
                  "&:hover": { transform: "none" },
                },
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
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.25,
              mt: 3.5,
              color: "text.secondary",
            }}
          >
            <VerifiedUserOutlinedIcon
              aria-hidden="true"
              sx={{ color: "success.dark", mt: 0.15, fontSize: 20 }}
            />
            <Box>
              <Typography
                variant="body2"
                sx={{ color: "text.primary", fontWeight: 700 }}
              >
                Protected access
              </Typography>
              <Typography variant="body2">
                Your account and session are secured.
              </Typography>
            </Box>
          </Box>
          <Typography
            sx={{
              mt: 3.5,
              pt: 2.5,
              borderTop: "1px solid",
              borderColor: "rgba(148, 163, 184, 0.28)",
              textAlign: "center",
              color: "text.secondary",
              fontSize: 12.5,
            }}
          >
            DCLA Business Solutions
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
