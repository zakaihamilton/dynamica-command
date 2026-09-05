/* eslint-disable @typescript-eslint/no-require-imports */
require("tsx/cjs");

const { parentPort, workerData } = require("node:worker_threads");
const { runBalanceSweepJob } = require("../lib/sim/balanceRunner.ts");

if (!parentPort) throw new Error("Balance sweep worker requires a parent port");

parentPort.on("message", (message) => {
  if (message?.type === "close") {
    parentPort.close();
    return;
  }
  if (message?.type !== "run" || !Array.isArray(message.scenarios)) return;
  try {
    const records = runBalanceSweepJob(
      { ...workerData, scenarios: message.scenarios },
      (record) => parentPort.postMessage({ type: "progress", record }),
    );
    parentPort.postMessage({ type: "complete", records });
  } catch (error) {
    parentPort.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
