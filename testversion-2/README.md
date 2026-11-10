# Tom Hengst – Testversion 2

Separater Entwicklungsstand für vier Spieler mit Sprachchat im eigenen Repository `lukassmolenski-prog/tom-hengst-testversion-2`. Das bestehende Repository `lukassmolenski-prog/tom-hengst` bleibt vollständig unverändert, auch ohne zusätzlichen Branch. Ein öffentlicher Spiel-Server ist noch nicht eingerichtet.

## Starten

Node.js 24 LTS installieren. Unter Windows `Start-Testversion.cmd` starten und die angezeigte Adresse öffnen (standardmäßig `http://localhost:4175/`). Beim ersten Start werden Abhängigkeiten und die Spielmodelle/Sounds geladen; dafür ist Internet nötig.

Alternativ im Ordner `testversion-2`:

```sh
npm ci --prefix runtime --no-audit --no-fund
node fetch-assets.cjs
node server.cjs
```

Danach `http://localhost:4173/` öffnen. Ein fertiges Paket unter GitHub Actions enthält bereits die 42 Spielassets und die benötigten JavaScript-Bibliotheken; damit reicht Node.js zum Starten. Die Quelldateien sind direkt bearbeitbar.

## Enthalten

- 14 detaillierte 3D-Modelle: Tom, Schwert, Schild, Ferrari, Einhorn, vier Gegnertypen, Boss, Mirja und Gebäude.
- 24 Sounds: individuelle Gegnerrufe, Waffen, Original-Treffereffekt, tiefer „Monsterkill!“-Ansager und V10-Motor.
- Schwertangriff (`J`), Knieangriff (`F` beziehungsweise HENGST), Ausweichrolle, Fortbewegungswechsel (`V`, `1`/`2`/`3`) und Touch-Steuerung.
- Koop mit bis zu vier Spielern, Mikrofon-Schalter und zehn Minuten reserviertem Raum/Spielerplatz nach Verbindungsverlust.

## Online-Koop ohne eigenen PC

Das Paket enthält einen Node.js-Server für Spiel und Räume. Für einen dauerhaft teilbaren Handy-Link muss dieser auf einem Cloud-Host mit HTTPS und WebSocket-Unterstützung laufen. Das ist noch nicht eingerichtet. GitHub Pages führt diesen Server nicht aus.

Für Cloud-Betrieb `BIND_ADDRESS=0.0.0.0` setzen; `PORT` kommt vom Host. Eine Instanz verwenden, da Räume im Arbeitsspeicher liegen. Neustarts beenden die Räume. HTTPS ist für das Handy-Mikrofon erforderlich. Für zuverlässigen Sprachchat in unterschiedlichen Mobilfunknetzen wird zusätzlich ein TURN-Dienst benötigt (`TURN_URL`, `TURN_USER`, `TURN_PASSWORD` als Umgebungsvariablen, niemals im Repository). Statische TURN-Zugangsdaten werden an Mitspieler ausgeliefert; vor öffentlichem Dauerbetrieb zeitlich begrenzte Zugangsdaten ergänzen.

Beim Wechsel zu WhatsApp kann das Handy die Browser-App einfrieren: Der Raum bleibt zehn Minuten erhalten, das Spiel wartet gegebenenfalls auf den Gastgeber. Durchgehendes Mikrofon und weiterlaufende Simulation im Hintergrund sind vom mobilen Betriebssystem abhängig.

## Prüfung und Grenzen

Lokal wurden vier Browser-Spieler mit simulierten Mikrofonen, Beitritt bei getrenntem Gastgeber, Wiederverbindung, Angriffe, Modelle und Sounds geprüft. Echte iOS-/Android-Geräte und unterschiedliche Mobilfunknetze müssen noch getestet werden. Diese Testfassung ist kein fertig optimiertes kommerzielles Spiel.

`node verify-package.cjs` prüft die Asset-Dateien, HTTP-Auslieferung, vier Plätze, Ablehnung eines fünften Spielers und Wiederverbindung. Die Asset-Quellen und SHA-256-Prüfsummen stehen in `assets-manifest.json`; `fetch-assets.cjs` lädt und optimiert sie reproduzierbar. Der Paket-Build benötigt diese externen Asset-Quellen, der fertige Spielbetrieb lädt sie lokal aus dem Paket.
