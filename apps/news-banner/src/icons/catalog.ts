import pack from './tabler-outline.json';
import { iconStyle } from '../tokens';

export type IconRef =
  | { kind: 'tabler'; name: string }
  | { kind: 'brand'; name: string }
  | { kind: 'image'; name: string; bitmap: ImageBitmap };

/** Tabler-Outline (MIT), erzeugt mit `npm run build:tabler`: Name → Pfade (24 × 24) und Suchbegriffe (Stichwörter und Kategorie, englisch). */
const tabler = pack as Record<string, { p: string[]; t: string }>;
// Pfade gehen ungeprüft in ein SVG (innerHTML): nur Pfadzeichen.
const PATH = /^[0-9MmLlHhVvCcSsQqTtAaZz .,+eE-]+$/;

/** Markenicons für den Tab «Apps», von Hand ausgewählt (Entscheid Alexej): Betriebssysteme, Browser, Microsoft, Google, Kommunikation, Cloud, Entwicklung. */
const brands = 'windows azure edge office onedrive teams skype xbox bing apple appstore android chrome firefox safari opera vivaldi arc google gmail google-drive google-maps google-photos google-play google-one google-home google-analytics debian ubuntu redhat slack zoom discord telegram whatsapp signal messenger matrix meta line wechat notion trello asana monday jira evernote airtable zapier loom intercom mastodon bluesky x twitter linkedin facebook instagram tiktok youtube youtube-kids snapchat threads pinterest reddit twitch vimeo spotify medium wikipedia openai github-copilot grammarly github gitlab bitbucket git docker powershell python nodejs npm vscode visual-studio php html5 css3 javascript typescript cloudflare aws nextcloud openvpn nord-vpn surfshark speedtest filezilla dropbox adobe adobe-photoshop adobe-illustrator adobe-indesign adobe-premiere adobe-after-effects adobe-xd figma sketch blender unity steam minecraft wordpress wix webflow picsart unsplash paypal'
  .split(' ')
  .filter((n) => Object.hasOwn(tabler, `brand-${n}`));

const tablerName = (ref: Exclude<IconRef, { kind: 'image' }>) => (ref.kind === 'brand' ? `brand-${ref.name}` : ref.name);

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

/** SVG-Text eines Icons, Strich immer 1.5 mit runden Enden. */
export function iconSvg(ref: Exclude<IconRef, { kind: 'image' }>, color: string, size?: number): string {
  const n = tablerName(ref);
  const body = (Object.hasOwn(tabler, n) ? tabler[n]!.p : []).filter((d) => PATH.test(d)).map((d) => `<path d="${d}"/>`).join('');
  const wh = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${wh} fill="none" stroke="${color}" stroke-width="${iconStyle.stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export const hasIcon = (ref: Exclude<IconRef, { kind: 'image' }>) => (ref.kind === 'brand' ? brands.includes(ref.name) : Object.hasOwn(tabler, ref.name));

/** Suche wie im Social Studio: exakter Name, Namensanfang, Name enthält alle Wörter, Stichwort oder Kategorie enthält alle Wörter. */
export function searchTabler(query: string, limit = 120): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return [];
  const words = q.split(' ');
  const dashed = q.replace(/ /g, '-');
  const buckets: string[][] = [[], [], [], []];
  for (const [name, { t }] of Object.entries(tabler)) {
    if (name === dashed) buckets[0]!.push(name);
    else if (name.startsWith(dashed)) buckets[1]!.push(name);
    else if (words.every((w) => name.includes(w))) buckets[2]!.push(name);
    else if (words.every((w) => t.includes(w))) buckets[3]!.push(name);
  }
  return buckets.flat().slice(0, limit);
}

/** Markenicons, optional gefiltert (Name oder Anzeigename). */
export function searchBrands(query: string): string[] {
  const q = query.toLowerCase().trim();
  return brands.filter((n) => !q || n.includes(q) || brandLabel(n).toLowerCase().includes(q)).sort((a, b) => brandLabel(a).localeCompare(brandLabel(b)));
}

export const brandNames = () => [...brands];

/** Auswahl für den Start, solange nichts gesucht wird: häufige Sinnbilder aus dem IT-Alltag. */
const featuredNames = ['wifi', 'printer', 'key', 'lock', 'shield-check', 'device-desktop', 'device-laptop', 'device-mobile', 'mail', 'cloud', 'server', 'database', 'network', 'world', 'user', 'users', 'settings', 'tool', 'refresh', 'download', 'upload', 'camera', 'folder', 'file-text', 'calendar', 'clock', 'bell', 'battery', 'headphones', 'keyboard'];
export const featuredTabler = () => featuredNames.filter((n) => Object.hasOwn(tabler, n));
