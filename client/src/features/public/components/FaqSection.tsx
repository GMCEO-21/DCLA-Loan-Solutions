import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Reveal from "./Reveal";

const questions = [
  [
    "Who can apply for a loan?",
    "Women, small entrepreneurs, market vendors, working individuals, and other qualified applicants may inquire with DCLA. Specific eligibility is determined through assessment and applicable lending terms.",
  ],
  [
    "What documents are required?",
    "General documents may include valid identification, proof of income or source of funds, and basic personal or business information. DCLA will confirm the documents applicable to your inquiry.",
  ],
  [
    "How long does the approval process take?",
    "Assessment timing depends on the information and documents needed for an inquiry. DCLA will discuss the next steps with you directly.",
  ],
  [
    "What types of financial needs can DCLA support?",
    "DCLA considers inquiries for business capital, livelihood support, working capital, personal financial needs, and other eligible needs based on its lending policies and assessment.",
  ],
  [
    "How can I contact DCLA?",
    "DCLA is based in Valencia City, Bukidnon, with a satellite office in Bagontaas. Confirmed phone, email, and office-hour information will be published when available.",
  ],
] as const;

export default function FaqSection() {
  return (
    <Box
      component="section"
      id="faq"
      sx={{ scrollMarginTop: 76, bgcolor: "#fffdf9", py: { xs: 8, md: 12 } }}
    >
      <Box sx={{ maxWidth: 860, mx: "auto", px: { xs: 2.5, sm: 4 } }}>
        <Reveal>
          <Typography
            component="h2"
            textAlign="center"
            sx={{
              fontSize: { xs: "2rem", md: "2.75rem" },
              fontWeight: 750,
              lineHeight: 1.15,
              mb: 5,
            }}
          >
            Frequently asked questions.
          </Typography>
        </Reveal>
        {questions.map(([question, answer], index) => (
          <Reveal key={question} delay={index * 55}>
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                mb: 1.5,
                border: "1px solid #e7dfd2",
                borderRadius: "10px !important",
                overflow: "hidden",
                bgcolor: "#fffdf9",
                "&::before": { display: "none" },
                transition:
                  "border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease",
                "@media (prefers-reduced-motion: reduce)": {
                  transition: "none",
                },
                "&:hover": { bgcolor: "#fdfaf5", borderColor: "#bfdbfe" },
                "&.Mui-expanded": {
                  borderColor: "#93c5fd",
                  boxShadow: "0 8px 24px rgba(30, 58, 138, 0.08)",
                },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls={`${question}-content`}
                id={`${question}-header`}
                sx={{
                  minHeight: 64,
                  px: { xs: 2, sm: 3 },
                  "& .MuiAccordionSummary-content": { my: 2 },
                  "& .MuiAccordionSummary-expandIconWrapper": {
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "#f8f5ef",
                    transition: "transform 180ms ease",
                  },
                  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
                    transform: "rotate(180deg)",
                    bgcolor: "#dff7e9",
                  },
                  "&:focus-visible": {
                    outline: "2px solid #1e3a8a",
                    outlineOffset: -3,
                  },
                }}
              >
                <Typography fontWeight={700}>{question}</Typography>
              </AccordionSummary>
              <AccordionDetails
                id={`${question}-content`}
                sx={{ px: { xs: 2, sm: 3 }, pt: 0, pb: 3 }}
              >
                <Typography color="text.secondary">{answer}</Typography>
              </AccordionDetails>
            </Accordion>
          </Reveal>
        ))}
      </Box>
    </Box>
  );
}
