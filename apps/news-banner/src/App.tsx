import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Header, Segmented, Switch } from '@bbzb/ui';
import type { IconRef } from './icons/catalog';
import { usePrepared } from './icons/usePrepared';
import { renderBanner, renderGuides, type BannerAssets, type BannerState } from './render';
import { canvas, guideColors, slots, type Audience, type Kind, type Slot } from './tokens';
import { IconPicker } from './ui/IconPicker';
import { Notice, type NoticeMsg } from './ui/Notice';
import { SlotPicker } from './ui/SlotPicker';
import { Section } from './ui/Section';

const load = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(src));
    i.src = src;
  });

const audiences: [Audience, string][] = [['le', 'Lernende'], ['lp', 'Lehrpersonen'], ['beide', 'Beide']];
const kinds: [Kind, string][] = [['info', 'Info'], ['stoerung', 'Störung']];
const BOTH_HINT = 'Beide nutzt die dunkle Vorlage der Lernenden.';

type Doc = BannerState & { icons: Record<Slot, IconRef>; bottomOn: boolean };
const start: Doc = {
  audience: 'le',
  kind: 'info',
  icons: { left: { kind: 'lucide', name: 'laptop' }, right: { kind: 'lucide', name: 'user' }, bottom: { kind: 'lucide', name: 'wrench' } },
  bottomOn: false,
};

function draw(c: HTMLCanvasElement, s: BannerState, a: BannerAssets, guides: Slot | null) {
  const ctx = c.getContext('2d')!;
  renderBanner(ctx, s, a);
  if (guides) renderGuides(ctx, guides);
}

export function App() {
  const [doc, setDoc] = useState<Doc>(start);
  const [slot, setSlot] = useState<Slot>('left');
  const [guides, setGuides] = useState(true);
  const [badges, setBadges] = useState<BannerAssets['badges'] | null>(null);
  const [notice, setNotice] = useState<NoticeMsg | null>(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  const setError = useCallback((text: string) => setNotice(text ? { text, kind: 'error' } : null), []);
  const ref = useRef<HTMLCanvasElement>(null);

  const wanted = { left: doc.icons.left, right: doc.icons.right, ...(doc.bottomOn && { bottom: doc.icons.bottom }) };
  const prepared = usePrepared(doc.audience, wanted);
  const assets = useMemo<BannerAssets | null>(() => (badges && prepared.ready ? { badges, icons: prepared.icons } : null), [badges, prepared.ready, prepared.icons]);
  const shown = notice ?? (prepared.error ? ({ text: prepared.error, kind: 'error' } as const) : null);

  useEffect(() => {
    Promise.all([load(`${import.meta.env.BASE_URL}badges/info.png`), load(`${import.meta.env.BASE_URL}badges/stoerung.png`)])
      .then(([info, stoerung]) => setBadges({ info, stoerung }))
      .catch(() => setError('Die Vorlagen konnten nicht geladen werden. Lade die Seite neu.'));
  }, [setError]);

  useEffect(() => {
    if (assets && ref.current) draw(ref.current, doc, assets, guides ? slot : null);
  }, [assets, doc, guides, slot]);

  /** Klick auf die Vorschau wählt den Icon-Platz unter dem Zeiger. */
  function pickSlot(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.w;
    const y = ((e.clientY - r.top) / r.height) * canvas.h;
    // der Bereich unter dem Punkt ist grosszügig, damit der kleine untere Platz leicht zu treffen ist
    setSlot(Math.abs(x - slots.bottom.cx) < 200 && y > 520 && y < 700 ? 'bottom' : x < canvas.w / 2 ? 'left' : 'right');
  }

  function download() {
    if (!assets) return;
    const c = document.createElement('canvas');
    c.width = canvas.w;
    c.height = canvas.h;
    draw(c, doc, assets, null);
    c.toBlob((blob) => {
      if (!blob) return setError('Der Export hat nicht geklappt. Versuche es nochmals.');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `news-${doc.audience}-${doc.kind}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNotice({ text: `Gespeichert als ${a.download}`, kind: 'info' });
    }, 'image/png');
  }

  return (
    <div className="app">
      <Header tool="IT-News-Banner" feedback="IT-News-Banner">
        <h1 className="sr-only">IT-News-Banner erstellen</h1>
        <div className="header-actions">
          <Button variant="primary" onClick={download} disabled={!assets}>PNG laden</Button>
        </div>
      </Header>
      <Notice msg={shown} onClose={closeNotice} />
      <div className="workspace">
        <div className="left-panel">
          <div className="left-box">
            <Section heading="Banner">
              <Segmented legend="Zielgruppe" value={doc.audience} options={audiences} onChange={(audience) => { setDoc({ ...doc, audience }); setNotice(audience === 'beide' ? { text: BOTH_HINT, kind: 'info' } : null); }} />
              <Segmented legend="Art" value={doc.kind} options={kinds} onChange={(kind) => setDoc({ ...doc, kind })} />
            </Section>
            <Section heading="Icons" grow>
              <SlotPicker icons={doc.icons} slot={slot} kind={doc.kind} bottomOn={doc.bottomOn} onSlot={setSlot} onBottomOn={(bottomOn) => setDoc({ ...doc, bottomOn })} />
              <IconPicker key={slot} value={doc.icons[slot]} onError={setError} onPick={(r) => setDoc({ ...doc, icons: { ...doc.icons, [slot]: r }, bottomOn: doc.bottomOn || slot === 'bottom' })} />
            </Section>
            <p className="small muted legal">
              Lizenzen: <a href={`${import.meta.env.BASE_URL}licenses/lucide-ISC.txt`} target="_blank" rel="noreferrer">Lucide</a>, <a href={`${import.meta.env.BASE_URL}licenses/tabler-MIT.txt`} target="_blank" rel="noreferrer">Tabler</a>, <a href={`${import.meta.env.BASE_URL}licenses/host-grotesk-OFL.txt`} target="_blank" rel="noreferrer">Host Grotesk</a>
            </p>
          </div>
        </div>
        <main className="stage">
          <canvas ref={ref} className="preview" width={canvas.w} height={canvas.h} aria-label="Vorschau des Banners" title="Klick wählt den Icon-Platz" onClick={pickSlot} />
          <div className="legend">
            {guides && (
              <>
                <span><i className="swatch" style={{ borderColor: guideColors.blocked }} aria-hidden="true" />Sperrzone, bleibt leer</span>
                <span><i className="swatch dashed" style={{ borderColor: guideColors.banner }} aria-hidden="true" />Banner-Zone</span>
              </>
            )}
            <span className="switch-field legend-switch"><Switch checked={guides} onChange={setGuides}>Hilfslinien zeigen</Switch></span>
          </div>
        </main>
      </div>
    </div>
  );
}
