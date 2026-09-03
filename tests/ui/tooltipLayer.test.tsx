// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipLayer } from "../../components/TooltipLayer";

afterEach(() => cleanup());

function TooltipPage({ showTarget }: { showTarget: boolean }) {
  return (
    <>
      {showTarget ? <button data-tooltip="Open the next page">Open</button> : null}
      <TooltipLayer />
    </>
  );
}

describe("tooltip layer", () => {
  it("hides the active tooltip when navigation removes its page target", async () => {
    const { rerender } = render(<TooltipPage showTarget />);
    const target = screen.getByRole("button", { name: "Open" });
    fireEvent.pointerOver(target);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Open the next page");

    rerender(<TooltipPage showTarget={false} />);

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("dismisses the active tooltip when pointer interaction begins", async () => {
    render(<TooltipPage showTarget />);
    const target = screen.getByRole("button", { name: "Open" });
    fireEvent.pointerOver(target);
    expect(await screen.findByRole("tooltip")).toBeVisible();

    fireEvent.pointerDown(target);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
