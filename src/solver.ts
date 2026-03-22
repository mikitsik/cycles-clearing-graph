import {
  makeId,
  type Obligation,
  type SettlementBatch,
  type SettlementRecord,
} from "./domain";

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

function assertBatchInvariants(params: {
  before: Obligation[];
  after: Obligation[];
  cycle: Obligation[];
  batch: SettlementBatch;
  delta: number;
}): void {
  const { before, after, cycle, batch, delta } = params;

  if (!Number.isFinite(delta) || delta <= 0) {
    throw new Error("Settlement delta must be a positive finite number");
  }

  if (cycle.length < 2) {
    throw new Error("Cycle must contain at least 2 edges");
  }

  const beforeGross = totalGross(before);
  const afterGross = totalGross(after);

  if (batch.beforeGross !== beforeGross) {
    throw new Error("Batch beforeGross mismatch");
  }

  if (batch.afterGross !== afterGross) {
    throw new Error("Batch afterGross mismatch");
  }

  if (afterGross >= beforeGross) {
    throw new Error("Settlement batch did not reduce gross exposure");
  }

  for (const obligation of after) {
    if (!Number.isFinite(obligation.amount) || obligation.amount <= 0) {
      throw new Error(`Invalid post-settlement obligation amount for ${obligation.id}`);
    }
  }

  for (const record of batch.records) {
    if (record.delta !== delta) {
      throw new Error(`Record ${record.id} delta mismatch`);
    }
  }

  for (const edge of cycle) {
    if (delta > edge.amount) {
      throw new Error(`Settlement delta exceeds cycle edge amount for ${edge.id}`);
    }
  }
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
  if (!Number.isFinite(delta) || delta <= 0) {
    throw new Error("Cycle clearing delta must be positive");
  }

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

  assertBatchInvariants({
    before: obligations,
    after: updatedObligations,
    cycle,
    batch,
    delta,
  });

  return { cycle, updatedObligations, batch };
}

export function resolveAllCycles(obligations: Obligation[]): {
  updatedObligations: Obligation[];
  batches: SettlementBatch[];
} {
  let current = obligations.map((o) => ({ ...o }));
  const batches: SettlementBatch[] = [];
  const maxIterations = Math.max(1, obligations.length * 10);

  for (let i = 0; i < maxIterations; i += 1) {
    const beforeGross = totalGross(current);
    const result = solveOneCycleMinEdge(current);

    if (!result.batch) {
      return { updatedObligations: current, batches };
    }

    const afterGross = totalGross(result.updatedObligations);
    if (afterGross >= beforeGross) {
      throw new Error("resolveAllCycles stopped: solver made no progress");
    }

    current = result.updatedObligations;
    batches.push(result.batch);
  }

  throw new Error("resolveAllCycles exceeded iteration limit");
}
