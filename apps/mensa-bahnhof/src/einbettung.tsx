import { createRoot } from 'react-dom/client';
import { applyTheme } from '@bbzb/ui';
import { Embed } from './Embed';
import '@bbzb/ui/fonts.css';
import '@bbzb/ui/base.css';
import './app.css';
import './embed.css';

applyTheme(document.documentElement);
createRoot(document.getElementById('root')!).render(<Embed />);
