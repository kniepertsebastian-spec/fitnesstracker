export function toCardioLogDto(log) {
    return {
        id: log.id,
        clientId: log.clientId,
        machine: log.machine,
        level: log.level,
        intensity: log.intensity,
        durationMinutes: log.durationMinutes,
        distanceKm: log.distanceKm === null ? null : Number(log.distanceKm),
        source: log.source,
        performedAt: log.performedAt.toISOString(),
        createdAt: log.createdAt.toISOString(),
        updatedAt: log.updatedAt.toISOString(),
    };
}
//# sourceMappingURL=cardioLog.types.js.map