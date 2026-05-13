import "./styles.css";

const status = document.querySelector<HTMLParagraphElement>("#cloudia-status");
if (status) {
  status.textContent = "Lab shell ready. The clouds are still paperwork.";
}
