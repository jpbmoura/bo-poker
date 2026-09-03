import { useEffect } from 'react';
import { useTrainerStore, activeOf } from '../store/useTrainerStore';

/**
 * A coleção do usuário. Expõe a LISTA e não um singular: hoje ela tem no máximo
 * um item, mas os componentes que consomem `active` continuam valendo quando o
 * teto subir, e `canAdd` é o que vai destravar o botão de adicionar.
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
  const maxPokemon = collection?.maxPokemon ?? 1;

  return {
    status,
    pokemon,
    active: activeOf(collection),
    maxPokemon,
    canAdd: pokemon.length < maxPokemon,
    /** Coleção vazia = precisa escolher o inicial. */
    needsStarter: status === 'ready' && pokemon.length === 0,
    apply,
    reload,
  };
}
