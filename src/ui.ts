import cytoscape from "cytoscape";
import type { AppStore } from "./store";
import { totalGross } from "./solver";

export function mountUI(root: HTMLElement, store: AppStore): void {
  root.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <h1>Cycles Contribution Graph</h1>
        <p>Local-first cycle clearing demo with settlement batches.</p>
      </header>

      <section class="toolbar">
        <button id="solve-one">Resolve one cycle</button>
        <button id="solve-all">Resolve all cycles</button>
      </section>

      <section class="layout">
        <div class="left-col">
          <div id="metrics" class="panel"></div>
          <div id="graph" class="graph-panel"></div>
        </div>
        <aside id="batches" class="panel side-panel"></aside>
      </section>
    </div>
  `;

  const graphEl = root.querySelector<HTMLElement>("#graph");
  const metricsEl = root.querySelector<HTMLElement>("#metrics");
  const batchesEl = root.querySelector<HTMLElement>("#batches");
  const solveOneBtn = root.querySelector<HTMLButtonElement>("#solve-one");
  const solveAllBtn = root.querySelector<HTMLButtonElement>("#solve-all");

  if (!graphEl || !metricsEl || !batchesEl || !solveOneBtn || !solveAllBtn) {
    throw new Error("UI mount failed: missing elements");
  }

  const cy = cytoscape({
    container: graphEl,
    elements: [],
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "text-valign": "center",
          "text-halign": "center",
          width: 44,
          height: 44,
        },
      },
      {
        selector: "edge",
        style: {
          label: "data(label)",
          "curve-style": "bezier",
          "target-arrow-shape": "triangle",
        },
      },
      {
        selector: ".cycle-edge",
        style: {
          "line-style": "dashed",
          width: 4,
        },
      },
    ],
    layout: { name: "cose" },
  });

  function render(): void {
    const state = store.getState();
    const selected = new Set(state.selectedCycleObligationIds);

    metricsEl.innerHTML = `
      <div><strong>Total gross:</strong> ${totalGross(state.obligations)}</div>
      <div><strong>Active obligations:</strong> ${state.obligations.length}</div>
      <div><strong>Batches:</strong> ${state.batches.length}</div>
    `;

    batchesEl.innerHTML = state.batches.length === 0
      ? `<p>No settlement batches yet.</p>`
      : state.batches.map((batch) => `
          <div class="batch-item">
            <div><strong>${batch.strategy}</strong></div>
            <div>records: ${batch.records.length}</div>
            <div>cleared: ${batch.beforeGross - batch.afterGross}</div>
          </div>
        `).join("");

    cy.elements().remove();
    cy.add([
      ...state.nodes.map((node) => ({ data: { id: node.id, label: node.label } })),
      ...state.obligations.map((obligation) => ({
        data: {
          id: obligation.id,
          source: obligation.from,
          target: obligation.to,
          label: `${obligation.amount} ${obligation.unit}`,
        },
        classes: selected.has(obligation.id) ? "cycle-edge" : "",
      })),
    ]);
    cy.layout({ name: "cose", animate: false }).run();
  }

  solveOneBtn.addEventListener("click", () => store.actions.solveOneCycle());
  solveAllBtn.addEventListener("click", () => store.actions.solveAllCycles());

  store.subscribe(render);
  render();
}
