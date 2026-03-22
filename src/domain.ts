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
  lastError: string | null;
};

function safeNowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeParticipantId(value: string): string {
  return value.trim();
}

export function assertValidObligation(
  obligation: Obligation,
  options?: { expectedUnit?: string }
): void {
  if (!obligation.id || !obligation.id.trim()) {
    throw new Error("Obligation id is required");
  }

  if (!obligation.from || !obligation.from.trim()) {
    throw new Error(`Obligation ${obligation.id}: "from" is required`);
  }

  if (!obligation.to || !obligation.to.trim()) {
    throw new Error(`Obligation ${obligation.id}: "to" is required`);
  }

  if (obligation.from === obligation.to) {
    throw new Error(`Obligation ${obligation.id}: self-loops are not allowed`);
  }

  if (!Number.isFinite(obligation.amount) || obligation.amount <= 0) {
    throw new Error(`Obligation ${obligation.id}: amount must be a positive finite number`);
  }

  if (!obligation.unit || !obligation.unit.trim()) {
    throw new Error(`Obligation ${obligation.id}: unit is required`);
  }

  if (!obligation.createdAt || Number.isNaN(Date.parse(obligation.createdAt))) {
    throw new Error(`Obligation ${obligation.id}: createdAt must be a valid ISO date`);
  }

  if (options?.expectedUnit && obligation.unit !== options.expectedUnit) {
    throw new Error(
      `Obligation ${obligation.id}: unit "${obligation.unit}" does not match expected unit "${options.expectedUnit}"`
    );
  }
}

export function validateObligations(obligations: Obligation[]): Obligation[] {
  if (!Array.isArray(obligations)) {
    throw new Error("Obligations must be an array");
  }

  const seenIds = new Set<string>();
  const normalized = obligations.map((obligation) => ({
    ...obligation,
    from: normalizeParticipantId(obligation.from),
    to: normalizeParticipantId(obligation.to),
    unit: obligation.unit.trim(),
  }));

  const expectedUnit = normalized[0]?.unit;

  for (const obligation of normalized) {
    assertValidObligation(obligation, { expectedUnit });

    if (seenIds.has(obligation.id)) {
      throw new Error(`Duplicate obligation id: ${obligation.id}`);
    }

    seenIds.add(obligation.id);
  }

  return normalized;
}

export function createObligation(input: {
  from: string;
  to: string;
  amount: number;
  unit?: string;
}): Obligation {
  const obligation: Obligation = {
    id: makeId("obl"),
    from: normalizeParticipantId(input.from),
    to: normalizeParticipantId(input.to),
    amount: input.amount,
    unit: input.unit?.trim() || "pts",
    createdAt: safeNowIso(),
  };

  assertValidObligation(obligation);
  return obligation;
}

export function buildNodesFromObligations(obligations: Obligation[]): Node[] {
  const nodeIds = [...new Set(obligations.flatMap((o) => [o.from, o.to]))];
  return nodeIds.map((id) => ({ id, label: id }));
}

export function createInitialState(obligations: Obligation[]): AppState {
  const validObligations = validateObligations(obligations);

  return {
    nodes: buildNodesFromObligations(validObligations),
    obligations: validObligations,
    batches: [],
    selectedCycleObligationIds: [],
    lastError: null,
  };
}
