export {
  type MusicCue,
  type MusicIntensity,
  type MusicVoiceType,
  type MusicGroove,
  type MusicSectionName,
  type MusicStem,
  type MusicDrumKind,
  type MusicNoteEvent,
  type MusicDrumEvent,
  type MusicMotif,
  type MusicSection,
  type MusicTheme,
  type MusicPattern,
  TITLE_MUSIC_SEED,
  TUTORIAL_MUSIC_MISSION,
  STEPS_PER_BAR,
  MUSIC_BARS,
  MUSIC_STEPS,
} from "./compose/types";

export { midiToHz } from "./compose/helpers";
export { composeMusic } from "./compose/pattern";
