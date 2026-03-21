import { createObligation, type Obligation } from "./domain";

export function triangleScenario(): Obligation[] {
  return [
    createObligation({ from: "A", to: "B", amount: 100 }),
    createObligation({ from: "B", to: "C", amount: 80 }),
    createObligation({ from: "C", to: "A", amount: 50 }),
    createObligation({ from: "C", to: "D", amount: 40 }),
  ];
}

export function nestedScenario(): Obligation[] {
  return [
    createObligation({ from: "A", to: "B", amount: 100 }),
    createObligation({ from: "B", to: "C", amount: 90 }),
    createObligation({ from: "C", to: "A", amount: 40 }),

    createObligation({ from: "B", to: "D", amount: 70 }),
    createObligation({ from: "D", to: "E", amount: 60 }),
    createObligation({ from: "E", to: "B", amount: 30 }),
  ];
}

export function liquidityScenario(): Obligation[] {
  return [
    createObligation({ from: "L", to: "A", amount: 50 }),
    createObligation({ from: "A", to: "B", amount: 50 }),
    createObligation({ from: "B", to: "C", amount: 50 }),
    createObligation({ from: "C", to: "L", amount: 50 }),
  ];
}
