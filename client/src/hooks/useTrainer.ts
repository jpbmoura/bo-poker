import { useEffect } from 'react';
import { useTrainerStore, activeOf } from '../store/useTrainerStore';

/**
 * A coleção do usuário: a LISTA e o `active` (o que aparece na mesa). Novos
 * Pokémon chegam pela captura diária; o inicial é só a primeira entrada.
 */
export function useTrainer() {
  const collection = useTrainerStore((s) => s.collection);
  const status = useTrainerStore((s) => s.status);
  const load = useTrainerStore((s) => s.load);
  const apply = useTrainerStore((s) => s.apply);
  const reload = useTrainerStore((s) => s.reload);

  useEffect(() => {
    void load();
  }, [load]);

  const pokemon = collection?.pokemon ?? [];

  return {
    status,
    pokemon,
    active: activeOf(collection),
    /** Coleção vazia = precisa escolher o inicial. */
    needsStarter: status === 'ready' && pokemon.length === 0,
    apply,
    reload,
  };
}
