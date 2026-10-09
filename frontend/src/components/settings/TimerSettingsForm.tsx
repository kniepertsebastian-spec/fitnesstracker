import { useTimerStore } from "../../stores/timerStore";
import { TIMER_SOUND_LABELS, unlockAudio, type TimerSoundId } from "../../lib/timerSound";

const VIBRATION_SUPPORTED = typeof navigator !== "undefined" && "vibrate" in navigator;
const MAX_CUSTOM_SOUND_BYTES = 1024 * 1024;
const SOUND_IDS = Object.keys(TIMER_SOUND_LABELS) as TimerSoundId[];

// Shared by the rest-timer widget's settings panel and the Settings page, so both edit the same
// persisted per-device preferences (see timerStore.ts).
export function TimerSettingsForm() {
  const {
    autoStartEnabled,
    autoStartSeconds,
    setAutoStart,
    soundEnabled,
    setSoundEnabled,
    soundId,
    setSoundId,
    soundVolume,
    setSoundVolume,
    soundRepeat,
    setSoundRepeat,
    customSoundDataUrl,
    customSoundName,
    setCustomSound,
    vibrationEnabled,
    setVibrationEnabled,
    testSound,
  } = useTimerStore();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CUSTOM_SOUND_BYTES) {
      window.alert("Die Datei ist zu groß (max. 1 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCustomSound(reader.result, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleTest = () => {
    unlockAudio();
    testSound();
  };

  const row = "flex items-center justify-between gap-3 text-sm text-text-muted";
  const input = "rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-sm";

  return (
    <div className="flex flex-col gap-3">
      <label className={row}>
        <span>Automatisch nach jedem Satz starten</span>
        <input
          type="checkbox"
          checked={autoStartEnabled}
          onChange={(e) => setAutoStart(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
      </label>
      <label className={row}>
        <span>Satzpause (Sekunden)</span>
        <input
          type="number"
          min={5}
          max={900}
          value={autoStartSeconds}
          onChange={(e) => setAutoStart(autoStartEnabled, Number(e.target.value))}
          className={`${input} w-24`}
        />
      </label>

      <label className={`${row} border-t border-border pt-3`}>
        <span>Ton bei Timer-Ende</span>
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(e) => setSoundEnabled(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
      </label>
      {soundEnabled && (
        <>
          <label className={row}>
            <span>Klang</span>
            <select
              value={soundId}
              onChange={(e) => setSoundId(e.target.value as TimerSoundId)}
              className={input}
            >
              {SOUND_IDS.filter((id) => id !== "custom" || customSoundDataUrl).map((id) => (
                <option key={id} value={id}>
                  {id === "custom" && customSoundName ? `Eigene: ${customSoundName}` : TIMER_SOUND_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className={row}>
            <span>Eigenes Lied / Ton</span>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="w-44 text-xs text-text-subtle"
            />
          </label>
          <label className={row}>
            <span>Lautstärke</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={soundVolume}
              onChange={(e) => setSoundVolume(Number(e.target.value))}
              className="w-40 accent-accent"
            />
          </label>
          <label className={row}>
            <span>Wiederholungen</span>
            <input
              type="number"
              min={1}
              max={5}
              value={soundRepeat}
              onChange={(e) => setSoundRepeat(Number(e.target.value))}
              className={`${input} w-20`}
            />
          </label>
          <button
            type="button"
            onClick={handleTest}
            className="self-start rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-text-2 hover:bg-control"
          >
            ▶ Ton testen
          </button>
        </>
      )}
      {VIBRATION_SUPPORTED && (
        <label className={row}>
          <span>Vibration bei Timer-Ende</span>
          <input
            type="checkbox"
            checked={vibrationEnabled}
            onChange={(e) => setVibrationEnabled(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>
      )}
    </div>
  );
}
