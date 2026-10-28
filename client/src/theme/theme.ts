import { createTheme, getContrastRatio } from "@mui/material/styles";

const readableForeground = (background: string) =>
  getContrastRatio(background, "#ffffff") >= 4.5 ? "#ffffff" : "#000000";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#1e3a8a", // Navy blue
      dark: "#172e6e",
      light: "#3b82f6",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#64748b", // Slate gray
      dark: "#475569",
      light: "#94a3b8",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f8fafc", // Very light gray
      paper: "#ffffff",
    },
    divider: "#e2e8f0",
    action: {
      hover: "#f1f5f9",
      selected: "rgba(30, 58, 138, 0.08)",
    },
    text: {
      primary: "#1e293b",
      secondary: "#64748b",
    },
    success: {
      main: "#10b981",
      light: "#34d399",
      dark: "#059669",
      contrastText: readableForeground("#10b981"),
    },
    warning: {
      main: "#f59e0b",
      light: "#fbbf24",
      dark: "#d97706",
      contrastText: readableForeground("#f59e0b"),
    },
    error: {
      main: "#ef4444",
      light: "#f87171",
      dark: "#dc2626",
      contrastText: readableForeground("#ef4444"),
    },
    info: {
      main: "#3b82f6",
      light: "#60a5fa",
      dark: "#2563eb",
      contrastText: readableForeground("#3b82f6"),
    },
  },
  typography: {
    allVariants: { letterSpacing: 0 },
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: "1.5rem",
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 600,
      fontSize: "1.5rem",
      lineHeight: 1.3,
    },
    h3: {
      fontWeight: 600,
      fontSize: "1.5rem",
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.5rem",
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: "1.125rem",
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: "1rem",
      lineHeight: 1.4,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": {
            outline: "2px solid #1e3a8a",
            outlineOffset: 2,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ ownerState, theme }) => ({
          overflowWrap: "anywhere",
          ...(ownerState.fullScreen
            ? {
                margin: 0,
                width: "100%",
                maxWidth: "100%",
                height: "100%",
                maxHeight: "none",
                borderRadius: 0,
              }
            : {
                borderRadius: 12,
                margin: 16,
                maxHeight: "calc(100% - 32px)",
                [theme.breakpoints.down("sm")]: {
                  ...(ownerState.fullWidth
                    ? { width: "calc(100% - 32px)" }
                    : {}),
                },
              }),
        }),
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          minWidth: 0,
          overflowX: "auto",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
          padding: "10px 24px",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        contained: ({ ownerState, theme }) => ({
          boxShadow: "none",
          "&:hover": {
            ...(ownerState.color && ownerState.color !== "inherit"
              ? {
                  color: readableForeground(
                    theme.palette[ownerState.color].dark,
                  ),
                }
              : {}),
          },
          "&:active": { boxShadow: "none" },
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow:
            "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)",
          border: "1px solid #e2e8f0",
          "&:hover": {
            boxShadow:
              "0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.1)",
          },
          transition: "box-shadow 0.2s ease-in-out",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow:
            "0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)",
        },
        elevation3: {
          boxShadow:
            "0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.1)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            backgroundColor: "#f8fafc",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "#3b82f6",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "#1e3a8a",
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          background: "#ffffff",
          color: "#1e293b",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "none",
        },
      },
    },
  },
});
