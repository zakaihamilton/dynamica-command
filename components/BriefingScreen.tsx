"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/lib/gen/campaign";
import { missionObjectives } from "@/lib/gen/story";
import { drawFace, type FaceTone } from "@/lib/render/faces";
import { formatSeed } from "@/lib/seed/rng";
import type { Character } from "@/lib/types";

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
    let t = 0;
    let raf = 0;
    const loop = () => {
      t += 1;
      ctx.clearRect(0, 0, c.width, c.height);
      drawFace(ctx, who.face, c.width / 2, c.height / 2 - 4, c.width * 0.86, t, talking, tone);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [who, talking, tone]);
  return <canvas ref={ref} width={168} height={200} className="pixel-canvas w-full bg-[#10140c]" />;
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
        <span className={talking ? "text-[#d7bd62]" : "text-[#6f7664]"}>{talking ? "Live" : "Standby"}</span>
      </div>
      <Face who={who} talking={talking} tone={tone} />
      <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#d5cc9f]">
        {who.title} {who.name}
      </p>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-[#8b9278]">{faction}</p>
    </div>
  );
}

export function BriefingScreen({ seed, mission, returnToGame = false }: { seed: number; mission: number; returnToGame?: boolean }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const def = campaign.missions[mission];
  const [shown, setShown] = useState(0);
  const text = def?.briefing ?? "No such mission.";
  const objectives = useMemo(
    () => (def ? missionObjectives(def, campaign) : []),
    [def, campaign],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 2;
      });
    }, 16);
    return () => clearInterval(id);
  }, [text]);

  if (!def) {
    return <div className="p-8 text-[#e8e0d0]">Mission missing.</div>;
  }

  const talking = shown < text.length;
  const speaker = shown < text.length * 0.45 ? campaign.characters.advisor : campaign.characters.commander;
  const revealed = shown >= text.length;

  return (
    <div className="briefing-scanlines min-h-screen px-4 py-8 text-[#d8d3b8] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="briefing-mast metal-panel mb-6 flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <p className="console-label" data-testid="seed">
              Genesis Protocol · Seed {formatSeed(seed)} · Mission {mission + 1}/8
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.12em] text-[#e7dcb0] md:text-4xl">{def.name}</h1>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#b7a66a]">
              {campaign.world.name} · {campaign.world.biome} · {campaign.world.era}
            </p>
          </div>
          <p className="max-w-sm text-right text-[11px] uppercase leading-5 tracking-[0.12em] text-[#8e957c]">
            {campaign.factions[0].name} theater brief
            <span className="mt-1 block text-[#c4b37a]" data-testid="objective">
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
            <div className="briefing-story mt-4 p-4">
              <p className="min-h-40 text-[15px] leading-8 text-[#c5c7b2]">
                {text.slice(0, shown)}
                <span className="text-[#d7bd62]">{talking ? "▌" : ""}</span>
              </p>
            </div>

            <section className="briefing-objectives mt-5 p-4" data-testid="mission-objectives">
              <p className="console-label">Mission objectives</p>
              <ol className="mt-3 grid gap-2">
                {objectives.map((obj, i) => (
                  <li key={obj.id} className={`objective-item ${obj.primary ? "objective-primary" : ""}`}>
                    <span className="objective-index">{String(i + 1).padStart(2, "0")}</span>
                    <span>{obj.text}</span>
                  </li>
                ))}
              </ol>
              {!revealed ? (
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[#6f7664]">Decrypting remaining orders…</p>
              ) : null}
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="console-button"
                onClick={() => router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}${returnToGame ? "&resume=1" : ""}`)}
              >
                {returnToGame ? "Return to mission" : "Launch"}
              </button>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#6f7664]">
                {campaign.world.tone} · {campaign.world.conflict}
              </p>
            </div>
          </div>

          <Portrait
            who={campaign.characters.enemyLeader}
            talking={false}
            tone="enemy"
            faction={campaign.factions[1].name}
          />
        </div>
      </div>
    </div>
  );
}
