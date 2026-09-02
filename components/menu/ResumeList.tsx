"use client";

import { useState } from "react";
import { ConsoleButton } from "@/components/ui/ConsoleButton";
import { ConsoleLabel } from "@/components/ui/ConsoleLabel";
import { MetalPanel } from "@/components/ui/MetalPanel";
import type { listSaves } from "@/lib/persist/save";
import { formatMissionDuration } from "@/lib/sim/debrief";
import styles from "./ResumeList.module.css";

type Save = ReturnType<typeof listSaves>[number];

export function ResumeList({
  saves,
  showHeading = true,
  expanded = false,
  onResume,
  onCampaignMap,
  onDelete,
}: {
  saves: Save[];
  showHeading?: boolean;
  expanded?: boolean;
  onResume: (seed: string) => void;
  onCampaignMap: (seed: string) => void;
  onDelete: (seed: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<Save | null>(null);

  return (
    <>
      <div className={styles.block}>
        {showHeading ? <ConsoleLabel as="h2" className={styles.heading}>Resume campaign</ConsoleLabel> : null}
        <div className={`${styles.listWrap} ${expanded ? styles.expanded : ""}`}>
          {saves.length === 0 ? (
            <p className={styles.empty}>No saved campaigns.</p>
          ) : (
            <ul className={styles.list}>
              {saves.map((s) => (
                <li className={styles.row} key={s.seed}>
                  <ConsoleButton
                    muted
                    className={styles.item}
                    tooltip={`Resume ${s.campaignName}`}
                    onClick={() => onResume(s.seed)}
                  >
                    {s.campaignName} · Mission {s.missionIndex + 1} · Duration {formatMissionDuration(s.tick)}
                  </ConsoleButton>
                  <ConsoleButton
                    muted
                    className={styles.operations}
                    aria-label={`Open operations for ${s.campaignName} campaign`}
                    tooltip={`Open operations for ${s.campaignName} campaign`}
                    onClick={() => onCampaignMap(s.seed)}
                  >
                    OPS
                  </ConsoleButton>
                  <ConsoleButton
                    muted
                    className={styles.delete}
                    aria-label={`Delete ${s.campaignName} campaign`}
                    tooltip={`Delete ${s.campaignName} campaign`}
                    onClick={() => setPendingDelete(s)}
                  >
                    <svg className={styles.deleteIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
                    </svg>
                  </ConsoleButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {pendingDelete ? (
        <div className={styles.confirmOverlay}>
          <MetalPanel
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-campaign-title"
          >
            <ConsoleLabel as="h2" id="delete-campaign-title">Delete campaign?</ConsoleLabel>
            <p className={styles.confirmCopy}>
              Delete {pendingDelete.campaignName}? This saved campaign cannot be recovered.
            </p>
            <div className={styles.confirmActions}>
              <ConsoleButton muted onClick={() => setPendingDelete(null)}>Cancel</ConsoleButton>
              <ConsoleButton
                className={styles.confirmDelete}
                onClick={() => {
                  onDelete(pendingDelete.seed);
                  setPendingDelete(null);
                }}
              >
                Delete campaign
              </ConsoleButton>
            </div>
          </MetalPanel>
        </div>
      ) : null}
    </>
  );
}
