let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Browsers only allow audio to start inside a real user gesture — call this from the
// Start/Resume button's own click handler (or a set's "done" tap), not from the timer's
// setInterval tick when it later reaches zero, or the completion sound would silently fail.
export function unlockAudio() {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

export type TimerSoundId = "mp3" | "beep" | "bell" | "alarm" | "gong" | "custom" | "none";

export const TIMER_SOUND_LABELS: Record<TimerSoundId, string> = {
  mp3: "Standard",
  beep: "Piepton",
  bell: "Glocke",
  alarm: "Alarm",
  gong: "Gong",
  custom: "Eigene Datei",
  none: "Kein Ton",
};

// Synthesized sounds need no bundled audio file, so they keep working fully offline.
type Tone = { offset: number; freq: number; duration: number; type: OscillatorType; peak?: number };

const TONE_SEQUENCES: Partial<Record<TimerSoundId, Tone[]>> = {
  beep: [0, 0.25, 0.5].map((offset) => ({ offset, freq: 880, duration: 0.18, type: "sine" })),
  bell: [
    { offset: 0, freq: 1318, duration: 1.2, type: "sine" },
    { offset: 0, freq: 1976, duration: 0.8, type: "sine", peak: 0.12 },
  ],
  alarm: [0, 0.3, 0.6, 0.9].flatMap((offset) => [
    { offset, freq: 988, duration: 0.14, type: "square" as const, peak: 0.18 },
    { offset: offset + 0.15, freq: 740, duration: 0.14, type: "square" as const, peak: 0.18 },
  ]),
  gong: [
    { offset: 0, freq: 196, duration: 2, type: "triangle", peak: 0.5 },
    { offset: 0, freq: 392, duration: 1.4, type: "sine", peak: 0.2 },
  ],
};

function playTones(tones: Tone[], volume: number) {
  const ctx = getContext();
  const now = ctx.currentTime;
  for (const tone of tones) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = tone.type;
    oscillator.frequency.value = tone.freq;
    const peak = (tone.peak ?? 0.3) * volume;
    gain.gain.setValueAtTime(0.0001, now + tone.offset);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + tone.offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.offset + tone.duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now + tone.offset);
    oscillator.stop(now + tone.offset + tone.duration + 0.05);
  }
}

export interface TimerSoundOptions {
  soundId: TimerSoundId;
  volume: number; // 0..1
  customSoundDataUrl: string | null;
  // How often the sound plays back-to-back — a single beep is easy to miss mid-set.
  repeat: number;
}

function playFile(url: string, volume: number, onError: () => void) {
  const audio = new Audio(url);
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.play().catch(onError);
}

function playOnce({ soundId, volume, customSoundDataUrl }: TimerSoundOptions) {
  if (soundId === "none") return;
  const fallback = () => playTones(TONE_SEQUENCES.beep!, volume);
  if (soundId === "mp3") return playFile("/sounds/timer-end.mp3", volume, fallback);
  if (soundId === "custom") {
    return customSoundDataUrl ? playFile(customSoundDataUrl, volume, fallback) : fallback();
  }
  playTones(TONE_SEQUENCES[soundId] ?? TONE_SEQUENCES.beep!, volume);
}

const REPEAT_GAP_MS = 1800;

export function playTimerEndSound(options: TimerSoundOptions) {
  if (options.soundId === "none") return;
  const repeat = Math.min(5, Math.max(1, Math.round(options.repeat)));
  for (let i = 0; i < repeat; i++) {
    if (i === 0) playOnce(options);
    else setTimeout(() => playOnce(options), i * REPEAT_GAP_MS);
  }
}
