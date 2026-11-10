/** Reine Daten, auch aus Node importierbar (e2e). `vorschau` ist relativ zu public/, 960 × 540. */
export type Tool = { id: string; name: string; satz: string; pfad: string; vorschau: string; beta: boolean };

export const tools: readonly Tool[] = [
  {
    id: 'news-banner',
    name: 'News-Banner',
    satz: 'Thumbnails für SharePoint-News in unter einer Minute.',
    pfad: '/news-banner/',
    vorschau: 'vorschau/news-banner.png',
    beta: true,
  },
];
