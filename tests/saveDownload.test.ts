// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadSaveExport } from "../lib/persist/saveDownload";

describe("save download adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("downloads JSON through a browser Blob and anchor", () => {
    const url = "blob:genesis";
    vi.spyOn(URL, "createObjectURL").mockReturnValue(url);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.fn();
    const createElement = vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      rel: "",
      click,
    } as unknown as HTMLAnchorElement);

    downloadSaveExport('{"ok":true}', "genesis-protocol-0421-save.json");

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(createElement).toHaveBeenCalledWith("a");
    expect(click).toHaveBeenCalledOnce();
  });
});
