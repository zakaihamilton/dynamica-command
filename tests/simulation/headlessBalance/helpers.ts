import { createMission } from "../../../lib/sim/api";

export function withoutFog(state: ReturnType<typeof createMission>) {
  const { fog: _fog, ...outcomeState } = state;
  void _fog;
  return outcomeState;
}
