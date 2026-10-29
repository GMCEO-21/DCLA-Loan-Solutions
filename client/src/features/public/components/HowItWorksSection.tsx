import { useState } from "react";
import {
  Box,
  Paper,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Reveal from "./Reveal";

const steps = [
  [
    "Apply / Inquire",
    "Reach out with basic details about your financial need.",
    QuestionAnswerOutlinedIcon,
  ],
  [
    "Assessment",
    "Our team reviews the information and documents needed for assessment.",
    ManageSearchOutlinedIcon,
  ],
  [
    "Approval",
    "Once assessed, we explain the result and terms clearly.",
    TaskAltOutlinedIcon,
  ],
  [
    "Loan Release",
    "After terms are agreed, an approved loan can be released.",
    AccountBalanceWalletOutlinedIcon,
  ],
] as const;

export default function HowItWorksSection() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [activeStep, setActiveStep] = useState(0);
  const [title, description, Icon] = steps[activeStep];

  return (
    <Box
      component="section"
      id="how-it-works"
      sx={{ scrollMarginTop: 76, bgcolor: "#fffdf9", py: { xs: 8, md: 12 } }}
    >
      <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 2.5, sm: 4 } }}>
        <Reveal>
          <Box
            sx={{
              textAlign: "center",
              maxWidth: 620,
              mx: "auto",
              mb: { xs: 5, md: 7 },
            }}
          >
            <Typography
              variant="overline"
              color="success.dark"
              fontWeight={700}
            >
              How It Works
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
              Four simple steps.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Explore each part of the general inquiry process.
            </Typography>
          </Box>
        </Reveal>

        <Paper
          variant="outlined"
          sx={{ p: { xs: 2.5, sm: 4 }, bgcolor: "#fffdf9" }}
        >
          <Stepper
            nonLinear
            activeStep={activeStep}
            orientation={mobile ? "vertical" : "horizontal"}
            aria-label="General loan inquiry steps"
            sx={{
              "& .MuiStepConnector-line": {
                borderColor: "#bbf7d0",
                borderWidth: mobile ? 1 : 2,
              },
              "& .MuiStepIcon-root": { color: "#cbd5e1" },
              "& .MuiStepIcon-root.Mui-active": { color: "success.main" },
              "& .MuiStepLabel-label": { fontWeight: 600 },
              "& .MuiStepLabel-label.Mui-active": {
                color: "primary.main",
                fontWeight: 750,
              },
              "& .MuiStepButton-root:focus-visible": {
                outline: "2px solid #1e3a8a",
                outlineOffset: 3,
                borderRadius: 2,
              },
            }}
          >
            {steps.map(([stepTitle], index) => (
              <Step key={stepTitle} completed={false}>
                <StepButton
                  onClick={() => setActiveStep(index)}
                  aria-label={`Show step ${index + 1}: ${stepTitle}`}
                >
                  <StepLabel>{stepTitle}</StepLabel>
                </StepButton>
              </Step>
            ))}
          </Stepper>

          <Box
            key={title}
            aria-live="polite"
            sx={{
              mt: { xs: 3, sm: 5 },
              p: { xs: 2.5, sm: 3.5 },
              borderRadius: 3,
              bgcolor: "#f8f5ef",
              border: "1px solid #e7dfd2",
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr)",
              alignItems: "center",
              gap: 2,
              animation: reducedMotion ? "none" : "stepDetailIn 280ms ease",
              "@keyframes stepDetailIn": {
                from: { opacity: 0, transform: "translateY(8px)" },
                to: { opacity: 1, transform: "translateY(0)" },
              },
            }}
          >
            <Box
              sx={{
                width: { xs: 50, sm: 62 },
                height: { xs: 50, sm: 62 },
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: "primary.main",
                color: "common.white",
              }}
            >
              <Icon />
            </Box>
            <Box>
              <Typography
                variant="overline"
                color="success.dark"
                fontWeight={700}
              >
                Step {activeStep + 1}
              </Typography>
              <Typography component="h3" variant="h5" fontWeight={750}>
                {title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {description}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              mt: 2.5,
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              color: "text.secondary",
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 18, mt: 0.2 }} />
            <Typography variant="caption">
              This stepper explains the general process; it does not show a
              real-time application status.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
