import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Box, Typography, useMediaQuery } from "@mui/material";
import { activityGallery } from "../data/activityGallery";
import Reveal from "./Reveal";

const VISIBLE_SLOT_COUNT = 10;
const READY_BUFFER_SIZE = 4;
const MARQUEE_SPEED_PX_PER_SECOND = 96;

type Activity = (typeof activityGallery)[number];
type ActivitySourceState = "idle" | "loading" | "ready" | "visible" | "error";
type ActivitySlot = {
  id: number;
  sourceIndex: number | null;
};

const createEmptySlots = (): ActivitySlot[] =>
  Array.from({ length: VISIBLE_SLOT_COUNT }, (_, id) => ({
    id,
    sourceIndex: null,
  }));

function preloadActivityImage(
  sourceIndex: number,
  priority: "high" | "low",
): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };

    image.decoding = "async";
    image.setAttribute("fetchpriority", priority);
    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // A completed load remains usable when decode() is unavailable or rejects.
      }
      finish(true);
    };
    image.onerror = () => finish(false);
    image.src = activityGallery[sourceIndex].src;
  });
}

type ActivityCardProps = {
  activity?: Activity;
  sourceIndex?: number;
};

const ActivityCard = memo(function ActivityCard({
  activity,
  sourceIndex,
}: ActivityCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Box
      data-loaded={isLoaded}
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "4 / 3",
        overflow: "hidden",
        borderRadius: { xs: 3, md: 4 },
        border: "1px solid",
        borderColor: "rgba(30, 58, 138, 0.12)",
        bgcolor: "#e8eef5",
        background:
          "linear-gradient(135deg, #e4edf6 0%, #edf1ec 52%, #f3eee3 100%)",
        boxShadow: "0 16px 36px rgba(15, 23, 42, 0.10)",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "linear-gradient(110deg, rgba(30, 58, 138, 0.08), rgba(255, 255, 255, 0.28), rgba(22, 101, 52, 0.06))",
          opacity: 1,
          transition: "opacity 260ms ease-out",
        },
        "& .activity-marquee-image": {
          position: "relative",
          zIndex: 1,
          opacity: 0,
          transition: "opacity 260ms ease-out",
        },
        '&[data-loaded="true"]::before': {
          opacity: 0,
        },
        '&[data-loaded="true"] .activity-marquee-image': {
          opacity: 1,
        },
        "@media (prefers-reduced-motion: reduce)": {
          "&::before, & .activity-marquee-image": {
            transition: "none",
          },
        },
      }}
    >
      {activity && (
        <img
          className="activity-marquee-image"
          src={activity.src}
          alt={activity.alt}
          decoding="async"
          width={780}
          height={585}
          onLoad={() => setIsLoaded(true)}
          data-source-index={sourceIndex}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition:
              sourceIndex !== undefined && sourceIndex < 4
                ? "center 38%"
                : "center",
          }}
        />
      )}
    </Box>
  );
});

type StaticActivityGalleryProps = {
  isActivated: boolean;
};

function StaticActivityGallery({ isActivated }: StaticActivityGalleryProps) {
  return (
    <Box
      component="ul"
      sx={{
        display: "flex",
        width: "max-content",
        gap: "var(--activity-gap)",
        m: 0,
        px: { xs: 2.5, sm: 4, lg: 5 },
        py: 1,
        listStyle: "none",
      }}
    >
      {activityGallery.map((activity, sourceIndex) => (
        <Box
          component="li"
          key={activity.src}
          sx={{
            flex: "0 0 auto",
            width: "var(--activity-card-width)",
            scrollSnapAlign: "start",
          }}
        >
          <ActivityCard
            key={isActivated ? activity.src : `loading-${sourceIndex}`}
            activity={isActivated ? activity : undefined}
            sourceIndex={sourceIndex}
          />
        </Box>
      ))}
    </Box>
  );
}

export default function ActivityGallerySection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLUListElement | null>(null);
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);
  const positionsRef = useRef<number[]>(
    Array.from({ length: VISIBLE_SLOT_COUNT }, () => 0),
  );
  const trackOffsetRef = useRef(0);
  const strideRef = useRef(0);
  const sourceStatesRef = useRef<ActivitySourceState[]>(
    activityGallery.map(() => "idle"),
  );
  const readyQueueRef = useRef<number[]>([]);
  const nextSourceIndexRef = useRef(0);
  const isFillingBufferRef = useRef(false);
  const initializationPromiseRef = useRef<Promise<number[]> | null>(null);
  const slotsRef = useRef<ActivitySlot[]>(createEmptySlots());
  const mountedRef = useRef(true);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const supportsIntersectionObserver =
    typeof IntersectionObserver !== "undefined";
  const [slots, setSlots] = useState<ActivitySlot[]>(() => createEmptySlots());
  const [isActivated, setIsActivated] = useState(
    !supportsIntersectionObserver,
  );
  const [isInViewport, setIsInViewport] = useState(
    !supportsIntersectionObserver,
  );
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const [isPoolReady, setIsPoolReady] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !supportsIntersectionObserver) return;

    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsActivated(true);
        preloadObserver.disconnect();
      },
      { rootMargin: "800px 0px" },
    );
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => setIsInViewport(entry.isIntersecting),
      { threshold: 0 },
    );

    preloadObserver.observe(section);
    visibilityObserver.observe(section);
    return () => {
      preloadObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [supportsIntersectionObserver]);

  useEffect(() => {
    const handleVisibilityChange = () => setIsPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const reserveNextIdleSource = useCallback(() => {
    for (let attempt = 0; attempt < activityGallery.length; attempt += 1) {
      const sourceIndex = nextSourceIndexRef.current;
      nextSourceIndexRef.current =
        (nextSourceIndexRef.current + 1) % activityGallery.length;

      if (sourceStatesRef.current[sourceIndex] === "idle") {
        sourceStatesRef.current[sourceIndex] = "loading";
        return sourceIndex;
      }
    }

    return null;
  }, []);

  const syncReadyCount = useCallback(() => {
    galleryRef.current?.setAttribute(
      "data-ready-count",
      String(readyQueueRef.current.length),
    );
  }, []);

  const fillReadyBuffer = useCallback(async () => {
    if (isFillingBufferRef.current || !mountedRef.current) return;
    isFillingBufferRef.current = true;

    try {
      while (
        readyQueueRef.current.length < READY_BUFFER_SIZE &&
        mountedRef.current
      ) {
        const sourceIndex = reserveNextIdleSource();
        if (sourceIndex === null) break;

        const loaded = await preloadActivityImage(sourceIndex, "low");
        if (!mountedRef.current) return;

        if (loaded) {
          sourceStatesRef.current[sourceIndex] = "ready";
          readyQueueRef.current.push(sourceIndex);
          syncReadyCount();
        } else {
          sourceStatesRef.current[sourceIndex] = "error";
        }
      }
    } finally {
      isFillingBufferRef.current = false;
    }
  }, [reserveNextIdleSource, syncReadyCount]);

  useEffect(() => {
    if (
      !isActivated ||
      reducedMotion ||
      slotsRef.current.some((slot) => slot.sourceIndex !== null)
    ) {
      return;
    }

    let disposed = false;

    if (!initializationPromiseRef.current) {
      initializationPromiseRef.current = (async () => {
        const initialSources: number[] = [];

        while (
          initialSources.length < VISIBLE_SLOT_COUNT + READY_BUFFER_SIZE
        ) {
          const requiredCount =
            VISIBLE_SLOT_COUNT + READY_BUFFER_SIZE - initialSources.length;
          const candidates: number[] = [];

          for (let index = 0; index < requiredCount; index += 1) {
            const sourceIndex = reserveNextIdleSource();
            if (sourceIndex === null) break;
            candidates.push(sourceIndex);
          }

          if (candidates.length === 0) break;

          const loadedSources = await Promise.all(
            candidates.map(async (sourceIndex, candidateIndex) => {
              const priority =
                initialSources.length + candidateIndex < VISIBLE_SLOT_COUNT
                  ? "high"
                  : "low";
              const loaded = await preloadActivityImage(sourceIndex, priority);
              sourceStatesRef.current[sourceIndex] = loaded
                ? "ready"
                : "error";
              return loaded ? sourceIndex : null;
            }),
          );

          initialSources.push(
            ...loadedSources.filter(
              (sourceIndex): sourceIndex is number => sourceIndex !== null,
            ),
          );
        }

        return initialSources;
      })();
    }

    const initializePool = async () => {
      const initialSources = await initializationPromiseRef.current;

      if (
        disposed ||
        !mountedRef.current ||
        !initialSources ||
        initialSources.length < VISIBLE_SLOT_COUNT
      ) {
        return;
      }

      const visibleSources = initialSources.slice(0, VISIBLE_SLOT_COUNT);
      readyQueueRef.current = initialSources.slice(
        VISIBLE_SLOT_COUNT,
        VISIBLE_SLOT_COUNT + READY_BUFFER_SIZE,
      );
      visibleSources.forEach((sourceIndex) => {
        sourceStatesRef.current[sourceIndex] = "visible";
      });

      const initializedSlots = visibleSources.map((sourceIndex, id) => ({
        id,
        sourceIndex,
      }));
      slotsRef.current = initializedSlots;
      setSlots(initializedSlots);
      syncReadyCount();
      setIsPoolReady(true);
      void fillReadyBuffer();
    };

    void initializePool();
    return () => {
      disposed = true;
    };
  }, [
    fillReadyBuffer,
    isActivated,
    reducedMotion,
    reserveNextIdleSource,
    syncReadyCount,
  ]);

  const recycleSlot = useCallback(
    (slotId: number) => {
      const nextSourceIndex = readyQueueRef.current.shift();
      if (nextSourceIndex === undefined) {
        void fillReadyBuffer();
        return false;
      }

      const currentSlot = slotsRef.current[slotId];
      if (currentSlot.sourceIndex !== null) {
        sourceStatesRef.current[currentSlot.sourceIndex] = "idle";
      }
      sourceStatesRef.current[nextSourceIndex] = "visible";

      const nextSlots = slotsRef.current.map((slot) =>
        slot.id === slotId
          ? { ...slot, sourceIndex: nextSourceIndex }
          : slot,
      );
      slotsRef.current = nextSlots;
      setSlots(nextSlots);
      syncReadyCount();
      void fillReadyBuffer();
      return true;
    },
    [fillReadyBuffer, syncReadyCount],
  );

  const positionCards = useCallback(() => {
    const stage = stageRef.current;
    const firstCard = cardRefs.current[0];
    if (!stage || !firstCard) return;

    const cardWidth = firstCard.getBoundingClientRect().width;
    const gap = Number.parseFloat(
      getComputedStyle(stage).getPropertyValue("--activity-gap"),
    );
    if (cardWidth <= 0) return;

    const stride = cardWidth + (Number.isFinite(gap) ? gap : 0);
    const visualOrder = positionsRef.current
      .map((position, id) => ({
        id,
        position: position + trackOffsetRef.current,
      }))
      .sort((left, right) => left.position - right.position);

    strideRef.current = stride;
    trackOffsetRef.current = 0;
    if (trackRef.current) {
      trackRef.current.style.transform = "translate3d(0, 0, 0)";
    }
    visualOrder.forEach(({ id }, orderIndex) => {
      const position = orderIndex * stride;
      positionsRef.current[id] = position;
      const card = cardRefs.current[id];
      if (card) {
        card.style.transform = `translate3d(${position}px, 0, 0)`;
      }
    });
  }, []);

  useEffect(() => {
    positionCards();

    const stage = stageRef.current;
    if (!stage) return;

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(positionCards);
      resizeObserver.observe(stage);
      return () => resizeObserver.disconnect();
    }

    window.addEventListener("resize", positionCards);
    return () => window.removeEventListener("resize", positionCards);
  }, [positionCards]);

  const marqueePaused =
    !isPoolReady ||
    !isInViewport ||
    !isPageVisible ||
    isInteractionPaused;

  useEffect(() => {
    if (reducedMotion || marqueePaused) return;

    let animationFrame = 0;
    let previousTime: number | null = null;

    const animate = (time: number) => {
      const stride = strideRef.current;
      if (previousTime === null) previousTime = time;
      const elapsed = Math.min(time - previousTime, 50);
      previousTime = time;

      if (stride > 0) {
        let movement = (MARQUEE_SPEED_PX_PER_SECOND * elapsed) / 1000;
        const leadingSlotId = positionsRef.current.reduce(
          (leadingId, position, id, positions) =>
            position + trackOffsetRef.current <
            positions[leadingId] + trackOffsetRef.current
              ? id
              : leadingId,
          0,
        );
        const leadingPosition =
          positionsRef.current[leadingSlotId] + trackOffsetRef.current;

        if (
          leadingPosition - movement <= -stride &&
          readyQueueRef.current.length === 0
        ) {
          movement = Math.max(0, leadingPosition + stride);
          void fillReadyBuffer();
        }

        trackOffsetRef.current -= movement;

        const exitedSlotId = positionsRef.current.findIndex(
          (position) => position + trackOffsetRef.current <= -stride,
        );
        if (exitedSlotId >= 0 && recycleSlot(exitedSlotId)) {
          const furthestPosition = Math.max(...positionsRef.current);
          positionsRef.current[exitedSlotId] = furthestPosition + stride;
          const card = cardRefs.current[exitedSlotId];
          if (card) {
            card.style.transform = `translate3d(${positionsRef.current[exitedSlotId]}px, 0, 0)`;
          }
        }

        if (
          trackOffsetRef.current <=
          -stride * activityGallery.length
        ) {
          positionsRef.current = positionsRef.current.map(
            (position) => position + trackOffsetRef.current,
          );
          trackOffsetRef.current = 0;
          positionsRef.current.forEach((position, id) => {
            const card = cardRefs.current[id];
            if (card) {
              card.style.transform = `translate3d(${position}px, 0, 0)`;
            }
          });
        }

        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${trackOffsetRef.current}px, 0, 0)`;
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [
    fillReadyBuffer,
    marqueePaused,
    recycleSlot,
    reducedMotion,
  ]);

  return (
    <Box
      component="section"
      ref={sectionRef}
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
        ref={(node) => {
          galleryRef.current = node as HTMLDivElement | null;
        }}
        role="region"
        aria-label="DCLA activities photo gallery"
        aria-busy={isActivated && !reducedMotion && !isPoolReady}
        aria-live="off"
        tabIndex={0}
        data-visible-slot-count={VISIBLE_SLOT_COUNT}
        data-ready-buffer-target={READY_BUFFER_SIZE}
        onMouseEnter={() => setIsInteractionPaused(true)}
        onMouseLeave={() => setIsInteractionPaused(false)}
        onFocus={() => setIsInteractionPaused(true)}
        onBlur={() => setIsInteractionPaused(false)}
        sx={{
          "--activity-gap": { xs: "16px", md: "24px" },
          "--activity-card-width": {
            xs: "min(78vw, 320px)",
            sm: "330px",
            md: "360px",
            lg: "390px",
          },
          overflow: "hidden",
          py: 1,
          outline: "none",
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "success.main",
            outlineOffset: -3,
          },
          ...(reducedMotion && {
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollPaddingInline: { xs: 2.5, sm: 4, lg: 5 },
            scrollbarWidth: "thin",
            overscrollBehaviorInline: "contain",
            WebkitOverflowScrolling: "touch",
          }),
        }}
      >
        {reducedMotion ? (
          <StaticActivityGallery isActivated={isActivated} />
        ) : (
          <Box
            ref={stageRef}
            className="activity-marquee-stage"
            data-pool-ready={isPoolReady}
            sx={{
              position: "relative",
              height: "calc(var(--activity-card-width) * 0.75)",
              opacity: isPoolReady ? 1 : 0.72,
              transition: "opacity 260ms ease-out",
              "@media (prefers-reduced-motion: reduce)": {
                transition: "none",
              },
            }}
          >
            <Box
              component="ul"
              ref={(node) => {
                trackRef.current = node as HTMLUListElement | null;
              }}
              sx={{
                position: "relative",
                width: "100%",
                height: "100%",
                m: 0,
                p: 0,
                listStyle: "none",
                willChange: "transform",
              }}
            >
              {slots.map((slot) => {
                const activity =
                  slot.sourceIndex === null
                    ? undefined
                    : activityGallery[slot.sourceIndex];

                return (
                  <Box
                    component="li"
                    key={slot.id}
                    ref={(node) => {
                      cardRefs.current[slot.id] = node as HTMLLIElement | null;
                    }}
                    data-activity-slot={slot.id}
                    data-activity-source-index={slot.sourceIndex ?? undefined}
                    sx={{
                      position: "absolute",
                      insetBlockStart: 0,
                      insetInlineStart: 0,
                      width: "var(--activity-card-width)",
                    }}
                  >
                    <ActivityCard
                      key={activity?.src ?? `loading-${slot.id}`}
                      activity={activity}
                      sourceIndex={slot.sourceIndex ?? undefined}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
