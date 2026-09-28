import type { Tier } from '../../data/pokedex';

/**
 * Cor de cada raridade. Hex literal e não token: são cinco cores que só existem
 * aqui, e o tema continua sendo o zinc + âmbar do resto do app.
 */
export const TIER_STYLE: Record<Tier, { text: string; bg: string; border: string; glow: string }> = {
  common: {
    text: 'text-[#A1A1AA]',
    bg: 'bg-[#A1A1AA]/10',
    border: 'border-[#A1A1AA]/30',
    glow: 'rgba(161, 161, 170, 0.25)',
  },
  uncommon: {
    text: 'text-[#34D399]',
    bg: 'bg-[#34D399]/10',
    border: 'border-[#34D399]/30',
    glow: 'rgba(52, 211, 153, 0.3)',
  },
  rare: {
    text: 'text-[#60A5FA]',
    bg: 'bg-[#60A5FA]/10',
    border: 'border-[#60A5FA]/30',
    glow: 'rgba(96, 165, 250, 0.35)',
  },
  epic: {
    text: 'text-[#C084FC]',
    bg: 'bg-[#C084FC]/10',
    border: 'border-[#C084FC]/30',
    glow: 'rgba(192, 132, 252, 0.4)',
  },
  legendary: {
    text: 'text-[#FBBF24]',
    bg: 'bg-[#FBBF24]/10',
    border: 'border-[#FBBF24]/40',
    glow: 'rgba(251, 191, 36, 0.5)',
  },
};
