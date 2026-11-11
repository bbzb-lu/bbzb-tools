import { IconInfoCircle } from '@tabler/icons-react';
import { useRef } from 'react';

type Link = [label: string, href: string];
type Entry = { name: string; license: string; use: string; note?: string; texts: Link[]; sources: Link[] };

// Versionen: package.json bzw. README von heic-to 1.6.6, ONNX Runtime Web: Abhängigkeit von transformers.js. Bei einem Update hier und in public/licenses/ nachziehen (docs/deployment.md).
const L = `${import.meta.env.BASE_URL}licenses/`; // Unterpfad des Tools, z. B. /social-studio/
const ENTRIES: Entry[] = [
  {
    name: 'Host Grotesk',
    license: 'OFL-1.1',
    use: 'Die Schrift der Oberfläche.',
    note: '© The Host Grotesk Project Authors.',
    texts: [['Lizenztext', L + 'host-grotesk-OFL.txt']],
    sources: [['Quelltext', 'https://github.com/Element-Type/HostGrotesk']],
  },
  {
    name: 'Newsreader',
    license: 'OFL-1.1',
    use: 'Die Schrift für Hinweise in der Oberfläche.',
    note: '© The Newsreader Project Authors.',
    texts: [['Lizenztext', L + 'newsreader-OFL.txt']],
    sources: [['Quelltext', 'https://github.com/productiontype/Newsreader']],
  },
  {
    name: 'Tabler Icons',
    license: 'MIT',
    use: 'Die Icons in der Bibliothek und in der Oberfläche.',
    texts: [['Lizenztext', L + 'tabler-MIT.txt']],
    sources: [['tabler.io/icons', 'https://tabler.io/icons']],
  },
  {
    name: 'Doodles von Khushmeen',
    license: 'CC0',
    use: 'Die Zeichnungen im Tab «Doodles». Ohne Auflagen.',
    texts: [],
    sources: [['khushmeen.com', 'https://khushmeen.com/']],
  },
  {
    name: 'heic-to 1.6.6 mit libheif 1.23.6 und libde265 1.0.16',
    license: 'LGPL-3.0',
    use: 'Öffnet iPhone-Fotos (HEIC). Die Bibliothek liegt unverändert als eigene Datei im Studio und lädt erst, wenn ein HEIC-Foto kommt.',
    note: 'libheif © Dirk Farin. libde265 © struktur AG, Dirk Farin.',
    texts: [
      ['LGPL-3.0', L + 'heic-to-LGPL-3.0.txt'],
      ['GPL-3.0', L + 'GPL-3.0.txt'],
    ],
    sources: [
      ['heic-to', 'https://github.com/hoppergee/heic-to'],
      ['libheif', 'https://github.com/strukturag/libheif'],
      ['libde265', 'https://github.com/strukturag/libde265'],
    ],
  },
  {
    name: 'Mediabunny 1.62.1',
    license: 'MPL-2.0',
    use: 'Liest Videos und schreibt die MP4-Dateien.',
    texts: [['Lizenztext', L + 'mediabunny-MPL-2.0.txt']],
    sources: [['Quelltext', 'https://github.com/Vanilagy/mediabunny']],
  },
  {
    name: 'Transformers.js 3.8.1',
    license: 'Apache-2.0',
    use: 'Führt das KI-Modell fürs Freistellen im Browser aus.',
    note: '© Hugging Face (Autor).',
    texts: [['Lizenztext', L + 'transformers-js-Apache-2.0.txt']],
    sources: [['Quelltext', 'https://github.com/huggingface/transformers.js']],
  },
  {
    name: 'ONNX Runtime Web 1.22.0-dev.20250409',
    license: 'MIT',
    use: 'Rechnet das KI-Modell mit WebGPU oder WebAssembly.',
    note: '© Microsoft Corporation.',
    texts: [['Lizenztext', L + 'onnxruntime-web-MIT.txt']],
    sources: [['Quelltext', 'https://github.com/microsoft/onnxruntime']],
  },
  {
    name: 'ISNet (Modell fürs Freistellen)',
    license: 'Apache-2.0 (Upstream), MIT (Modellkarte)',
    use: 'Erkennt das Motiv. Lädt beim ersten Freistellen von Hugging Face und bleibt dann im Browser.',
    note: 'Xuebin Qin und weitere, «Highly Accurate Dichotomous Image Segmentation» (DIS).',
    texts: [['Lizenztext und Hinweise', L + 'isnet-DIS-Apache-2.0.txt']],
    sources: [
      ['Modell', 'https://huggingface.co/imgly/isnet-general-onnx'],
      ['DIS', 'https://github.com/xuebinqin/DIS'],
    ],
  },
];

const Links = ({ label, links }: { label: string; links: Link[] }) =>
  links.length > 0 && (
    <span>
      {label}:{' '}
      {links.map(([text, href], i) => (
        <span key={href}>
          {i > 0 && ', '}
          <a href={href} target="_blank" rel="noopener noreferrer">
            {text}
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
        </span>
      ))}
    </span>
  );

/** «Lizenzen»: Knopf mit Dialog, Lizenz und Quelle der freien Bestandteile. Die Texte liegen als Dateien unter public/licenses/. */
export function LicensesDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}>
        <IconInfoCircle aria-hidden="true" />
        Lizenzen
      </button>
      <dialog ref={dialog} aria-labelledby="lizenzen-titel" className="licenses-dialog">
        <h2 id="lizenzen-titel">Lizenzen und Quellen</h2>
        <p className="muted hint">Das Studio benutzt freie Software und freie Zeichnungen. Hier stehen Lizenz und Quelle.</p>
        <ul className="license-list">
          {ENTRIES.map((e) => (
            <li key={e.name}>
              <strong>{e.name}</strong>
              <span className="muted">
                {e.license} · {e.use}
              </span>
              {e.note && <span className="muted">{e.note}</span>}
              <span className="license-links muted">
                <Links label="Lizenz" links={e.texts} />
                <Links label="Quelle" links={e.sources} />
              </span>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            Schliessen
          </button>
        </div>
      </dialog>
    </>
  );
}
