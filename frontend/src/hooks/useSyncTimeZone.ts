import { useEffect } from "react";
import { updateTimeZoneRequest } from "../api/auth.api";
import { useAuthStore } from "../stores/authStore";

// "Today" and "this week" (daily challenge, week status, evening reminders) follow the account's
// time zone on the server. It is taken from the browser: whenever the device's zone differs from
// the stored one — first login, or after travelling — it is sent once.
export function useSyncTimeZone() {
  const user = useAuthStore((s) => s.user);
  const hasToken = useAuthStore((s) => !!s.accessToken);
  const updateUser = useAuthStore((s) => s.updateUser);

  useEffect(() => {
    if (!user || !hasToken) return;
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone || zone === user.timeZone) return;
    updateTimeZoneRequest({ timeZone: zone })
      .then(updateUser)
      .catch(() => undefined); // offline or rejected: stays as it was, tried again next start
  }, [user, hasToken, updateUser]);
}
