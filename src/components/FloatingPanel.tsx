"use client";

import { useEffect, useRef } from "react";

/**
 * Floating overlay panel. Closes on Escape or a click outside, locks the page
 * behind it, and moves focus into the panel so keyboard users land inside it.
 */
export function FloatingPanel({
  title,
  subtitle,
  onClose,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Present on a deeper drill-down level; Escape goes back before it
   * closes, so the panel behaves like the levels it shows. */
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (onBack) onBack();
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onBack]);

  return (
    <div
      className="panel-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel-floating"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="panel-floating-head">
          {onBack && (
            <button
              className="panel-back"
              type="button"
              onClick={onBack}
              aria-label="Back"
            >
              ‹
            </button>
          )}
          <div className="panel-floating-title">
            <h2>{title}</h2>
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
          <button
            className="panel-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="panel-floating-body">{children}</div>
      </div>
    </div>
  );
}
