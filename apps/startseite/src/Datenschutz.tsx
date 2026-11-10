import { Header } from '@bbzb/ui';
import { Fuss } from './Fuss';

export function Datenschutz() {
  return (
    <>
      <Header tool="Datenschutz" />
      <main className="seite text">
        <h1>Datenschutz</h1>
        <p>BBZB Tools läuft ganz in deinem Browser. Es gibt keinen Server, der deine Bilder, Texte oder Projekte bekommt.</p>
        <p>Wir speichern nichts bei uns. Wenn ein Tool deine Arbeit sichert, dann nur in deinem Browser auf deinem Gerät.</p>
        <p>Es gibt keine Analyse, kein Tracking und keine Cookies.</p>
        <h2>Ausnahmen</h2>
        <p>Zurzeit gibt es keine Ausnahmen.</p>
        <p>
          Nachprüfen: Jede Seite schickt eine Content-Security-Policy, die dem Browser verbietet, Daten an andere Adressen zu senden. Du
          siehst sie in den Entwicklertools unter Netzwerk. Der Quellcode ist öffentlich, und ein automatischer Test prüft bei jeder
          Änderung, dass keine fremden Adressen angefragt werden.
        </p>
      </main>
      <Fuss />
    </>
  );
}
