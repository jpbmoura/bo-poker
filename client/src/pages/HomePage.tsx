import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { Button } from '../components/ui/Button';
import { PokeballIcon } from '../components/ui/PokeballIcon';

const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomId(): string {
  return nanoid(10)
    .replace(/[^A-Za-z0-9]/g, '')
    .padEnd(10, 'A')
    .slice(0, 10)
    .toUpperCase();
}

function generateFriendlyRoomId(): string {
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
  }
  return id;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const handleCreate = () => {
    const id = generateFriendlyRoomId() || generateRoomId();
    navigate(`/room/${id}`);
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length === 0) return;
    navigate(`/room/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-3 mb-10 text-text">
        <PokeballIcon size={32} className="text-accent" />
        <h1 className="text-3xl font-bold tracking-tight">BO Poker</h1>
      </div>

      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-text mb-1">Bem-vindo</h2>
        <p className="text-sm text-muted mb-6">
          Crie uma nova sala ou entre em uma existente para começar a estimar.
        </p>

        <Button size="lg" className="w-full mb-6" onClick={handleCreate}>
          Criar nova sala
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs uppercase tracking-wider text-subtle">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <label className="text-sm text-muted">Código da sala</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC12345"
            className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text placeholder:text-subtle outline-none focus:border-accent/60 transition-colors uppercase tracking-wider"
            maxLength={20}
          />
          <Button type="submit" variant="secondary" disabled={code.trim().length === 0}>
            Entrar na sala
          </Button>
        </form>
      </div>

      <footer className="mt-10 text-xs text-subtle">
        BO Poker · Internal tool · BackOffice
      </footer>
    </div>
  );
}
