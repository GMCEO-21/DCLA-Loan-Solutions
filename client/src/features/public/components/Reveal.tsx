import { useEffect, useRef, useState } from "react";
import { Box, useMediaQuery } from "@mui/material";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
};

export default function Reveal({ children, delay = 0 }: RevealProps) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const elementRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || visible || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.12 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Box
      ref={elementRef}
      sx={{
        opacity: visible || reducedMotion ? 1 : 0,
        transform:
          visible || reducedMotion ? "translateY(0)" : "translateY(18px)",
        transition: reducedMotion
          ? "none"
          : `opacity 480ms ease ${delay}ms, transform 480ms ease ${delay}ms`,
      }}
    >
      {children}
    </Box>
  );
}
