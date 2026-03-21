import { createObligation } from "./domain";

export function triangleScenario() {
  return [
    createObligation({ from: "A", to: "B", amount: 100 }),
    createObligation({ from: "B", to: "C", amount: 80 }),
    createObligation({ from: "C", to: "A", amount: 50 }),
    createObligation({ from: "C", to: "D", amount: 40 }),
  ];
}
