import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";

type BrandVariant = "mark" | "lockup";
type BrandSize = "sm" | "md" | "lg";
type BrandAnimationPreset = "static" | "subtle" | "splash";

interface BrandMarkProps {
  variant?: BrandVariant;
  size?: BrandSize;
  animate?: boolean;
  animationPreset?: BrandAnimationPreset;
  subtitle?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: {
    mark: "h-9 w-9 rounded-xl",
    icon: "h-4 w-4",
    title: "text-base",
    gap: "gap-3",
    pill: "px-2 py-0.5 text-[9px]",
    subtitle: "text-[10px] tracking-[0.22em]",
  },
  md: {
    mark: "h-11 w-11 rounded-2xl",
    icon: "h-5 w-5",
    title: "text-xl sm:text-2xl",
    gap: "gap-3",
    pill: "px-2 py-0.5 text-[10px]",
    subtitle: "text-[11px] tracking-[0.28em]",
  },
  lg: {
    mark: "h-14 w-14 rounded-[1.35rem]",
    icon: "h-7 w-7",
    title: "text-2xl sm:text-3xl",
    gap: "gap-4",
    pill: "px-2.5 py-0.5 text-[10px]",
    subtitle: "text-[11px] tracking-[0.3em]",
  },
} as const;

export function BrandMark({
  variant = "lockup",
  size = "md",
  animate = false,
  animationPreset,
  subtitle = "Movement Analysis",
  className,
}: BrandMarkProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = SIZE_MAP[size];
  const resolvedPreset: BrandAnimationPreset =
    animationPreset ?? (animate ? "subtle" : "static");
  const shouldAnimate = resolvedPreset !== "static" && !prefersReducedMotion;

  const markInitial =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          opacity: 0,
          scale: 0.92,
          y: 10,
          rotate: -3,
        }
      : shouldAnimate
        ? {
            opacity: 0,
            scale: 0.97,
            y: 6,
          }
        : false;

  const markAnimate =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          opacity: 1,
          scale: 1,
          y: 0,
          rotate: 0,
        }
      : shouldAnimate
        ? {
            opacity: 1,
            scale: 1,
            y: 0,
          }
        : undefined;

  const markTransition =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          duration: size === "sm" ? 0.7 : size === "md" ? 0.82 : 0.92,
          ease: [0.22, 1, 0.36, 1] as const,
        }
      : shouldAnimate
        ? {
            duration: size === "sm" ? 0.34 : size === "md" ? 0.38 : 0.44,
            ease: [0.22, 1, 0.36, 1] as const,
          }
        : undefined;

  const iconInitial =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          opacity: 0,
          scale: 0.84,
          rotate: -10,
        }
      : shouldAnimate
        ? {
            opacity: 0,
            scale: 0.92,
          }
        : false;

  const iconAnimate =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          opacity: 1,
          scale: 1,
          rotate: 0,
        }
      : shouldAnimate
        ? {
            opacity: 1,
            scale: 1,
          }
        : undefined;

  const iconTransition =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          duration: size === "sm" ? 0.62 : size === "md" ? 0.7 : 0.78,
          ease: [0.22, 1, 0.36, 1] as const,
          delay: 0.08,
        }
      : shouldAnimate
        ? {
            duration: 0.28,
            ease: [0.22, 1, 0.36, 1] as const,
            delay: 0.04,
          }
        : undefined;

  const copyInitial =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          opacity: 0,
          y: 12,
        }
      : shouldAnimate
        ? {
            opacity: 0,
            y: 6,
          }
        : false;

  const copyAnimate =
    shouldAnimate
      ? {
          opacity: 1,
          y: 0,
        }
      : undefined;

  const copyTransition =
    shouldAnimate && resolvedPreset === "splash"
      ? {
          duration: 0.56,
          ease: [0.22, 1, 0.36, 1] as const,
          delay: 0.12,
        }
      : shouldAnimate
        ? {
            duration: 0.26,
            ease: [0.22, 1, 0.36, 1] as const,
            delay: 0.08,
          }
        : undefined;

  const mark = (
    <motion.div
      className={cn(
        "brand-mark-shell inline-flex items-center justify-center bg-gradient-to-br from-cyan-300 to-teal-400 text-slate-950 shadow-[0_12px_36px_rgba(34,211,238,0.22)]",
        config.mark,
      )}
      initial={markInitial}
      animate={markAnimate}
      transition={markTransition}
    >
      <motion.div
        initial={iconInitial}
        animate={iconAnimate}
        transition={iconTransition}
      >
        <Search className={cn(config.icon)} strokeWidth={2.5} />
      </motion.div>
    </motion.div>
  );

  if (variant === "mark") {
    return <div className={className}>{mark}</div>;
  }

  return (
    <div className={cn("brand-lockup flex items-center min-w-0", config.gap, className)}>
      {mark}
      <motion.div
        className="min-w-0"
        initial={copyInitial}
        animate={copyAnimate}
        transition={copyTransition}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "brand-title truncate font-display font-bold tracking-tight text-app-text",
              config.title,
            )}
          >
            Rank Analyzer
          </span>
          <span
            className={cn(
              "brand-pro-pill shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/8 font-black uppercase tracking-[0.18em] text-cyan-300",
              config.pill,
            )}
          >
            Pro
          </span>
        </div>
        {subtitle ? (
          <p
            className={cn(
              "brand-subtitle mt-1 truncate font-semibold uppercase text-app-text-muted",
              config.subtitle,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}

export default BrandMark;
