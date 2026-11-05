import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Reveal from "./Reveal";

const requirements = [
  [
    "Valid government-issued identification",
    "Identification",
    BadgeOutlinedIcon,
  ],
  ["Proof of income or source of funds", "Financial", PaymentsOutlinedIcon],
  [
    "Basic personal or business information",
    "Information",
    BusinessOutlinedIcon,
  ],
  [
    "Other documents as required by DCLA",
    "Assessment",
    DescriptionOutlinedIcon,
  ],
] as const;

export default function LoanRequirementsSection() {
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <Box
      component="section"
      id="requirements"
      sx={{ scrollMarginTop: 76, bgcolor: "#f8f5ef", py: { xs: 8, md: 12 } }}
    >
      <Box
        sx={{
          maxWidth: 1080,
          mx: "auto",
          px: { xs: 2.5, sm: 4 },
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(0, 0.8fr) minmax(0, 1.2fr)",
          },
          alignItems: "center",
          gap: { xs: 4, md: 7 },
        }}
      >
        <Reveal>
          <Box>
            <Typography
              variant="overline"
              color="success.dark"
              fontWeight={700}
            >
              Loan Requirements
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
              What to prepare.
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ mt: 2, fontSize: "1.05rem" }}
            >
              These are general requirements. Our team will confirm the exact
              documents needed for your application.
            </Typography>
            <Button
              type="button"
              aria-expanded={noteOpen}
              aria-controls="requirements-note"
              onClick={() => setNoteOpen((current) => !current)}
              startIcon={<InfoOutlinedIcon />}
              endIcon={
                <ExpandMoreIcon
                  sx={{
                    transform: noteOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                    "@media (prefers-reduced-motion: reduce)": {
                      transition: "none",
                    },
                  }}
                />
              }
              sx={{ mt: 2.5, px: 0, color: "primary.main" }}
            >
              About document requirements
            </Button>
            <Collapse in={noteOpen}>
              <Box
                id="requirements-note"
                sx={{
                  mt: 1,
                  p: 2,
                  bgcolor: "#e8f5ff",
                  color: "#174a7c",
                  border: "1px solid #c8e7fc",
                  borderRadius: 2,
                }}
              >
                <Typography variant="body2">
                  Requirements may vary depending on the loan purpose and
                  assessment and applicable lending terms. DCLA will confirm
                  what applies to your inquiry.
                </Typography>
              </Box>
            </Collapse>
          </Box>
        </Reveal>

        <Box
          component="ul"
          sx={{
            listStyle: "none",
            p: 0,
            m: 0,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
            gap: 2,
          }}
        >
          {requirements.map(([requirement, category, Icon], index) => (
            <Reveal key={requirement} delay={index * 70}>
              <Paper
                component="li"
                variant="outlined"
                sx={{
                  p: 2.5,
                  bgcolor: "#fffdf9",
                  minHeight: 170,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1}
                  sx={{ width: "100%" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "#dff7e9",
                      color: "success.dark",
                    }}
                  >
                    <Icon />
                  </Box>
                  <Chip
                    label={category}
                    size="small"
                    sx={{ bgcolor: "#edf5ff", color: "primary.main" }}
                  />
                </Stack>
                <Typography fontWeight={700} sx={{ mt: 2 }}>
                  {requirement}
                </Typography>
              </Paper>
            </Reveal>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
