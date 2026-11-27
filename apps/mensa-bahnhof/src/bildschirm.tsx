import { createRoot } from 'react-dom/client';
import { applyTheme } from '@bbzb/ui';
import { Infoscreen } from './Infoscreen';
import '@bbzb/ui/fonts.css';
import '@bbzb/ui/base.css';
import './app.css';
import './infoscreen.css';

applyTheme(document.documentElement);
createRoot(document.getElementById('root')!).render(<Infoscreen />);
