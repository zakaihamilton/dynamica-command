import { GENERATED_PORTRAIT_MOUTH_CALIBRATIONS } from "./portraitCalibration.generated";
import { PORTRAIT_MOUTH_CALIBRATION_OVERRIDES } from "./portraitCalibrationOverrides";

type PortraitClip = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

type PortraitOffset = {
  dx: number;
  dy: number;
};

export type PortraitMouthCalibration = {
  clip: PortraitClip;
  talkOffset: PortraitOffset;
};

const calibration = (
  cy: number,
  options: Partial<PortraitClip & PortraitOffset> = {},
): PortraitMouthCalibration => ({
  clip: {
    cx: options.cx ?? 0.5,
    cy,
    rx: options.rx ?? 0.18,
    ry: options.ry ?? 0.09,
  },
  talkOffset: {
    dx: options.dx ?? 0,
    dy: options.dy ?? 0,
  },
});

// Coordinates are normalized destination-space values after the production
// crop and resize to 200x240. The generated map contains a separate value for
// every sheet; manual exceptions take precedence when an asset is intentionally
// hand-tuned or its generated signal is not trustworthy.
export const PORTRAIT_MOUTH_CALIBRATIONS: Readonly<Record<string, PortraitMouthCalibration>> = {
  ...GENERATED_PORTRAIT_MOUTH_CALIBRATIONS,
  ...PORTRAIT_MOUTH_CALIBRATION_OVERRIDES,
};

export const DEFAULT_PORTRAIT_MOUTH_CALIBRATION: PortraitMouthCalibration = calibration(0.635, {
  rx: 0.18,
  ry: 0.09,
});

export function portraitMouthCalibration(id: string): PortraitMouthCalibration {
  return PORTRAIT_MOUTH_CALIBRATIONS[id] ?? DEFAULT_PORTRAIT_MOUTH_CALIBRATION;
}
