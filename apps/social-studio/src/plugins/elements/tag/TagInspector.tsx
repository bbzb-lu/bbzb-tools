import { useEffect } from 'react';
import type { Element } from '../../../model/types';
import { channelOf } from '../../../model/elements';
import { apply, endGesture, startGesture, useDoc } from '../../../store/document';
import { OpacitySlider } from '../../../ui/OpacitySlider';
import { Section } from '../../../ui/Section';
import { switchChannel } from '../../../ui/layoutActions';
import { channelLabels, channels, departments, tagFills, type Location } from '../../../tokens';
import { Segmented, Switch } from '@bbzb/ui';
import { colorNames } from '../../../ui/Swatches';
import { blurIntoMenu } from '../../../ui/ContextMenu';
import { tagBoxWidth, tagHeightOf } from './layout';
import { measureLabel } from './measure';
import { locations, type TagProps } from './schema';

/** Ein apply: Props ändern, Breite neu messen, Höhe setzen (Fachbereich = zweite Zeile). Standort-Tags merken den Standort fürs Projekt. */
function change(id: string, edit: (p: TagProps) => void) {
  apply((d) => {
    const e = d.elements[id] as Element<TagProps>;
    edit(e.props);
    e.width = tagBoxWidth(e.props, measureLabel(e.props));
    e.height = tagHeightOf(e.props);
    if (e.props.variant === 'schul') d.lastTagLocation = e.props.text;
  });
}
const setText = (id: string, text: string) => change(id, (p) => void (p.text = text));

export function TagInspector({ el }: { el: Element<TagProps> }) {
  // Tippen = eine Geste = ein Undo-Schritt; auch wenn die Auswahl wechselt, ohne dass das Feld den Fokus verliert.
  useEffect(() => endGesture, []);
  return (
    <Section heading="Darstellung" id="darstellung-tag" collapsible defaultOpen>
      <OpacitySlider el={el} />
      {el.props.variant === 'schul' ? <LocationPicker el={el} /> : el.props.variant === 'fach' ? <Dept el={el} /> : <Label el={el} />}
      {el.props.variant === 'frei' && <Fill el={el} />}
      {el.props.variant === 'cta' && <ChannelSwitch />}
    </Section>
  );
}

const deptsOf = (l: string): readonly string[] => (Object.hasOwn(departments, l) ? departments[l as Exclude<Location, 'BBZB'>] : []);

function LocationPicker({ el }: { el: Element<TagProps> }) {
  const { text, dept } = el.props;
  const list = deptsOf(text);
  const shown = !!dept && list.includes(dept);
  return (
    <>
      <fieldset className="choice">
        <legend>Standort</legend>
        <select
          aria-label="Standort"
          value={text}
          // Ein Fachbereich, den der neue Standort nicht führt, fällt weg.
          onChange={(e) => change(el.id, (p) => {
            p.text = e.target.value;
            if (p.dept && !deptsOf(p.text).includes(p.dept)) delete p.dept;
          })}
        >
          {[...new Set<string>([...locations, text])].map((l) => (
            <option key={l} value={l}>{l === 'BBZB' ? 'Ohne Standort' : l}</option>
          ))}
        </select>
      </fieldset>
      {list.length > 0 && (
        <Switch
          checked={shown}
          onChange={(on) => change(el.id, (p) => {
            if (on) p.dept = dept && list.includes(dept) ? dept : list[0];
            else delete p.dept;
          })}
        >
          Fachbereich zeigen
          <span aria-hidden="true" className="switch-state">{shown ? 'Ja' : 'Nein'}</span>
        </Switch>
      )}
      {shown && (
        <fieldset className="choice">
          <legend>Fachbereich</legend>
          <select aria-label="Fachbereich" value={dept} onChange={(e) => change(el.id, (p) => void (p.dept = e.target.value))}>
            {list.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </fieldset>
      )}
    </>
  );
}

/** Fachbereich-Tag: ein Fachbereich aus allen Standorten; die Wahl setzt Text und Standortfarbe. */
function Dept({ el }: { el: Element<TagProps> }) {
  // Fehlt der Standort (von Hand bearbeitete Datei), gilt der erste Fachbereich mit diesem Namen.
  const places = Object.keys(departments) as Exclude<Location, 'BBZB'>[];
  const home = places.find((l) => l === el.props.color && departments[l].includes(el.props.text)) ?? places.find((l) => departments[l].includes(el.props.text));
  const key = `${home ?? el.props.color}|${el.props.text}`;
  return (
    <fieldset className="choice">
      <legend>Fachbereich</legend>
      <select
        aria-label="Fachbereich"
        value={key}
        onChange={(e) => {
          const [color, ...rest] = e.target.value.split('|');
          change(el.id, (p) => {
            p.color = color as TagProps['color'];
            p.text = rest.join('|');
          });
        }}
      >
        {places.map((l) => (
          <optgroup key={l} label={l}>
            {departments[l].map((d) => (
              <option key={d} value={`${l}|${d}`}>{d}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </fieldset>
  );
}

/** Freier Tag: Füllfarbe; die Schrift folgt über onAccent. */
function Fill({ el }: { el: Element<TagProps> }) {
  return (
    <fieldset className="choice">
      <legend>Farbe</legend>
      <select aria-label="Farbe" value={el.props.color ?? 'blau'} onChange={(e) => change(el.id, (p) => void (p.color = e.target.value as TagProps['color']))}>
        {tagFills.map((f) => (
          <option key={f} value={f}>{colorNames[f as keyof typeof colorNames] ?? f}</option>
        ))}
      </select>
    </fieldset>
  );
}

function Label({ el }: { el: Element<TagProps> }) {
  return (
    <fieldset className="choice">
      <legend>Text</legend>
      <input
        aria-label="Text"
        value={el.props.text}
        maxLength={60}
        onFocus={(e) => !blurIntoMenu(e) && startGesture()}
        onBlur={(e) => !blurIntoMenu(e) && endGesture()}
        // Leer lassen geht nicht: ein Tag ohne Text wäre unsichtbar.
        onChange={(e) => e.target.value.trim() && setText(el.id, e.target.value)}
      />
    </fieldset>
  );
}

/** Der Kanal gilt fürs ganze Projekt: Standardtexte aller CTA wechseln mit. */
function ChannelSwitch() {
  const channel = useDoc((s) => (s.project ? channelOf(s.project) : 'instagram'));
  return (
    <Segmented
      legend="Kanal"
      value={channel}
      options={channels.map((c) => [c, channelLabels[c]])}
      hint="Gilt für alle CTA im Projekt."
      onChange={(c) => void switchChannel(c)}
    />
  );
}
