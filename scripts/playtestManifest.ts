import { representativePlaytestManifest } from "../lib/sim/balanceRunner";

console.log(JSON.stringify({
  range: { from: 0, to: 39 },
  scenariosPerVariant: 2,
  scenarios: representativePlaytestManifest(),
}, null, 2));
