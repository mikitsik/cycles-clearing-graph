export type ID = string;

export type Node = {
  id: ID;
  label: string;
};

export type Obligation = {
  id: ID;
  from: ID;
  to: ID;
  amount: number;
  unit: string;
  createdAt: string;
};

export type SettlementRecord = {
  id: ID;
  batchId: ID;
  obligationId: ID;
  from: ID;
  to: ID;
  delta: number;
};

export type SettlementBatch = {
  id: ID;
  strategy: "cycle-min-edge" | "resolve-all-cycles";
  createdAt: string;
  records: SettlementRecord[];
  beforeGross: number;
  afterGross: number;
};

export type AppState = {
  nodes: Node[];
  obligations: Obligation[];
  batches: SettlementBatch[];
  selectedCycleObligationIds: string[];
};

export function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createObligation(input: {
  from: string;
  to: string;
  amount: number;
  unit?: string;
}): Obligation {
  return {
    id: makeId("obl"),
    from: input.from,
    to: input.to,
    amount: input.amount,
    unit: input.unit ?? "pts",
    createdAt: new Date().toISOString(),
  };
}

export function createInitialState(obligations: Obligation[]): AppState {
  const nodeIds = [...new Set(obligations.flatMap((o) => [o.from, o.to]))];
  return {
    nodes: nodeIds.map((id) => ({ id, label: id })),
    obligations,
    batches: [],
    selectedCycleObligationIds: [],
  };
}
