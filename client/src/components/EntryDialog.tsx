import { FormEvent, useEffect, useRef, useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { PokeballIcon } from './ui/PokeballIcon';
import { PLAYER_NAME_MAX_LENGTH } from '../types';
import type { PlayerRole, RoomError } from '../types';
import { updateUser, useSession } from '../services/auth';
import { useTrainer } from '../hooks/useTrainer';

interface EntryDialogProps {
  open: boolean;
  roomId: string;
  /** Null enquanto o prefetch nao respondeu; cai no codigo nesse caso. */
  roomName: string | null;
  joining: boolean;
  connected: boolean;
  error: RoomError | null;
  onSubmit: (data: { name: string; role: PlayerRole }) => void;
}

export function EntryDialog({
  open,
  roomId,
  roomName,
  joining,
  connected,
  error,
  onSubmit,
}: EntryDialogProps) {
  const { data: session } = useSession();
  const { active } = useTrainer();

  // Só o primeiro nome: numa mesa de refinamento é o que a pessoa quer, e o
  // nome completo do GitHub costuma estourar o card. Ela pode editar.
  const githubFirstName = (session?.user?.name ?? '')
    .trim()
    .split(/\s+/)[0]
    .slice(0, PLAYER_NAME_MAX_LENGTH);

  const [name, setName] = useState(githubFirstName);

  // A sessão resolve de forma assíncrona; preenche assim que chegar, sem
  // atropelar o que a pessoa já tiver digitado.
  const touchedRef = useRef(false);
  useEffect(() => {
    if (!touchedRef.current && githubFirstName) setName(githubFirstName);
  }, [githubFirstName]);

  // Sem a guarda de conexao o emit ia para o buffer do socket e o botao ficava
  // em "Entrando..." sem nunca receber resposta.
  const canSubmit = name.trim().length >= 1 && !joining && connected;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const finalName = name.trim();
    // O nome editado vive na conta, então segue a pessoa para outras salas e
    // outras máquinas. Falha aqui não impede entrar na sala.
    if (finalName !== session?.user?.name) {
      void updateUser({ name: finalName }).catch(() => undefined);
    }
    onSubmit({ name: finalName, role: 'voter' });
  };

  return (
    <Dialog open={open}>
      <form onSubmit={handleSubmit} className="p-7">
        <div className="flex items-center gap-2 mb-1">
          <PokeballIcon size={16} className="text-brand" />
          <h2 className="text-base font-semibold text-text">
            {roomName ?? 'Entrar na sala'}
          </h2>
        </div>
        <p className="text-xs text-subtle mb-6">
          <span className="font-mono">{roomId}</span>
        </p>

        <label className="block text-xs uppercase tracking-wider text-subtle mb-2">
          Seu nome
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            touchedRef.current = true;
            setName(e.target.value);
          }}
          placeholder="Como aparecerá na mesa"
          className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-border-strong focus:bg-surface-3 transition-colors mb-6"
          maxLength={PLAYER_NAME_MAX_LENGTH}
          autoFocus
        />

        {/*
          O Pokémon não se escolhe mais aqui: ele é da CONTA e evolui com o XP.
          O preview existe só para a pessoa saber com quem vai entrar na mesa.
        */}
        {active && (
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-surface-2 border border-border animate-fade-in">
            <img
              src={active.form.sprite}
              alt=""
              className="w-10 h-10 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
            />
            <div className="min-w-0">
              <div className="text-sm text-text capitalize truncate">{active.form.name}</div>
              <div className="text-[11px] font-mono text-subtle">
                {active.progress.xp} XP
                {active.progress.nextXp !== null &&
                  ` · faltam ${active.progress.nextXp - active.progress.xp} para evoluir`}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger animate-fade-in">
            {error.message}
          </div>
        )}

        {!connected && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border text-subtle animate-fade-in">
            <PokeballIcon spinning size={12} className="text-subtle" />
            <span className="text-xs">Conectando ao servidor...</span>
          </div>
        )}

        <Button
          type="submit"
          variant="solid"
          size="lg"
          className="w-full mt-6 press-down"
          disabled={!canSubmit}
        >
          {joining ? 'Entrando...' : 'Entrar na sala'}
        </Button>
      </form>
    </Dialog>
  );
}
