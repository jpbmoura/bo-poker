import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-dot-grid flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2.5 mb-12">
        <PokeballIcon size={22} className="text-brand" />
        <h1 className="text-xl font-semibold tracking-tight text-text">BO Poker</h1>
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-text tracking-tight mb-2">
            Estimar em equipe
          </h2>
          <p className="text-sm text-muted">
            Crie uma sala ou entre em uma existente.
          </p>
        </div>

        <Button
          variant="solid"
          size="lg"
          className="w-full mb-4 group"
          onClick={handleCreate}
        >
          Criar nova sala
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-subtle">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-2.5">
          <label className="text-xs uppercase tracking-wider text-subtle">
            Código da sala
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC12345"
            className="w-full bg-surface-2 border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-border-strong focus:bg-surface-3 transition-colors uppercase tracking-wider font-mono"
            maxLength={20}
          />
          <Button type="submit" variant="secondary" disabled={code.trim().length === 0}>
            Entrar na sala
          </Button>
        </form>
      </div>

      <footer className="mt-16 text-[11px] text-subtle font-mono">
        BO Poker · BackOffice
      </footer>
    </div>
  );
}
