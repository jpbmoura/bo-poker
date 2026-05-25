/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        'surface-4': 'var(--surface-4)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        highlight: 'var(--highlight)',
        'highlight-soft': 'var(--highlight-soft)',
        brand: 'var(--brand)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px) rotate(-1deg)' },
          '40%': { transform: 'translateX(4px) rotate(1deg)' },
          '60%': { transform: 'translateX(-3px) rotate(-0.5deg)' },
          '80%': { transform: 'translateX(3px) rotate(0.5deg)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.6) translateY(8px)' },
          '30%': { opacity: '1', transform: 'scale(1.15) translateY(-2px)' },
          '50%': { transform: 'scale(0.96) translateY(0)' },
          '70%': { transform: 'scale(1.02)' },
          '85%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'card-in': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.92)' },
          '60%': { opacity: '1', transform: 'translateY(-4px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' },
          '50%': { boxShadow: '0 0 24px 4px rgba(245, 158, 11, 0.35)' },
        },
        'glow-once': {
          '0%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' },
          '40%': { boxShadow: '0 0 32px 6px rgba(245, 158, 11, 0.55)' },
          '100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0)' },
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
          '50%': { opacity: '0.65', transform: 'scale(1.06)' },
        },
        'selected-float': {
          '0%, 100%': { transform: 'translateY(-20px) scale(1.1)' },
          '50%': { transform: 'translateY(-23px) scale(1.1)' },
        },
        'slot-roll': {
          '0%': { transform: 'translateY(-12px) scale(0.92)', opacity: '0' },
          '40%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '60%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(10px) scale(0.92)', opacity: '0' },
        },
        'slot-land': {
          '0%': { transform: 'translateY(-8px) scale(0.85)', opacity: '0' },
          '55%': { transform: 'translateY(2px) scale(1.12)', opacity: '1' },
          '80%': { transform: 'translateY(-1px) scale(0.98)' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'reflow-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.94)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pre-flip-jitter': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-1.5px) translateY(-1px)' },
          '40%': { transform: 'translateX(1.5px) translateY(-1px)' },
          '60%': { transform: 'translateX(-1px)' },
          '80%': { transform: 'translateX(1px)' },
        },
        'waiting-pulse': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        'outlier-ring': {
          '0%, 100%': {
            boxShadow:
              '0 0 0 1px rgba(245, 158, 11, 0.55), 0 0 14px -2px rgba(245, 158, 11, 0.35)',
          },
          '50%': {
            boxShadow:
              '0 0 0 2px rgba(245, 158, 11, 0.85), 0 0 22px 0px rgba(245, 158, 11, 0.55)',
          },
        },
        'confetti-fall': {
          '0%': {
            transform: 'translate3d(0, -10vh, 0) rotate(var(--r0))',
            opacity: '0',
          },
          '8%': { opacity: '1' },
          '100%': {
            transform: 'translate3d(var(--drift), 110vh, 0) rotate(var(--r1))',
            opacity: '1',
          },
        },
        'confetti-cleanup': {
          'to': { display: 'none' },
        },
      },
      animation: {
        'shake': 'shake 0.5s ease-in-out',
        'pop-in': 'pop-in 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-in': 'fade-in 200ms ease-out',
        'fade-up': 'fade-up 360ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'card-in': 'card-in 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'spin-slow': 'spin-slow 1s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'glow-once': 'glow-once 2.4s ease-out 1',
        'card-pick': 'card-pick 540ms cubic-bezier(0.34, 1.6, 0.64, 1) forwards',
        'selected-halo': 'selected-halo 2.6s ease-in-out infinite',
        'selected-float': 'selected-float 2.8s ease-in-out infinite',
        'slot-roll': 'slot-roll 180ms ease-in-out',
        'slot-land': 'slot-land 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'reflow-in': 'reflow-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pre-flip-jitter': 'pre-flip-jitter 280ms ease-in-out',
        'waiting-pulse': 'waiting-pulse 1.6s ease-in-out infinite',
        'outlier-ring': 'outlier-ring 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
