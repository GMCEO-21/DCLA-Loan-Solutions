import { useEffect, useState } from "react";
import {
  Box,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";

const benefits = [
  {
    title: "Clear conversations",
    description: "Talk through the details before making a commitment.",
    Icon: ForumOutlinedIcon,
  },
  {
    title: "Simple process",
    description: "Understand the next step without unnecessary complexity.",
    Icon: RouteOutlinedIcon,
  },
  {
    title: "Transparent terms",
    description: "Review the terms and ask questions before you decide.",
    Icon: PolicyOutlinedIcon,
  },
  {
    title: "Client-focused support",
    description: "Receive respectful guidance for your lending inquiry.",
    Icon: SupportAgentOutlinedIcon,
  },
] as const;

export default function HeroBenefitCarousel() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const benefit = benefits[activeIndex];
  const BenefitIcon = benefit.Icon;

  useEffect(() => {
    if (reducedMotion || paused) return;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % benefits.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const selectRelative = (offset: number) => {
    setActiveIndex(
      (current) => (current + offset + benefits.length) % benefits.length,
    );
  };

  return (
    <Box
      component="aside"
      aria-roledescription="carousel"
      aria-label="DCLA lending benefits"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
      sx={{
        position: "absolute",
        zIndex: 2,
        left: { xs: 16, sm: 32 },
        right: { xs: 16, sm: "auto" },
        bottom: { xs: 16, sm: 30 },
        width: { sm: 360 },
        p: 1.5,
        bgcolor: "rgba(255,253,249,0.97)",
        border: "1px solid #e7dfd2",
        borderRadius: 2.5,
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: "primary.main",
            color: "common.white",
            flexShrink: 0,
          }}
        >
          <BenefitIcon />
        </Box>
        <Box
          key={benefit.title}
          aria-live="polite"
          aria-atomic="true"
          sx={{
            minWidth: 0,
            flex: 1,
            animation: reducedMotion ? "none" : "benefitFade 320ms ease",
            "@keyframes benefitFade": {
              from: { opacity: 0, transform: "translateX(8px)" },
              to: { opacity: 1, transform: "translateX(0)" },
            },
          }}
        >
          <Typography fontWeight={700} fontSize="0.92rem">
            {benefit.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {benefit.description}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label="Previous benefit"
          onClick={() => selectRelative(-1)}
        >
          <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Next benefit"
          onClick={() => selectRelative(1)}
        >
          <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>
      <Stack
        direction="row"
        justifyContent="center"
        spacing={0.75}
        sx={{ mt: 1 }}
      >
        {benefits.map((item, index) => (
          <Box
            component="button"
            type="button"
            key={item.title}
            aria-label={`Show benefit ${index + 1}: ${item.title}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => setActiveIndex(index)}
            sx={{
              width: index === activeIndex ? 22 : 8,
              height: 8,
              p: 0,
              border: 0,
              borderRadius: 999,
              bgcolor: index === activeIndex ? "primary.main" : "#cbd5e1",
              cursor: "pointer",
              transition: reducedMotion ? "none" : "width 220ms ease",
              "&:focus-visible": {
                outline: "2px solid #1e3a8a",
                outlineOffset: 2,
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}
