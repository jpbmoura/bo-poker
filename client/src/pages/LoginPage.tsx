import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PokeballIcon } from '../components/ui/PokeballIcon';
import { GithubIcon } from '../components/ui/GithubIcon';
import { absoluteUrl, signIn, useSession } from '../services/auth';

interface LocationState {
  from?: string;
}

/** Mensagens que o callback do OAuth pode devolver na querystring. */
const ERROR_MESSAGES: Record<string, string> = {
  email_not_found:
    'O GitHub não liberou seu e-mail. Autorize o acesso a "Email addresses" e tente de novo.',
  account_not_linked:
    'Já existe uma conta com esse e-mail criada por outro método de login.',
  access_denied: 'Você cancelou a autorização no GitHub.',
};

export default function LoginPage() {
  const location = useLocation();
  const { data: session, isPending } = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Para onde voltar depois do GitHub. Guardado pelo RequireAuth ao barrar a
  // navegação, para o link de uma sala específica não se perder no caminho.
  const from = (location.state as LocationState | null)?.from ?? '/';
  const oauthError = new URLSearchParams(location.search).get('error');

  // <Navigate> em vez de chamar navigate() no corpo do render, que seria
  // efeito colateral durante a renderização.
  if (!isPending && session) {
    return <Navigate to={from} replace />;
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signIn.social({
        provider: 'github',
        // ABSOLUTO: um caminho relativo seria resolvido contra o baseURL do
        // servidor (:3001 em dev), que não serve o client.
        callbackURL: absoluteUrl(from),
        errorCallbackURL: absoluteUrl('/login'),
      });
    } catch {
      setSigningIn(false);
      setError('Não foi possível iniciar o login. Tente novamente.');
    }
  };

  const message =
    error ?? (oauthError ? (ERROR_MESSAGES[oauthError] ?? 'Falha no login.') : null);

  return (
    <div className="min-h-screen bg-dot-grid flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2.5 mb-12">
        <PokeballIcon size={22} className="text-brand" />
        <h1 className="text-xl font-semibold tracking-tight text-text">BO Poker</h1>
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-text tracking-tight mb-2">
            Entrar
          </h2>
          <p className="text-sm text-muted">
            O login identifica você na mesa — é o que garante um assento por
            pessoa, mesmo depois de recarregar a página.
          </p>
        </div>

        {isPending ? (
          <div className="flex items-center justify-center gap-2 py-3 text-subtle">
            <PokeballIcon spinning size={14} className="text-subtle" />
            <span className="text-xs">Verificando sessão...</span>
          </div>
        ) : (
          <Button
            variant="solid"
            size="lg"
            className="w-full"
            onClick={handleSignIn}
            disabled={signingIn}
          >
            <GithubIcon size={16} />
            {signingIn ? 'Redirecionando...' : 'Entrar com GitHub'}
          </Button>
        )}

        {message && (
          <div className="mt-4 p-3 bg-danger-soft border border-danger/30 rounded-lg text-xs text-danger animate-fade-in">
            {message}
          </div>
        )}
      </div>

      <footer className="mt-16 text-[11px] text-subtle font-mono">
        BO Poker · BackOffice
      </footer>
    </div>
  );
}
