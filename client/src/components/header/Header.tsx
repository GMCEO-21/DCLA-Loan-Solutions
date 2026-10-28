import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Box,
  ListItemIcon,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Logout from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import Close from "@mui/icons-material/Close";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authService } from "@features/auth/api";
import { useAuthStore } from "@features/auth/authStore";
import dclaLogo from "../../assets/dcla-logo.png";
import {
  getNavigationItems,
  headerHeight,
  navigationWidth,
} from "../layout/navigation";

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("lg"));
  const items = getNavigationItems(user?.role);
  const currentLabel = items.find(
    (item) => item.path === location.pathname,
  )?.label;
  const userName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const userLabel = userName || user?.email || "User";
  const userInitials = userName
    ? [user?.firstName?.[0], user?.lastName?.[0]]
        .filter(Boolean)
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U";
  const roleLabel = user?.role
    ? user.role.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "";
  const handleLogout = async () => {
    await authService.logout();
    navigate("/login");
    setDrawerOpen(false);
  };

  return (
    <>
      {!desktop && (
        <AppBar position="fixed" elevation={0} sx={{ width: "100%" }}>
          <Toolbar
            sx={{
              minHeight: `${headerHeight}px !important`,
              px: { xs: 2, sm: 3 },
              gap: 1,
            }}
          >
            <Tooltip title="Open navigation">
              <IconButton
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                aria-controls={
                  drawerOpen ? "application-navigation" : undefined
                }
                onClick={() => setDrawerOpen(true)}
                sx={{ width: 44, height: 44, ml: -1 }}
              >
                <MenuIcon />
              </IconButton>
            </Tooltip>
            <Typography
              component="div"
              sx={{ flexGrow: 1, minWidth: 0, fontSize: 16, fontWeight: 600 }}
            >
              {title ?? currentLabel ?? "DCLA Loan Solutions"}
            </Typography>
          </Toolbar>
        </AppBar>
      )}
      <Drawer
        variant={desktop ? "permanent" : "temporary"}
        open={desktop || drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: navigationWidth,
            maxWidth: "calc(100vw - 32px)",
            borderRadius: 0,
            boxShadow: "none",
            borderRight: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            overflowX: "hidden",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: 88,
            px: 2.5,
            gap: 1.5,
          }}
        >
          <Box
            component="img"
            src={dclaLogo}
            alt=""
            sx={{
              width: 44,
              height: 40,
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              sx={{ fontWeight: 800, fontSize: 20, color: "primary.main" }}
            >
              DCLA
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              Loan Solutions
            </Typography>
          </Box>
          {!desktop && (
            <IconButton
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              sx={{ width: 44, height: 44 }}
            >
              <Close />
            </IconButton>
          )}
        </Box>
        <Box
          component="nav"
          id="application-navigation"
          aria-label="Main navigation"
          sx={{
            px: 1.5,
            py: 1,
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          <List disablePadding>
            {items.map((item) => (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                end
                selected={location.pathname === item.path}
                onClick={() => setDrawerOpen(false)}
                sx={{
                  minHeight: 48,
                  borderRadius: "8px",
                  mb: 0.5,
                  borderLeft: "3px solid transparent",
                  px: 1.5,
                  "&.Mui-selected": {
                    bgcolor: "action.selected",
                    borderLeftColor: "primary.main",
                    color: "primary.main",
                    "& .MuiTypography-root": { fontWeight: 700 },
                  },
                  "& .MuiListItemIcon-root": { color: "inherit", minWidth: 36 },
                }}
              >
                <ListItemIcon>
                  <item.icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14 }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box
          aria-label="Signed in user"
          sx={{
            mt: "auto",
            flexShrink: 0,
            borderTop: "1px solid",
            borderColor: "divider",
            p: 1.5,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 1,
              py: 1,
              minWidth: 0,
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: "action.selected",
                color: "primary.main",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {userInitials}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }} title={userLabel}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
                {userLabel}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
                {roleLabel}
              </Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 44,
              borderRadius: "8px",
              px: 1.25,
              color: "text.secondary",
              "&:hover": { color: "error.dark" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
              <Logout fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Logout"
              primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
            />
          </ListItemButton>
        </Box>
      </Drawer>
    </>
  );
}
