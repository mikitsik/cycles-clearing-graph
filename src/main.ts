import "./styles.css";
import { triangleScenario } from "./scenario";
import { createAppStore } from "./store";
import { mountUI } from "./ui";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root element");

const store = createAppStore(triangleScenario());
mountUI(root, store);
