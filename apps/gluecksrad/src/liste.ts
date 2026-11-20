const KEY = 'gluecksrad-liste';

export function ladeListe(): string {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function speichereListe(text: string): void {
  try { localStorage.setItem(KEY, text); } catch { /* privat oder voll: Liste bleibt nur in der Sitzung */ }
}
