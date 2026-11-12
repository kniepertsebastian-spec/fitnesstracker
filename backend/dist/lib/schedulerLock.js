// Postgres advisory locks give the schedulers a distributed mutex without adding infrastructure
// (Redis, a dedicated worker) — appropriate here because Postgres is already the one resource
// shared by every backend instance. If a second container/instance's tick fires while the first
// still holds the lock, `pg_try_advisory_lock` returns false immediately (non-blocking) and that
// tick is simply skipped rather than sending the same push notifications twice.
export async function withSchedulerLock(prisma, lockKey, tick) {
    const [{ acquired }] = await prisma.$queryRaw `SELECT pg_try_advisory_lock(${lockKey}) AS acquired`;
    if (!acquired)
        return;
    try {
        await tick();
    }
    finally {
        await prisma.$queryRaw `SELECT pg_advisory_unlock(${lockKey})`;
    }
}
//# sourceMappingURL=schedulerLock.js.map