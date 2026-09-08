# Architecture hardening baseline

Captured 2026-09-08 before the staged refactor. Replay digests were independently
recomputed from the pre-refactor `HEAD` and the refactored tree; both produced
the values below. Each replay runs 120 ticks with no orders.

| Mission kind | Seed | Mission | SHA-256 of replay fingerprint |
| --- | ---: | ---: | --- |
| annihilate | 1 | 2 | `a7778eaa0d490048f01feb7dbe764a8ed8027157cade385a65318dc3cade5082` |
| decapitate | 1 | 4 | `1f91b716d413f5d7e38fe0594f2dbd91ebdcca1f0bb1b2fecd89c343c28f7c88` |
| destroyMarked | 0 | 3 | `3163c1aa667d253378f1151011c67221789b27dd49c9e45d26b32ba9cea27c65` |
| escort | 0 | 2 | `529fb67ce6525db3d7e5b38be23a3095cbc802f1c36f5bd427038f4f35b85746` |
| extraction | 0 | 1 | `5022c0b80323ba1be2f9e7aa954d398d356f2123384f70a40f682e8da800c111` |
| forceQuota | 0 | 4 | `2dd8ca2e5b255499829ddd491398badf38619521cabd2a42b246715df4063a7a` |
| harvestQuota | 7 | 3 | `2ef3b18591122e986258a7760fed54478714d89ca471c08aa7d781e04111b294` |
| holdTheLine | 0 | 5 | `1709546e3006c6b3312e62f0bfee5b271e1577df8a2cbfb6ab1aeba0698465be` |
| razeAll | 3 | 2 | `149ac9b6b6c99e3d1e2efc46430ed97f6a476c354a0d58451e599fc33bdc0d02` |
| rescue | 0 | 0 | `b4c7c003a09944563f2de154b8f7813db79450fdd469e66af4da09922fa399c8` |
| sabotage | 1 | 0 | `580e555d953c6e789422fd76b6a42ab8f2c953ef2471e561a34baa26219900cc` |
| structureQuota | 2 | 0 | `c6fc6cf9ba8add87cc835fd394ab457602533155d0dce468c4d25b47d818dd85` |

The executable replay assertions live in
`tests/simulation/replayCompatibility.test.ts`.

## Persistence fixtures

- Current autosave envelope: save version 2, content version 1.
- Legacy autosave envelope: save version 1 with content version omitted.
- Legacy root-form autosave: state and `savedAt` at the root.
- Named slots: current versioned envelope and migration path.
- Malformed and future versions: rejected without normalization.
- Partial restore writes: autosave/campaign rollback behavior covered by
  `tests/persistence/restoreSlot.test.ts`.

## Health snapshot

- Fast suite: 116 files, 1,148 tests passed.
- Dead-code check: passed.
- Duplication check: 60 clones, 439 duplicated lines, 0.83% of analyzed lines.
- Performance budgets: atlas <= 880 ms in sampled runs; simulation p95 <= 2.68
  ms; blocked combat p95 <= 0.11 ms; foreground path p95 <= 0.22 ms.
- Replay, catalog, pipeline, scenario, migration, and architecture boundary
  tests are included in the normal Vitest run.

The full balance and browser-suite results remain release gates and should be
refreshed after each architecture stage.
