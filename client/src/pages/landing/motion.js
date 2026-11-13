import { useEffect, useRef, useState } from "react";

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Adds `is-in` to every [data-reveal] element inside `rootRef` the first time
 * it scrolls into view. One shared observer, no re-renders.
 */
export function useRevealAll(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll("[data-reveal]");
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    root.classList.add("lp-js");
    return () => {
      io.disconnect();
      root.classList.remove("lp-js");
    };
  }, [rootRef]);
}

/** Animated number that counts up once when it becomes visible. */
export function useCountUp(to, duration = 1400) {
  const ref = useRef(null);
  const [value, setValue] = useState(() => (prefersReducedMotion() ? to : 0));
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return [ref, value];
}

/** Gentle pointer-driven tilt for the hero product stage (desktop pointers only). */
export function useTilt(max = 5) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", `${(-6 + x * max).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(4 - y * max).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      el.style.removeProperty("--ry");
      el.style.removeProperty("--rx");
    };
    const host = el.parentElement;
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [max]);
  return ref;
}

export const REPO_URL = "https://github.com/RimonDipta/bachelorMate";

/**
 * Smooth in-page scrolling that respects reduced-motion preferences. Links use
 * href="/#id", so on other pages (e.g. /privacy) they simply navigate home.
 */
export function scrollToId(e, id) {
  const el = document.getElementById(id);
  if (!el) return;
  e?.preventDefault();
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}
