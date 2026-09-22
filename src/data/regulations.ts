import type { RegulationSection } from './types';
import data from '../../content/regulations.json';

/**
 * Festival & camping regulations, sourced from content/regulations.json.
 * NOTE: the English section still carries the Dutch body text in the source —
 * it awaits translation, which a CMS editor can supply.
 */
export const regulations: RegulationSection[] = data.sections as RegulationSection[];
