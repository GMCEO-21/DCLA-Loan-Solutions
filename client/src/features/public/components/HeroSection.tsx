import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import heroImage from "../../../assets/hero-image.png";
import HeroBenefitCarousel from "./HeroBenefitCarousel";
import Reveal from "./Reveal";

const trustIndicators = [
  "Personalized service",
  "Clear terms",
  "Responsible support",
];

export default function HeroSection() {
  return (
    <Box
      component="section"
      id="home"
      sx={{
        scrollMarginTop: 76,
        overflow: "hidden",
        position: "relative",
        bgcolor: "#fffdf9",
        py: { xs: 8, md: 11, lg: 13 },
        "&::before": {
          content: '""',
          position: "absolute",
          width: { xs: 280, lg: 500 },
          height: { xs: 280, lg: 500 },
          borderRadius: "50%",
          bgcolor: "rgba(16, 185, 129, 0.11)",
          left: { xs: -180, lg: -230 },
          bottom: { xs: -180, lg: -260 },
        },
      }}
    >
      <Box
        sx={{
          maxWidth: 1280,
          mx: "auto",
          px: { xs: 2.5, sm: 4, lg: 5 },
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 0.9fr) minmax(0, 1fr)",
          },
          alignItems: "center",
          gap: { xs: 6, lg: 7 },
          position: "relative",
        }}
      >
        <Reveal>
          <Box>
            <Chip
              icon={<LocationOnOutlinedIcon />}
              label="Serving Valencia City, Bukidnon"
              size="small"
              sx={{
                mb: 2.5,
                bgcolor: "#dff7e9",
                color: "#166534",
                fontWeight: 600,
                px: 0.5,
              }}
            />
            <Typography
              variant="overline"
              sx={{
                display: "block",
                color: "success.dark",
                fontWeight: 750,
                letterSpacing: "0.08em",
                mb: 1.5,
              }}
            >
              Empowering Women. Building Businesses. Changing Lives.
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "2.45rem", sm: "3.5rem", lg: "4.1rem" },
                fontWeight: 750,
                letterSpacing: "-0.045em",
                lineHeight: 1.04,
                color: "#0f172a",
                maxWidth: 700,
              }}
            >
              Financial support for women and growing businesses.
            </Typography>
            <Typography
              sx={{
                mt: 3,
                maxWidth: 650,
                color: "text.secondary",
                fontSize: { xs: "1rem", sm: "1.125rem" },
                lineHeight: 1.7,
              }}
            >
              DCLA Business Solutions provides accessible financial assistance
              to women, small entrepreneurs, market vendors, and working
              individuals who need support for livelihood, business, and other
              eligible financial needs.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 4 }}
            >
              <Button
                component="a"
                href="#contact"
                variant="contained"
                color="success"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  minHeight: 52,
                  color: "common.white",
                  "&:hover": { color: "common.white" },
                }}
              >
                Contact DCLA
              </Button>
              <Button
                component="a"
                href="#about"
                variant="outlined"
                color="primary"
                size="large"
                sx={{ minHeight: 52 }}
              >
                Learn More
              </Button>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 2.5 }}
              sx={{ mt: 4 }}
            >
              {trustIndicators.map((indicator) => (
                <Stack
                  key={indicator}
                  direction="row"
                  alignItems="center"
                  spacing={0.75}
                >
                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                  <Typography variant="body2" color="text.secondary">
                    {indicator}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Reveal>

        <Box
          sx={{
            position: "relative",
            minHeight: { xs: 390, sm: 500, lg: 590 },
            overflow: "hidden",
            borderRadius: { xs: 3, lg: 5 },
            border: "1px solid #e7dfd2",
            bgcolor: "#e8efe7",
            boxShadow: "0 24px 54px rgba(15, 23, 42, 0.16)",
          }}
        >
          <Box
            component="img"
            src={heroImage}
            alt="Women reviewing business documents at a neighborhood shop"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 55%, rgba(15, 23, 42, 0.26) 100%)",
            }}
          />
          <HeroBenefitCarousel />
        </Box>
      </Box>
    </Box>
  );
}
