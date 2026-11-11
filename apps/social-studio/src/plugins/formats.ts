import { formats } from '../core/registries';

export function registerFormats(): void {
  formats.register({ id: 'post', label: 'Post 4:5', width: 1080, height: 1350 });
  formats.register({ id: 'story', label: 'Story 9:16', width: 1080, height: 1920 });
}
