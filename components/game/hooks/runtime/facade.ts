import type { MutableRefObject } from "react";
import type { Command, SimState } from "@/lib/types";
import { createRuntimeController } from "./controller";
import type { RuntimePorts, RuntimeRefs } from "./types";

/**
 * The narrow command boundary shared by UI adapters and the fixed-step runtime.
 * The queue remains a ref so command submission never waits for React state.
 */
export type RuntimeCommandPort = {
  readonly ref: MutableRefObject<Command[]>;
  enqueue: (command: Command) => void;
  enqueueMany: (commands: readonly Command[]) => void;
  clear: () => void;
};

export function createRuntimeCommandPort(ref: MutableRefObject<Command[]>): RuntimeCommandPort {
  return {
    ref,
    enqueue: (command) => ref.current.push(command),
    enqueueMany: (commands) => ref.current.push(...commands),
    clear: () => {
      ref.current = [];
    },
  };
}

export type GameRuntimeFacade = RuntimeCommandPort & {
  readonly stateRef: MutableRefObject<SimState>;
  start: () => void;
  stop: () => void;
};

/**
 * Owns the browser runtime lifecycle while keeping the existing controller as
 * the implementation detail used by the fixed-step loop.
 */
export function createGameRuntimeFacade(refs: RuntimeRefs, ports: RuntimePorts): GameRuntimeFacade {
  const controller = createRuntimeController(refs, ports);
  const commandPort = createRuntimeCommandPort(refs.commandQueue);
  return {
    ...commandPort,
    stateRef: refs.stateRef,
    start: controller.start,
    stop: controller.stop,
  };
}
