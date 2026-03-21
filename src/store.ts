import { createInitialState, type AppState, type Obligation } from "./domain";
import { resolveAllCycles, solveOneCycleMinEdge } from "./solver";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(initialObligations: Obligation[]) {
  let state = createInitialState(initialObligations);
  const listeners = new Set<() => void>();

  function getState(): AppState {
    return state;
  }

  function setState(next: AppState): void {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const actions = {
    setObligations(obligations: Obligation[]): void {
      setState(createInitialState(obligations));
    },

    solveOneCycle(): void {
      const result = solveOneCycleMinEdge(state.obligations);
      setState({
        ...state,
        obligations: result.updatedObligations,
        batches: result.batch ? [...state.batches, result.batch] : state.batches,
        selectedCycleObligationIds: result.cycle ? result.cycle.map((edge) => edge.id) : [],
      });
    },

    solveAllCycles(): void {
      const result = resolveAllCycles(state.obligations);
      setState({
        ...state,
        obligations: result.updatedObligations,
        batches: [...state.batches, ...result.batches],
        selectedCycleObligationIds: [],
      });
    },
  };

  return { getState, subscribe, actions };
}
