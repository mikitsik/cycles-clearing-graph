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

  function updateState(updater: (current: AppState) => AppState): void {
    setState(updater(state));
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const actions = {
    setError(message: string): void {
      updateState((current) => ({ ...current, lastError: message }));
    },

    clearError(): void {
      updateState((current) => ({ ...current, lastError: null }));
    },

    setObligations(obligations: Obligation[]): void {
      try {
        setState(createInitialState(obligations));
      } catch (error) {
        updateState((current) => ({
          ...current,
          lastError: error instanceof Error ? error.message : "Failed to set obligations",
        }));
      }
    },

    solveOneCycle(): void {
      try {
        const before = state.obligations.map((o) => ({ ...o }));
        const result = solveOneCycleMinEdge(state.obligations);

        updateState((current) => ({
          ...current,
          obligations: result.updatedObligations,
          batches: result.batch ? [...current.batches, result.batch] : current.batches,
          selectedCycleObligationIds: [],
          lastError: null,
          beforeSnapshot: result.batch ? before : current.beforeSnapshot,
          afterSnapshot: result.batch
            ? result.updatedObligations.map((o) => ({ ...o }))
            : current.afterSnapshot,
        }));
      } catch (error) {
        updateState((current) => ({
          ...current,
          lastError: error instanceof Error ? error.message : "Failed to resolve cycle",
        }));
      }
    },

    solveAllCycles(): void {
      try {
        const before = state.obligations.map((o) => ({ ...o }));
        const result = resolveAllCycles(state.obligations);

        updateState((current) => ({
          ...current,
          obligations: result.updatedObligations,
          batches: [...current.batches, ...result.batches],
          selectedCycleObligationIds: [],
          lastError: null,
          beforeSnapshot: result.batches.length > 0 ? before : current.beforeSnapshot,
          afterSnapshot:
            result.batches.length > 0
              ? result.updatedObligations.map((o) => ({ ...o }))
              : current.afterSnapshot,
        }));
      } catch (error) {
        updateState((current) => ({
          ...current,
          lastError: error instanceof Error ? error.message : "Failed to resolve all cycles",
        }));
      }
    },
  };

  return { getState, subscribe, actions };
}
