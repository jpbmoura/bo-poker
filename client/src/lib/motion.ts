import type { Transition } from 'framer-motion';

/**
 * Presets de motion compartilhados. Espelham os tokens do tailwind.config
 * (`ease-out-expo`, `ease-spring-soft`, `duration-fast|base|slow`) para que
 * CSS e framer-motion falem a mesma língua.
 */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const EASE_SPRING_SOFT = [0.34, 1.56, 0.64, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.36,
} as const;

/** Entradas de painéis, toasts e barras: rápido e sem quicar. */
export const enter: Transition = { duration: DURATION.slow, ease: EASE_OUT_EXPO };

/** Saídas são sempre mais curtas que entradas. */
export const exit: Transition = { duration: DURATION.fast, ease: 'easeIn' };

/** Mola para elementos que "assentam" (layout, pop de feedback). */
export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 32 };
export const springSoft: Transition = { type: 'spring', stiffness: 220, damping: 20 };
