// Tabler Icons outline (MIT, public/licenses/tabler-MIT.txt), 24 × 24, Strich
const leaf = ['M5 21c.5 -4.5 2.5 -8 7 -10', 'M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3l.014 0'];
const milchfrei = ['M10 6h6v-2a1 1 0 0 0 -1 -1h-6a1 1 0 0 0 -1 1', 'M16 6l1.094 1.759a6 6 0 0 1 .906 3.17v3.071m0 4v1a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8.071a6 6 0 0 1 .906 -3.17l.327 -.525', 'M10 16a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M3 3l18 18'];
const glutenfrei = ['M3 3l18 18', 'M12 21.5v-3.75', 'M5.916 9.49l-.43 1.604c-.712 2.659 .866 5.392 3.524 6.104c.997 .268 1.994 .535 2.99 .802v-3.44c-.164 -2.105 -1.637 -3.879 -3.677 -4.426l-2.407 -.644', 'M10.249 4.251c.007 -.007 .014 -.014 .021 -.021l1.73 -1.73', 'M10.27 11.15c-.589 -.589 -1.017 -1.318 -1.246 -2.118', 'M14.988 8.988c.229 -.834 .234 -1.713 .013 -2.549c-.221 -.836 -.659 -1.598 -1.271 -2.209l-1.73 -1.73', 'M16.038 10.037l2.046 -.547l.431 1.604c.142 .53 .193 1.063 .162 1.583', 'M16.506 16.505c-.45 .307 -.959 .544 -1.516 .694c-.997 .268 -1.994 .535 -2.99 .801v-3.44c.055 -.708 .259 -1.379 .582 -1.978'];
const ICONS: Record<string, string[]> = { Vegan: leaf, Vegetarisch: leaf, Laktosefrei: milchfrei, Glutenfrei: glutenfrei };

export const VEGI = ['Vegan', 'Vegetarisch'];

export function iconFuer(label: string): string[] | undefined {
  return ICONS[label];
}
