import { Box, Paper, Typography } from "@mui/material";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import Reveal from "./Reveal";

const reasons = [
  [
    "Personalized Service",
    "A lending conversation shaped around each client's needs and circumstances.",
    AssignmentOutlinedIcon,
  ],
  [
    "Clear & Transparent Terms",
    "Clear loan terms, payment arrangements, and open communication.",
    VisibilityOutlinedIcon,
  ],
  [
    "Responsible Lending",
    "Financial assistance paired with responsible borrowing and disciplined repayment.",
    SupportAgentOutlinedIcon,
  ],
  [
    "Client-Focused Support",
    "Respectful guidance for women, entrepreneurs, families, and working individuals.",
    ForumOutlinedIcon,
  ],
] as const;

export default function WhyChooseDclaSection() {
  return (
    <Box
      component="section"
      id="why-dcla"
      sx={{
        scrollMarginTop: 76,
        bgcolor: "primary.main",
        color: "common.white",
        py: { xs: 8, md: 11 },
        overflow: "hidden",
      }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2.5, sm: 4, lg: 5 } }}>
        <Reveal>
          <Box
            sx={{
              textAlign: "center",
              maxWidth: 730,
              mx: "auto",
              mb: { xs: 5, md: 7 },
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: "#86efac", fontWeight: 700 }}
            >
              Why Choose DCLA
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
              Lending built on trust and clarity.
            </Typography>
          </Box>
        </Reveal>

        <Box
          role="region"
          aria-label="Reasons to choose DCLA"
          tabIndex={0}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(4, minmax(270px, 82vw))",
              sm: "repeat(4, minmax(300px, 44vw))",
              lg: "repeat(4, 1fr)",
            },
            gap: 3,
            overflowX: { xs: "auto", lg: "visible" },
            scrollSnapType: { xs: "x mandatory", lg: "none" },
            scrollPaddingInline: { xs: 1, lg: 0 },
            overscrollBehaviorInline: "contain",
            pb: { xs: 2, lg: 0 },
            mx: { xs: -0.5, lg: 0 },
            px: { xs: 0.5, lg: 0 },
            scrollbarColor: "rgba(255,255,255,0.45) transparent",
            "&:focus-visible": {
              outline: "2px solid #86efac",
              outlineOffset: 5,
            },
          }}
        >
          {reasons.map(([title, description, Icon], index) => (
            <Reveal key={title} delay={index * 90}>
              <Paper
                component="article"
                tabIndex={0}
                elevation={0}
                sx={{
                  p: 3.5,
                  minHeight: 250,
                  height: "100%",
                  bgcolor: "rgba(8, 37, 95, 0.36)",
                  color: "common.white",
                  border: "1px solid rgba(147, 197, 253, 0.25)",
                  boxShadow: "none",
                  scrollSnapAlign: "start",
                  transition:
                    "transform 180ms ease, border-color 180ms ease, background-color 180ms ease",
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                  },
                  "&:hover, &:focus-visible": {
                    transform: { lg: "translateY(-6px)" },
                    borderColor: "#86efac",
                    bgcolor: "rgba(8, 37, 95, 0.55)",
                    outline: "none",
                  },
                  "&:hover .reason-icon, &:focus-visible .reason-icon": {
                    transform: "translateY(-3px) rotate(-4deg)",
                  },
                }}
              >
                <Box
                  className="reason-icon"
                  sx={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "success.main",
                    color: "common.white",
                    mb: 3,
                    transition: "transform 180ms ease",
                    "@media (prefers-reduced-motion: reduce)": {
                      transition: "none",
                    },
                  }}
                >
                  <Icon />
                </Box>
                <Typography component="h3" variant="h5" fontWeight={750}>
                  {title}
                </Typography>
                <Typography sx={{ mt: 1.25, color: "rgba(255,255,255,0.86)" }}>
                  {description}
                </Typography>
              </Paper>
            </Reveal>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
