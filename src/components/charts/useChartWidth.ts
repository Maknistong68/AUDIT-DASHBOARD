"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * The rendered width of a chart's wrapper, in CSS pixels.
 *
 * Hand-built SVG charts here use `width: 100%`, so a fixed viewBox means the
 * whole drawing — type included — is scaled by (rendered width / viewBox
 * width). At a 720-unit viewBox in a 332px card that is 0.46×, which turns
 * 12.5px labels into 6px ones. Drawing at the measured width instead keeps
 * the scale at 1:1, so a label is the size it says it is on every screen.
 *
 * Starts at `fallback` so the server render and the first client render
 * agree; the observer corrects it on mount.
 */
export function useChartWidth(
  ref: RefObject<HTMLElement | null>,
  fallback: number,
  min = 300,
): number {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      if (measured > 0) setWidth(Math.max(min, Math.round(measured)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, min]);

  return width;
}
