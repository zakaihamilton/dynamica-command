// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Ref } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useModalFocus } from "../components/ui/useModalFocus";

afterEach(() => cleanup());

function Trap({ initial = "first" }: { initial?: "dialog" | "first" }) {
  const ref = useModalFocus(true, initial, initial);
  return (
    <div>
      <button type="button">Outside</button>
      <div ref={ref as Ref<HTMLDivElement>} tabIndex={-1} role="dialog" aria-label="Dialog">
        <button type="button">First</button>
        <button type="button">Last</button>
      </div>
    </div>
  );
}

describe("useModalFocus", () => {
  it("focuses the first control and wraps tab at the dialog edges", () => {
    render(<Trap />);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    screen.getByRole("button", { name: "Last" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("can start on the dialog so button tooltips do not pop on open", () => {
    render(<Trap initial="dialog" />);
    expect(screen.getByRole("dialog", { name: "Dialog" })).toHaveFocus();
  });

  it("pulls focus back when tab starts outside the dialog", () => {
    render(<Trap />);
    screen.getByRole("button", { name: "Outside" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });
});
