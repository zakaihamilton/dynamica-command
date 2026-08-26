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
// crop and resize to 200x240. Keep this table keyed by the complete asset ID:
// the same numbered sheet can have a different crop in another role.
export const PORTRAIT_MOUTH_CALIBRATIONS: Readonly<Record<string, PortraitMouthCalibration>> = {
  "commander-01": calibration(0.66, { rx: 0.2, ry: 0.095, dx: 9 }),
  "commander-02": calibration(0.57, { rx: 0.17, ry: 0.085 }),
  "commander-03": calibration(0.55, { rx: 0.18, ry: 0.085 }),
  "commander-04": calibration(0.55, { rx: 0.18, ry: 0.09 }),
  "commander-05": calibration(0.56, { rx: 0.18, ry: 0.085 }),
  "commander-06": calibration(0.55, { rx: 0.18, ry: 0.09 }),
  "commander-07": calibration(0.57, { rx: 0.18, ry: 0.09 }),
  "commander-08": calibration(0.55, { rx: 0.17, ry: 0.085 }),
  "commander-09": calibration(0.55, { rx: 0.18, ry: 0.085 }),
  "commander-10": calibration(0.56, { rx: 0.18, ry: 0.09 }),
  "commander-11": calibration(0.56, { rx: 0.19, ry: 0.095 }),
  "commander-12": calibration(0.56, { rx: 0.18, ry: 0.09 }),

  "advisor-01": calibration(0.56, { rx: 0.18, ry: 0.085 }),
  "advisor-02": calibration(0.57, { rx: 0.19, ry: 0.09 }),
  "advisor-03": calibration(0.57, { rx: 0.18, ry: 0.085 }),
  "advisor-04": calibration(0.57, { rx: 0.17, ry: 0.085 }),
  "advisor-05": calibration(0.57, { rx: 0.18, ry: 0.09, dx: 2 }),
  "advisor-06": calibration(0.57, { rx: 0.19, ry: 0.09 }),
  "advisor-07": calibration(0.56, { rx: 0.18, ry: 0.085 }),
  "advisor-08": calibration(0.57, { rx: 0.19, ry: 0.09 }),
  "advisor-09": calibration(0.57, { rx: 0.18, ry: 0.085 }),
  "advisor-10": calibration(0.57, { rx: 0.17, ry: 0.085 }),
  "advisor-11": calibration(0.57, { rx: 0.18, ry: 0.09, dx: 2 }),
  "advisor-12": calibration(0.57, { rx: 0.19, ry: 0.09 }),

  "enemy-leader-01": calibration(0.66, { rx: 0.2, ry: 0.095, dx: 9 }),
  "enemy-leader-02": calibration(0.57, { rx: 0.17, ry: 0.085 }),
  "enemy-leader-03": calibration(0.55, { rx: 0.18, ry: 0.085 }),
  "enemy-leader-04": calibration(0.55, { rx: 0.18, ry: 0.09 }),
  "enemy-leader-05": calibration(0.56, { rx: 0.18, ry: 0.085 }),
  "enemy-leader-06": calibration(0.55, { rx: 0.18, ry: 0.09 }),
  "enemy-leader-07": calibration(0.57, { rx: 0.18, ry: 0.09 }),
  "enemy-leader-08": calibration(0.55, { rx: 0.17, ry: 0.085 }),
  "enemy-leader-09": calibration(0.55, { rx: 0.18, ry: 0.085 }),
  "enemy-leader-10": calibration(0.56, { rx: 0.18, ry: 0.09 }),
  "enemy-leader-11": calibration(0.56, { rx: 0.19, ry: 0.095 }),
  "enemy-leader-12": calibration(0.56, { rx: 0.18, ry: 0.09 }),
};

export const DEFAULT_PORTRAIT_MOUTH_CALIBRATION: PortraitMouthCalibration = calibration(0.635, {
  rx: 0.18,
  ry: 0.09,
});

export function portraitMouthCalibration(id: string): PortraitMouthCalibration {
  return PORTRAIT_MOUTH_CALIBRATIONS[id] ?? DEFAULT_PORTRAIT_MOUTH_CALIBRATION;
}
