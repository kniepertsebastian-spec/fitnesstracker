import type { WaterDayDto, WaterStatusDto } from "@fitnesstracker/shared";
import type { TargetInfo, WaterDay } from "./water.service.js";

function toWaterDayDto(day: WaterDay): WaterDayDto {
  return { date: day.date.toISOString().slice(0, 10), amountMl: day.amountMl };
}

// `history` is newest-first (see getHistory), so today is always the first entry.
export function toWaterStatusDto(history: WaterDay[], target: TargetInfo): WaterStatusDto {
  const today = history[0];
  return {
    today: toWaterDayDto(today),
    targetMl: target.targetMl,
    isCustomTarget: target.isCustomTarget,
    history: history.map(toWaterDayDto),
  };
}
