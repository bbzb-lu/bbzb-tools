import type { ButtonHTMLAttributes } from 'react';

/** Taste im Stil des Entwurfs. Den Ruhe-Schatten, Hover, Gedrückt und Fokus liefert kit.css für jede `button`; hier nur die Varianten. */
export function Button({ variant = 'rest', className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'rest' | 'primary' | 'icon' }) {
  const cls = [variant === 'primary' && 'primary', variant === 'icon' && 'icon-btn', className].filter(Boolean).join(' ') || undefined;
  return <button type={type} className={cls} {...rest} />;
}
