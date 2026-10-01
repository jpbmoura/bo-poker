import type { Ailment, BattleEvent, MoveEffect, MoveView, Side, StatKey, TypeName } from '../../services/battle';

/**
 * Cor de cada tipo. Hex literal pelo mesmo motivo do `tierStyle.ts`: são cores
 * que só existem aqui. Tons da paleta oficial, levemente dessaturados para não
 * brigar com o tema escuro.
 */
export const TYPE_COLOR: Record<TypeName, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

export const TYPE_LABEL: Record<TypeName, string> = {
  normal: 'Normal',
  fire: 'Fogo',
  water: 'Água',
  electric: 'Elétrico',
  grass: 'Planta',
  ice: 'Gelo',
  fighting: 'Lutador',
  poison: 'Veneno',
  ground: 'Terra',
  flying: 'Voador',
  psychic: 'Psíquico',
  bug: 'Inseto',
  rock: 'Pedra',
  ghost: 'Fantasma',
  dragon: 'Dragão',
  dark: 'Sombrio',
  steel: 'Aço',
  fairy: 'Fada',
};

export const AILMENT_LABEL: Record<Ailment | 'confusion', string> = {
  paralysis: 'Paralisia',
  sleep: 'Sono',
  freeze: 'Congelamento',
  burn: 'Queimadura',
  poison: 'Veneno',
  toxic: 'Veneno grave',
  confusion: 'Confusão',
};

/** Sigla curta para o chip ao lado da barra de HP. */
export const AILMENT_CHIP: Record<Ailment, { label: string; color: string }> = {
  paralysis: { label: 'PAR', color: '#F7D02C' },
  sleep: { label: 'DOR', color: '#A1A1AA' },
  freeze: { label: 'CON', color: '#96D9D6' },
  burn: { label: 'QUE', color: '#EE8130' },
  poison: { label: 'ENV', color: '#A33EA1' },
  toxic: { label: 'TOX', color: '#A33EA1' },
};

export const STAT_LABEL: Record<StatKey, string> = {
  atk: 'Ataque',
  def: 'Defesa',
  spa: 'Atq. Esp.',
  spd: 'Def. Esp.',
  spe: 'Velocidade',
  acc: 'Precisão',
  eva: 'Evasão',
};

export const STAT_SHORT: Record<StatKey, string> = {
  atk: 'ATQ',
  def: 'DEF',
  spa: 'AE',
  spd: 'DE',
  spe: 'VEL',
  acc: 'PRE',
  eva: 'EVA',
};

const chancePrefix = (chance: number | undefined) =>
  chance !== undefined && chance < 100 ? `${chance}%: ` : '';

/** Texto do efeito na carta, curto. Vazio quando o golpe só causa dano. */
export function describeEffect(effect: MoveEffect | null): string[] {
  if (!effect) return [];
  const out: string[] = [];
  if (effect.ailment) {
    out.push(`${chancePrefix(effect.ailmentChance)}${AILMENT_LABEL[effect.ailment]} no alvo`);
  }
  if (effect.stats) {
    const who = effect.statTarget === 'self' ? 'em você' : 'no alvo';
    const parts = Object.entries(effect.stats).map(
      ([stat, n]) => `${STAT_LABEL[stat as StatKey]} ${n! > 0 ? '+' : ''}${n}`,
    );
    out.push(`${chancePrefix(effect.statChance)}${parts.join(', ')} ${who}`);
  }
  if (effect.heal) out.push(`Cura ${effect.heal}% do HP`);
  if (effect.drain) out.push(`Recupera ${effect.drain}% do dano`);
  return out;
}

export function effectivenessLabel(move: MoveView): { text: string; tone: 'good' | 'bad' | 'none' } | null {
  if (move.category === 'status') return null;
  if (move.effectiveness === 0) return { text: 'Sem efeito', tone: 'none' };
  if (move.effectiveness > 1) return { text: `Super efetivo ×${move.effectiveness}`, tone: 'good' };
  if (move.effectiveness < 1) return { text: `Pouco efetivo ×${move.effectiveness}`, tone: 'bad' };
  return null;
}

/** Uma linha do log de batalha. Null = evento sem texto (só anima). */
export function eventText(e: BattleEvent, names: Record<Side, string>): string | null {
  const who = (side: Side) => (side === 'player' ? names.player : `${names.wild} selvagem`);
  switch (e.kind) {
    case 'move':
      return `${who(e.side)} usou ${e.name}!`;
    case 'miss':
      return 'Errou!';
    case 'fail':
      return 'Mas não funcionou…';
    case 'damage':
      if (e.effectiveness === 0) return `Não afeta ${who(e.side)}.`;
      if (e.crit && e.effectiveness > 1) return 'Acerto crítico! É super efetivo!';
      if (e.crit) return 'Acerto crítico!';
      if (e.effectiveness > 1) return 'É super efetivo!';
      if (e.effectiveness < 1) return 'Não é muito efetivo…';
      return null;
    case 'heal':
      return `${who(e.side)} recuperou HP.`;
    case 'ailment':
      return `${who(e.side)} sofreu ${AILMENT_LABEL[e.ailment].toLowerCase()}!`;
    case 'cure':
      return e.ailment === 'sleep' ? `${who(e.side)} acordou!` : `${who(e.side)} descongelou!`;
    case 'confused':
      return `${who(e.side)} ficou confuso!`;
    case 'confusionEnd':
      return `${who(e.side)} não está mais confuso.`;
    case 'selfHit':
      return `${who(e.side)} se atacou na confusão!`;
    case 'skip':
      if (e.reason === 'sleep') return `${who(e.side)} está dormindo.`;
      if (e.reason === 'freeze') return `${who(e.side)} está congelado!`;
      return `${who(e.side)} está paralisado e não se move!`;
    case 'stat': {
      const stat = STAT_LABEL[e.stat];
      if (e.delta === 0) return `${stat} de ${who(e.side)} não muda mais.`;
      const size = Math.abs(e.delta) >= 2 ? ' muito' : '';
      return `${stat} de ${who(e.side)}${size} ${e.delta > 0 ? 'subiu' : 'caiu'}!`;
    }
    case 'residual':
      return e.ailment === 'burn'
        ? `${who(e.side)} sofre com a queimadura.`
        : `${who(e.side)} sofre com o veneno.`;
    case 'faint':
      return `${who(e.side)} desmaiou!`;
    case 'timeout':
      return 'O tempo acabou! O selvagem cansou de lutar.';
    case 'end':
      return null;
  }
}
