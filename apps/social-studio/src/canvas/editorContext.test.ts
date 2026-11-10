import { expect, it } from 'vitest';
import { addElement } from '../model/elements';
import { el, project } from '../model/fixtures';
import { load, useDoc } from '../store/document';
import { useUi } from '../store/ui';
import { editorContext } from './editorContext';

it('spätes apply (z. B. nach Foto-Import) landet nicht in einem anderen Projekt', () => {
  load(project(1));
  const ctx = editorContext();
  load({ ...project(1), id: 'anderes' });
  const other = useDoc.getState().project;
  ctx.apply((d) => addElement(d, el({ id: 'spät' })));
  ctx.select('spät');
  expect(useDoc.getState().project).toBe(other);
  expect(useUi.getState().selectedId).toBeNull();
  load(project(1));
  editorContext().apply((d) => addElement(d, el({ id: 'jetzt' })));
  expect(useDoc.getState().project?.order).toEqual(['jetzt']);
});
