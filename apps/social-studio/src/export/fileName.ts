const umlauts: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue' };
const trim = (s: string) => s.replace(/^[-\s]+|[-\s]+$/g, '');

/** Dateiname ohne Sonderzeichen, der unter Windows, macOS und in ZIPs überall gleich aussieht. */
export function safeFileName(name: string): string {
  const s = name
    .replace(/[äöüÄÖÜ]/g, (c) => umlauts[c]!)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9 _-]/g, '-')
    .replace(/\s*-[-\s]*/g, '-');
  return trim(trim(s).slice(0, 60)) || 'bbzb-social';
}
