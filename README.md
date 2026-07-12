# 💍 Hochzeitsquiz – Lara & Nathanael

Eine vollständig lauffähige, serverlose Live-Quiz-Anwendung für ca. 100
Hochzeitsgäste. Drei Ansichten – **Display**, **Moderator** und
**Teilnehmer** – synchronisieren sich in Echtzeit ausschließlich über
**Cloud Firestore**. Es gibt keinen eigenen Server, kein Backend, keinen
Build-Prozess. Die App läuft direkt aus statischen Dateien, z. B. auf
**GitHub Pages**.

---

## 1. Projektübersicht

| Ansicht | Datei | Zielgerät | Zweck |
|---|---|---|---|
| **Display** | `display.html` | Beamer / Surface Pro (16:9) | QR-Code + Teilnehmerliste, Fragen, Ergebnis-Balkendiagramm |
| **Moderator** | `host.html` | Laptop/Tablet des Hochzeitspaares/Trauzeugen | Ablauf steuern (Anmeldung, Fragen, Ergebnisse) |
| **Teilnehmer** | `login.html` → `vote.html` | Smartphone der Gäste | Anmelden, dann pro Frage abstimmen |
| **Gesamtergebnis** | `results.html` | beliebig | Alle 16 Fragen mit Bild + horizontalen Ergebnisbalken auf einen Blick |
| **Rangliste** | `ranking.html` | beliebig | Teilnehmer-Ranking nach Anzahl "richtig" (Mehrheitsmeinung) getroffener Fragen |
| **Startseite** | `index.html` | beliebig | Übersicht/Verteiler zu den fünf Ansichten |

Der Ablauf orientiert sich am klassischen "Mr & Mrs"-Hochzeitsspiel: Bei
jeder der 16 Fragen stimmen die Gäste ab, wer von beiden ("Lara" oder
"Nathanael") besser zutrifft. Ergebnisse werden live als Balkendiagramm auf
dem Display angezeigt.

---

## 2. Projektstruktur

```
/css
    style.css          Gesamtes Design (Farben, Typografie, Layout, Animationen)
/js
    firebase.js        Firebase-Initialisierung (App + Firestore-Instanz)
    firestore.js       Sämtliche Firestore-Zugriffe (Lesen/Schreiben/Listener)
    questions.js        16 Quizfragen (leicht editierbar)
    display.js          Logik der Anzeige-Ansicht
    host.js              Logik der Moderator-Ansicht
    login.js             Logik der Anmeldeseite
    vote.js               Logik der Abstimmungsseite
    results.js             Logik der Gesamtergebnis-Übersicht
    ranking.js              Logik der Teilnehmer-Rangliste
    utils.js              Session-/Teilnehmer-ID-Verwaltung, kleine Helfer
/assets
    images/                Fragebilder (q01.jpg … q16.jpg), optional
/data
    questions.sample.json  Referenz-Kopie der Fragen im JSON-Format (optional)
display.html
host.html
login.html
vote.html
results.html
ranking.html
index.html
README.md
```

Es werden ausschließlich **ES6-Module** verwendet (`<script type="module">`).
Es gibt keine globale JavaScript-Datei und keinen Build-Schritt – jede Datei
wird unverändert vom Browser geladen.

---

## 3. Firestore-Datenmodell

```
sessions/{sessionId}
    status:                string   // siehe Status-Tabelle unten
    currentQuestionIndex:  number   // 0-basierter Index in questions.js
    createdAt:             Timestamp
    updatedAt:             Timestamp

sessions/{sessionId}/participants/{participantId}
    name:      string
    nameLower: string        // für case-insensitive Namensprüfung
    joinedAt:  Timestamp

sessions/{sessionId}/votes/{questionIndex_participantId}
    participantId: string
    questionIndex: number
    answer:        "A" | "B"
    createdAt:     Timestamp
```

### Begründung der Struktur

- **`sessions/{sessionId}` als Wurzel-Dokument**: Alle Daten einer Hochzeit
  (Teilnehmer, Stimmen, aktueller Status) hängen als Unterkollektionen an
  einer einzigen Session. So lassen sich beliebig viele unabhängige
  Hochzeiten oder Testläufe im selben Firebase-Projekt betreiben – einfach
  mit einer anderen `sessionId` (URL-Parameter `?session=...`).
- **`participantId` statt Name als Dokument-ID**: Beim ersten Öffnen der
  Login-Seite wird im `localStorage` eine zufällige **UUID** erzeugt und
  dauerhaft gespeichert (`utils.js:getOrCreateParticipantId`). Diese UUID –
  nicht der änderbare Anzeigename – ist die eigentliche Identität eines
  Teilnehmers. Das macht Mehrfachabstimmungen zuverlässig verhinderbar, auch
  wenn zwei Gäste zufällig denselben Namen tragen oder jemand den Namen neu
  eintippt.
- **Zusammengesetzte Dokument-ID bei Stimmen (`questionIndex_participantId`)**:
  Für jede Kombination aus Frage und Teilnehmer kann in Firestore nur genau
  ein Dokument mit dieser ID existieren. Das Schreiben erfolgt in einer
  **Firestore-Transaction** (`runTransaction`), die zuerst prüft, ob das
  Dokument schon existiert, und nur dann schreibt, wenn nicht. Das
  verhindert Mehrfachstimmen zuverlässig – auch bei exakt gleichzeitigen
  Anfragen (z. B. Doppelklick, Tab-Duplikat) – und funktioniert auch nach
  einem Seiten-Reload, da die Prüfung serverseitig in Firestore erfolgt und
  nicht nur lokal im Browser.
- **`nameLower`** ermöglicht eine performante, case-insensitive Prüfung auf
  doppelte Benutzernamen über eine einfache `where()`-Query, ohne alle
  Teilnehmer client-seitig laden zu müssen.

### Status-Werte der Session

| Status | Bedeutung |
|---|---|
| `registration_open` | Anmeldung offen – Gäste können sich per Login-Seite registrieren |
| `registration_closed` | Anmeldung geschlossen – noch keine Frage aktiv |
| `voting_open` | Aktuelle Frage ist offen, Gäste können abstimmen |
| `voting_closed` | Abstimmung zur aktuellen Frage beendet, Ergebnis noch nicht sichtbar |
| `results_visible` | Balkendiagramm der aktuellen Frage wird auf dem Display gezeigt |

---

## 4. Firebase-Einrichtung

1. Gehe zur [Firebase Console](https://console.firebase.google.com/) und
   lege ein neues Projekt an (kostenloser **Spark-Plan** reicht völlig aus).
2. Aktiviere **Cloud Firestore** (Firestore Database → Datenbank erstellen →
   Produktionsmodus oder Testmodus).
3. Lege folgende **Sicherheitsregeln** fest (Firestore → Regeln). Diese
   erlauben Lesen/Schreiben innerhalb einer Session ohne Login, was für ein
   privates, zeitlich begrenztes Hochzeitsevent ausreichend ist:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /sessions/{sessionId} {
         allow read, write: if true;
         match /participants/{participantId} {
           allow read, write: if true;
         }
         match /votes/{voteId} {
           allow read: if true;
           // Ein Stimm-Dokument darf nach dem Erstellen nicht mehr
           // verändert oder gelöscht werden (verhindert Manipulation).
           allow create: if true;
           allow update, delete: if false;
         }
       }
     }
   }
   ```

   > Für den produktiven Einsatz mit echten Gästen empfiehlt es sich, den
   > Zugriff zeitlich zu begrenzen oder zusätzlich per App Check
   > abzusichern. Für ein einmaliges Hochzeitsevent ist obige Regel ein
   > praktikabler Kompromiss aus Einfachheit und Schutz.

4. Erstelle unter **Projekteinstellungen → Deine Apps → Web-App (</>)** eine
   neue Web-App und kopiere die angezeigte `firebaseConfig`.
5. Trage diese Konfiguration in `js/firebase.js` ein (ersetze die
   `DEIN_...`-Platzhalter).

---

## 5. Deployment auf GitHub Pages

1. Erstelle ein neues GitHub-Repository und lade den kompletten Inhalt
   dieses Projekts hoch (z. B. per `git push`).
2. Gehe im Repository zu **Settings → Pages**.
3. Wähle als Quelle **"Deploy from a branch"**, Branch `main`, Ordner `/root`.
4. Speichern – nach kurzer Zeit ist die App unter
   `https://<dein-benutzername>.github.io/<repo-name>/` erreichbar.
5. Teile den Link zur Moderator-Seite (`.../host.html`) mit dem
   Hochzeitspaar/Trauzeugen, öffne `.../display.html` auf dem Beamer/Surface
   Pro, und lass den QR-Code auf dem Display auf `.../login.html` zeigen
   (das passiert automatisch, keine Konfiguration nötig).

> **Hinweis zu mehreren Hochzeiten/Testläufen:** Hänge einfach
> `?session=meinetestsession` an alle drei URLs an, um eine komplett
> unabhängige Session zu verwenden (z. B. für einen Probelauf vor der
> echten Hochzeit).

---

## 6. Lokale Tests

Da ES6-Module über `file://` von den meisten Browsern blockiert werden,
muss die App lokal über einen einfachen HTTP-Server ausgeliefert werden.
Beispiele (eines davon genügt):

```bash
# Python (meist vorinstalliert)
python3 -m http.server 8000

# Node.js (falls vorhanden, ohne Projekt-Abhängigkeit)
npx serve .

# VS Code
# Erweiterung "Live Server" installieren und "Go Live" klicken
```

Anschließend im Browser öffnen:

- `http://localhost:8000/host.html` – Moderator
- `http://localhost:8000/display.html` – Anzeige
- `http://localhost:8000/login.html` – Teilnehmer-Anmeldung

Zum Testen mit mehreren "Gästen" gleichzeitig einfach `login.html` in
mehreren Browser-Tabs oder auf mehreren Geräten im selben WLAN öffnen
(dazu die lokale IP-Adresse statt `localhost` verwenden, z. B.
`http://192.168.1.23:8000/login.html`).

**Firestore-Emulator (optional):** Wer ganz ohne echtes Firebase-Projekt
testen möchte, kann den lokalen Firestore-Emulator nutzen
(`firebase emulators:start`) und beliebige URLs mit `?emulator=1` öffnen
(z. B. `host.html?emulator=1`) – `js/firebase.js` verbindet sich dann
automatisch mit `localhost:8080` statt der Cloud.

---

## 7. Typischer Ablauf am Hochzeitstag

1. Display zeigt den Startbildschirm mit QR-Code.
2. Gäste scannen den Code, geben ihren Namen ein → sie erscheinen live in
   der Teilnehmerliste auf dem Display.
3. Moderator klickt **"Anmeldung schließen"**.
4. Moderator klickt **"Umfrage starten"** → Frage 1 erscheint auf Display
   und auf allen Smartphones.
5. Gäste tippen auf "Lara" oder "Nathanael" → Button wird sofort deaktiviert,
   Bestätigung "Deine Stimme wurde gespeichert." erscheint.
6. Moderator klickt **"Abstimmung schließen"**, dann **"Ergebnis anzeigen"**
   → Display zeigt animiertes Balkendiagramm mit Stimmen & Prozenten.
7. Moderator klickt **"Nächste Frage"** → weiter mit Frage 2, usw. bis
   Frage 16.
8. Am Ende: **"Komplette Session zurücksetzen"**, falls die App für einen
   zweiten Durchlauf (z. B. Standesamt + Feier) erneut genutzt werden soll.

---

## 8. Spätere Erweiterungsmöglichkeiten

- **Mehrsprachigkeit**: Texte in `login.js`, `vote.js`, `host.js`,
  `display.js` in ein separates `i18n.js`-Modul auslagern.
- **JSON-basierte Fragen**: `js/questions.js` so anpassen, dass es die
  Fragen per `fetch('data/questions.sample.json')` lädt statt sie fest zu
  verdrahten – praktisch, wenn Nicht-Entwickler die Fragen pflegen sollen.
  Die Datei `data/questions.sample.json` liegt bereits im passenden Format
  vor.
- **Live-Kommentarfunktion**: Zusätzliche Unterkollektion
  `sessions/{sessionId}/reactions` für Emoji-Reaktionen der Gäste, die auf
  dem Display eingeblendet werden.
- **Foto-Upload durch Gäste**: Firebase Storage anbinden, damit Gäste eigene
  Fotos zu den Antwortoptionen hochladen können.
- **Mehrere parallele Spiele**: Die App unterstützt bereits mehrere
  Sessions parallel (`?session=...`) – eine Session-Auswahl-Seite für den
  Moderator wäre eine sinnvolle Ergänzung, falls mehrere Hochzeiten dasselbe
  Firebase-Projekt teilen.
- **Statistik-Export**: Nach dem Event alle `votes`-Dokumente per Cloud
  Function als CSV exportieren, um die Ergebnisse als Erinnerung zu
  archivieren.

---

## 9. Lizenz / Nutzung

Dieses Projekt wurde individuell für die Hochzeit von Lara & Nathanael
erstellt und kann frei für private, nicht-kommerzielle Zwecke angepasst und
weiterverwendet werden.
