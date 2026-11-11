import { useDoc } from '../store/document';
import { EditorPage } from './EditorPage';
import { Notice } from './Notice';
import { StartPage } from './StartPage';
import { Tooltip } from './Tooltip';

export function App() {
  const open = useDoc((s) => s.project !== null);
  return (
    <>
      <Notice />
      <Tooltip />
      {open ? <EditorPage /> : <StartPage />}
    </>
  );
}
