# Cycles Contribution Graph

A local-first application for visualizing and resolving cyclic obligations using graph-based clearing.

---

##  Idea

We model obligations as a **directed weighted graph**, where:

* nodes = participants
* edges = obligations (who owes whom)

The system detects **cycles of debt** and clears them using a minimal edge strategy:

> If A → B → C → A forms a cycle, the smallest obligation can be netted out across the entire cycle.

This reduces total exposure without external liquidity.

---

##  Example

Before:

A → B: 100
B → C: 80
C → A: 50

After resolving cycle:

A → B: 50
B → C: 30

✔ 50 units of debt cleared
✔ no external money required

---

##  Features

* Graph-based obligation modeling
* Cycle detection (DFS)
* Automatic cycle clearing
* "Resolve one cycle"
* "Resolve all cycles"
* Settlement batch history
* Import / Export JSON
* KPI panel (total exposure, cleared amount)

---

##  Architecture

* **Frontend:** TypeScript + Vite
* **Graph engine:** custom cycle detection + clearing
* **State:** local-first store
* **UI:** Cytoscape.js (graph visualization)

No backend required for MVP.

---

##  How it works

1. Build adjacency graph
2. Find a cycle (DFS)
3. Compute minimum edge in cycle
4. Create settlement batch
5. Apply atomically

---

##  Installation

```bash
npm install
npm run dev
```

---

##  Demo scenarios

* Triangle cycle
* Nested cycles
* Liquidity loop

---

##  Inspiration

This project is inspired by:

* Cycles Protocol (graph-based settlement)
* Netting & clearing systems in finance
* Graph theory (cycle detection)

---

##  Roadmap

* Heuristic global clearing
* Min-cost flow solver (MTCS-like)
* Multi-user backend (Ruby API)
* Privacy layer (TEE / ZK)

---

##  Author

Built during Shape Rotator Hackathon.

---

##  Disclaimer

This is a research-inspired prototype, not a financial system.

Hackathon project – work in progress
