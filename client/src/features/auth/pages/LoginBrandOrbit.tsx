import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Box, Button, useMediaQuery } from "@mui/material";
import {
  PauseCircleOutline,
  PlayCircleOutline,
} from "@mui/icons-material";
import dclaLogo from "../../../assets/dcla-logo.png";
import activity01 from "../../../assets/activities/activity-01.jpg";
import activity02 from "../../../assets/activities/activity-02.jpg";
import activity03 from "../../../assets/activities/activity-03.jpg";
import activity04 from "../../../assets/activities/activity-04.jpg";
import activity05 from "../../../assets/activities/activity-05.jpg";
import activity06 from "../../../assets/activities/activity-06.jpg";
import activity07 from "../../../assets/activities/activity-07.jpg";
import activity08 from "../../../assets/activities/activity-08.jpg";
import activity09 from "../../../assets/activities/activity-09.jpg";
import activity10 from "../../../assets/activities/activity-10.jpg";
import activity11 from "../../../assets/activities/activity-11.jpg";
import activity12 from "../../../assets/activities/activity-12.jpg";
import activity13 from "../../../assets/activities/activity-13.jpg";
import activity14 from "../../../assets/activities/activity-14.jpg";
import activity15 from "../../../assets/activities/activity-15.jpg";
import activity16 from "../../../assets/activities/activity-16.jpg";
import "./LoginBrandOrbit.css";

const activityPhotos = [
  activity01,
  activity02,
  activity03,
  activity04,
  activity05,
  activity06,
  activity07,
  activity08,
  activity09,
  activity10,
  activity11,
  activity12,
  activity13,
  activity14,
  activity15,
  activity16,
];

const slotCount = 6;
const orbitDurationMs = 32_000;
const crossfadeDurationMs = 650;

type SlotImage = {
  current: number;
  incoming: number | null;
  crossfading: boolean;
};

const initialSlotImages = Array.from({ length: slotCount }, (_, index) => ({
  current: index,
  incoming: null,
  crossfading: false,
}));

export default function LoginBrandOrbit() {
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const hasFinePointer = useMediaQuery("(hover: hover) and (pointer: fine)");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Array<HTMLDivElement | null>>([]);
  const animationFrameRef = useRef<number | null>(null);
  const parallaxFrameRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rearZoneRef = useRef(Array(slotCount).fill(false));
  const nextImageRef = useRef(slotCount);
  const swapInFlightRef = useRef(Array(slotCount).fill(false));
  const swapTimersRef = useRef<number[]>([]);
  const [slotImages, setSlotImages] = useState<SlotImage[]>(initialSlotImages);
  const slotImagesRef = useRef(slotImages);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(document.hidden);

  useEffect(() => {
    slotImagesRef.current = slotImages;
  }, [slotImages]);

  useEffect(() => {
    activityPhotos.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (parallaxFrameRef.current !== null) {
        cancelAnimationFrame(parallaxFrameRef.current);
      }
      swapTimersRef.current.forEach(window.clearTimeout);
    },
    [],
  );

  const getNextAvailableImage = useCallback(() => {
    const visibleImages = new Set<number>();
    slotImagesRef.current.forEach(({ current, incoming }) => {
      visibleImages.add(current);
      if (incoming !== null) visibleImages.add(incoming);
    });

    for (let offset = 0; offset < activityPhotos.length; offset += 1) {
      const candidate = (nextImageRef.current + offset) % activityPhotos.length;
      if (!visibleImages.has(candidate)) {
        nextImageRef.current = (candidate + 1) % activityPhotos.length;
        return candidate;
      }
    }

    return null;
  }, []);

  const swapSlotImage = useCallback(
    (slotIndex: number, failedCandidates = new Set<number>()) => {
      if (swapInFlightRef.current[slotIndex]) return;

      const candidate = getNextAvailableImage();
      if (candidate === null || failedCandidates.has(candidate)) return;

      swapInFlightRef.current[slotIndex] = true;
      const preloader = new Image();
      preloader.src = activityPhotos[candidate];

      preloader.onload = () => {
        setSlotImages((previous) =>
          previous.map((slot, index) =>
            index === slotIndex
              ? { ...slot, incoming: candidate, crossfading: true }
              : slot,
          ),
        );

        const timer = window.setTimeout(() => {
          setSlotImages((previous) =>
            previous.map((slot, index) =>
              index === slotIndex
                ? { current: candidate, incoming: null, crossfading: false }
                : slot,
            ),
          );
          swapInFlightRef.current[slotIndex] = false;
        }, crossfadeDurationMs);
        swapTimersRef.current.push(timer);
      };

      preloader.onerror = () => {
        swapInFlightRef.current[slotIndex] = false;
        failedCandidates.add(candidate);
        if (failedCandidates.size < activityPhotos.length - slotCount) {
          swapSlotImage(slotIndex, failedCandidates);
        }
      };
    },
    [getNextAvailableImage],
  );

  const renderOrbitFrame = useCallback(
    (elapsed: number, staticComposition = false) => {
      const root = rootRef.current;
      if (!root) return;

      const radiusX = root.clientWidth * 0.36;
      const radiusY = root.clientHeight * 0.23;
      const progress = (elapsed % orbitDurationMs) / orbitDurationMs;

      slotRefs.current.forEach((slot, index) => {
        if (!slot) return;

        const phase = index / slotCount;
        const angle = (progress + phase) * Math.PI * 2;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const depth = (sin + 1) / 2;
        const x = cos * radiusX;
        const y = sin * radiusY;
        const z = -118 + depth * 244;
        const scale = 0.64 + depth * 0.36;
        const opacity = staticComposition
          ? 0.76 + depth * 0.24
          : 0.4 + depth * 0.6;
        const shadowY = 7 + depth * 13;
        const shadowBlur = 16 + depth * 20;
        const shadowAlpha = 0.16 + depth * 0.24;

        slot.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) scale(${scale.toFixed(3)})`;
        slot.style.opacity = opacity.toFixed(3);
        slot.style.zIndex = String(Math.round(1 + depth * 6));
        slot.style.boxShadow = `0 ${shadowY.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(4, 18, 46, ${shadowAlpha.toFixed(3)}), 0 0 ${(
          depth * 12
        ).toFixed(1)}px rgba(52, 211, 153, ${(depth * 0.1).toFixed(3)})`;

        const isInRearSwapZone = sin < -0.96;
        if (
          !staticComposition &&
          elapsed > 1_000 &&
          isInRearSwapZone &&
          !rearZoneRef.current[index]
        ) {
          swapSlotImage(index);
        }
        rearZoneRef.current[index] = isInRearSwapZone;
      });
    },
    [swapSlotImage],
  );

  const motionPaused =
    userPaused ||
    hoverPaused ||
    focusPaused ||
    tabHidden ||
    prefersReducedMotion;

  useEffect(() => {
    if (prefersReducedMotion) {
      renderOrbitFrame(0, true);
      return;
    }

    renderOrbitFrame(elapsedRef.current);
    if (motionPaused) {
      lastFrameRef.current = null;
      return;
    }

    const animate = (timestamp: number) => {
      if (lastFrameRef.current !== null) {
        elapsedRef.current += Math.min(timestamp - lastFrameRef.current, 50);
      }
      lastFrameRef.current = timestamp;
      renderOrbitFrame(elapsedRef.current);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameRef.current = null;
    };
  }, [motionPaused, prefersReducedMotion, renderOrbitFrame]);

  useEffect(() => {
    const handleResize = () =>
      renderOrbitFrame(elapsedRef.current, prefersReducedMotion);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [prefersReducedMotion, renderOrbitFrame]);

  const resetParallax = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty("--parallax-x", "0px");
    stage.style.setProperty("--parallax-y", "0px");
    stage.style.setProperty("--parallax-rotate-x", "0deg");
    stage.style.setProperty("--parallax-rotate-y", "0deg");
  }, []);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hasFinePointer || prefersReducedMotion || !rootRef.current) return;
    const { clientX, clientY } = event;

    if (parallaxFrameRef.current !== null) {
      cancelAnimationFrame(parallaxFrameRef.current);
    }
    parallaxFrameRef.current = requestAnimationFrame(() => {
      const root = rootRef.current;
      const stage = stageRef.current;
      if (!root || !stage) return;
      const bounds = root.getBoundingClientRect();
      const normalizedX = (clientX - bounds.left) / bounds.width - 0.5;
      const normalizedY = (clientY - bounds.top) / bounds.height - 0.5;
      stage.style.setProperty(
        "--parallax-x",
        `${(normalizedX * 6).toFixed(2)}px`,
      );
      stage.style.setProperty(
        "--parallax-y",
        `${(normalizedY * 4).toFixed(2)}px`,
      );
      stage.style.setProperty(
        "--parallax-rotate-x",
        `${(-normalizedY * 1.2).toFixed(2)}deg`,
      );
      stage.style.setProperty(
        "--parallax-rotate-y",
        `${(normalizedX * 1.4).toFixed(2)}deg`,
      );
      parallaxFrameRef.current = null;
    });
  };

  const pauseLabel = useMemo(() => {
    if (prefersReducedMotion) return "Motion reduced";
    return userPaused ? "Resume motion" : "Pause motion";
  }, [prefersReducedMotion, userPaused]);

  return (
    <Box
      className="login-orbit"
      ref={rootRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setHoverPaused(true)}
      onPointerLeave={() => {
        setHoverPaused(false);
        resetParallax();
      }}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={() => setFocusPaused(false)}
    >
      <Button
        className="login-orbit-motion-toggle"
        size="small"
        color="inherit"
        disabled={prefersReducedMotion}
        aria-pressed={userPaused}
        onClick={() => setUserPaused((paused) => !paused)}
        startIcon={
          userPaused || prefersReducedMotion ? (
            <PlayCircleOutline aria-hidden="true" />
          ) : (
            <PauseCircleOutline aria-hidden="true" />
          )
        }
      >
        {pauseLabel}
      </Button>

      <Box className="login-orbit-stage" ref={stageRef} aria-hidden="true">
        <Box className="login-orbit-ring login-orbit-ring-outer" />
        <Box className="login-orbit-ring login-orbit-ring-inner" />
        {slotImages.map((slotImage, index) => (
          <Box
            className="login-orbit-photo"
            key={index}
            ref={(node: HTMLDivElement | null) => {
              slotRefs.current[index] = node;
            }}
          >
            <Box
              component="img"
              className={`login-orbit-photo-layer login-orbit-photo-current${
                slotImage.crossfading ? " is-fading" : ""
              }`}
              src={activityPhotos[slotImage.current]}
              alt=""
              loading="eager"
              onError={() => swapSlotImage(index)}
            />
            {slotImage.incoming !== null && (
              <Box
                component="img"
                className={`login-orbit-photo-layer login-orbit-photo-incoming${
                  slotImage.crossfading ? " is-visible" : ""
                }`}
                src={activityPhotos[slotImage.incoming]}
                alt=""
                onError={() => swapSlotImage(index)}
              />
            )}
          </Box>
        ))}
        <Box className="login-orbit-logo">
          <Box component="img" src={dclaLogo} alt="" />
        </Box>
      </Box>
    </Box>
  );
}
