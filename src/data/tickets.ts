import type { PriceRow } from './types';
import data from '../../content/tickets.json';

/** Day / weekend passes. Sourced from content/tickets.json. */
export const passes: PriceRow[] = data.passes;
export const passesNote: string = data.passesNote;

/** Camping & parking fees (shared by the Tickets and Camping pages). */
export const campingParking: PriceRow[] = data.campingParking;

/** General ticket notes. */
export const ticketNotes: string[] = data.ticketNotes;
