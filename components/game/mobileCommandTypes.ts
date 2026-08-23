export type MobileCommand = "move" | "attack" | "attackMove" | "harvest";
export type MobileSheetContext = "unit" | "base";
export type MobileSurfaceState = {
  dockVisible: boolean;
  sheetOpen: boolean;
  sheetContext: MobileSheetContext;
  activeCommand: MobileCommand | null;
  selectionMode: boolean;
  selectedCount: number;
};
