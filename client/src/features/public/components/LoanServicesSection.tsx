import { useRef } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import VolunteerActivismOutlinedIcon from "@mui/icons-material/VolunteerActivismOutlined";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Reveal from "./Reveal";

const services = [
  [
    "Business Capital",
    "Support for small-business owners who need additional funds for operations, inventory, or growth.",
    StorefrontOutlinedIcon,
  ],
  [
    "Livelihood Support",
    "Financial assistance for livelihood activities and income-generating opportunities.",
    AgricultureOutlinedIcon,
  ],
  [
    "Working Capital",
    "Support for micro-entrepreneurs who need funds to maintain or expand daily business operations.",
    AccountBalanceWalletOutlinedIcon,
  ],
  [
    "Personal Financial Needs",
    "Assistance for other eligible personal financial needs, subject to applicable lending terms.",
    PersonOutlineOutlinedIcon,
  ],
  [
    "Other Eligible Needs",
    "For qualified financial needs that may be considered based on DCLA's lending policies and assessment.",
    VolunteerActivismOutlinedIcon,
  ],
] as const;

export default function LoanServicesSection() {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollRail = (direction: number) => {
    railRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  };

  return (
    <Box
      component="section"
      id="loans"
      sx={{ scrollMarginTop: 76, bgcolor: "#fffdf9", py: { xs: 8, md: 12 } }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2.5, sm: 4, lg: 5 } }}>
        <Reveal>
          <Box
            sx={{
              textAlign: "center",
              maxWidth: 680,
              mx: "auto",
              mb: { xs: 4, md: 7 },
            }}
          >
            <Typography
              variant="overline"
              color="success.dark"
              fontWeight={700}
            >
              Loan Services
            </Typography>
            <Typography
              component="h2"
              sx={{
                mt: 1,
                fontSize: { xs: "2rem", md: "2.75rem" },
                fontWeight: 750,
                lineHeight: 1.15,
              }}
            >
              Support for the needs that matter.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Whatever your purpose, our team is ready to discuss how DCLA can
              help.
            </Typography>
          </Box>
        </Reveal>

        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1}
          sx={{ display: { xs: "flex", lg: "none" }, mb: 2 }}
        >
          <IconButton
            aria-label="Scroll loan services backward"
            onClick={() => scrollRail(-1)}
            sx={{ border: "1px solid", borderColor: "divider" }}
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <IconButton
            aria-label="Scroll loan services forward"
            onClick={() => scrollRail(1)}
            sx={{ border: "1px solid", borderColor: "divider" }}
          >
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Box
          ref={railRef}
          role="region"
          aria-label="Loan service options"
          tabIndex={0}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(6, minmax(270px, 82vw))",
              sm: "repeat(6, minmax(300px, 44vw))",
              lg: "repeat(3, 1fr)",
            },
            gap: 3,
            overflowX: { xs: "auto", lg: "visible" },
            scrollSnapType: { xs: "x mandatory", lg: "none" },
            scrollPaddingInline: { xs: 1, lg: 0 },
            pb: { xs: 2, lg: 0 },
            mx: { xs: -0.5, lg: 0 },
            px: { xs: 0.5, lg: 0 },
            scrollbarWidth: "thin",
            overscrollBehaviorInline: "contain",
            "&:focus-visible": {
              outline: "2px solid #1e3a8a",
              outlineOffset: 4,
            },
          }}
        >
          {services.map(([title, description, Icon], index) => (
            <Reveal key={title} delay={index * 70}>
              <Paper
                component="article"
                variant="outlined"
                sx={{
                  p: 3.5,
                  minHeight: 230,
                  height: "100%",
                  bgcolor: "#fffdf9",
                  scrollSnapAlign: "start",
                  transition: "transform 180ms ease, box-shadow 180ms ease",
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                  },
                  "&:hover, &:focus-within": {
                    transform: { lg: "translateY(-5px)" },
                    boxShadow: "0 14px 32px rgba(15, 23, 42, 0.10)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 54,
                    height: 54,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "#edf5ff",
                    color: "primary.main",
                    mb: 3,
                  }}
                >
                  <Icon />
                </Box>
                <Typography component="h3" variant="h5" fontWeight={750}>
                  {title}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1.25 }}>
                  {description}
                </Typography>
              </Paper>
            </Reveal>
          ))}
          <Reveal delay={350}>
            <Paper
              component="article"
              sx={{
                p: 3.5,
                minHeight: 230,
                height: "100%",
                bgcolor: "primary.main",
                color: "common.white",
                border: "none",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                scrollSnapAlign: "start",
                transition: "transform 180ms ease, box-shadow 180ms ease",
                "@media (prefers-reduced-motion: reduce)": {
                  transition: "none",
                },
                "&:hover, &:focus-within": {
                  transform: { lg: "translateY(-5px)" },
                  boxShadow: "0 16px 36px rgba(30, 58, 138, 0.24)",
                },
              }}
            >
              <Box>
                <Typography component="h3" variant="h5" fontWeight={750}>
                  Not sure which fits?
                </Typography>
                <Typography sx={{ mt: 1.25, color: "rgba(255,255,255,0.82)" }}>
                  Contact DCLA and we will help guide the conversation.
                </Typography>
              </Box>
              <Button
                component="a"
                href="#contact"
                variant="contained"
                color="success"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  alignSelf: "flex-start",
                  mt: 3,
                  color: "common.white",
                  "&:hover": { color: "common.white" },
                }}
              >
                Contact DCLA
              </Button>
            </Paper>
          </Reveal>
        </Box>
      </Box>
    </Box>
  );
}
