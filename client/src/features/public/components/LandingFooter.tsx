import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import dclaLogo from "../../../assets/dcla-logo.png";

const links = [
  ["Home", "#home"],
  ["About", "#about"],
  ["Loans", "#loans"],
  ["How It Works", "#how-it-works"],
  ["FAQ", "#faq"],
  ["Contact", "#contact"],
] as const;

const contactDetails = [
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
] as const;

export default function LandingFooter() {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: "#edf5ff",
        borderTop: "4px solid",
        borderColor: "success.main",
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2.5, sm: 4 },
          py: { xs: 6, md: 8 },
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
            md: "minmax(0, 1.15fr) minmax(180px, 0.65fr) minmax(0, 1.2fr)",
          },
          columnGap: { sm: 5, md: 7 },
          rowGap: { xs: 5, sm: 6 },
        }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                width: 52,
                height: 52,
                bgcolor: "rgba(255, 255, 255, 0.72)",
                border: "1px solid rgba(24, 64, 124, 0.12)",
                borderRadius: 2,
              }}
            >
              <Box
                component="img"
                src={dclaLogo}
                alt=""
                sx={{ width: 42, height: 42, objectFit: "contain" }}
              />
            </Box>
            <Box>
              <Typography
                variant="overline"
                color="success.dark"
                fontWeight={750}
                lineHeight={1.2}
              >
                Local lending support
              </Typography>
              <Typography
                sx={{
                  color: "primary.main",
                  fontSize: "1.15rem",
                  fontWeight: 800,
                }}
              >
                DCLA Business Solutions
              </Typography>
            </Box>
          </Stack>
          <Typography
            color="text.secondary"
            sx={{ mt: 2.5, maxWidth: 390, lineHeight: 1.7 }}
          >
            Empowering Women. Building Businesses. Changing Lives.
          </Typography>
          <Button
            component="a"
            href="#contact"
            variant="contained"
            color="success"
            endIcon={<ArrowForwardIcon />}
            sx={{
              mt: 3,
              minHeight: 44,
              color: "common.white",
              "&:hover": { color: "common.white" },
            }}
          >
            Contact DCLA
          </Button>
        </Box>

        <Box component="nav" aria-label="Footer navigation">
          <Typography
            sx={{ color: "primary.main", fontWeight: 800, fontSize: "1rem" }}
          >
            Explore
          </Typography>
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "1fr",
              },
              gap: 0.5,
            }}
          >
            {links.map(([label, href]) => (
              <Button
                key={href}
                component="a"
                href={href}
                color="inherit"
                sx={{
                  justifyContent: "flex-start",
                  minHeight: 40,
                  px: 0,
                  color: "text.secondary",
                  fontWeight: 500,
                  textTransform: "none",
                  "&:hover": { color: "primary.main", bgcolor: "transparent" },
                  "&:focus-visible": {
                    borderRadius: 1,
                    outline: "3px solid rgba(22, 163, 74, 0.28)",
                    outlineOffset: 2,
                  },
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            gridColumn: { sm: "1 / -1", md: "auto" },
            maxWidth: { md: 410 },
          }}
        >
          <Typography
            sx={{ color: "primary.main", fontWeight: 800, fontSize: "1rem" }}
          >
            Contact
          </Typography>
          <Box
            component="address"
            sx={{ mt: 2, display: "grid", gap: 1.75, fontStyle: "normal" }}
          >
            {contactDetails.map(({ label, value, Icon, ...detail }) => {
              const href = "href" in detail ? detail.href : undefined;

              return (
                <Stack
                  key={label}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                      width: 36,
                      height: 36,
                      mt: 0.25,
                      color: "success.dark",
                      bgcolor: "rgba(255, 255, 255, 0.72)",
                      borderRadius: 1.5,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={700}
                    >
                      {label}
                    </Typography>
                    {href ? (
                      <Typography component="a" href={href} sx={contactLinkSx}>
                        {value}
                      </Typography>
                    ) : (
                      <Typography
                        color="text.secondary"
                        sx={{ mt: 0.2, lineHeight: 1.45 }}
                      >
                        {value}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              );
            })}
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(24, 64, 124, 0.12)" }} />
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 2.5, sm: 4 },
          py: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} DCLA Business Solutions. All rights
          reserved.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Valencia City, Bukidnon
        </Typography>
      </Box>
    </Box>
  );
}

const contactLinkSx = {
  display: "block",
  width: "fit-content",
  mt: 0.2,
  color: "primary.main",
  fontWeight: 700,
  overflowWrap: "anywhere",
  textDecoration: "none",
  textUnderlineOffset: "3px",
  "&:hover": { textDecoration: "underline" },
  "&:focus-visible": {
    borderRadius: 0.5,
    outline: "3px solid rgba(22, 163, 74, 0.28)",
    outlineOffset: 3,
  },
};
