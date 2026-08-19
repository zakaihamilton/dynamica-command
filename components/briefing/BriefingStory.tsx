import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { characterLabel } from "@/lib/gen/names";
import type { BriefingLine, Campaign, CharacterRole } from "@/lib/types";
import { createTextMeasure, wrapBreakOffsets } from "./briefingWrap";
import styles from "./BriefingStory.module.css";

function characterFor(campaign: Campaign, role: CharacterRole) {
  if (role === "advisor") return campaign.characters.advisor;
  if (role === "commander") return campaign.characters.commander;
  return campaign.characters.enemyLeader;
}

function channelLabel(role: CharacterRole) {
  return role === "enemyLeader" ? "Hostile" : "Channel";
}

export type RevealedLine = BriefingLine & {
  visible: string;
  started: boolean;
  complete: boolean;
};

function sameBreaks(a: number[], b: number[]) {
  return a.length === b.length && a.every((offset, i) => offset === b[i]);
}

function TypewriterBody({
  text,
  visible,
  live,
}: {
  text: string;
  visible: string;
  live: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [breaks, setBreaks] = useState<number[]>([]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const { measure, dispose } = createTextMeasure(el);
    const update = () => {
      if (cancelled) return;
      const next = wrapBreakOffsets(text, Math.max(0, el.clientWidth - 1), measure);
      setBreaks((prev) => (sameBreaks(prev, next) ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    void document.fonts?.ready.then(update);
    return () => {
      cancelled = true;
      observer.disconnect();
      dispose();
    };
  }, [text]);

  const nodes: ReactNode[] = [];
  let last = 0;
  for (const offset of breaks) {
    if (offset > visible.length) break;
    if (offset > last) nodes.push(visible.slice(last, offset));
    nodes.push(<br key={offset} />);
    last = offset;
  }
  if (last < visible.length) nodes.push(visible.slice(last));

  return (
    <p ref={ref} className={styles.body}>
      {nodes}
      <span className={styles.caret}>{live ? "▌" : ""}</span>
    </p>
  );
}

export function BriefingStory({
  storyRef,
  campaign,
  lines,
  talking,
  speakerRole,
}: {
  storyRef: Ref<HTMLDivElement>;
  campaign: Campaign;
  lines: RevealedLine[];
  talking: boolean;
  speakerRole: CharacterRole | undefined;
}) {
  return (
    <div ref={storyRef} className={styles.story} data-testid="briefing-dialogue">
      {lines.length === 0 ? (
        <p className={styles.empty}>
          Awaiting channel lock
          <span className={styles.caret}>▌</span>
        </p>
      ) : (
        <div className={styles.lines}>
          {lines.map((line, i) => {
            const who = characterFor(campaign, line.speaker);
            const live = talking && speakerRole === line.speaker && !line.complete;
            return (
              <article key={`${line.speaker}:${i}`} className={styles.line} data-role={line.speaker} data-testid="briefing-line">
                <p className={styles.speaker}>
                  <span>{channelLabel(line.speaker)}</span>
                  <span>{characterLabel(who)}</span>
                </p>
                <TypewriterBody text={line.text} visible={line.visible} live={live} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
