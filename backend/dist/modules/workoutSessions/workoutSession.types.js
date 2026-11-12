export function toWorkoutSessionDto(session) {
    return {
        id: session.id,
        clientId: session.clientId,
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt ? session.endedAt.toISOString() : null,
        stopPromptSentAt: session.stopPromptSentAt ? session.stopPromptSentAt.toISOString() : null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
    };
}
//# sourceMappingURL=workoutSession.types.js.map