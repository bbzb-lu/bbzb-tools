import { spawnSync } from 'node:child_process';

/** Playwright-globalSetup: erzeugt die Testvideos des Studios, falls ffmpeg da ist. Ohne ffmpeg nur ein Hinweis (andere Tools brauchen die Clips nicht). */
export default function setup() {
  const r = spawnSync('sh', ['apps/social-studio/scripts/make-test-videos.sh'], { stdio: 'pipe' });
  if (r.status !== 0) console.warn('Testvideos fehlen: ffmpeg installieren, sonst scheitern die Video-Specs des Studios.');
}
