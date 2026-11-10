# Tom Hengst – Testversion 2

Die neue Fassung liegt im Ordner [testversion-2](testversion-2/README.md).

Dieses Repository enthält die getrennte zweite Testversion. Das ursprüngliche Repository `lukassmolenski-prog/tom-hengst` bleibt vollständig unverändert, einschließlich seiner Branches und GitHub-Pages-Veröffentlichung.

Unter [Actions → Testversion 2 – Paket prüfen](https://github.com/lukassmolenski-prog/tom-hengst-testversion-2/actions/workflows/testversion-2.yml) baut und prüft GitHub ein Startpaket mit allen 42 Spielassets. Nach erfolgreichem Lauf steht es unter **Artifacts → tom-hengst-testversion-2** zum Download bereit. Zum Starten genügt Node.js 24 LTS; unter Windows `Start-Testversion.cmd` öffnen.

Der Workflow ist auf dieses Repository beschränkt und veröffentlicht nichts auf GitHub Pages. Ein öffentlicher Spiel-Link mit Online-Koop und Handy-Mikrofon ist noch nicht eingerichtet; dafür ist ein HTTPS-Host für den enthaltenen Node.js-Server nötig. Details und Steuerung stehen in der [Spielanleitung](testversion-2/README.md).
