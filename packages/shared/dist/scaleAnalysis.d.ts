import type { ScaleDetails } from "./schemas/scaleDetails.schema.js";
export interface ScaleReading {
    measuredAt: string;
    weightKg: number;
    bodyFatPercent: number | null;
    muscleMassKg: number | null;
    bodyWaterPercent: number | null;
    details: ScaleDetails | null;
}
export interface ScaleMetric {
    key: string;
    label: string;
    unit: string;
    kind: "value" | "impedance";
    get: (reading: ScaleReading) => number | null;
}
export declare const SCALE_METRICS: ScaleMetric[];
export interface ScaleSession {
    start: string;
    end: string;
    readings: number;
}
export interface NoiseRow {
    key: string;
    label: string;
    unit: string;
    kind: "value" | "impedance";
    sd: number;
    maxRange: number;
    repeats: number;
    betweenSd: number | null;
}
export interface DerivedRow {
    key: string;
    label: string;
    unit: string;
    relation: "identity" | "ratio" | "linear";
    basis: string;
    ratio?: number;
    slope?: number;
    intercept?: number;
    spreadPercent?: number;
    r2?: number;
    n: number;
}
export interface DriverRow {
    channelKey: string;
    channelLabel: string;
    r: number;
}
export interface ScaleAnalysis {
    readings: number;
    withDetails: number;
    withImpedance: number;
    sessions: ScaleSession[];
    repeatSessions: number;
    noise: NoiseRow[];
    derived: DerivedRow[];
    independent: {
        key: string;
        label: string;
    }[];
    drivers: DriverRow[];
    driversNeeded: number;
}
export declare const SESSION_GAP_MINUTES = 60;
export declare function groupSessions(readings: ScaleReading[]): ScaleReading[][];
export interface SessionAverage {
    readings: number;
    from: string;
    to: string;
    weightKg: number;
    bodyFatPercent: number | null;
    muscleMassKg: number | null;
    bodyWaterPercent: number | null;
    bodyFatRange: number | null;
}
export declare function latestSessionAverage(readings: ScaleReading[]): SessionAverage | null;
export declare function analyzeScaleReadings(readings: ScaleReading[]): ScaleAnalysis;
