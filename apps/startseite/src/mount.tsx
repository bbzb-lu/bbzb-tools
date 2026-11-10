import '@bbzb/ui/fonts.css';
import '@bbzb/ui/base.css';
import '@bbzb/ui/header.css';
import './start.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme } from '@bbzb/ui';

export function mount(page: ReactNode): void {
  applyTheme(document.documentElement);
  createRoot(document.getElementById('root')!).render(<StrictMode>{page}</StrictMode>);
}
