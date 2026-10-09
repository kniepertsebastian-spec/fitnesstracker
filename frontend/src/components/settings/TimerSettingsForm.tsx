import { Play } from "lucide-react";
import { useTimerStore } from "../../stores/timerStore";
import { TIMER_SOUND_LABELS, unlockAudio, type TimerSoundId } from "../../lib/timerSound";
import { Button, Field, Input, Select, Toggle } from "../ui";

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

  return (
    <div className="flex flex-col gap-3">
      <Toggle label="Automatisch nach jedem Satz starten" checked={autoStartEnabled} onChange={setAutoStart} />
      <Field label="Satzpause (Sekunden)">
        {(p) => (
          <Input
            {...p}
            type="number"
            min={5}
            max={900}
            inputMode="numeric"
            value={autoStartSeconds}
            onChange={(e) => setAutoStart(autoStartEnabled, Number(e.target.value))}
            className="w-28"
          />
        )}
      </Field>

      <div className="border-t border-border-subtle pt-3">
        <Toggle label="Ton bei Timer-Ende" checked={soundEnabled} onChange={setSoundEnabled} />
      </div>
      {soundEnabled && (
        <>
          <Field label="Klang">
            {(p) => (
              <Select {...p} value={soundId} onChange={(e) => setSoundId(e.target.value as TimerSoundId)}>
                {SOUND_IDS.filter((id) => id !== "custom" || customSoundDataUrl).map((id) => (
                  <option key={id} value={id}>
                    {id === "custom" && customSoundName ? `Eigene: ${customSoundName}` : TIMER_SOUND_LABELS[id]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Eigenes Lied / Ton" hint="Audiodatei, max. 1 MB">
            {(p) => (
              <input
                {...p}
                type="file"
                accept="audio/*"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="text-small text-text-subtle file:mr-3 file:min-h-9 file:rounded-md file:border file:border-border-strong file:bg-control file:px-3 file:text-text-2"
              />
            )}
          </Field>
          <Field label="Lautstärke">
            {(p) => (
              <input
                {...p}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={soundVolume}
                onChange={(e) => setSoundVolume(Number(e.target.value))}
                className="h-11 w-full accent-accent"
              />
            )}
          </Field>
          <Field label="Wiederholungen">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={1}
                max={5}
                inputMode="numeric"
                value={soundRepeat}
                onChange={(e) => setSoundRepeat(Number(e.target.value))}
                className="w-28"
              />
            )}
          </Field>
          <Button variant="secondary" className="self-start" iconLeft={<Play size={16} aria-hidden />} onClick={handleTest}>
            Ton testen
          </Button>
        </>
      )}
      {VIBRATION_SUPPORTED && (
        <Toggle label="Vibration bei Timer-Ende" checked={vibrationEnabled} onChange={setVibrationEnabled} />
      )}
    </div>
  );
}
