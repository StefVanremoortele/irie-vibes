import type { DevNote } from './types';
import data from '../../content/dev-notes.json';

/** Developer notes for testers (content/dev-notes.json), newest first. */
export const devNotes: DevNote[] = [...(data.notes as DevNote[])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
