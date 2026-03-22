import { createObligation, type Obligation } from "./domain";

const UNIT = "pts";

export function triangleScenario(): Obligation[] {
  return [
    createObligation({ from: "A", to: "B", amount: 100, unit: UNIT }),
    createObligation({ from: "B", to: "C", amount: 80, unit: UNIT }),
    createObligation({ from: "C", to: "A", amount: 50, unit: UNIT }),
    createObligation({ from: "C", to: "D", amount: 40, unit: UNIT }),
  ];
}

export function nestedScenario(): Obligation[] {
  return [
    createObligation({ from: "A", to: "B", amount: 100, unit: UNIT }),
    createObligation({ from: "B", to: "C", amount: 90, unit: UNIT }),
    createObligation({ from: "C", to: "A", amount: 40, unit: UNIT }),
    createObligation({ from: "B", to: "D", amount: 70, unit: UNIT }),
    createObligation({ from: "D", to: "E", amount: 60, unit: UNIT }),
    createObligation({ from: "E", to: "B", amount: 30, unit: UNIT }),
  ];
}

export function overlappingScenario(): Obligation[] {
  return [
    createObligation({ from: "A", to: "B", amount: 8, unit: UNIT }),
    createObligation({ from: "B", to: "C", amount: 8, unit: UNIT }),
    createObligation({ from: "C", to: "A", amount: 8, unit: UNIT }),

    createObligation({ from: "B", to: "D", amount: 8, unit: UNIT }),
    createObligation({ from: "D", to: "A", amount: 8, unit: UNIT }),
  ];
}
