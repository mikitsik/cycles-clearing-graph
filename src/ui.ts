import cytoscape from "cytoscape";
import type { AppStore } from "./store";
import { totalGross } from "./solver";
import {
  triangleScenario,
  nestedScenario,
  overlappingScenario,
} from "./scenario";

type ScenarioName = "triangle" | "nested" | "overlapping" | "imported";

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
          <div id="graph" class="graph-panel"></div>
        </div>
        <aside id="batches" class="panel side-panel"></aside>
      </section>
    </div>
  `;

  const graphEl = root.querySelector<HTMLElement>("#graph");
  const metricsEl = root.querySelector<HTMLElement>("#metrics");
  const errorEl = root.querySelector<HTMLElement>("#error-box");
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

  const scenarioButtons: Record<Exclude<ScenarioName, "imported">, HTMLButtonElement> = {
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
      {
        selector: ".edge-reduced",
        style: {
          "line-color": "#16a34a",
          "target-arrow-color": "#16a34a",
          width: 4,
        },
      },
      {
        selector: ".edge-removed",
        style: {
          "line-color": "#dc2626",
          "target-arrow-color": "#dc2626",
          "line-style": "dashed",
          width: 4,
        },
      },
    ],
    layout: { name: "cose" },
  });

  function renderScenarioButtons(): void {
    (Object.keys(scenarioButtons) as Array<Exclude<ScenarioName, "imported">>).forEach(
      (name) => {
        const btn = scenarioButtons[name];
        btn.style.fontWeight = name === activeScenario ? "700" : "400";
        btn.style.outline = name === activeScenario ? "2px solid #333" : "";
        btn.style.outlineOffset = name === activeScenario ? "2px" : "";
      }
    );

    if (activeScenario === "imported") {
      triangleBtn.style.fontWeight = "400";
      nestedBtn.style.fontWeight = "400";
      overlappingBtn.style.fontWeight = "400";

      triangleBtn.style.outline = "";
      nestedBtn.style.outline = "";
      overlappingBtn.style.outline = "";
    }
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function obligationsToHtml(items: SnapshotObligation[]): string {
    if (items.length === 0) {
      return `<span class="diff-removed">All cleared</span>`;
    }

    return items
      .map(
        (o) =>
          `${escapeHtml(o.from)} → ${escapeHtml(o.to)}: ${o.amount} ${escapeHtml(o.unit)}`
      )
      .join("<br>");
  }

  function render(): void {
    const state = store.getState();
    const selected = new Set(state.selectedCycleObligationIds);
    const lastBatch = state.batches[state.batches.length - 1];
    const lastCleared = lastBatch ? lastBatch.beforeGross - lastBatch.afterGross : 0;

    let topBlock = `
      <div class="top-summary-meta">
        <div><strong>Scenario:</strong> ${escapeHtml(activeScenario)}</div>
        <div><strong>Batches:</strong> ${state.batches.length}</div>
        <div><strong>Last cleared:</strong> ${lastCleared}</div>
      </div>
    `;

    if (state.beforeSnapshot && state.afterSnapshot) {
      const beforeGross = totalGross(state.beforeSnapshot);
      const afterGross = totalGross(state.afterSnapshot);
      const cleared = beforeGross - afterGross;

      topBlock += `
        <div class="top-details-grid">
          <div class="comparison-col">
            <div class="comparison-title">Before</div>
            <div class="comparison-stats">
              <span>Total gross: <b>${beforeGross}</b></span>
              <span>Active obligations: ${state.beforeSnapshot.length}</span>
            </div>
            <div class="comparison-list">
              ${obligationsToHtml(state.beforeSnapshot)}
            </div>
          </div>

          <div class="comparison-col">
            <div class="comparison-title">After</div>
            <div class="comparison-stats">
              <span>Cleared: <b>${cleared}</b></span>
              <span>Total gross: ${afterGross}</span>
              <span>Active obligations: ${state.afterSnapshot.length}</span>
            </div>
            <div class="comparison-list">
              ${obligationsToHtml(state.afterSnapshot)}
            </div>
          </div>
        </div>
      `;
    } else if (state.beforeSnapshot) {
      const beforeGross = totalGross(state.beforeSnapshot);

      topBlock += `
        <div class="top-details-grid top-details-single">
          <div class="comparison-col">
            <div class="comparison-title">Before</div>
            <div class="comparison-stats">
              <span>Total gross: <b>${beforeGross}</b></span>
              <span>Active obligations: ${state.beforeSnapshot.length}</span>
            </div>
            <div class="comparison-list">
              ${obligationsToHtml(state.beforeSnapshot)}
            </div>
          </div>
        </div>
      `;
    }

    metricsEl.innerHTML = topBlock;

    if (state.lastError) {
      errorEl.innerHTML = `<strong>Error:</strong> ${escapeHtml(state.lastError)}`;
      errorEl.style.display = "block";
    } else {
      errorEl.innerHTML = "";
      errorEl.style.display = "none";
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
    // --- build diff maps ---
    const beforeMap = new Map<string, number>();
    const afterMap = new Map<string, number>();

    if (state.beforeSnapshot) {
      state.beforeSnapshot.forEach((o) => {
        beforeMap.set(o.id, o.amount);
      });
    }

    if (state.afterSnapshot) {
      state.afterSnapshot.forEach((o) => {
        afterMap.set(o.id, o.amount);
      });
    }

    // --- build edges ---
    const edges = [];

    // текущие (after)
    for (const o of state.obligations) {
      let classes = "";

      const beforeAmount = beforeMap.get(o.id);

      if (beforeAmount !== undefined && state.afterSnapshot) {
        if (o.amount < beforeAmount) {
          classes = "edge-reduced";
        }
      }

      edges.push({
        data: {
          id: o.id,
          source: o.from,
          target: o.to,
          label: `${o.amount} ${o.unit}`,
        },
        classes,
      });
    }

    // удалённые рёбра
    if (state.beforeSnapshot && state.afterSnapshot) {
      for (const before of state.beforeSnapshot) {
        if (!afterMap.has(before.id)) {
          edges.push({
            data: {
              id: "removed-" + before.id,
              source: before.from,
              target: before.to,
              label: `0 ${before.unit}`,
            },
            classes: "edge-removed",
          });
        }
      }
    }

    // --- render graph ---
    cy.elements().remove();

    cy.add([
      ...state.nodes.map((node) => ({
        data: { id: node.id, label: node.label },
      })),
      ...edges,
    ]);

    cy.layout({ name: "cose", animate: false }).run();

    renderScenarioButtons();
  }

  function loadScenario(name: Exclude<ScenarioName, "imported">): void {
    activeScenario = name;

    if (name === "triangle") {
      store.actions.setObligations(triangleScenario());
    } else if (name === "nested") {
      store.actions.setObligations(nestedScenario());
    } else {
      store.actions.setObligations(overlappingScenario());
    }
  }

  triangleBtn.addEventListener("click", () => loadScenario("triangle"));
  nestedBtn.addEventListener("click", () => loadScenario("nested"));
  overlappingBtn.addEventListener("click", () => loadScenario("overlapping"));

  solveOneBtn.addEventListener("click", () => {
    store.actions.solveOneCycle();
  });

  solveAllBtn.addEventListener("click", () => {
    store.actions.solveAllCycles();
  });

  exportBtn.addEventListener("click", () => {
    const state = store.getState();

    const payload = {
      obligations: state.obligations,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cycles-graph.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { obligations?: unknown };

      if (!parsed || !Array.isArray(parsed.obligations)) {
        throw new Error("Invalid JSON: expected { obligations: [...] }");
      }

      const obligations = parsed.obligations.map((item, index) => {
        if (!item || typeof item !== "object") {
          throw new Error(`Invalid obligation at index ${index}`);
        }

        const row = item as Record<string, unknown>;

        if (
          typeof row.id !== "string" ||
          typeof row.from !== "string" ||
          typeof row.to !== "string" ||
          typeof row.amount !== "number" ||
          typeof row.unit !== "string"
        ) {
          throw new Error(`Invalid obligation fields at index ${index}`);
        }

        return {
          id: row.id,
          from: row.from,
          to: row.to,
          amount: row.amount,
          unit: row.unit,
        };
      });

      activeScenario = "imported";
      store.actions.setObligations(obligations);
      store.actions.clearError();
    } catch (error) {
      store.actions.setError(
        error instanceof Error ? error.message : "Failed to import JSON"
      );
    } finally {
      importInput.value = "";
    }
  });

  store.subscribe(render);
  loadScenario("triangle");
}
