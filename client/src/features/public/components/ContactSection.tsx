import { Box, Paper, Stack, Typography } from "@mui/material";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import Reveal from "./Reveal";

type ContactItem = {
  label: string;
  value: string;
  href?: string;
  Icon: typeof PhoneOutlinedIcon;
};

const contactItems: ContactItem[] = [
  {
    label: "Phone",
    value: "0968 261 8158",
    href: "tel:09682618158",
    Icon: PhoneOutlinedIcon,
  },
  {
    label: "Email",
    value: "dclasolutions@gmail.com",
    href: "mailto:dclasolutions@gmail.com",
    Icon: EmailOutlinedIcon,
  },
  {
    label: "Main Location",
    value: "Valencia City, Bukidnon, Philippines",
    Icon: LocationOnOutlinedIcon,
  },
  {
    label: "Satellite Office",
    value: "Bagontaas, Valencia City, Bukidnon",
    Icon: BusinessOutlinedIcon,
  },
];

export default function ContactSection() {
  return (
    <Box
      component="section"
      id="contact"
      sx={{ scrollMarginTop: 76, bgcolor: "#f8f5ef", py: { xs: 8, md: 12 } }}
    >
      <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 2.5, sm: 4 } }}>
        <Reveal>
          <Paper
            variant="outlined"
            sx={{
              overflow: "hidden",
              bgcolor: "#fffdf9",
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(280px, 0.8fr) minmax(0, 1.2fr)",
              },
            }}
          >
            <Box
              sx={{
                p: { xs: 3.5, sm: 5 },
                bgcolor: "primary.main",
                color: "common.white",
              }}
            >
              <Typography
                variant="overline"
                sx={{ color: "#86efac", fontWeight: 700 }}
              >
                Contact DCLA
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontSize: { xs: "2rem", md: "2.5rem" },
                  fontWeight: 750,
                  lineHeight: 1.1,
                }}
              >
                Have questions about our loan services?
              </Typography>
              <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.84)" }}>
                Get in touch with us directly to discuss eligible financial
                needs, lending terms, and the assessment process.
              </Typography>
            </Box>

            <Box
              component="dl"
              sx={{
                m: 0,
                p: { xs: 3, sm: 4.5 },
                display: "grid",
                alignContent: "center",
              }}
            >
              {contactItems.map(({ label, value, href, Icon }, index) => (
                <Stack
                  key={label}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  sx={{
                    py: 2,
                    borderBottom:
                      index < contactItems.length - 1
                        ? "1px solid #e7dfd2"
                        : "none",
                  }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "#dff7e9",
                      color: "success.dark",
                      flexShrink: 0,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      component="dt"
                      variant="caption"
                      color="text.secondary"
                      fontWeight={700}
                    >
                      {label}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, mt: 0.25 }}>
                      {href ? (
                        <Box
                          component="a"
                          href={href}
                          sx={{
                            color: "primary.main",
                            fontWeight: 700,
                            overflowWrap: "anywhere",
                            textDecoration: "none",
                            textUnderlineOffset: "3px",
                            "&:hover": { textDecoration: "underline" },
                            "&:focus-visible": {
                              borderRadius: 0.5,
                              outline: "3px solid rgba(22, 163, 74, 0.32)",
                              outlineOffset: 3,
                            },
                          }}
                        >
                          {value}
                        </Box>
                      ) : (
                        <Box component="span" sx={{ fontWeight: 650 }}>
                          {value}
                        </Box>
                      )}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
          </Paper>
        </Reveal>
      </Box>
    </Box>
  );
}
