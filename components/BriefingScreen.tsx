"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/lib/gen/campaign";
import { missionObjectives } from "@/lib/gen/story";
import { drawFace, type FaceTone } from "@/lib/render/faces";
import { formatSeed } from "@/lib/seed/rng";
import type { BriefingLine, Campaign, Character, CharacterRole } from "@/lib/types";
import { briefingCommandFromKey, isEditableTarget, SHORTCUT } from "@/lib/ui/shortcuts";

function Face({
  who,
  talking,
  tone,
}: {
  who: Character;
  talking: boolean;
  tone: FaceTone;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = 200;
    const h = 240;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    let t = 0;
    let raf = 0;
    const loop = () => {
      t += 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawFace(ctx, who.face, w / 2, h / 2 - 2, w * 0.9, t, talking, tone);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [who, talking, tone]);
  return <canvas ref={ref} width={200} height={240} className="w-full bg-[var(--chrome-void)]" style={{ aspectRatio: "5 / 6" }} />;
}

function Portrait({
  who,
  talking,
  tone,
  faction,
}: {
  who: Character;
  talking: boolean;
  tone: FaceTone;
  faction: string;
}) {
  return (
    <div className={`portrait-frame p-2 ${talking ? "portrait-live" : ""}`}>
      <div className="portrait-meta">
        <span>{tone === "enemy" ? "Hostile" : "Channel"}</span>
        <span className={talking ? "text-[var(--chrome-cyan)]" : "text-[var(--chrome-muted)]"}>{talking ? "Live" : "Standby"}</span>
      </div>
      <Face who={who} talking={talking} tone={tone} />
      <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--chrome-text)]">
        {who.title} {who.name}
      </p>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-[var(--chrome-muted)]">{faction}</p>
    </div>
  );
}

function characterFor(campaign: Campaign, role: CharacterRole): Character {
  if (role === "advisor") return campaign.characters.advisor;
  if (role === "commander") return campaign.characters.commander;
  return campaign.characters.enemyLeader;
}

function channelLabel(role: CharacterRole): string {
  return role === "enemyLeader" ? "Hostile" : "Channel";
}

export function BriefingScreen({ seed, mission, returnToGame = false }: { seed: number; mission: number; returnToGame?: boolean }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const def = campaign.missions[mission];
  const [shown, setShown] = useState(0);
  const storyRef = useRef<HTMLDivElement>(null);
  const lines: BriefingLine[] = def?.briefing ?? [];
  const totalChars = lines.reduce((n, line) => n + line.text.length, 0);
  const objectives = useMemo(
    () => (def ? missionObjectives(def, campaign) : []),
    [def, campaign],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= totalChars) {
          clearInterval(id);
          return n;
        }
        return n + 2;
      });
    }, 16);
    return () => clearInterval(id);
  }, [totalChars]);

  useLayoutEffect(() => {
    const el = storyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [shown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = briefingCommandFromKey(e, {
        typing: isEditableTarget(e.target),
        revealed: shown >= totalChars,
        returnToGame,
      });
      if (!command) return;
      e.preventDefault();
      if (command.type === "skip") {
        setShown(totalChars);
        return;
      }
      router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, totalChars, router, seed, mission, returnToGame]);

  if (!def) {
    return <div className="p-8 text-[var(--chrome-text)]">Mission missing.</div>;
  }

  const talking = shown < totalChars;
  let remaining = shown;
  const revealedLines = lines.map((line) => {
    const chars = Math.max(0, Math.min(line.text.length, remaining));
    remaining -= chars;
    return {
      ...line,
      visible: line.text.slice(0, chars),
      started: chars > 0,
      complete: chars >= line.text.length,
    };
  });
  const visibleLines = revealedLines.filter((line) => line.started);
  const active = revealedLines.find((line) => line.started && !line.complete) ?? revealedLines.at(-1);
  const speaker = active ? characterFor(campaign, active.speaker) : campaign.characters.advisor;
  const revealed = shown >= totalChars;

  return (
    <div className="briefing-scanlines min-h-screen px-4 py-8 text-[var(--chrome-body)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="briefing-mast metal-panel mb-6 flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <p className="console-label" data-testid="seed">
              Genesis Protocol · Seed {formatSeed(seed)} · Mission {mission + 1}/8
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.12em] text-[var(--chrome-text)] md:text-4xl">{def.name}</h1>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--chrome-cyan)]">
              {campaign.world.name} · {campaign.world.biome} · {campaign.world.era}
            </p>
          </div>
          <p className="max-w-sm text-right text-[11px] uppercase leading-5 tracking-[0.12em] text-[var(--chrome-muted)]">
            {campaign.factions[0].name} theater brief
            <span className="mt-1 block text-[var(--chrome-cyan)]" data-testid="objective">
              {def.win.kind.replace(/([a-z])([A-Z])/g, "$1 $2")}
              {def.win.target !== undefined ? ` · ${def.win.target}` : ""}
            </span>
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[200px_1fr_200px]">
          <div className="grid gap-4 self-start sm:grid-cols-2 lg:grid-cols-1">
            <Portrait
              who={campaign.characters.advisor}
              talking={speaker.role === "advisor" && talking}
              tone="ally"
              faction={campaign.factions[0].name}
            />
            <Portrait
              who={campaign.characters.commander}
              talking={speaker.role === "commander" && talking}
              tone="command"
              faction={campaign.factions[0].name}
            />
          </div>

          <div className="metal-panel p-5 md:p-6">
            <p className="console-label">Incoming transmission</p>
            <div ref={storyRef} className="briefing-story mt-4 p-4" data-testid="briefing-dialogue">
              {visibleLines.length === 0 ? (
                <p className="min-h-24 text-[15px] leading-8 text-[var(--chrome-muted)]">
                  Awaiting channel lock
                  <span className="text-[var(--chrome-cyan)]">▌</span>
                </p>
              ) : (
                <div className="grid gap-4">
                  {visibleLines.map((line, i) => {
                    const who = characterFor(campaign, line.speaker);
                    const live = talking && speaker.role === line.speaker && !line.complete;
                    return (
                      <article key={`${line.speaker}:${i}`} className="briefing-line" data-role={line.speaker} data-testid="briefing-line">
                        <p className="briefing-line-speaker">
                          <span>{channelLabel(line.speaker)}</span>
                          <span>{who.title} {who.name}</span>
                        </p>
                        <p className="text-[15px] leading-8 text-[var(--chrome-body)]">
                          {line.visible}
                          <span className="text-[var(--chrome-cyan)]">{live ? "▌" : ""}</span>
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <section className="briefing-objectives mt-5 p-4" data-testid="mission-objectives">
              <p className="console-label">Mission objectives</p>
              <ol className="mt-3 grid gap-2">
                {objectives.map((obj, i) => (
                  <li key={obj.id} className="objective-item">
                    <span className="objective-index">{String(i + 1).padStart(2, "0")}</span>
                    <span>{obj.text}</span>
                  </li>
                ))}
              </ol>
              {!revealed ? (
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[var(--chrome-muted)]">Decrypting remaining orders…</p>
              ) : null}
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="console-button has-tooltip"
                data-tooltip={returnToGame ? "Return to the battlefield" : "Launch this mission"}
                data-shortcut={returnToGame ? SHORTCUT.resume : SHORTCUT.launch}
                onClick={() => router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`)}
              >
                {returnToGame ? "Return to mission" : "Launch"}
              </button>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--chrome-muted)]">
                {campaign.world.tone} · {campaign.world.conflict}
              </p>
            </div>
          </div>

          <Portrait
            who={campaign.characters.enemyLeader}
            talking={speaker.role === "enemyLeader" && talking}
            tone="enemy"
            faction={campaign.factions[1].name}
          />
        </div>
      </div>
    </div>
  );
}
