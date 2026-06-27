"use client";

import {
  MotionConfig,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionProps,
} from "framer-motion";
import Link, { type LinkProps } from "next/link";
import { useEffect, useRef, type AnchorHTMLAttributes, type ReactNode } from "react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

/* ──────────────────────────────────────────────
 * MotionRoot — wraps landing in MotionConfig so
 * prefers-reduced-motion disables animations
 * WITHOUT changing rendered DOM structure (SSR-safe).
 * ────────────────────────────────────────────── */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="never">{children}</MotionConfig>;
}

/* ──────────────────────────────────────────────
 * SplitHeadline — word-level entrance reveal.
 * Always renders same DOM structure for SSR-safe hydration.
 * framer-motion's MotionConfig (or system reduce-motion) handles
 * disabling at runtime.
 * ────────────────────────────────────────────── */
export function SplitHeadline({
  text,
  className = "",
  delay = 0,
  stagger = 0.05,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={`split-headline ${className}`.trim()} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className="split-headline-word" aria-hidden>
          <motion.span
            className="split-headline-inner"
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{
              delay: delay + i * stagger,
              duration: 0.6,
              ease: easeOutExpo,
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/* ──────────────────────────────────────────────
 * MockupParallax — wraps a mockup, tilts on cursor.
 * Initial values at 0,0 so SSR output matches client.
 * ────────────────────────────────────────────── */
export function MockupParallax({
  children,
  intensity = 5,
}: {
  children: ReactNode;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-1, 1], [intensity, -intensity]), {
    stiffness: 140,
    damping: 20,
    mass: 0.5,
  });
  const rotateY = useSpring(useTransform(mx, [-1, 1], [-intensity, intensity]), {
    stiffness: 140,
    damping: 20,
    mass: 0.5,
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onMove = (e: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mx.set(Math.max(-1, Math.min(1, x)));
      my.set(Math.max(-1, Math.min(1, y)));
    };
    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [mx, my]);

  return (
    <motion.div
      ref={ref}
      className="parallax-host"
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1400,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
 * SectionReveal — sharp scroll-triggered slide.
 * Always renders motion structure for hydration parity.
 * ────────────────────────────────────────────── */
export function SectionReveal({
  children,
  delay = 0,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "header" | "footer";
}) {
  const MotionTag = motion[as] as React.ComponentType<MotionProps & { className?: string }>;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px", amount: 0.15 }}
      transition={{ delay, duration: 0.42, ease: easeOutExpo }}
    >
      {children}
    </MotionTag>
  );
}

/* ──────────────────────────────────────────────
 * MotionLink — Link wrapped in motion.span for
 * whileHover/whileTap. Avoids motion(Link) HOC
 * which causes hydration drift on tabindex/refs.
 * ────────────────────────────────────────────── */
type MotionLinkProps = LinkProps<string> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { children?: ReactNode };

export function MotionLink({
  href,
  prefetch,
  replace,
  scroll,
  shallow,
  locale,
  className,
  children,
  ...rest
}: MotionLinkProps) {
  return (
    <motion.span
      className="motion-link-wrap"
      whileHover={{ y: -1, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 22, mass: 0.4 }}
    >
      <Link
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        shallow={shallow}
        locale={locale}
        className={className}
        {...rest}
      >
        {children}
      </Link>
    </motion.span>
  );
}

/* ──────────────────────────────────────────────
 * MockupScrollDrift — slight perspective drift
 * tied to scroll progress.
 * ────────────────────────────────────────────── */
export function MockupScrollDrift({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [24, -24]);
  return (
    <div ref={ref}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
