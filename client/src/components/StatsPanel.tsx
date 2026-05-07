import type { VoteStats } from '../utils/stats';
import { formatAverage } from '../utils/stats';

interface StatsPanelProps {
  stats: VoteStats;
  visible: boolean;
}

export function StatsPanel({ stats, visible }: StatsPanelProps) {
  if (!visible) return null;
  return (
    <div className="flex justify-center animate-fade-up">
      <div className="inline-flex items-baseline gap-3 px-5 py-2.5 bg-surface-2/60 border border-border rounded-full backdrop-blur">
        <span className="text-[10px] uppercase tracking-[0.18em] text-subtle">Média</span>
        <span className="text-xl font-mono font-semibold text-text">
          {formatAverage(stats.average)}
        </span>
      </div>
    </div>
  );
}
