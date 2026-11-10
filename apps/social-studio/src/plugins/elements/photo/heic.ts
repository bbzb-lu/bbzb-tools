/** HEIC → JPEG im Browser. Die Bibliothek (3 MB) lädt erst, wenn Edge die Datei nicht selbst öffnen kann. */
export async function heicToJpeg(file: Blob): Promise<Blob> {
  const { heicTo } = await import('heic-to/csp');
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
}
