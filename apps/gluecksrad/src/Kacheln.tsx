/** Alle Optionen als Wand. Nach dem Ziehen leuchten die gewählten, die übrigen werden gedämpft. */
export function Kacheln({ optionen, gewaehlt }: { optionen: string[]; gewaehlt: Set<number> }) {
  return (
    <ul className="kacheln">
      {optionen.map((o, i) => (
        <li
          key={i}
          className={gewaehlt.size === 0 ? undefined : gewaehlt.has(i) ? 'an' : 'aus'}
          aria-current={gewaehlt.has(i) || undefined}
          style={{ '--i': Math.min([...gewaehlt].indexOf(i), 10) } as React.CSSProperties}
        >
          {o}
        </li>
      ))}
    </ul>
  );
}
