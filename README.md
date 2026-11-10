# Tom Hengst – Testversion 2

[**Spiel im Browser öffnen**](https://lukassmolenski-prog.github.io/tom-hengst-testversion-2/)

Am Handy den Link in Chrome oder Safari öffnen. **Koop → Namen eingeben → Raum eröffnen → Einladung teilen**. Bis zu drei Freunde öffnen dieselbe Einladung und treten über den fünfstelligen Code bei. Den Sprachchat über den Mikrofon-Schalter einschalten und die Browser-Freigabe erlauben. Kein eigener Spielserver, laufender PC oder Spieler-Konto nötig.

Dieses Repository enthält die getrennte zweite Testversion. Das ursprüngliche Repository `lukassmolenski-prog/tom-hengst` bleibt vollständig unverändert, einschließlich seiner Branches und GitHub-Pages-Veröffentlichung.

Die Webseite wird über GitHub Pages ausgeliefert. PeerJS Cloud vermittelt die WebRTC-Verbindungen. Das Handy des Gastgebers führt die Spielwelt aus. Beim Wechsel zu WhatsApp kann das Betriebssystem die Browser-App pausieren; Freunde warten dann und versuchen den Beitritt bis zu zehn Minuten weiter. Den Browser-Tab behalten und nach dem Teilen ins Spiel zurückkehren. Ein vollständig geschlossener Tab oder gelöschte Browserdaten können den Raum beenden.

**Netzwerkgrenze:** Direktverbindungen funktionieren nicht in jedem Mobilfunk-/Firmennetz. Die aktuelle Online-Fassung enthält STUN, aber keinen TURN-Relay-Zugang. Falls ein Teilnehmer nicht verbinden oder sprechen kann, zunächst gemeinsam im WLAN testen. Für zuverlässige Verbindungen durch restriktive Netze lässt sich ein verwalteter TURN-Dienst ergänzen. Keine dauerhaften API-Schlüssel in öffentliche Dateien eintragen.

Der [Workflow](https://github.com/lukassmolenski-prog/tom-hengst-testversion-2/actions/workflows/testversion-2.yml) prüft die 42 Assets und den lokalen Koop-Dienst, baut die Online-Fassung und veröffentlicht sie ausschließlich für dieses Repository. Zusätzlich steht ein lokales Startpaket als Artifact bereit. GitHub Pages muss unter **Settings → Pages → Source: GitHub Actions** aktiviert sein. Details und Steuerung: [Spielanleitung](testversion-2/README.md).
