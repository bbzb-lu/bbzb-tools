import { Header } from '@bbzb/ui';
import { Fuss } from './Fuss';

export function Datenschutz() {
  return (
    <>
      <Header tool="Datenschutz" feedback="Startseite" />
      <main className="seite text">
        <h1>Datenschutz</h1>
        <p>
          Alle BBZB Tools sind Web-Apps ohne serverseitige Datenspeicherung. Die App wird beim Aufruf in deinen Browser geladen und läuft danach
          vollständig auf deinem Gerät. Ist ein Tool einmal offen, arbeitet es auch ohne Internetverbindung weiter. Ausnahme ist das Freistellen im
          Social Studio, das sein KI-Modell beim ersten Mal herunterlädt.
        </p>
        <p>Trotzdem gilt: Sensible Daten, die nicht veröffentlicht werden sollen, gehören nicht auf Server ausserhalb der kantonalen M365-Umgebung.</p>
        <p>BBZB Tools läuft ganz in deinem Browser. Es gibt keinen Server, der deine Bilder, Texte oder Projekte bekommt.</p>
        <p>Wir speichern nichts bei uns. Wenn ein Tool deine Arbeit sichert, dann nur in deinem Browser auf deinem Gerät.</p>
        <p>Es gibt keine Analyse, kein Tracking und keine Cookies.</p>
        <p>Die Startseite zeigt deine zuletzt bearbeiteten Projekte. Diese Liste (Name, Tool, Zeitpunkt) liegt ebenfalls nur in deinem Browser.</p>
        <h2>Ausnahmen</h2>
        <p>Das Social Studio lädt beim Freistellen KI-Modelle von Hugging Face herunter. Dabei wird nichts von dir gesendet, deine Bilder bleiben im Browser.</p>
        <p>
          Der Link «Feedback» öffnet ein Microsoft-Forms-Formular der Schule. Was du dort eingibst, landet bei Microsoft im Schul-Konto, nicht in
          den Tools. Die Tools selbst senden dabei nichts.
        </p>
        <p>
          Nachprüfen: Jede Seite schickt eine Content-Security-Policy, die dem Browser verbietet, Daten an andere Adressen zu senden.
          Ausnahmen stehen oben unter «Ausnahmen». Du siehst die Regeln in den Entwicklertools unter Netzwerk. Der Quellcode ist öffentlich, und ein automatischer Test prüft bei jeder
          Änderung, dass keine fremden Adressen angefragt werden.
        </p>
      </main>
      <Fuss />
    </>
  );
}
