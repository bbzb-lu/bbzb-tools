import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadBrandFonts } from './fonts';
import { registerPlugins } from './plugins';
import { startAutosave } from './storage/autosave';
import { useUi } from './store/ui';
import { installTestHook } from './testHook';
import { App } from './ui/App';
import { applyStudioTheme, loadUiFonts } from './ui/theme';
import '@bbzb/ui/fonts.css';
import '@bbzb/ui/base.css';
import './ui/app.css';
// Reihenfolge wie vor dem Umzug: Grundregeln, Editor, Bauteile (geteilt, dann eigene), Kopf
import '@bbzb/ui/kit.css';
import './ui/kit/kit.css';
import './ui/slider.css';
import './ui/inspector.css';
import './ui/contextbar.css';
import '@bbzb/ui/header.css';

applyStudioTheme(document.documentElement);
registerPlugins();
void navigator.storage?.persist?.().catch(() => {});
void loadBrandFonts().then(({ missing }) => useUi.getState().setFonts(missing));
startAutosave();
if (import.meta.env.MODE === 'test') installTestHook();

// Lokale Schriften vor dem ersten Render, aber höchstens kurz warten: bei Fehler greift der System-Fallback.
await Promise.race([loadUiFonts(), new Promise((r) => setTimeout(r, 1500))]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
