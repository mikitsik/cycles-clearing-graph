import cytoscape from "cytoscape";
import type { AppStore } from "./store";
import { totalGross } from "./solver";
import {
  triangleScenario,
  nestedScenario,
  overlappingScenario,
} from "./scenario";

type ScenarioName = "triangle" | "nested" | "overlapping";

type SnapshotObligation = {
  id: string;
  from: string;
  to: string;
  amount: number;
  unit: string;
};

export function mountUI(root: HTMLElement, store: AppStore): void {
  let activeScenario: ScenarioName = "triangle";

  root.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <h1>Cycles Clearing Graph</h1>
        <p>Local-first cycle clearing demo with settlement batches.</p>
      </header>

      <section class="toolbar">
        <button id="scenario-triangle">Triangle</button>
        <button id="scenario-nested">Nested</button>
        <button id="scenario-overlapping">Overlapping</button>
        <button id="solve-one">Resolve one cycle</button>
        <button id="solve-all">Resolve all cycles</button>
        <button id="export-json">Export JSON</button>
        <label for="import-json" class="import-label">Import JSON</label>
        <input id="import-json" type="file" accept="application/json" style="display:none" />
      </section>

      <section class="layout">
        <div class="left-col">
          <div id="metrics" class="panel"></div>
          <div id="error-box" class="panel"></div>
          <div id="comparison" class="panel"></div>
          <div id="graph" class="graph-panel"></div>
        </div>
        <aside id="batches" class="panel side-panel"></aside>
      </section>
    </div>
  `;

  const graphEl = root.querySelector<HTMLElement>("#graph");
  const metricsEl = root.querySelector<HTMLElement>("#metrics");
  const errorEl = root.querySelector<HTMLElement>("#error-box");
  const comparisonEl = root.querySelector<HTMLElement>("#comparison");
  const batchesEl = root.querySelector<HTMLElement>("#batches");

  const triangleBtn = root.querySelector<HTMLButtonElement>("#scenario-triangle");
  const nestedBtn = root.querySelector<HTMLButtonElement>("#scenario-nested");
  const overlappingBtn = root.querySelector<HTMLButtonElement>("#scenario-overlapping");

  const solveOneBtn = root.querySelector<HTMLButtonElement>("#solve-one");
  const solveAllBtn = root.querySelector<HTMLButtonElement>("#solve-all");

  const exportBtn = root.querySelector<HTMLButtonElement>("#export-json");
  const importInput = root.querySelector<HTMLInputElement>("#import-json");

  if (
    !graphEl ||
    !metricsEl ||
    !errorEl ||
    !comparisonEl ||
    !batchesEl ||
    !triangleBtn ||
    !nestedBtn ||
    !overlappingBtn ||
    !solveOneBtn ||
    !solveAllBtn ||
    !exportBtn ||
    !importInput
  ) {
    throw new Error("UI mount failed: missing elements");
  }

  const scenarioButtons: Record<ScenarioName, HTMLButtonElement> = {
    triangle: triangleBtn,
    nested: nestedBtn,
    overlapping: overlappingBtn,
  };

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

  function renderScenarioButtons(): void {
    (Object.keys(scenarioButtons) as ScenarioName[]).forEach((name) => {
      const btn = scenarioButtons[name];
      btn.style.fontWeight = name === activeScenario ? "700" : "400";
      btn.style.outline = name === activeScenario ? "2px solid #333" : "";
      btn.style.outlineOffset = name === activeScenario ? "2px" : "";
    });
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatBeforeAfterLists(
    before: SnapshotObligation[],
    after: SnapshotObligation[],
  ): { beforeHtml: string; afterHtml: string } {
    const afterMap = new Map(after.map((o) => [o.id, o]));

    const beforeLines: string[] = [];
    const afterLines: string[] = [];

    for (const prev of before) {
      const next = afterMap.get(prev.id);

      beforeLines.push(
        `${escapeHtml(prev.from)} → ${escapeHtml(prev.to)}: ${prev.amount} ${escapeHtml(prev.unit)}`
      );

      if (!next) {
        afterLines.push(
          `<span class="diff-removed">removed</span>`
        );
        continue;
      }

      if (next.amount !== prev.amount) {
        afterLines.push(
          `<span class="diff-reduced">${escapeHtml(next.from)} → ${escapeHtml(next.to)}: ${next.amount} ${escapeHtml(next.unit)}</span>`
        );
      } else {
        afterLines.push(
          `${escapeHtml(next.from)} → ${escapeHtml(next.to)}: ${next.amount} ${escapeHtml(next.unit)}`
        );
      }
    }

    return {
      beforeHtml: beforeLines.join("<br>"),
      afterHtml: afterLines.join("<br>"),
    };
  }

  function diffObligations(
    before: SnapshotObligation[],
    after: SnapshotObligation[],
  ): string {
    const afterMap = new Map(after.map((o) => [o.id, o]));
    const lines: string[] = [];

    for (const prev of before) {
      const next = afterMap.get(prev.id);

      if (!next) {
        lines.push(
          `<span class="diff-removed">${escapeHtml(prev.from)} → ${escapeHtml(prev.to)}: ${prev.amount} ${escapeHtml(prev.unit)} → removed</span>`
        );
        continue;
      }

      if (next.amount !== prev.amount) {
        lines.push(
          `<span class="diff-reduced">${escapeHtml(prev.from)} → ${escapeHtml(prev.to)}: ${prev.amount} ${escapeHtml(prev.unit)} → ${next.amount} ${escapeHtml(next.unit)}</span>`
        );
      }
    }

    return lines.length > 0 ? lines.join("<br>") : "No changes";
  }

  function render(): void {
  const state = store.getState();
  const selected = new Set(state.selectedCycleObligationIds);
  const lastBatch = state.batches[state.batches.length - 1];
  const lastCleared = lastBatch ? lastBatch.beforeGross - lastBatch.afterGross : 0;

  let beforeBlock = "";

  if (state.beforeSnapshot && !state.afterSnapshot) {
    const beforeHtml = state.beforeSnapshot
      .map(
        (o) =>
          `${escapeHtml(o.from)} → ${escapeHtml(o.to)}: ${o.amount} ${escapeHtml(o.unit)}`
      )
      .join("<br>");

    beforeBlock = `
      <div class="metrics-before">
        <div class="comparison-title">Before</div>
        <div class="comparison-list">
          ${beforeHtml}
        </div>
      </div>
    `;
  }

  metricsEl.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card"><strong>Total gross:</strong> ${totalGross(state.obligations)}</div>
      <div class="metric-card"><strong>Active obligations:</strong> ${state.obligations.length}</div>
      <div class="metric-card"><strong>Batches:</strong> ${state.batches.length}</div>
      <div class="metric-card"><strong>Last cleared:</strong> ${lastCleared}</div>
      <div class="metric-card"><strong>Scenario:</strong> ${activeScenario}</div>
    </div>

    ${beforeBlock}
  `;

  if (state.lastError) {
    errorEl.innerHTML = `<strong>Error:</strong> ${escapeHtml(state.lastError)}`;
    errorEl.style.display = "block";
  } else {
    errorEl.innerHTML = "";
    errorEl.style.display = "none";
  }

  if (state.beforeSnapshot && state.afterSnapshot) {
    const beforeGross = totalGross(state.beforeSnapshot);
    const afterGross = totalGross(state.afterSnapshot);
    const cleared = beforeGross - afterGross;
    const { beforeHtml, afterHtml } = formatBeforeAfterLists(
      state.beforeSnapshot,
      state.afterSnapshot,
    );

    comparisonEl.innerHTML = `
      <div class="comparison-header">
        <strong>Before / After</strong>
        <div class="comparison-stats">
          <span>Cleared: <b>${cleared}</b></span>
          <span>Before: ${beforeGross}</span>
          <span>After: ${afterGross}</span>
        </div>
      </div>

      <div class="comparison-diff">
        <strong>Changed edges</strong><br>
        ${diffObligations(state.beforeSnapshot, state.afterSnapshot)}
      </div>

      <div class="comparison-grid">
        <div class="comparison-col">
          <div class="comparison-title">Before</div>
          <div class="comparison-list">
            ${beforeHtml}
          </div>
        </div>

        <div class="comparison-col">
          <div class="comparison-title">After</div>
          <div class="comparison-list">
            ${afterHtml}
          </div>
        </div>
      </div>
    `;
  } else if (state.beforeSnapshot) {
    comparisonEl.innerHTML = "";
  } else {
    comparisonEl.innerHTML = `
      <div><strong>Before / After</strong></div>
      <div style="margin-top: 8px;">No graph loaded yet.</div>
    `;
  }

  batchesEl.innerHTML =
    state.batches.length === 0
      ? `<p>No settlement batches yet.</p>`
      : state.batches
          .map((batch, index) => {
            const cleared = batch.beforeGross - batch.afterGross;
            const recordsHtml = batch.records
              .map(
                (record) =>
                  `<li>${escapeHtml(record.from)} → ${escapeHtml(record.to)}: -${record.delta}</li>`
              )
              .join("");

            return `
              <div class="batch-item">
                <div><strong>Batch ${index + 1}</strong></div>
                <div>strategy: ${escapeHtml(batch.strategy)}</div>
                <div>records: ${batch.records.length}</div>
                <div>cleared: ${cleared}</div>
                <ul>${recordsHtml}</ul>
              </div>
            `;
          })
          .join("");

  cy.elements().remove();
  cy.add([
    ...state.nodes.map((node) => ({
      data: { id: node.id, label: node.label },
    })),
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

  renderScenarioButtons();
}

  triangleBtn.addEventListener("click", () => {
    activeScenario = "triangle";
    store.actions.setObligations(triangleScenario());
  });

  nestedBtn.addEventListener("click", () => {
    activeScenario = "nested";
    store.actions.setObligations(nestedScenario());
  });

  overlappingBtn.addEventListener("click", () => {
    activeScenario = "overlapping";
    store.actions.setObligations(overlappingScenario());
  });

  solveOneBtn.addEventListener("click", () => {
    store.actions.solveOneCycle();
  });

  solveAllBtn.addEventListener("click", () => {
    store.actions.solveAllCycles();
  });

  exportBtn.addEventListener("click", () => {
    const state = store.getState();
    const payload = {
      nodes: state.nodes,
      obligations: state.obligations,
      batches: state.batches,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cycles-graph.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        obligations?: Array<{
          id: string;
          from: string;
          to: string;
          amount: number;
          unit: string;
          createdAt: string;
        }>;
      };

      if (!parsed.obligations || !Array.isArray(parsed.obligations)) {
        throw new Error("JSON must contain obligations array");
      }

      activeScenario = "triangle";
      store.actions.setObligations(parsed.obligations);
    } catch (error) {
      console.error(error);
      store.actions.setError(
        error instanceof Error ? error.message : "Failed to import JSON"
      );
    } finally {
      importInput.value = "";
    }
  });

  store.subscribe(render);
  render();
}
