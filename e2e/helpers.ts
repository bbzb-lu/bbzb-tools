import type { Page } from '@playwright/test';

/** Sammelt laufend jede Anfrage, die nicht von der eigenen Herkunft, `blob:` oder `data:` kommt. */
export function foreignRequests(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(`http://localhost:${process.env.PW_PORT ?? '8788'}/`) && !url.startsWith('blob:') && !url.startsWith('data:')) foreign.push(url);
  });
  return foreign;
}
