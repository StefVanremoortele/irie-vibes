import type { Sponsor } from './types';
import data from '../../content/sponsors.json';
import { assetUrl } from '../lib/assets';

type RawSponsor = { image?: string; alt?: string; label?: string; sub?: string };

function normalise(list: RawSponsor[]): Sponsor[] {
  return list.map((s) =>
    s.image
      ? { src: assetUrl(s.image), alt: s.alt ?? '' }
      : { label: s.label, sub: s.sub ?? '' },
  );
}

/** Main partners (larger logos). Sourced from content/sponsors.json. */
export const sponsorsMain: Sponsor[] = normalise(data.main as RawSponsor[]);

/** Regular sponsors (smaller logos). */
export const sponsorsReg: Sponsor[] = normalise(data.regular as RawSponsor[]);
