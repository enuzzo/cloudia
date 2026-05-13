import "./styles.css";
import { LabApp } from "./lab/LabApp";

const stage = document.querySelector<HTMLElement>("[data-testid='cloudia-stage']");
const status = document.querySelector<HTMLParagraphElement>("#cloudia-status");

if (!stage) {
  throw new Error("Cloudia stage element is missing");
}

const app = new LabApp(stage);
app.start();

if (status) {
  status.textContent = "Lab running. Tune gently; the atmosphere is listening.";
}

window.addEventListener("beforeunload", () => app.destroy());
