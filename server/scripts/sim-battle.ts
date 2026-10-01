// Simulador de balanceamento: roda milhares de batalhas por tier e imprime a
// taxa de vitória e o bônus médio. Não roda em produção.
//
//   pnpm --filter bo-poker-server sim:battle [batalhas por célula]
//
// O jogador simulado joga sempre a melhor carta (greedy = 1); um humano joga
// parecido ou melhor, porque enxerga a efetividade na carta.

import { EVOLUTION_LINES, TIERS, XP_THRESHOLDS, resolveForm, wildSpecies, type Tier } from '../src/data/pokedex.js';
import { battleBonus, playerLevel, wildLevel } from '../src/battle/balance.js';
import { chooseCard, createBattle, hpRatio, playCard } from '../src/battle/engine.js';

const N = Number(process.argv[2] ?? 2000);

/** Perfis de Pokémon do jogador: estágio e XP típicos. */
const PROFILES = [
  { label: 'estágio 1 (0 XP)', stage: 0, xp: 0 },
  { label: 'estágio 1 (150 XP)', stage: 0, xp: 150 },
  { label: 'estágio 2 (350 XP)', stage: 1, xp: 350 },
  { label: 'estágio 3 (700 XP)', stage: 2, xp: 700 },
];

let seed = 12345;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];

const wildByTier = new Map<Tier, ReturnType<typeof wildSpecies>>();
for (const s of wildSpecies()) wildByTier.set(s.tier, [...(wildByTier.get(s.tier) ?? []), s]);

const threeStage = EVOLUTION_LINES.filter((l) => l.stages.length === 3);

console.log(`${N} batalhas por célula. XP_THRESHOLDS = ${XP_THRESHOLDS.join('/')}\n`);
const header = ['perfil'.padEnd(22), ...TIERS.map((t) => t.padStart(20))];
console.log(header.join(''));

for (const profile of PROFILES) {
  const cells: string[] = [profile.label.padEnd(22)];
  for (const tier of TIERS) {
    let wins = 0;
    let bonus = 0;
    let turns = 0;
    for (let i = 0; i < N; i++) {
      const line = pick(threeStage);
      const form = resolveForm(line.id, profile.stage, null)!;
      const wild = pick(wildByTier.get(tier)!);
      let state = createBattle(
        { dexId: form.id, name: form.name, level: playerLevel(profile.xp) },
        { dexId: wild.entry.id, name: wild.entry.name, level: wildLevel(tier, playerLevel(profile.xp)) },
        Math.floor(rand() * 2 ** 31),
      );
      while (state.outcome === 'active') {
        state = playCard(state, chooseCard(state, 'player', 1).uid).state;
      }
      turns += state.turn;
      if (state.outcome === 'won') {
        wins++;
        bonus += battleBonus(hpRatio(state));
      }
    }
    const rate = ((wins / N) * 100).toFixed(0);
    const avgBonus = wins ? (bonus / wins).toFixed(0) : '-';
    cells.push(`${rate}% +${avgBonus} ${(turns / N).toFixed(1)}t`.padStart(20));
  }
  console.log(cells.join(''));
}
console.log('\ncélula = vitória% +bônus médio na vitória, turnos médios');
