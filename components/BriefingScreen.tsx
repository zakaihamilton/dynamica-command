"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/lib/gen/campaign";
import { drawFace } from "@/lib/render/faces";
import { formatSeed } from "@/lib/seed/rng";
import type { Character } from "@/lib/types";

function Face({
  who,
  talking,
}: {
  who: Character;
  talking: boolean;
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
      ctx.fillStyle = "#10140c";
      ctx.fillRect(0, 0, c.width, c.height);
      drawFace(ctx, who.face, c.width / 2, c.height / 2 + 10, c.width * 0.9, t, talking);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [who, talking]);
  return <canvas ref={ref} width={220} height={260} className="w-full bg-[#10140c]" />;
}

export function BriefingScreen({ seed, mission }: { seed: number; mission: number }) {
  const router = useRouter();
  const campaign = useMemo(() => createCampaign(seed), [seed]);
  const def = campaign.missions[mission];
  const [shown, setShown] = useState(0);
  const text = def?.briefing ?? "No such mission.";

  useEffect(() => {
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 16);
    return () => clearInterval(id);
  }, [text]);

  if (!def) {
    return <div className="p-8 text-[#e8e0d0]">Mission missing.</div>;
  }

  const talking = shown < text.length;
  const speaker = shown < text.length * 0.45 ? campaign.characters.advisor : campaign.characters.commander;

  return (
    <div className="min-h-screen bg-[#0b0d10] px-6 py-10 text-[#e8e0d0]">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[220px_1fr_220px]">
        <div>
          <Face who={campaign.characters.advisor} talking={speaker.role === "advisor" && talking} />
          <p className="mt-2 text-center font-mono text-xs">
            {campaign.characters.advisor.title} {campaign.characters.advisor.name}
          </p>
        </div>
        <div className="border border-[#3d4a38] bg-[#14180f] p-6">
          <p className="font-mono text-xs tracking-[0.3em] text-[#8f9a6a]" data-testid="seed">
            SEED {formatSeed(seed)} · MISSION {mission + 1}/8
          </p>
          <h1 className="mt-2 font-serif text-3xl text-[#f3e6c4]">{def.name}</h1>
          <p className="mt-2 text-sm text-[#c4b37a]" data-testid="objective">
            {def.win.kind}
            {def.win.target !== undefined ? ` · ${def.win.target}` : ""}
          </p>
          <p className="mt-6 min-h-40 text-sm leading-7">{text.slice(0, shown)}</p>
          <button
            type="button"
            className="mt-8 rounded border border-[#c4b37a] bg-[#2a3218] px-5 py-2 hover:bg-[#3a4520]"
            onClick={() => router.push(`/play?seed=${formatSeed(seed)}&mission=${mission}`)}
          >
            Launch
          </button>
        </div>
        <div>
          <Face who={campaign.characters.enemyLeader} talking={false} />
          <p className="mt-2 text-center font-mono text-xs">
            {campaign.characters.enemyLeader.title} {campaign.characters.enemyLeader.name}
          </p>
        </div>
      </div>
    </div>
  );
}
