import type { Transition, Variants } from 'framer-motion'

/**
 * Shared Framer Motion presets. The motion budget: 150-350ms, spring bounce <= 0.15,
 * no 3D / parallax / looping motion. Screens import these instead of scattering numbers.
 * `<MotionConfig reducedMotion="user">` at the app root turns transform animations off for
 * users who prefer reduced motion.
 */

export const DURATION = {
  fast: 0.15,
  base: 0.2,
  slow: 0.3
} as const

export const EASE_OUT = [0.22, 1, 0.36, 1] as const

export const transitions = {
  fast: { duration: DURATION.fast, ease: EASE_OUT } satisfies Transition,
  base: { duration: DURATION.base, ease: EASE_OUT } satisfies Transition,
  slow: { duration: DURATION.slow, ease: EASE_OUT } satisfies Transition,
  /** Gentle spring for layout moves (active-tab pill, list reorder/removal). */
  spring: { type: 'spring', duration: 0.35, bounce: 0.1 } satisfies Transition
} as const

/** Screen/page transition (used by App for the active tab). */
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: transitions.base
} as const

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transitions.fast
} as const

export const slideDown = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: transitions.base
} as const

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base
} as const

/** Only the first N items of a long list are staggered; the rest appear at once. */
export const STAGGER_LIMIT = 12
export const STAGGER_STEP = 0.03

export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER_STEP, delayChildren: 0.02 } }
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: transitions.base }
}

/**
 * Per-item props for lists: items beyond STAGGER_LIMIT skip the entrance animation entirely.
 * Usage: <motion.li {...listItemProps(index)} />, parent: <motion.ul variants={listContainer} initial="hidden" animate="show">
 */
export function listItemProps(index: number): { variants: Variants } | { initial: false } {
  return index < STAGGER_LIMIT ? { variants: listItem } : { initial: false }
}

/** Press / hover feedback for chips and clickable cards. */
export const tapFeedback = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: transitions.fast
} as const

/** Shared layoutId prefixes: always suffix with the component instance (e.g. `${NAV_PILL}-sidebar`). */
export const LAYOUT_IDS = {
  navPill: 'nav-active-pill',
  tabPill: 'tab-active-pill'
} as const
