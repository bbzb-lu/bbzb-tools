import { icons } from 'lucide';
import meta from './lucide-meta.json';
import { iconStyle } from '../tokens';

export type IconRef =
  | { kind: 'lucide'; name: string }
  | { kind: 'brand'; name: string }
  | { kind: 'image'; name: string; bitmap: ImageBitmap };

type Node = [string, Record<string, string | number>];

const pascal = (n: string) => n.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join('');

/** Stichwörter und Kategorien von lucide.dev, erzeugt mit `npm run build:lucide-meta`: [Hauptname, Stichwörter, Aliase]. */
type Entry = { name: string; node: Node[]; aliases: string; tags: string };
const entries: Entry[] = (meta as [string, string, string][])
  .map(([name, tags, aliases]) => ({ name, tags, aliases, node: (icons as Record<string, Node[]>)[pascal(name)]! }))
  .filter((e) => e.node);
const lucide = new Map<string, Node[]>(entries.flatMap((e) => [e.name, ...e.aliases.split(' ').filter(Boolean)].map((n) => [n, e.node] as const)));

/** Nur Markenicons von Tabler (Entscheid Alexej), von Hand ausgewählt: Betriebssysteme, Browser, Microsoft, Google, Kommunikation, Cloud, Entwicklung. */
const tablerRaw = import.meta.glob('@tabler-outline/brand-{windows,azure,edge,office,onedrive,teams,skype,xbox,bing,apple,appstore,android,chrome,firefox,safari,opera,vivaldi,arc,google,gmail,google-drive,google-maps,google-photos,google-play,google-one,google-home,google-analytics,debian,ubuntu,redhat,slack,zoom,discord,telegram,whatsapp,signal,messenger,matrix,meta,line,wechat,notion,trello,asana,monday,jira,evernote,airtable,zapier,loom,intercom,mastodon,bluesky,x,twitter,linkedin,facebook,instagram,tiktok,youtube,youtube-kids,snapchat,threads,pinterest,reddit,twitch,vimeo,spotify,medium,wikipedia,openai,github-copilot,grammarly,github,gitlab,bitbucket,git,docker,powershell,python,nodejs,npm,vscode,visual-studio,php,html5,css3,javascript,typescript,cloudflare,aws,nextcloud,openvpn,nord-vpn,surfshark,speedtest,filezilla,dropbox,adobe,adobe-photoshop,adobe-illustrator,adobe-indesign,adobe-premiere,adobe-after-effects,adobe-xd,figma,sketch,blender,unity,steam,minecraft,wordpress,wix,webflow,picsart,unsplash,paypal}.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const brand = new Map<string, string>(
  Object.entries(tablerRaw).map(([p, svg]) => [
    p.split('/').pop()!.replace(/^brand-|\.svg$/g, ''),
    // der unsichtbare Rahmenpfad («stroke="none"») gehört nicht zum Icon
    svg.replace(/^[\s\S]*?<\/?svg[^>]*>|<\/svg>\s*$/g, '').replace(/<path stroke="none"[^>]*\/>/g, '').trim(),
  ]),
);

/** Anzeigenamen, wo «Gross schreiben und Bindestrich zu Leerzeichen» nicht stimmt. */
const labelFix: Record<string, string> = {
  onedrive: 'OneDrive', github: 'GitHub', gitlab: 'GitLab', youtube: 'YouTube', 'youtube-kids': 'YouTube Kids', linkedin: 'LinkedIn', tiktok: 'TikTok',
  whatsapp: 'WhatsApp', openai: 'OpenAI', powershell: 'PowerShell', vscode: 'VS Code', nodejs: 'Node.js', npm: 'npm', php: 'PHP', html5: 'HTML5', css3: 'CSS3',
  javascript: 'JavaScript', typescript: 'TypeScript', aws: 'AWS', x: 'X', 'github-copilot': 'GitHub Copilot', 'nord-vpn': 'NordVPN', openvpn: 'OpenVPN',
  wordpress: 'WordPress', filezilla: 'FileZilla', 'visual-studio': 'Visual Studio', 'google-drive': 'Google Drive', 'google-maps': 'Google Maps',
  'google-photos': 'Google Photos', 'google-play': 'Google Play', 'google-one': 'Google One', 'google-home': 'Google Home', 'google-analytics': 'Google Analytics',
  'adobe-photoshop': 'Photoshop', 'adobe-illustrator': 'Illustrator', 'adobe-indesign': 'InDesign', 'adobe-premiere': 'Premiere', 'adobe-after-effects': 'After Effects',
  'adobe-xd': 'Adobe XD', appstore: 'App Store', picsart: 'PicsArt', redhat: 'Red Hat', nextcloud: 'Nextcloud', coreos: 'CoreOS', bitbucket: 'Bitbucket',
};
export const brandLabel = (n: string) => labelFix[n] ?? n.replace(/(^|-)([a-z])/g, (_, d: string, c: string) => (d ? ' ' : '') + c.toUpperCase());

const attrs = (a: Record<string, string | number>) => Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');

/** SVG-Text eines Icons, Strich immer 1.5 mit runden Enden. */
export function iconSvg(ref: Exclude<IconRef, { kind: 'image' }>, color: string, size?: number): string {
  const body = ref.kind === 'lucide'
    ? (lucide.get(ref.name) ?? []).map(([t, a]) => `<${t} ${attrs(a)}/>`).join('')
    : (brand.get(ref.name) ?? '');
  const wh = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${wh} fill="none" stroke="${color}" stroke-width="${iconStyle.stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export const hasIcon = (ref: Exclude<IconRef, { kind: 'image' }>) => (ref.kind === 'lucide' ? lucide.has(ref.name) : brand.has(ref.name));

/**
 * Suche wie auf lucide.dev: alle Wörter müssen im Namen, in einem Alias, einem Stichwort oder einer Kategorie vorkommen.
 * Treffer im Namen zählen mehr als Stichwort-Treffer, exakte Wörter mehr als Teilstücke.
 */
export function searchLucide(query: string, limit = 120): string[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: [string, number][] = [];
  for (const e of entries) {
    const tags = e.tags.split(' ');
    const aliases = e.aliases.split(' ');
    let total = 0;
    for (const w of words) {
      const s =
        e.name === w ? 100 : e.name.startsWith(w) ? 60 : e.name.includes(w) ? 40
        : aliases.some((a) => a.includes(w)) ? 30
        : tags.includes(w) ? 25 : e.tags.includes(w) ? 15 : 0;
      if (!s) { total = 0; break; }
      total += s;
    }
    if (total) scored.push([e.name, total]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0])).slice(0, limit).map(([n]) => n);
}

/** Markenicons, optional gefiltert (Name oder Anzeigename). */
export function searchBrands(query: string): string[] {
  const q = query.toLowerCase().trim();
  return [...brand.keys()].filter((n) => !q || n.includes(q) || brandLabel(n).toLowerCase().includes(q)).sort((a, b) => brandLabel(a).localeCompare(brandLabel(b)));
}

export const brandNames = () => [...brand.keys()];

/** Auswahl für den Start, solange nichts gesucht wird: häufige Sinnbilder aus dem IT-Alltag. */
const featuredNames = ['wifi', 'printer', 'key-round', 'lock', 'shield-check', 'monitor', 'laptop', 'smartphone', 'mail', 'cloud', 'server', 'hard-drive', 'network', 'globe', 'user', 'users', 'settings', 'wrench', 'refresh-cw', 'download', 'upload', 'camera', 'folder', 'file-text', 'calendar', 'clock', 'bell', 'battery', 'headphones', 'keyboard'];
export const featuredLucide = () => featuredNames.filter((n) => lucide.has(n));
