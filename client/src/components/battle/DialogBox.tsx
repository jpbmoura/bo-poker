import { useTypewriter } from './useTypewriter';

interface DialogBoxProps {
  message: string;
  instant: boolean;
  /** Mostra o ▼ quando a frase termina: é a vez do jogador. */
  waiting: boolean;
}

/**
 * A caixa de texto da batalha. Uma frase por vez, digitada; o leitor de tela
 * recebe a frase inteira de uma vez pelo `sr-only`.
 */
export function DialogBox({ message, instant, waiting }: DialogBoxProps) {
  const { shown, done } = useTypewriter(message, instant);

  return (
    <div className="gba-dialog relative px-4 py-3 min-h-[4.25rem]">
      <p aria-hidden className="font-pixel text-[15px] sm:text-base leading-snug text-white pr-4">
        {shown}
      </p>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
      {done && waiting && (
        <span
          aria-hidden
          className="absolute right-3 bottom-2 font-pixel text-xs leading-none text-[rgb(var(--gba-dialog-edge))] motion-safe:animate-caret-bounce"
        >
          ▼
        </span>
      )}
    </div>
  );
}
