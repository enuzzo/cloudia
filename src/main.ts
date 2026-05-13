import "./styles.css";
import { defaultPreset } from "./core/defaultPreset";
import { CloudEngine } from "./render/CloudEngine";

const stage = document.querySelector<HTMLElement>("[data-testid='cloudia-stage']");
const status = document.querySelector<HTMLParagraphElement>("#cloudia-status");

if (!stage) {
  throw new Error("Cloudia stage element is missing");
}

const engine = new CloudEngine(stage, defaultPreset);
engine.start();

if (status) {
  status.textContent = "Flow baseline running. The cloud deck has entered the chat.";
}

window.addEventListener("beforeunload", () => engine.destroy());
