// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandCameo } from "../../components/game/CommandCameo";
import { SpritePreview } from "../../components/game/SpritePreview";
import { SPRITE_PREVIEW_HEIGHT, SPRITE_PREVIEW_WIDTH } from "../../lib/render/spritePreview";
import type { FactionVisualProfile, Palette } from "../../lib/types";

const mocks = vi.hoisted(() => ({
  buildingSprite: vi.fn(() => ({
    id: "building:power",
    kind: "building",
    w: 100,
    h: 80,
    palette: {},
    shapes: [],
    imageSrc: "/art/power.webp",
  })),
  unitSprite: vi.fn(() => ({
    id: "unit:infantry",
    kind: "unit",
    w: 64,
    h: 60,
    palette: {},
    shapes: [],
    imageSrc: "/art/infantry.webp",
  })),
  drawSprite: vi.fn(),
  rasterize: vi.fn(() => ({ width: 200, height: 160 })),
  spriteContentBounds: vi.fn(() => ({ minX: 8, minY: 12, width: 40, height: 20 })),
  drawUnitShadow: vi.fn(),
  paintBuildingAssetOverlay: vi.fn(),
}));

vi.mock("@/lib/gen/assets", () => ({
  buildingSprite: mocks.buildingSprite,
  unitSprite: mocks.unitSprite,
}));
vi.mock("@/lib/render/sprites", () => ({
  drawSprite: mocks.drawSprite,
  rasterize: mocks.rasterize,
  spriteContentBounds: mocks.spriteContentBounds,
}));
vi.mock("@/lib/render/unitMotion", () => ({ drawUnitShadow: mocks.drawUnitShadow }));
vi.mock("@/lib/render/previewEffects", () => ({ paintBuildingAssetOverlay: mocks.paintBuildingAssetOverlay }));
vi.mock("@/lib/render/gl/modelLoader", () => ({ buildTurretHeadModel: vi.fn() }));
vi.mock("@/lib/render/gl/modelRenderer", () => ({ draw3dModel: vi.fn() }));

const palette: Palette = {
  primary: "#4a7",
  secondary: "#253",
  accent: "#fd0",
  outline: "#111",
  light: "#8c8",
  dark: "#131",
};
const profile: FactionVisualProfile = {
  designFamily: 0,
  material: "brushed",
  trimPattern: 0,
  insignia: 0,
  weathering: 0,
  lightRig: "cyan",
};

function createContext() {
  return {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  } as unknown as CanvasRenderingContext2D;
}

describe("SpritePreview", () => {
  let context: CanvasRenderingContext2D;

  beforeEach(() => {
    context = createContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => context,
    );
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders building cards at high resolution with shared building accents", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const { container } = render(<SpritePreview kind="power" palette={palette} profile={profile} />);

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    if (!canvas) return;
    expect(canvas).toHaveAttribute("width", String(SPRITE_PREVIEW_WIDTH * 2));
    expect(canvas).toHaveAttribute("height", String(SPRITE_PREVIEW_HEIGHT * 2));
    expect(context.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe("high");
    expect(mocks.drawSprite).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ minX: 8, minY: 12, width: 40, height: 20 }),
    );
    expect(mocks.paintBuildingAssetOverlay).toHaveBeenCalledWith(
      expect.anything(),
      "power",
      SPRITE_PREVIEW_WIDTH / 2,
      SPRITE_PREVIEW_HEIGHT / 2,
      expect.any(Number),
      0,
      0,
      false,
      palette,
    );
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("keeps unit animation and shadow rendering while cleaning up its timer", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { container, unmount } = render(<SpritePreview kind="infantry" palette={palette} profile={profile} />);

    expect(container.querySelector("canvas")).toBeTruthy();
    expect(mocks.drawUnitShadow).toHaveBeenCalled();
    expect(mocks.paintBuildingAssetOverlay).not.toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 140);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledWith(setIntervalSpy.mock.results[0]?.value);
  });

  it("keeps both building and unit previews attached to sidebar item cards", () => {
    render(
      <>
        <CommandCameo
          kind="power"
          palette={palette}
          profile={profile}
          cost={300}
          cameo={{ ratio: 0, queued: 0, phase: "idle" }}
          onClick={vi.fn()}
        />
        <CommandCameo
          kind="infantry"
          palette={palette}
          profile={profile}
          cost={100}
          cameo={{ ratio: 0, queued: 0, phase: "idle" }}
          onClick={vi.fn()}
        />
      </>,
    );

    expect(screen.getByRole("button", { name: /Power Plant, 300 credits/ }).querySelector("canvas")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Infantry, 100 credits/ }).querySelector("canvas")).toBeTruthy();
  });
});
