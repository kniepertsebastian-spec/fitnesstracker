export interface LogoutState {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
}

const entries = (n: number) => (n === 1 ? "1 Eintrag" : `${n} Einträge`);

/** What the user should know before logging out; empty when there is nothing to warn about. */
export function logoutWarnings({ isOnline, pendingCount, failedCount }: LogoutState): string[] {
  const warnings: string[] = [];
  if (pendingCount > 0) {
    warnings.push(
      `${entries(pendingCount)} ${pendingCount === 1 ? "ist" : "sind"} noch nicht synchronisiert. ` +
        "Sie bleiben auf diesem Gerät und werden gesendet, sobald du dich hier wieder mit diesem Konto anmeldest.",
    );
  }
  if (failedCount > 0) {
    warnings.push(`${entries(failedCount)} ${failedCount === 1 ? "konnte" : "konnten"} nicht gespeichert werden und bleiben in der Sync-Liste.`);
  }
  if (!isOnline) {
    warnings.push("Du bist offline. Die Abmeldung auf dem Server wird nachgeholt, sobald wieder eine Verbindung besteht.");
  }
  return warnings;
}
