import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import type { listSaves } from "@/lib/persist/save";
import styles from "./ResumeList.module.css";

type Save = ReturnType<typeof listSaves>[number];

export function ResumeList({
  saves,
  onResume,
}: {
  saves: Save[];
  onResume: (seed: string) => void;
}) {
  return (
    <div className={styles.block}>
      <ConsoleLabel as="h2">Resume campaign</ConsoleLabel>
      <div className={styles.listWrap}>
        {saves.length === 0 ? (
          <p className={styles.empty}>No saved campaigns.</p>
        ) : (
          <ul className={styles.list}>
            {saves.map((s) => (
              <li key={s.seed}>
                <ConsoleButton
                  muted
                  className={styles.item}
                  tooltip={`Resume seed ${s.seed}`}
                  onClick={() => onResume(s.seed)}
                >
                  Seed {s.seed} · Mission {s.missionIndex + 1} · tick {s.tick}
                </ConsoleButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
