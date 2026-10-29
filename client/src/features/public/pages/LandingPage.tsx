import { Box } from "@mui/material";
import LandingNavbar from "../components/LandingNavbar";
import HeroSection from "../components/HeroSection";
import AboutSection from "../components/AboutSection";
import LoanServicesSection from "../components/LoanServicesSection";
import WhyChooseDclaSection from "../components/WhyChooseDclaSection";
import HowItWorksSection from "../components/HowItWorksSection";
import LoanRequirementsSection from "../components/LoanRequirementsSection";
import FaqSection from "../components/FaqSection";
import ContactSection from "../components/ContactSection";
import LandingFooter from "../components/LandingFooter";

export default function LandingPage() {
  return (
    <Box
      sx={{
        bgcolor: "#fffdf9",
        color: "text.primary",
        overflowX: "clip",
        "& section": { scrollMarginTop: { xs: 64, md: 76 } },
        "@media (prefers-reduced-motion: no-preference)": {
          scrollBehavior: "smooth",
        },
      }}
    >
      <LandingNavbar />
      <Box component="main">
        <HeroSection />
        <AboutSection />
        <LoanServicesSection />
        <WhyChooseDclaSection />
        <HowItWorksSection />
        <LoanRequirementsSection />
        <FaqSection />
        <ContactSection />
      </Box>
      <LandingFooter />
    </Box>
  );
}
