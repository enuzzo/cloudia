import { describe, expect, it } from "vitest";
import { resolveMountElement } from "./CloudiaHero";

describe("CloudiaHero", () => {
  it("resolves a selector mount target", () => {
    document.body.innerHTML = "<div id='cloudia-mount'></div>";

    expect(resolveMountElement("#cloudia-mount")).toBeInstanceOf(HTMLElement);
  });

  it("returns an HTMLElement target unchanged", () => {
    const target = document.createElement("section");

    expect(resolveMountElement(target)).toBe(target);
  });

  it("throws for a missing selector", () => {
    expect(() => resolveMountElement("#missing")).toThrow(
      "Cloudia mount target not found: #missing",
    );
  });
});
