import { useEffect } from 'react';

export type NoticeMsg = { text: string; kind: 'info' | 'error' };

/** Schwebende Meldung oben mittig: verschiebt nie die Seitenleiste. Info verschwindet nach 5 s, Fehler bleiben bis zum Schliessen. */
export function Notice({ msg, onClose }: { msg: NoticeMsg | null; onClose(): void }) {
  useEffect(() => {
    if (!msg || msg.kind === 'error') return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div className={`notice notice-${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>
      <p>{msg.text}</p>
      <button type="button" onClick={onClose}>Schliessen</button>
    </div>
  );
}
