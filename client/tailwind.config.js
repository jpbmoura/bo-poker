/** @type {import('tailwindcss').Config} */

// Tokens definidos em index.css como canais RGB; <alpha-value> habilita bg-surface/40 etc.
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        'surface-3': c('surface-3'),
        'surface-4': c('surface-4'),
        border: c('border'),
        'border-strong': c('border-strong'),
        text: c('text'),
        muted: c('text-muted'),
        subtle: c('text-subtle'),
        success: c('success'),
        'success-soft': 'rgb(var(--success) / 0.12)',
        danger: c('danger'),
        'danger-soft': 'rgb(var(--danger) / 0.12)',
        highlight: c('highlight'),
        'highlight-soft': 'rgb(var(--highlight) / 0.14)',
        brand: c('brand'),
      },
      transitionTimingFunction: {
        // Entradas e deslocamentos: desacelera forte no fim.
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        // Overshoot leve: só para "pick"/"pop" (feedback de toque).
        'spring-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '220ms',
        slow: '360ms',
      },
      fontFamily: {
        sans: ['"Geist Pixel"', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        pixel: ['"Geist Pixel"', 'JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px) rotate(-1deg)' },
          '40%': { transform: 'translateX(4px) rotate(1deg)' },
          '60%': { transform: 'translateX(-3px) rotate(-0.5deg)' },
          '80%': { transform: 'translateX(3px) rotate(0.5deg)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--highlight) / 0)' },
          '50%': { boxShadow: '0 0 24px 4px rgb(var(--highlight) / 0.35)' },
        },
        'glow-once': {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--highlight) / 0)' },
          '40%': { boxShadow: '0 0 32px 6px rgb(var(--highlight) / 0.55)' },
          '100%': { boxShadow: '0 0 0 0 rgb(var(--highlight) / 0)' },
        },
        'card-pick': {
          '0%': { transform: 'translateY(0) scale(1)' },
          '35%': { transform: 'translateY(-34px) scale(1.2)' },
          '62%': { transform: 'translateY(-14px) scale(1.04)' },
          '82%': { transform: 'translateY(-22px) scale(1.12)' },
          '100%': { transform: 'translateY(-20px) scale(1.1)' },
        },
        'selected-halo': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(1.04)' },
        },
        // Pose de repouso da carta escolhida (-20px, 1.1) com respiro de 2px.
        'selected-float': {
          '0%, 100%': { transform: 'translateY(-20px) scale(1.1)' },
          '50%': { transform: 'translateY(-22px) scale(1.1)' },
        },
        // Batalha: entrada dos lutadores, cortina de abertura e respiros em "frames".
        'enter-from-left': {
          '0%': { transform: 'translateX(-140%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'enter-from-right': {
          '0%': { transform: 'translateX(140%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'curtain-up': {
          '0%': { transform: 'scaleY(1)' },
          '100%': { transform: 'scaleY(0)' },
        },
        'stripe-in': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'caret-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(2px)' },
        },
        'idle-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'outlier-ring': {
          '0%, 100%': {
            boxShadow:
              '0 0 0 1px rgb(var(--highlight) / 0.55), 0 0 14px -2px rgb(var(--highlight) / 0.35)',
          },
          '50%': {
            boxShadow:
              '0 0 0 2px rgb(var(--highlight) / 0.85), 0 0 22px 0px rgb(var(--highlight) / 0.55)',
          },
        },
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'fade-in': 'fade-in 200ms ease-out',
        'fade-up': 'fade-up 360ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'spin-slow': 'spin-slow 1s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'glow-once': 'glow-once 2.4s ease-out 1',
        'card-pick': 'card-pick 540ms cubic-bezier(0.34, 1.6, 0.64, 1) forwards',
        'selected-halo': 'selected-halo 3.2s ease-in-out infinite',
        'selected-float': 'selected-float 3.2s ease-in-out infinite',
        'outlier-ring': 'outlier-ring 2.2s ease-in-out infinite',
        'enter-from-left': 'enter-from-left 700ms cubic-bezier(0.16, 1, 0.3, 1) 250ms both',
        'enter-from-right': 'enter-from-right 700ms cubic-bezier(0.16, 1, 0.3, 1) 250ms both',
        'curtain-up': 'curtain-up 520ms cubic-bezier(0.7, 0, 0.84, 0) 120ms both',
        'stripe-in': 'stripe-in 380ms steps(6, end) both',
        'caret-bounce': 'caret-bounce 700ms steps(2, jump-none) infinite',
        'idle-bob': 'idle-bob 900ms steps(2, jump-none) infinite',
      },
    },
  },
  plugins: [],
};
