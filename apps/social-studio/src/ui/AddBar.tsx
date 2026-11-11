import { elementTypes } from '../core/registries';
import { editorContext } from '../canvas/editorContext';

/** «Foto hinzufügen», «Text hinzufügen» …: ein Knopf je ElementType mit `add`, Icon links vom Text. */
export function AddBar() {
  const types = elementTypes.all().filter((t) => t.add);
  return (
    <div className="add-bar" role="group" aria-label="Hinzufügen">
      {types.map((t) => {
        const { icon: Icon, label, run } = t.add!;
        return (
          <button key={t.id} type="button" aria-label={label} onClick={() => void run(editorContext())}>
            {Icon && <Icon aria-hidden="true" />}
            <span>{label.replace(/ hinzufügen$/, '')}</span>
          </button>
        );
      })}
    </div>
  );
}
