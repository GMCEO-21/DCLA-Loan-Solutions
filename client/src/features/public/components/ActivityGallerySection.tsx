import { Box, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { activityGallery } from "../data/activityGallery";
import Reveal from "./Reveal";

const activityMarquee = keyframes`
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(calc(-50% - (var(--activity-gap) / 2)));
  }
`;

type ActivitySequenceProps = {
  duplicate?: boolean;
};

function ActivitySequence({ duplicate = false }: ActivitySequenceProps) {
  return (
    <Box
      component="ul"
      aria-hidden={duplicate || undefined}
      sx={{
        display: "flex",
        flexShrink: 0,
        gap: "var(--activity-gap)",
        m: 0,
        p: 0,
        listStyle: "none",
      }}
    >
      {activityGallery.map((activity, index) => (
        <Box
          component="li"
          key={`${duplicate ? "duplicate" : "primary"}-${activity.src}`}
          sx={{
            flex: "0 0 auto",
            width: {
              xs: "min(78vw, 320px)",
              sm: 330,
              md: 360,
              lg: 390,
            },
            scrollSnapAlign: "start",
          }}
        >
          <Box
            sx={{
              aspectRatio: "4 / 3",
              overflow: "hidden",
              borderRadius: { xs: 3, md: 4 },
              border: "1px solid",
              borderColor: "rgba(30, 58, 138, 0.12)",
              bgcolor: "common.white",
              boxShadow: "0 16px 36px rgba(15, 23, 42, 0.10)",
            }}
          >
            <Box
              component="img"
              src={activity.src}
              alt={duplicate ? "" : activity.alt}
              loading="lazy"
              decoding="async"
              sx={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: index < 4 ? "center 38%" : "center",
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function ActivityGallerySection() {
  return (
    <Box
      component="section"
      id="activities"
      aria-labelledby="activities-heading"
      sx={{
        bgcolor: "#f7f4ed",
        py: { xs: 8, md: 11 },
        borderBlock: "1px solid",
        borderColor: "rgba(15, 23, 42, 0.06)",
      }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2.5, sm: 4, lg: 5 } }}>
        <Reveal>
          <Box sx={{ maxWidth: 760, mb: { xs: 4, md: 6 } }}>
            <Typography
              variant="overline"
              color="success.dark"
              fontWeight={750}
              letterSpacing="0.12em"
            >
              DCLA Activities
            </Typography>
            <Typography
              id="activities-heading"
              component="h2"
              sx={{
                mt: 1,
                fontSize: { xs: "2rem", md: "2.75rem" },
                fontWeight: 750,
                lineHeight: 1.15,
                color: "#0f172a",
              }}
            >
              Supporting businesses and communities beyond lending.
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ mt: 2, fontSize: { xs: "1rem", md: "1.125rem" } }}
            >
              A glimpse into the activities, client engagement, and community
              initiatives of DCLA Business Solutions.
            </Typography>
          </Box>
        </Reveal>
      </Box>

      <Box
        role="region"
        aria-label="DCLA activities photo gallery"
        tabIndex={0}
        sx={{
          "--activity-gap": { xs: "16px", md: "24px" },
          overflow: "hidden",
          py: 1,
          outline: "none",
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "success.main",
            outlineOffset: -3,
          },
          "&:hover .activity-marquee-track, &:focus-within .activity-marquee-track":
            {
              animationPlayState: "paused",
            },
          "@media (prefers-reduced-motion: reduce)": {
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollPaddingInline: { xs: 2.5, sm: 4, lg: 5 },
            scrollbarWidth: "thin",
            overscrollBehaviorInline: "contain",
            WebkitOverflowScrolling: "touch",
            "& .activity-marquee-track": {
              animation: "none",
              transform: "none",
              pl: { xs: 2.5, sm: 4, lg: 5 },
              pr: { xs: 2.5, sm: 4, lg: 5 },
            },
            "& .activity-marquee-duplicate": {
              display: "none",
            },
          },
        }}
      >
        <Box
          className="activity-marquee-track"
          sx={{
            display: "flex",
            width: "max-content",
            gap: "var(--activity-gap)",
            animation: `${activityMarquee} 40s linear infinite`,
            willChange: "transform",
          }}
        >
          <ActivitySequence />
          <Box className="activity-marquee-duplicate" sx={{ display: "flex" }}>
            <ActivitySequence duplicate />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
