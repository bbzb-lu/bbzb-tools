import { createRoot } from 'react-dom/client';
import { applyTheme } from '@bbzb/ui';
import { App } from './App';
import '@bbzb/ui/fonts.css';
import '@bbzb/ui/base.css';
import '@bbzb/ui/kit.css';
import '@bbzb/ui/header.css';
import './ui/app.css';

applyTheme(document.documentElement);
createRoot(document.getElementById('root')!).render(<App />);
