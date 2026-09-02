export type MissionConfirmationAction = "save" | "load" | "restart" | "menu";

export type MissionConfirmation = {
  action: MissionConfirmationAction;
  title: string;
  message: string;
  confirmLabel: string;
};

export const MISSION_CONFIRMATION_COPY: Record<MissionConfirmationAction, Omit<MissionConfirmation, "action">> = {
  menu: {
    title: "Leave mission?",
    message: "Return to the main menu? Unsaved mission progress will be lost.",
    confirmLabel: "Leave mission",
  },
  restart: {
    title: "Restart mission?",
    message: "Restart this mission from the beginning? Unsaved mission progress will be lost.",
    confirmLabel: "Restart mission",
  },
  save: {
    title: "Save mission?",
    message: "Save this mission?",
    confirmLabel: "Save mission",
  },
  load: {
    title: "Load mission?",
    message: "Load the last save for this campaign? Unsaved progress will be lost.",
    confirmLabel: "Load mission",
  },
};

export function missionConfirmationFor(action: MissionConfirmationAction): MissionConfirmation {
  return { action, ...MISSION_CONFIRMATION_COPY[action] };
}
