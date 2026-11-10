# Tom Hengst – Testversion 2

Separater Entwicklungsstand für vier Spieler mit Sprachchat im eigenen Repository `lukassmolenski-prog/tom-hengst-testversion-2`. Das bestehende Repository `lukassmolenski-prog/tom-hengst` bleibt vollständig unverändert, auch ohne zusätzlichen Branch.

## Online spielen

[Spiel öffnen](https://lukassmolenski-prog.github.io/tom-hengst-testversion-2/) → **Koop** → Namen eingeben → **Raum eröffnen** → **Einladung teilen**. Freunde öffnen die Einladung in Chrome oder Safari und treten bei. Alternativ den fünfstelligen Code eingeben. Mikrofon über den Schalter im Spiel aktivieren.

## Lokal starten

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
- Koop mit bis zu vier Spielern, Mikrofon-Schalter und bis zu zehn Minuten Wiederverbindung nach einer Unterbrechung.

## Online-Koop ohne eigenen PC

Die Online-Fassung läuft auf GitHub Pages. PeerJS Cloud vermittelt die Verbindungen; Spiel und Sprache laufen direkt zwischen den Browsern. Es ist kein eigener Server und kein laufender PC nötig. Das Gastgeber-Handy führt die Welt aus. Die lokale Download-Fassung verwendet weiterhin den enthaltenen Node.js-/WebSocket-Dienst.

Die Online-Konfiguration nutzt STUN. Ein TURN-Relay für restriktive Mobilfunknetze ist noch nicht eingerichtet; deshalb sind Verbindungen zwischen beliebigen Netzen nicht garantiert. Ein verwalteter Relay-Dienst kann später über kurzlebige WebRTC-Zugangsdaten in `rtc-config.json` beziehungsweise einen geschützten Ausgabedienst ergänzt werden. Dauerhafte API-Schlüssel gehören nicht in öffentliche Dateien.

Beim Wechsel zu WhatsApp kann das Handy die Browser-App einfrieren: Wiederverbindung und Beitrittsversuche laufen bis zu zehn Minuten. Der Gastgeber muss anschließend in denselben Tab zurückkehren. Neue Freunde können während der Pause warten; die eigentliche Verbindung erfolgt bei Rückkehr. Durchgehendes Mikrofon und fortlaufende Simulation im Hintergrund hängen vom Betriebssystem ab. Das Schließen des Tabs oder Löschen der Browserdaten kann den Raum beenden.

## Prüfung und Grenzen

Vier isolierte Chrome-Spieler wurden über den öffentlichen PeerJS-Dienst geprüft: Raum-Code, Synchronisierung, Begrenzung auf vier Spieler, drei empfangene Testmikrofone pro Spieler, Wiederverbindung, Seiten-Neuladen und Warten während einer Gastgeber-Unterbrechung. Echte iOS-/Android-Geräte und unterschiedliche Mobilfunknetze müssen noch getestet werden. Diese Testfassung ist kein fertig optimiertes kommerzielles Spiel.

`node verify-package.cjs` prüft die Asset-Dateien, HTTP-Auslieferung, vier Plätze, Ablehnung eines fünften Spielers und Wiederverbindung. Die Asset-Quellen und SHA-256-Prüfsummen stehen in `assets-manifest.json`; `fetch-assets.cjs` lädt und optimiert sie reproduzierbar. Der Paket-Build benötigt diese externen Asset-Quellen, der fertige Spielbetrieb lädt sie lokal aus dem Paket.

`node build-web.cjs` erzeugt die statische Online-Fassung unter `web/`. Dieser Build setzt Online-Protokollversion 6 und aktiviert `peer-room.js`; die lokale Edition bleibt bei Protokollversion 5.
