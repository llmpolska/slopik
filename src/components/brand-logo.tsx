"use client";
import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";

type Placement = {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
};
export function BrandLogo({
  dock,
  gate,
  verified,
  playing,
  panelOpen,
}: {
  dock: RefObject<HTMLDivElement | null>;
  gate: HTMLElement | null;
  verified: boolean;
  playing: boolean;
  panelOpen: boolean;
}) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const slot = dock.current;
    if (!slot || (!verified && !gate)) return;
    const measure = () => {
      const target = slot.getBoundingClientRect();
      let x = target.x,
        y = target.y,
        scale = 1;
      if (!verified && gate) {
        const bounds = gate.getBoundingClientRect();
        const top = bounds.top + bounds.height / 2 - gate.offsetHeight / 2;
        const gap = 16;
        const width = Math.min(
          gate.offsetWidth * 0.65,
          (Math.max(0, top - gap - 8) * target.width) / target.height,
        );
        scale = width / target.width;
        x = bounds.left + bounds.width / 2 - width / 2;
        y = top - target.height * scale - gap;
      }
      setPlacement({ x, y, scale, width: target.width, height: target.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    if (gate) observer.observe(gate);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [dock, gate, verified]);
  if (!placement) return null;
  return createPortal(
    <motion.a
      className="wordmark floating-wordmark"
      href="/"
      aria-label="Slopik, strona główna"
      aria-hidden={!verified || panelOpen}
      tabIndex={verified && !panelOpen ? 0 : -1}
      initial={false}
      animate={{ x: placement.x, y: placement.y, scale: placement.scale }}
      transition={{
        type: "tween",
        duration: reduced ? 0 : 0.9,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      style={{
        width: placement.width,
        height: placement.height,
        zIndex: panelOpen ? 2 : 52,
        pointerEvents: verified && !panelOpen ? "auto" : "none",
      }}
    >
      <img
        src={playing ? "/assets/logo.webp" : "/assets/logo-static.webp"}
        width="350"
        height="350"
        alt="Slopik.pl"
        fetchPriority="high"
      />
    </motion.a>,
    document.body,
  );
}
