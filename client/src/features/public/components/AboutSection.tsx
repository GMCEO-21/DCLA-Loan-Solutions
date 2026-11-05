import { Box, Paper, Typography } from "@mui/material";
import aboutImage from "../../../assets/about-image.png";
import Reveal from "./Reveal";

const values = [
  [
    "Trust",
    "Build long-term relationships through honesty, reliability, and consistent service.",
  ],
  [
    "Transparency",
    "Provide clear loan terms, payment arrangements, and open communication.",
  ],
  [
    "Accountability",
    "Promote responsible borrowing, consistent repayment, and financial discipline.",
  ],
  [
    "Empowerment",
    "Support women and small entrepreneurs as they pursue livelihood and business opportunities.",
  ],
] as const;

const storyParagraphs = [
  "DCLA Business Solutions began its lending operations in 2024 with the goal of providing accessible financial assistance to women, small entrepreneurs, and individuals seeking support for their financial and livelihood needs.",
  "Based in Valencia City, Bukidnon, with a satellite office in Bagontaas, DCLA seeks to build relationships with clients through personalized service, clear payment arrangements, and responsible financial practices.",
  "Since its beginnings, DCLA has aimed to support clients who need funds for small-business activities, working capital, and other eligible financial needs. The business recognizes that access to financial assistance comes with a shared responsibility: helping clients understand their obligations while maintaining disciplined and transparent account management.",
  "As DCLA continues to develop, it aspires to strengthen its operations, improve its service systems, and contribute to the financial well-being of the communities it serves.",
] as const;

const principleSx = {
  p: { xs: 3, sm: 3.5 },
  borderRadius: 3,
  border: "1px solid",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

export default function AboutSection() {
  return (
    <Box
      component="section"
      id="about"
      sx={{
        position: "relative",
        scrollMarginTop: 76,
        py: { xs: 8, md: 12 },
        backgroundImage: `url(${aboutImage})`,
        backgroundPosition: { xs: "58% center", md: "center" },
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        isolation: "isolate",
        "&::before": {
          position: "absolute",
          zIndex: -1,
          inset: 0,
          bgcolor: {
            xs: "rgba(255, 251, 244, 0.9)",
            sm: "rgba(255, 251, 244, 0.88)",
            md: "rgba(255, 251, 244, 0.85)",
          },
          content: '""',
        },
      }}
    >
      <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, sm: 4 } }}>
        <Reveal>
          <Box
            sx={{
              maxWidth: 760,
              mx: "auto",
              textAlign: "center",
              mb: { xs: 4, md: 5 },
            }}
          >
            <Typography
              variant="overline"
              color="success.dark"
              fontWeight={700}
            >
              About DCLA
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
              A lending partner you can talk to.
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ mt: 2, fontSize: "1.05rem", lineHeight: 1.7 }}
            >
              Since 2024, DCLA Business Solutions has provided accessible
              financial assistance to women, small entrepreneurs, and
              individuals pursuing livelihood and financial goals.
            </Typography>
          </Box>
        </Reveal>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1.65fr) minmax(300px, 1fr)",
            },
            gap: { xs: 2.5, md: 3 },
            alignItems: "stretch",
          }}
        >
          <Reveal>
            <Paper
              component="article"
              variant="outlined"
              sx={{
                height: "100%",
                p: { xs: 3, sm: 4, md: 5 },
                bgcolor: "rgba(255, 253, 249, 0.96)",
                borderColor: "rgba(218, 209, 194, 0.95)",
                borderRadius: 3,
                boxShadow: "0 18px 44px rgba(49, 43, 32, 0.1)",
                backdropFilter: "blur(4px)",
              }}
            >
              <Typography
                component="p"
                variant="overline"
                color="success.dark"
                fontWeight={750}
              >
                Our Story
              </Typography>
              <Typography
                component="h3"
                sx={{
                  mt: 0.75,
                  fontSize: { xs: "1.5rem", md: "1.75rem" },
                  fontWeight: 750,
                }}
              >
                Company Background
              </Typography>
              <Box sx={{ mt: 2.5, maxWidth: 720 }}>
                {storyParagraphs.map((paragraph, index) => (
                  <Typography
                    key={paragraph}
                    color="text.secondary"
                    sx={{ mt: index === 0 ? 0 : 2, lineHeight: 1.78 }}
                  >
                    {paragraph}
                  </Typography>
                ))}
              </Box>
            </Paper>
          </Reveal>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                lg: "1fr",
              },
              gap: { xs: 2.5, md: 3 },
            }}
          >
            <Reveal delay={80}>
              <Paper
                component="article"
                elevation={0}
                sx={{
                  ...principleSx,
                  height: "100%",
                  bgcolor: "primary.dark",
                  borderColor: "primary.dark",
                  color: "common.white",
                  boxShadow: "0 16px 36px rgba(18, 54, 104, 0.16)",
                }}
              >
                <Typography component="h3" variant="h5" fontWeight={750}>
                  Our Mission
                </Typography>
                <Typography
                  sx={{
                    mt: 2,
                    color: "rgba(255, 255, 255, 0.84)",
                    lineHeight: 1.75,
                  }}
                >
                  To provide accessible and responsible financial assistance
                  that helps women, small entrepreneurs, and working individuals
                  support their livelihood, business activities, and everyday
                  financial needs while promoting responsible borrowing,
                  financial discipline, and consistent repayment.
                </Typography>
              </Paper>
            </Reveal>

            <Reveal delay={140}>
              <Paper
                component="article"
                elevation={0}
                sx={{
                  ...principleSx,
                  height: "100%",
                  bgcolor: "rgba(239, 250, 243, 0.96)",
                  borderColor: "rgba(104, 190, 133, 0.45)",
                  color: "text.primary",
                  boxShadow: "0 14px 32px rgba(36, 94, 59, 0.09)",
                }}
              >
                <Typography component="h3" variant="h5" fontWeight={750}>
                  Our Vision
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ mt: 2, lineHeight: 1.75 }}
                >
                  To become a trusted financial services brand known for
                  professional service, transparent transactions, responsible
                  collection practices, and meaningful support for women, small
                  entrepreneurs, families, and the communities we serve.
                </Typography>
              </Paper>
            </Reveal>
          </Box>

          <Box sx={{ gridColumn: "1 / -1" }}>
            <Reveal delay={180}>
              <Paper
                component="article"
                variant="outlined"
                sx={{
                  p: { xs: 3, sm: 4 },
                  bgcolor: "rgba(255, 253, 249, 0.94)",
                  borderColor: "rgba(218, 209, 194, 0.95)",
                  borderRadius: 3,
                  boxShadow: "0 14px 34px rgba(49, 43, 32, 0.08)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <Typography component="h3" variant="h5" fontWeight={750}>
                  Core Values
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  The principles that guide how DCLA serves its clients.
                </Typography>
                <Box
                  component="ul"
                  sx={{
                    m: 0,
                    mt: 3,
                    p: 0,
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      lg: "repeat(4, minmax(0, 1fr))",
                    },
                    listStyle: "none",
                    "& > li": {
                      py: { xs: 2.25, sm: 2 },
                      px: { xs: 0, sm: 2.5, lg: 3 },
                      borderTop: { xs: "1px solid #ddd5c8", sm: "none" },
                      borderLeft: { sm: "1px solid #ddd5c8" },
                    },
                    "& > li:first-of-type": {
                      pt: { xs: 0, sm: 2 },
                      pl: { sm: 0 },
                      borderTop: "none",
                      borderLeft: "none",
                    },
                    "& > li:nth-of-type(odd)": {
                      borderLeft: { sm: "none", lg: "1px solid #ddd5c8" },
                    },
                    "& > li:nth-of-type(1)": { borderLeft: "none" },
                    "& > li:nth-of-type(n+3)": {
                      borderTop: { sm: "1px solid #ddd5c8", lg: "none" },
                    },
                  }}
                >
                  {values.map(([title, description]) => (
                    <Box component="li" key={title}>
                      <Typography color="success.dark" fontWeight={750}>
                        {title}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ mt: 0.75, lineHeight: 1.7 }}
                      >
                        {description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Reveal>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
