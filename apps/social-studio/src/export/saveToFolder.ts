import { safeFileName } from './fileName';

declare global {
  interface Window {
    /** File System Access API (Edge, Chrome); fehlt in lib.dom. */
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}

/**
 * Fragt nach einem Ordner (`pick`: der Ordnerdialog von Edge) und liefert eine Senke, die jede Datei sofort dorthin schreibt,
 * in einen Unterordner mit dem Projektnamen; vorhandene Dateien werden überschrieben. `null`: Dialog abgebrochen.
 */
export async function saveToFolder(
  pick: () => Promise<FileSystemDirectoryHandle>,
  projectName: string,
): Promise<{ sink: (name: string, data: Uint8Array) => Promise<void>; name: string } | null> {
  let root: FileSystemDirectoryHandle;
  try {
    root = await pick();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
  const folder = safeFileName(projectName);
  const dir = await root.getDirectoryHandle(folder, { create: true });
  const sink = async (name: string, data: Uint8Array) => {
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    try {
      await w.write(data as BufferSource);
    } catch (e) {
      await w.abort().catch(() => undefined); // halbe Datei verwerfen, andere bleiben
      throw e;
    }
    await w.close();
  };
  return { sink, name: `${root.name}/${folder}` };
}
