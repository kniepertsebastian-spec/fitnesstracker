let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Browsers only allow audio to start inside a real user gesture — call this from the
// Start/Resume button's own click handler, not from the timer's setInterval tick when it
// later reaches zero, or the completion sound would silently fail to play.
export function unlockAudio() {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

// Three short synthesized beeps — no bundled audio file needed, so the default sound keeps
// working fully offline like the rest of this PWA.
function playDefaultBeep() {
  const ctx = getContext();
  const now = ctx.currentTime;
  [0, 0.25, 0.5].forEach((offset) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.2);
  });
}

// Set to e.g. "/sounds/timer-end.mp3" once a custom sound file is dropped into
// frontend/public/sounds/ — falls back to the synthesized beep until then, and also if the
// file fails to load/play for any reason.
const CUSTOM_SOUND_URL: string | null = null;

export function playTimerEndSound() {
  if (CUSTOM_SOUND_URL) {
    const audio = new Audio(CUSTOM_SOUND_URL);
    audio.play().catch(() => playDefaultBeep());
    return;
  }
  playDefaultBeep();
}
