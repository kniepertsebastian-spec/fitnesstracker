Fitnesstracker (PR #82)
Vor dem Merge
29. Hat deine Produktions-.env echte Werte für JWT_ACCESS_SECRET, JWT_REFRESH_SECRET und SETUP_TOKEN? Enthält sie noch „change-me“, startet das Backend nach dem Deploy bewusst nicht mehr.

--- ja, da sind echte werte drin

30. Stimmt die Kette Cloudflare → cloudflared → Caddy → Backend? Hängen weitere Container im edge-Netz, oder steht ein zusätzlicher Proxy davor? Das entscheidet, ob TRUST_PROXY richtig gesetzt ist.

--- wie bei learning, proxy wird durch cloudflare getunnelt

31. Kannst du bcrypt 6 vor dem Produktivgang in deinem Alpine-Image testen, zum Beispiel mit einem Login?
Entscheidungen

--- mache ich sobald die liste durch ist

32. Ist das eine Ein-Personen-App oder gibt es mehrere Konten? Das entscheidet über drei Dinge: Registrierung nach dem ersten Konto sperren (der Kommentar sagt „first and only“, der Code erzwingt es nicht), Offline-Daten pro Konto trennen und Passwort-Funktionen.

--- aktuell eine person, aber freunde dürfen auch drauf. trenn alles pro konto


33. Wünschst du Passwort ändern, Passwort zurücksetzen (es gibt keinen Mailversand) und Konto löschen?

--- ja

34. Refresh-Token mit Wiederverwendungs-Erkennung: Der Preis ist ein Logout bei parallelen Tabs oder verlorenen Antworten. Willst du das, oder lieber eine kurze Kulanzzeit?

--- lieber kurze kulanz

35. Sollen beim Logout die lokalen Offline-Daten gelöscht werden, auch wenn noch nicht synchronisierte Einträge existieren? Sollen Plan-Änderungen bei einem 5xx behalten statt verworfen werden?

- nein, niemals löschen

36. Darf das Backend als Nicht-root laufen? Dafür müssen die Rechte des bestehenden uploads-Volumes angepasst werden.

- das backend wird als root normalerweise gestartet, kannst die rechte aber trotzdem anpassen

37. Wann und ob folgen die Migrationen zod 3→4 (offener hoher Fund), react-router 6→7 sowie Prisma 5, Vite 5, React 18 und Tailwind 3?

--- jetzt, leg los

38. Sollen die Übungsbilder lokal statt von raw.githubusercontent.com kommen, soll Caddy HSTS setzen (oder macht das Cloudflare schon), und sollen Backend-Integrationstests für Auth, Datentrennung und Upload geschrieben werden?

- aktuell werden die ja von einem repo geholt. lokal ziehen und aufrufen wäre viel besser