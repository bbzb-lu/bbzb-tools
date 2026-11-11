/** Reine Daten, auch aus Node importierbar (e2e, CI). `vorschau` ist relativ zu public/, 960 × 540. */
export type Tool = { id: string; name: string; satz: string; pfad: string; vorschau: string; beta: boolean };

/** Tools, die in dieser Suite laufen (eigene App unter apps/<id>/). */
export const tools: readonly Tool[] = [
  {
    id: 'social-studio',
    name: 'Social Studio',
    satz: 'Carousels und Stories für Instagram und LinkedIn im BBZB-Design.',
    pfad: '/social-studio/',
    vorschau: 'vorschau/social-studio.png',
    beta: true,
  },
  {
    id: 'news-banner',
    name: 'IT-News-Banner',
    satz: 'Thumbnails für IT-Posts auf SharePoint im BBZB-Design.',
    pfad: '/news-banner/',
    vorschau: 'vorschau/news-banner.png',
    beta: true,
  },
];

/** Tools, die es noch nicht im Browser gibt; die Kachel führt zum bestehenden Projekt. */
export type Geplant = { id: string; name: string; satz: string; link: string };

export const geplant: readonly Geplant[] = [
  {
    id: 'legiccard-creator',
    name: 'LegicCard Creator',
    satz: 'Porträtfotos für die LegicCard. Heute als Python-App, bald im Browser.',
    link: 'https://github.com/alexejwaser/Identity-Card-Photo-Creator',
  },
];
