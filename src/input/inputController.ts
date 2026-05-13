import type { GestureState } from "./gestureMapper";

export class InputController {
  private pointerDown = false;
  private x = 0.5;
  private y = 0.5;

  constructor(private readonly target: HTMLElement) {
    target.addEventListener("pointermove", this.onPointerMove);
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointerup", this.onPointerUp);
    target.addEventListener("pointerleave", this.onPointerUp);
  }

  destroy(): void {
    this.target.removeEventListener("pointermove", this.onPointerMove);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    this.target.removeEventListener("pointerup", this.onPointerUp);
    this.target.removeEventListener("pointerleave", this.onPointerUp);
  }

  getGesture(): GestureState {
    const compression = this.pointerDown ? 0.85 : 0.05;
    return {
      handPresence: 1,
      primaryX: this.x,
      primaryY: this.y,
      openness: 1 - compression,
      compression,
      leftHandClosed: false,
      stormIntent: 0,
    };
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.target.getBoundingClientRect();
    this.x = (event.clientX - rect.left) / rect.width;
    this.y = (event.clientY - rect.top) / rect.height;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = true;
    this.onPointerMove(event);
  };

  private readonly onPointerUp = (): void => {
    this.pointerDown = false;
  };
}
