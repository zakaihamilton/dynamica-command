import { afterEach, describe, expect, it, vi } from "vitest";
import {
  composeMusic,
  midiToHz,
  MUSIC_BARS,
  MUSIC_STEPS,
  STEPS_PER_BAR,
  BARS_PER_SECTION,
  TUTORIAL_MUSIC_MISSION,
} from "../../lib/audio/compose";
import { exportMissionSoundtrack, missionSoundtrackFilename, supportsM4aExport } from "../../lib/audio/export";
import { isMusicEnabled, musicCueFromPath, setMusicEnabled, setMusicIntensity } from "../../lib/audio/music";
import { shouldApplyPendingIntensity } from "../../lib/audio/musicScheduler";
import { beep, isSfxEnabled, MAX_SFX_QUEUE_S, playSfx, scheduleSfxTime, setSfxEnabled } from "../../lib/audio/synth";
import { beepForCommands } from "../../lib/audio/uiOrders";
import { spatialAudioForWorld } from "../../lib/audio/spatial";
import { createCamera } from "../../lib/iso";
import { createCampaign } from "../../lib/gen/campaign";
import { pickMissionBiomes } from "../../lib/gen/names";
import { styleAffinityScore } from "../../lib/audio/compose/missionContext";

describe("generated audio", () => {
  afterEach(() => {
    setSfxEnabled(true);
    setMusicEnabled(true);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("composes the same pattern for the same seed, cue, and mission", () => {
    expect(composeMusic(421, "mission", 3)).toEqual(composeMusic(421, "mission", 3));
    expect(composeMusic(421, "menu")).not.toEqual(composeMusic(421, "mission"));
    expect(composeMusic(1, "mission")).not.toEqual(composeMusic(2, "mission"));
  });

  it("varies the arrangement across missions of the same seed", () => {
    expect(composeMusic(421, "mission", 0)).not.toEqual(composeMusic(421, "mission", 1));
    expect(composeMusic(421, "mission", 0)).not.toEqual(composeMusic(421, "mission", 7));
    expect(composeMusic(421, "mission", 0)).not.toEqual(composeMusic(421, "mission", TUTORIAL_MUSIC_MISSION));
  });

  it("covers every seeded style family and keeps mission fingerprints distinct", () => {
    const corpus = Array.from({ length: 48 }, (_, seed) =>
      Array.from({ length: 8 }, (__, mission) => composeMusic(seed, "mission", mission)),
    ).flat();
    expect(new Set(corpus.map((pattern) => pattern.style.name)).size).toBe(20);
    expect(corpus.some((pattern) => pattern.style.bassRiffFamily === "classic")).toBe(true);
    expect(corpus.some((pattern) => pattern.theme.groove === "shuffle")).toBe(true);
    expect(corpus.some((pattern) => pattern.theme.groove === "half-time")).toBe(true);
    expect(corpus.some((pattern) => pattern.theme.groove === "breakbeat")).toBe(true);
    expect(corpus.some((pattern) => pattern.theme.groove === "four-floor")).toBe(true);
    expect(corpus.some((pattern) => pattern.theme.groove === "offbeat")).toBe(true);
    expect(corpus.some((pattern) => pattern.scaleName === "phrygian")).toBe(true);
    expect(corpus.some((pattern) => pattern.scaleName === "harmonic minor" || pattern.scaleName === "minor pentatonic")).toBe(true);
    expect(corpus.some((pattern) => pattern.scaleName === "lydian" || pattern.scaleName === "double harmonic" || pattern.scaleName === "blues")).toBe(true);
    expect(corpus.some((pattern) => pattern.style.voiceEngine === "chip")).toBe(true);
    expect(corpus.some((pattern) => pattern.style.voiceEngine === "acid-res")).toBe(true);
    expect(corpus.some((pattern) => pattern.style.drumKit === "industrial")).toBe(true);
    expect(corpus.some((pattern) => pattern.drums.some((event) => event.kind === "rim" || event.kind === "shaker"))).toBe(true);
    expect(new Set(corpus.map((pattern) => pattern.style.voiceEngine)).size).toBe(5);

    const missions = Array.from({ length: 8 }, (_, mission) => composeMusic(421, "mission", mission));
    expect(new Set(missions.map((pattern) => pattern.style.name)).size).toBe(8);
    expect(new Set(missions.map((pattern) => pattern.style.arrangement.name)).size).toBe(8);
    const campaign = Array.from({ length: 12 }, (_, mission) => composeMusic(421, "mission", mission));
    expect(new Set(campaign.map((pattern) => pattern.style.arrangement.name)).size).toBe(12);
    expect(campaign.some((pattern, index) =>
      campaign.some((other, otherIndex) =>
        index !== otherIndex &&
        JSON.stringify(pattern.style.arrangement.melodyEnabled) !== JSON.stringify(other.style.arrangement.melodyEnabled),
      ),
    )).toBe(true);
    expect(campaign.some((pattern, index) =>
      campaign.some((other, otherIndex) =>
        index !== otherIndex &&
        JSON.stringify(pattern.style.arrangement.counterEnabled) !== JSON.stringify(other.style.arrangement.counterEnabled),
      ),
    )).toBe(true);
    const fingerprints = missions.map((pattern) => JSON.stringify({
      style: pattern.style,
      bpm: pattern.bpm,
      rootMidi: pattern.rootMidi,
      scaleName: pattern.scaleName,
      progression: pattern.theme.progressionA,
      motif: pattern.motif,
      hook: pattern.theme.hook,
      drums: pattern.drums,
    }));
    expect(new Set(fingerprints).size).toBe(missions.length);
    expect(missions.every((pattern) => pattern.arpType === pattern.style.pulseType)).toBe(true);
    expect(missions.every((pattern) => pattern.melodyType === pattern.style.melodyType)).toBe(true);
  });

  it("ties mission scores to campaign biome and objective", () => {
    for (const seed of [0, 21, 421, 1994, 7777]) {
      const campaign = createCampaign(seed);
      for (const mission of campaign.missions) {
        const pattern = composeMusic(seed, "mission", mission.index);
        expect(pattern.biome).toBe(mission.biome);
        expect(pattern.missionKind).toBe(mission.kind);
      }
    }

    const volcanicFamilies = ["foundry-stomp", "night-raid", "acid-grid"];
    const tundraFamilies = ["ice-protocol", "low-orbit", "cinematic-tension"];
    const volcanicOrSecondary = [...volcanicFamilies, "industrial-march", "cinematic-tension", "tape-static", "resonant-coil"];
    const tundraOrSecondary = [...tundraFamilies, "orbital-drift", "glass-chime", "choir-vector", "relay-dub"];
    for (let seed = 0; seed < 48; seed++) {
      const biomes = pickMissionBiomes(seed);
      if (biomes[0] === "volcanic shelf") {
        expect(volcanicFamilies).toContain(composeMusic(seed, "mission", 0).style.name);
      }
      if (biomes[0] === "tundra grid") {
        expect(tundraFamilies).toContain(composeMusic(seed, "mission", 0).style.name);
      }
      const volcanicIndex = biomes.indexOf("volcanic shelf");
      if (volcanicIndex >= 0) {
        expect(volcanicOrSecondary).toContain(composeMusic(seed, "mission", volcanicIndex).style.name);
      }
      const tundraIndex = biomes.indexOf("tundra grid");
      if (tundraIndex >= 0) {
        expect(tundraOrSecondary).toContain(composeMusic(seed, "mission", tundraIndex).style.name);
      }
    }

    for (const seed of [0, 21, 421, 1994, 7777]) {
      const campaign = createCampaign(seed);
      for (const mission of campaign.missions) {
        const pattern = composeMusic(seed, "mission", mission.index);
        expect(styleAffinityScore(pattern.style.name, {
          biome: mission.biome,
          missionKind: mission.kind,
        })).toBeGreaterThan(0);
      }
    }

    const assault: number[] = [];
    const harvest: number[] = [];
    for (let seed = 0; seed < 36; seed++) {
      const campaign = createCampaign(seed);
      for (const mission of campaign.missions) {
        const density = composeMusic(seed, "mission", mission.index).style.drumDensity;
        if (mission.kind === "razeAll" || mission.kind === "annihilate" || mission.kind === "decapitate") {
          assault.push(density);
        }
        if (mission.kind === "harvestQuota") harvest.push(density);
      }
    }
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    expect(assault.length).toBeGreaterThan(0);
    expect(harvest.length).toBeGreaterThan(0);
    expect(average(assault)).toBeGreaterThan(average(harvest));
  });

  it("builds a long-form arrangement with contrasting phrases and fills", () => {
    expect(MUSIC_BARS).toBe(128);
    expect(BARS_PER_SECTION).toBe(16);
    const half = STEPS_PER_BAR * (MUSIC_BARS / 2);
    const fillBars = Array.from({ length: MUSIC_BARS / 8 }, (_, index) => index * 8 + 7);

    for (const seed of [0, 421, 9999]) {
      const pattern = composeMusic(seed, "mission", 3);
      const firstHalf = [
        pattern.bass.slice(0, half),
        pattern.arp.slice(0, half),
        pattern.melody.slice(0, half),
        pattern.kick.slice(0, half),
        pattern.snare.slice(0, half),
        pattern.padRoot.slice(0, MUSIC_BARS / 2),
      ];
      const secondHalf = [
        pattern.bass.slice(half),
        pattern.arp.slice(half),
        pattern.melody.slice(half),
        pattern.kick.slice(half),
        pattern.snare.slice(half),
        pattern.padRoot.slice(MUSIC_BARS / 2),
      ];

      expect(firstHalf.some((lane, index) => JSON.stringify(lane) !== JSON.stringify(secondHalf[index]))).toBe(true);
      const quarter = STEPS_PER_BAR * 32;
      const quarterPrints = [0, 1, 2, 3].map((index) => JSON.stringify({
        bass: pattern.bass.slice(index * quarter, (index + 1) * quarter),
        arp: pattern.arp.slice(index * quarter, (index + 1) * quarter),
        melody: pattern.melody.slice(index * quarter, (index + 1) * quarter),
        kick: pattern.kick.slice(index * quarter, (index + 1) * quarter),
      }));
      expect(quarterPrints[0]).not.toEqual(quarterPrints[1]);
      expect(quarterPrints[1]).not.toEqual(quarterPrints[2]);
      expect(quarterPrints[2]).not.toEqual(quarterPrints[3]);
      expect(new Set(pattern.padRoot).size).toBeGreaterThan(2);
      for (const bar of fillBars) {
        const start = bar * STEPS_PER_BAR;
        expect(pattern.snare.slice(start, start + STEPS_PER_BAR).filter(Boolean).length).toBeGreaterThan(0);
      }
      const penultimateFill = pattern.snare.slice(119 * STEPS_PER_BAR, 120 * STEPS_PER_BAR).filter(Boolean).length;
      const finalFill = pattern.snare.slice(127 * STEPS_PER_BAR, 128 * STEPS_PER_BAR).filter(Boolean).length;
      expect(finalFill).toBeGreaterThan(penultimateFill);
      expect(pattern.sections.map((section) => section.name)).toEqual([
        "intro", "groove", "hook", "development", "breakdown", "escalation", "climax", "turnaround",
      ]);
      expect(pattern.motif.degrees.length).toBeGreaterThan(4);
      expect(pattern.notes.melody.length).toBeGreaterThan(0);
      expect(pattern.notes.melody.every((note) => note.duration > 0 && note.velocity > 0)).toBe(true);
    }
  });

  it("starts mission grooves with drums, pulse, and melody before the first verse ends", () => {
    for (const seed of [0, 421, 9999]) {
      const pattern = composeMusic(seed, "mission", 3);
      const fromBar = (bar: number) => bar * STEPS_PER_BAR;
      expect(pattern.kick.slice(fromBar(4), fromBar(16)).some(Boolean)).toBe(true);
      if (pattern.style.arrangement.pulseEnabled[0] && pattern.style.pulseRole !== "none") {
        expect(pattern.arp.slice(fromBar(4), fromBar(16)).some((note) => note !== null)).toBe(true);
      }
      if (pattern.style.arrangement.melodyEnabled[0]) {
        expect(pattern.melody.slice(fromBar(8), fromBar(16)).some((note) => note !== null)).toBe(true);
      }
    }
  });

  it("applies combat intensity on bar boundaries and critical immediately", () => {
    expect(shouldApplyPendingIntensity(0, "engaged")).toBe(true);
    expect(shouldApplyPendingIntensity(1, "engaged")).toBe(false);
    expect(shouldApplyPendingIntensity(STEPS_PER_BAR, "calm")).toBe(true);
    expect(shouldApplyPendingIntensity(7, "critical")).toBe(true);
    expect(shouldApplyPendingIntensity(3, null)).toBe(false);
  });

  it("keeps victory drums active through the breakdown", () => {
    const pattern = composeMusic(421, "victory");
    const breakdownStart = 64 * STEPS_PER_BAR;
    const breakdownEnd = 79 * STEPS_PER_BAR;

    expect(pattern.kick.slice(breakdownStart, breakdownEnd).some(Boolean)).toBe(true);
    expect(pattern.snare.slice(breakdownStart, breakdownEnd).some(Boolean)).toBe(true);
    expect(pattern.hats.slice(breakdownStart, breakdownEnd).some(Boolean)).toBe(true);
  });

  it("keeps cue tempos in upbeat 80s ranges and fills long-form lanes", () => {
    const ranges = {
      menu: [118, 130],
      briefing: [108, 122],
      mission: [124, 144],
      victory: [128, 140],
      defeat: [92, 104],
    } as const;
    for (const seed of [0, 1, 421, 9999]) {
      for (const [cue, [lo, hi]] of Object.entries(ranges)) {
        const pattern = composeMusic(seed, cue as keyof typeof ranges, cue === "mission" ? 3 : 0);
        expect(pattern.bpm).toBeGreaterThanOrEqual(lo);
        expect(pattern.bpm).toBeLessThanOrEqual(hi);
        expect(pattern.bars).toBe(MUSIC_BARS);
        expect(pattern.steps).toBe(MUSIC_STEPS);
        expect(pattern.bass).toHaveLength(MUSIC_STEPS);
        expect(pattern.arp).toHaveLength(MUSIC_STEPS);
        expect(pattern.melody).toHaveLength(MUSIC_STEPS);
        expect(pattern.counter).toHaveLength(MUSIC_STEPS);
        expect(pattern.kick).toHaveLength(MUSIC_STEPS);
        expect(pattern.snare).toHaveLength(MUSIC_STEPS);
        expect(pattern.hats).toHaveLength(MUSIC_STEPS);
        expect(pattern.openHats).toHaveLength(MUSIC_STEPS);
        expect(pattern.padRoot).toHaveLength(MUSIC_BARS);
        expect(pattern.padThird).toHaveLength(MUSIC_BARS);
        expect(pattern.padFifth).toHaveLength(MUSIC_BARS);
        expect(pattern.padSeventh).toHaveLength(MUSIC_BARS);
        expect(pattern.bass.some((note) => note !== null)).toBe(true);
        expect(pattern.kick.some(Boolean)).toBe(true);
        expect(pattern.snare.some(Boolean)).toBe(true);
        const melodyHits = pattern.melody.filter((note) => note !== null).length;
        expect(melodyHits).toBeGreaterThan(0);
        expect(melodyHits).toBeLessThan(MUSIC_STEPS / 2);
        expect(pattern.rootHz).toBeGreaterThan(midiToHz(30));
        if (cue === "mission") {
          expect(["pulse", "march", "shuffle", "half-time", "breakbeat", "four-floor", "offbeat"]).toContain(pattern.theme.groove);
          expect(["natural minor", "dorian", "mixolydian", "major", "phrygian", "harmonic minor", "minor pentatonic", "lydian", "double harmonic", "blues"]).toContain(pattern.scaleName);
        }
      }
    }
  });

  it("builds a recurring 80s synth-pop hook with gated drums", () => {
    const sectionNotesFor = (pattern: ReturnType<typeof composeMusic>, name: string, lane: "melody" | "pulse" | "counter") => {
      const section = pattern.sections.find((entry) => entry.name === name);
      if (!section) return [];
      return pattern.notes[lane].filter((note) => note.step >= section.startBar * STEPS_PER_BAR && note.step < section.endBar * STEPS_PER_BAR);
    };
    const averageDuration = (notes: { duration: number }[]) =>
      notes.reduce((sum, note) => sum + note.duration, 0) / Math.max(1, notes.length);

    for (const seed of [0, 421, 9999]) {
      const pattern = composeMusic(seed, "mission", 3);
      const sectionNotes = (name: string, lane: "melody" | "pulse" | "counter") => sectionNotesFor(pattern, name, lane);
      expect(pattern.theme.hook).not.toEqual(pattern.motif);
      expect(pattern.theme.developmentMotif.degrees.length).toBeGreaterThan(4);
      expect(pattern.motif.rhythm.some((step) => step % 2 === 1)).toBe(true);
      expect(["pulse", "march", "shuffle", "half-time", "breakbeat", "four-floor", "offbeat"]).toContain(pattern.theme.groove);
      expect(["natural minor", "dorian", "mixolydian", "major", "phrygian", "harmonic minor", "minor pentatonic", "lydian", "double harmonic", "blues"]).toContain(pattern.scaleName);
      expect(sectionNotes("hook", "melody").length).toBeGreaterThan(24);
      expect(sectionNotes("groove", "melody").length).toBeGreaterThan(0);
      expect(averageDuration(sectionNotes("hook", "melody"))).toBeGreaterThan(averageDuration(sectionNotes("groove", "melody")));
      expect(sectionNotes("climax", "melody").length).toBeGreaterThan(sectionNotes("hook", "melody").length);
      if (pattern.style.pulseRole !== "none") {
        expect(sectionNotes("climax", "pulse").length).toBeGreaterThan(sectionNotes("hook", "pulse").length);
      }
      const developmentMelody = sectionNotes("development", "melody");
      const developmentCounter = sectionNotes("development", "counter");
      expect(developmentCounter.length).toBeGreaterThan(0);
      for (const note of developmentCounter) {
        const lead = developmentMelody.find((entry) => entry.step === note.step);
        expect(lead).toBeTruthy();
        expect(lead?.midi).not.toBe(note.midi);
      }
      expect(pattern.drums.some((event) => event.kind === "clap")).toBe(true);
      expect(pattern.drums.some((event) => event.kind === "impact")).toBe(true);
      expect(pattern.arpType).toBe(pattern.style.pulseType);
      expect(new Set(pattern.padThird).size).toBeGreaterThan(2);
      expect(new Set(pattern.padSeventh).size).toBeGreaterThan(2);

      const sectionHats = (name: string) => {
        const section = pattern.sections.find((entry) => entry.name === name);
        if (!section) return [];
        return pattern.drums.filter(
          (event) =>
            event.kind === "hat" &&
            event.step >= section.startBar * STEPS_PER_BAR &&
            event.step < section.endBar * STEPS_PER_BAR,
        );
      };
      expect(sectionHats("climax").length).toBeGreaterThan(sectionHats("hook").length);
      expect(sectionHats("hook").length).toBeLessThanOrEqual(BARS_PER_SECTION * 8);
    }

    const majorOpeners = [
      [0, 4, 5, 3],
      [0, 4, 3, 5],
      [0, 3, 4, 5],
      [5, 3, 0, 4],
      [0, 2, 5, 4],
      [0, 5, 3, 4],
      [2, 5, 0, 4],
      [0, 3, 5, 1],
    ];
    const majors = Array.from({ length: 48 }, (_, seed) => composeMusic(seed, "mission", 0)).filter(
      (entry) => entry.scaleName === "major",
    );
    expect(majors.length).toBeGreaterThan(0);
    for (const major of majors) {
      expect(majorOpeners).toContainEqual(major.theme.progressionA.slice(0, 4));
      expect(major.theme.progressionA.slice(0, 4)).not.toEqual([0, 5, 2, 6]);
    }
  });

  it("keeps climax counters off the harmony line and does not stack drum hits", () => {
    for (const seed of [0, 1, 421, 9999]) {
      for (let mission = 0; mission < 8; mission++) {
        const pattern = composeMusic(seed, "mission", mission);
        const climax = pattern.sections.find((section) => section.name === "climax");
        expect(climax).toBeTruthy();
        const start = climax!.startBar * STEPS_PER_BAR;
        const end = climax!.endBar * STEPS_PER_BAR;
        const climaxMelody = pattern.notes.melody.filter((note) => note.step >= start && note.step < end);
        const climaxCounter = pattern.notes.counter.filter((note) => note.step >= start && note.step < end);
        for (const note of climaxCounter) {
          expect(climaxMelody.some((lead) => lead.step === note.step && lead.midi === note.midi)).toBe(false);
        }
        const seen = new Set<string>();
        for (const event of pattern.drums) {
          const key = `${event.step}:${event.kind}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
        if (pattern.style.arrangement.pulseEnabled[2] && pattern.style.pulseRole !== "none") {
          const hook = pattern.sections.find((section) => section.name === "hook")!;
          const midHookPulse = pattern.notes.pulse.filter((note) => {
            const bar = Math.floor(note.step / STEPS_PER_BAR);
            return bar === hook.startBar + 2 || bar === hook.startBar + 3;
          });
          expect(midHookPulse.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("opens holdBass holes and delays the groove echo", () => {
    const sectionHits = (pattern: ReturnType<typeof composeMusic>, name: string, kind: "kick" | "snare" | "hat") => {
      const section = pattern.sections.find((entry) => entry.name === name);
      if (!section) return 0;
      const start = section.startBar * STEPS_PER_BAR;
      const end = section.endBar * STEPS_PER_BAR;
      return pattern.drums.filter((event) => event.kind === kind && event.step >= start && event.step < end).length;
    };
    const sectionHalfHits = (
      pattern: ReturnType<typeof composeMusic>,
      name: string,
      kind: "kick" | "snare" | "hat",
      half: "first" | "second",
    ) => {
      const section = pattern.sections.find((entry) => entry.name === name);
      if (!section) return 0;
      const mid = section.startBar + 8;
      const start = (half === "first" ? section.startBar : mid) * STEPS_PER_BAR;
      const end = (half === "first" ? mid : section.endBar) * STEPS_PER_BAR;
      return pattern.drums.filter((event) => event.kind === kind && event.step >= start && event.step < end).length;
    };
    let sawDrop = false;
    let sawEcho = false;
    for (const seed of [0, 1, 7, 21, 421, 999, 2000, 9999]) {
      for (let mission = 0; mission < 16; mission++) {
        const pattern = composeMusic(seed, "mission", mission);
        if (pattern.style.arrangement.name === "double-drop") {
          sawDrop = true;
          const grooveKicks = sectionHits(pattern, "groove", "kick");
          expect(sectionHalfHits(pattern, "escalation", "kick", "first")).toBeLessThan(grooveKicks / 3);
          expect(sectionHalfHits(pattern, "breakdown", "kick", "first")).toBeLessThan(grooveKicks / 3);
          const escalation = pattern.sections.find((section) => section.name === "escalation")!;
          expect(pattern.notes.pulse.some((note) =>
            note.step >= escalation.startBar * STEPS_PER_BAR && note.step < escalation.endBar * STEPS_PER_BAR,
          )).toBe(false);
        }
        if (pattern.style.arrangement.echoMelody) {
          sawEcho = true;
          const groove = pattern.sections.find((section) => section.name === "groove")!;
          const inGroove = (bar: number) => bar >= groove.startBar && bar < groove.endBar;
          const even = pattern.notes.melody.filter((note) => {
            const bar = Math.floor(note.step / STEPS_PER_BAR);
            return inGroove(bar) && (bar - groove.startBar) % 2 === 0 && bar > groove.startBar;
          });
          const odd = pattern.notes.melody.filter((note) => {
            const bar = Math.floor(note.step / STEPS_PER_BAR);
            return inGroove(bar) && (bar - groove.startBar) % 2 === 1;
          });
          expect(even.length).toBeGreaterThan(0);
          expect(odd.length).toBeGreaterThan(0);
          const average = (notes: { velocity: number }[]) =>
            notes.reduce((sum, note) => sum + note.velocity, 0) / Math.max(1, notes.length);
          expect(average(even)).toBeLessThan(average(odd));
        }
      }
    }
    expect(sawDrop).toBe(true);
    expect(sawEcho).toBe(true);
  });

  it("maps routes onto music cues", () => {
    expect(musicCueFromPath("/")).toBeNull();
    expect(musicCueFromPath("/briefing")).toBeNull();
    expect(musicCueFromPath("/play")).toBe("mission");
    expect(musicCueFromPath("/tutorial")).toBeNull();
    expect(musicCueFromPath("/campaign-complete")).toBeNull();
  });

  it("skips synthesized cues when sound effects are disabled", () => {
    setSfxEnabled(false);
    expect(isSfxEnabled()).toBe(false);
    expect(() => beep("select")).not.toThrow();
    setSfxEnabled(true);
    expect(isSfxEnabled()).toBe(true);
  });

  it("exposes semantic layered cues without requiring an audio device", () => {
    expect(() => {
      playSfx("uiConfirm");
      playSfx("uiCancel");
      playSfx("orderAttack");
      playSfx("orderHarvest");
      playSfx("credits");
      playSfx("powerShortage");
      playSfx("insufficientFunds");
      playSfx("deadline");
      playSfx("smallArms", { pan: -0.8 });
      playSfx("antiArmor");
      playSfx("cannon", { pan: 0.8 });
      playSfx("turret");
      playSfx("impact");
      playSfx("impactFlesh");
      playSfx("impactMetal");
      playSfx("destruction", { heavy: true });
      playSfx("wreckHuman");
      playSfx("wreckVehicle");
      playSfx("heal");
      playSfx("repair");
      playSfx("contact");
      playSfx("warning");
      setMusicIntensity("critical");
    }).not.toThrow();
  });

  it("maps issued orders onto distinct acknowledgement beeps", () => {
    expect(beepForCommands([])).toBeUndefined();
    expect(beepForCommands([{ type: "move", unitIds: [1], x: 2, y: 3 }])).toBe("ack");
    expect(beepForCommands([{ type: "attack", unitIds: [1], targetId: 9 }])).toBe("ackAttack");
    expect(beepForCommands([{ type: "attackMove", unitIds: [1], x: 4, y: 5 }])).toBe("ackAttack");
    expect(beepForCommands([{ type: "harvest", unitIds: [1], x: 4, y: 5 }])).toBe("ackHarvest");
    expect(beepForCommands([
      { type: "harvest", unitIds: [1], x: 4, y: 5 },
      { type: "move", unitIds: [2], x: 4, y: 5 },
    ])).toBe("ackHarvest");
    expect(beepForCommands([{ type: "support", unitIds: [1], targetId: 2 }])).toBe("ack");
    expect(beepForCommands([{ type: "stop", unitIds: [1] }])).toBe("ack");
  });

  it("maps world positions to bounded stereo placement and audible range", () => {
    const camera = createCamera();
    camera.x = 400;
    camera.y = 80;
    expect(spatialAudioForWorld(0, 0, camera, 800, 500).pan).toBeLessThanOrEqual(0.85);
    expect(spatialAudioForWorld(0, 0, camera, 800, 500).pan).toBeGreaterThanOrEqual(-0.85);
    const near = spatialAudioForWorld(6, 6, camera, 800, 500);
    const far = spatialAudioForWorld(12, 0, camera, 800, 500);
    expect(near.audible).toBe(true);
    expect(far.audible).toBe(true);
    expect(near.gain).toBeGreaterThanOrEqual(0.95);
    expect(far.gain).toBeGreaterThanOrEqual(0.68);
    expect(near.gain).toBeGreaterThan(far.gain);
  });

  it("staggers same-kind shots instead of dropping a volley", () => {
    expect(scheduleSfxTime(1, Number.NEGATIVE_INFINITY, 0.045)).toBe(1);
    expect(scheduleSfxTime(1, 1, 0.045)).toBeCloseTo(1.045);
    expect(scheduleSfxTime(1, 1, 0)).toBe(1);

    const starts: number[] = [];
    let previous = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 20; i++) {
      const start = scheduleSfxTime(1, previous, 0.045);
      if (start === null) break;
      starts.push(start);
      previous = start;
    }
    expect(starts[0]).toBe(1);
    expect(starts.length).toBeGreaterThan(5);
    expect(starts.at(-1)! - 1).toBeLessThanOrEqual(MAX_SFX_QUEUE_S);
    expect(scheduleSfxTime(1, previous, 0.045)).toBeNull();
  });

  it("tracks the music enable flag without requiring an audio device", () => {
    setMusicEnabled(false);
    expect(isMusicEnabled()).toBe(false);
    setMusicEnabled(true);
    expect(isMusicEnabled()).toBe(true);
  });

  it("creates deterministic mission filenames and reports unsupported headless export", async () => {
    expect(missionSoundtrackFilename(421, 3)).toBe("dynamica-command-0421-mission-04.m4a");
    expect(await supportsM4aExport()).toBe(false);
  });

  it("does not require optional offline suspend controls for export availability", async () => {
    const isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
    class OfflineAudioContextStub {}
    class AudioDataStub {
      close() {}
    }
    class AudioEncoderStub {
      static isConfigSupported = isConfigSupported;
      state: "unconfigured" | "configured" | "closed" = "unconfigured";
      encodeQueueSize = 0;
      configure() {
        this.state = "configured";
      }
      encode() {}
      flush() {
        return Promise.resolve();
      }
      close() {
        this.state = "closed";
      }
    }
    vi.stubGlobal("window", {
      AudioEncoder: AudioEncoderStub,
      AudioData: AudioDataStub,
      OfflineAudioContext: OfflineAudioContextStub,
    });

    await expect(supportsM4aExport()).resolves.toBe(true);
    expect(isConfigSupported).toHaveBeenCalledOnce();
  });

  it("rejects a cancelled soundtrack export before starting browser work", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(exportMissionSoundtrack(421, 3, undefined, { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
  });
});
