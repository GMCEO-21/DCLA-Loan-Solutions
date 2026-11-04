import { useEffect, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { Link as RouterLink } from "react-router-dom";
import dclaLogo from "../../../assets/dcla-logo.png";

const navigationItems = [
  ["Home", "#home"],
  ["About", "#about"],
  ["Loans", "#loans"],
  ["How It Works", "#how-it-works"],
  ["FAQ", "#faq"],
  ["Contact", "#contact"],
] as const;

export default function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  const [activeSection, setActiveSection] = useState(
    () => window.location.hash.slice(1) || "home",
  );
  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = navigationItems
      .map(([, href]) => document.getElementById(href.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-18% 0px -62%", threshold: [0.1, 0.35, 0.65] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const navLinks = (mobile = false) =>
    navigationItems.map(([label, href]) => {
      const active = activeSection === href.slice(1);
      return (
        <Button
          key={href}
          component="a"
          href={href}
          color="inherit"
          aria-current={active ? "location" : undefined}
          onClick={() => {
            setActiveSection(href.slice(1));
            if (mobile) closeMobileMenu();
          }}
          sx={{
            justifyContent: mobile ? "flex-start" : "center",
            minHeight: mobile ? 48 : 40,
            px: mobile ? 2 : 1.25,
            py: mobile ? 1.1 : 0.75,
            color: active ? "primary.main" : "primary.dark",
            fontWeight: active ? 700 : 500,
            position: "relative",
            borderRadius: 1.5,
            bgcolor:
              mobile && active ? "rgba(16, 185, 129, 0.1)" : "transparent",
            transition:
              "color 180ms ease, background-color 180ms ease, transform 180ms ease",
            "&:hover": {
              color: "primary.main",
              bgcolor: "rgba(16, 185, 129, 0.08)",
            },
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            "&::after": mobile
              ? undefined
              : {
                  content: '""',
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 3,
                  height: 2,
                  borderRadius: 999,
                  bgcolor: active ? "success.main" : "transparent",
                  transform: active ? "scaleX(1)" : "scaleX(0)",
                  transition: "transform 180ms ease",
                },
          }}
        >
          {label}
        </Button>
      );
    });

  return (
    <AppBar
      component="header"
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        bgcolor: scrolled ? "rgba(255, 253, 249, 0.97)" : "#fffdf9",
        backdropFilter: scrolled ? "blur(10px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(10px)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(218, 209, 194, 0.9)"
          : "1px solid #eee8de",
        boxShadow: scrolled ? "0 8px 24px rgba(15, 23, 42, 0.08)" : "none",
        transition:
          "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, backdrop-filter 180ms ease",
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }}
    >
      <Toolbar
        sx={{
          minHeight: scrolled ? { xs: 60, lg: 68 } : { xs: 64, lg: 76 },
          maxWidth: 1200,
          width: "100%",
          mx: "auto",
          px: { xs: 2, sm: 3, lg: 3.5 },
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr) auto",
            lg: "minmax(220px, 1fr) auto minmax(220px, 1fr)",
          },
          gap: { xs: 1.5, lg: 2.5 },
          transition: "min-height 180ms ease, padding 180ms ease",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Box
          component="a"
          href="#home"
          aria-label="DCLA Business Solutions home"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.25,
            minWidth: 0,
            width: "fit-content",
            borderRadius: 1.5,
            "&:focus-visible": {
              outline: "3px solid rgba(30, 58, 138, 0.28)",
              outlineOffset: 4,
            },
          }}
        >
          <Box
            component="img"
            src={dclaLogo}
            alt=""
            sx={{
              width: {
                xs: scrolled ? 36 : 38,
                sm: scrolled ? 38 : 44,
              },
              height: {
                xs: scrolled ? 36 : 38,
                sm: scrolled ? 38 : 44,
              },
              objectFit: "contain",
              flexShrink: 0,
              transition: "width 180ms ease, height 180ms ease",
              "@media (prefers-reduced-motion: reduce)": {
                transition: "none",
              },
            }}
          />
          <Typography
            component="span"
            sx={{
              color: "primary.main",
              fontSize: { xs: "1rem", sm: "1.15rem" },
              fontWeight: 800,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            DCLA Business Solutions
          </Typography>
        </Box>

        <Stack
          component="nav"
          aria-label="Landing page"
          direction="row"
          spacing={0.25}
          sx={{ display: { xs: "none", lg: "flex" }, justifySelf: "center" }}
        >
          {navLinks()}
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            display: { xs: "none", lg: "flex" },
            justifySelf: "end",
          }}
        >
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            startIcon={<LoginOutlinedIcon />}
            sx={{
              minHeight: 44,
              px: 1.75,
              borderColor: "primary.main",
              color: "primary.main",
              "&:hover": {
                borderColor: "primary.dark",
                bgcolor: "rgba(30, 58, 138, 0.05)",
              },
            }}
          >
            Login
          </Button>
          <Button
            component="a"
            href="#contact"
            variant="contained"
            color="success"
            sx={{
              minHeight: 44,
              px: 2,
              color: "common.white",
              transition:
                "background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
              "&:hover": {
                bgcolor: "success.dark",
                color: "common.white",
                boxShadow: "0 7px 16px rgba(5, 150, 105, 0.2)",
                transform: "translateY(-1px)",
              },
              "&:active": { transform: "translateY(0)" },
              "@media (prefers-reduced-motion: reduce)": {
                transition: "none",
              },
            }}
          >
            Contact DCLA
          </Button>
        </Stack>

        <IconButton
          aria-label="Open landing page navigation"
          onClick={() => setMobileMenuOpen(true)}
          sx={{
            display: { xs: "inline-flex", lg: "none" },
            justifySelf: "end",
            width: 44,
            height: 44,
            color: "primary.main",
            border: "1px solid rgba(30, 58, 138, 0.14)",
            bgcolor: "rgba(255, 255, 255, 0.62)",
            "&:hover": { bgcolor: "rgba(16, 185, 129, 0.08)" },
          }}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>

      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        PaperProps={{
          sx: {
            width: "min(88vw, 360px)",
            bgcolor: "#fffdf9",
            borderRadius: 0,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2.5,
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              component="img"
              src={dclaLogo}
              alt=""
              sx={{ width: 38, height: 38, objectFit: "contain" }}
            />
            <Typography fontWeight={800} color="primary.main">
              DCLA Business Solutions
            </Typography>
          </Stack>
          <IconButton
            aria-label="Close landing page navigation"
            onClick={closeMobileMenu}
            sx={{ width: 44, height: 44 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <Stack
          component="nav"
          aria-label="Landing page mobile"
          spacing={0.75}
          sx={{ p: 2 }}
        >
          {navLinks(true)}
        </Stack>
        <Divider />
        <Stack spacing={1.25} sx={{ p: 2 }}>
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            onClick={closeMobileMenu}
            startIcon={<LoginOutlinedIcon />}
            sx={{ minHeight: 46, borderColor: "primary.main" }}
          >
            Login
          </Button>
          <Button
            component="a"
            href="#contact"
            variant="contained"
            color="success"
            onClick={closeMobileMenu}
            sx={{
              minHeight: 46,
              color: "common.white",
              "&:hover": {
                bgcolor: "success.dark",
                color: "common.white",
              },
            }}
          >
            Contact DCLA
          </Button>
        </Stack>
      </Drawer>
    </AppBar>
  );
}
