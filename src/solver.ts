import { makeId, type Obligation, type SettlementBatch, type SettlementRecord } from "./domain";

function buildAdjacency(obligations: Obligation[]): Map<string, Obligation[]> {
  const adj = new Map<string, Obligation[]>();
  for (const obligation of obligations) {
    if (!adj.has(obligation.from)) adj.set(obligation.from, []);
    adj.get(obligation.from)!.push(obligation);
  }
  return adj;
}

function getAllNodeIds(obligations: Obligation[]): string[] {
  return [...new Set(obligations.flatMap((o) => [o.from, o.to]))];
}

export function totalGross(obligations: Obligation[]): number {
  return obligations.reduce((sum, obligation) => sum + obligation.amount, 0);
}

export function findOneCycle(obligations: Obligation[]): Obligation[] | null {
  const adj = buildAdjacency(obligations);
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const edgeStack: Obligation[] = [];

  function dfs(node: string): Obligation[] | null {
    visited.add(node);
    inStack.add(node);

    for (const edge of adj.get(node) ?? []) {
      const next = edge.to;
      edgeStack.push(edge);

      if (!visited.has(next)) {
        const result = dfs(next);
        if (result) return result;
      } else if (inStack.has(next)) {
        const cycle: Obligation[] = [];
        for (let i = edgeStack.length - 1; i >= 0; i -= 1) {
          cycle.push(edgeStack[i]);
          if (edgeStack[i].from === next) break;
        }
        cycle.reverse();
        return cycle;
      }

      edgeStack.pop();
    }

    inStack.delete(node);
    return null;
  }

  for (const node of getAllNodeIds(obligations)) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }

  return null;
}

export function solveOneCycleMinEdge(obligations: Obligation[]): {
  cycle: Obligation[] | null;
  updatedObligations: Obligation[];
  batch: SettlementBatch | null;
} {
  const cycle = findOneCycle(obligations);
  if (!cycle) {
    return {
      cycle: null,
      updatedObligations: obligations.map((o) => ({ ...o })),
      batch: null,
    };
  }

  const delta = Math.min(...cycle.map((edge) => edge.amount));
  const batchId = makeId("batch");
  const beforeGross = totalGross(obligations);

  const records: SettlementRecord[] = cycle.map((obligation) => ({
    id: makeId("rec"),
    batchId,
    obligationId: obligation.id,
    from: obligation.from,
    to: obligation.to,
    delta,
  }));

  const cycleIds = new Set(cycle.map((edge) => edge.id));
  const updatedObligations = obligations
    .map((obligation) => {
      if (!cycleIds.has(obligation.id)) return { ...obligation };
      return { ...obligation, amount: obligation.amount - delta };
    })
    .filter((obligation) => obligation.amount > 0);

  const afterGross = totalGross(updatedObligations);
  const batch: SettlementBatch = {
    id: batchId,
    strategy: "cycle-min-edge",
    createdAt: new Date().toISOString(),
    records,
    beforeGross,
    afterGross,
  };

  return { cycle, updatedObligations, batch };
}

export function resolveAllCycles(obligations: Obligation[]): {
  updatedObligations: Obligation[];
  batches: SettlementBatch[];
} {
  let current = obligations.map((o) => ({ ...o }));
  const batches: SettlementBatch[] = [];

  while (true) {
    const result = solveOneCycleMinEdge(current);
    if (!result.batch) break;
    current = result.updatedObligations;
    batches.push(result.batch);
  }

  return { updatedObligations: current, batches };
}
