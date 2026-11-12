import type { Gender } from "./schemas/profile.schema.js";
export interface BodyFatEstimateInput {
    weightKg: number;
    heightCm: number;
    age: number;
    gender: Gender;
}
export declare function estimateBodyFatCunBae({ weightKg, heightCm, age, gender }: BodyFatEstimateInput): number | null;
export declare function fatFreeMassIndex(weightKg: number, bodyFatPercent: number, heightCm: number): number | null;
export declare const FFMI_NATURAL_LIMIT = 25;
export declare const BODY_FAT_GAP_THRESHOLD = 8;
