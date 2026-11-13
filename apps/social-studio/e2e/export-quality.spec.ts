import { expect, test, type Page } from '@playwright/test';
import { addPhoto, addSlide, gradientPng, newProject } from './fixtures';
import { addVideo, settled } from './video';
import { exportFiles, setVideo } from './video-export';

// Viel Rauschen: der Encoder schöpft die Bitrate aus (ein einfarbiges Video bliebe bei jeder Stufe winzig)
const NOISE = `${import.meta.dirname}/fixtures/video/noise.mp4`;

async function setQuality(page: Page, label: 'Klein' | 'Standard' | 'Hoch') {
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByRole('dialog', { name: 'Projekteinstellungen' }).getByRole('group', { name: 'Exportqualität' }).getByLabel(label).check({ force: true });
  await page.keyboard.press('Escape');
}

/** Dateigrössen (JPEG, MP4) eines gemischten Projekts bei gewählter Qualität. */
async function sizes(page: Page, label: 'Klein' | 'Hoch') {
  await setQuality(page, label);
  const files = await exportFiles(page);
  const size = (ext: string) => Object.entries(files).find(([n]) => n.endsWith(ext))![1].length;
  return { jpg: size('.jpg'), mp4: size('.mp4') };
}

test('Exportqualität: «Hoch» liefert grössere JPEG und MP4 als «Klein»', async ({ page }) => {
  test.fixme(process.platform === 'win32', 'Windows-Encoder: MP4 kaum grösser, github.com/bbzb-lu/bbzb-tools/issues/7');
  await newProject(page, 'Post 4:5');
  await addPhoto(page, { name: 'f.png', mimeType: 'image/png', buffer: gradientPng(1080, 1350) });
  await addSlide(page);
  const id = await addVideo(page, NOISE);
  await setVideo(page, id, { start: 0, end: 3 });
  await settled(page);
  const klein = await sizes(page, 'Klein');
  const hoch = await sizes(page, 'Hoch');
  console.log(`JPEG ${klein.jpg} → ${hoch.jpg} Byte, MP4 ${klein.mp4} → ${hoch.mp4} Byte`);
  expect(hoch.jpg).toBeGreaterThan(klein.jpg * 1.1);
  expect(hoch.mp4).toBeGreaterThan(klein.mp4 * 1.1);
});
