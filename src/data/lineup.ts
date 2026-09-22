import type { Act, LineupDay, Stage, StageKey } from './types';
import config from '../../content/lineup.json';

// One JSON file per act (the CMS "Acts" collection). The slug is the filename.
const actModules = import.meta.glob<Record<string, unknown>>('/content/acts/*.json', {
  eager: true,
  import: 'default',
});

/** The three stages, in left-to-right grid order. */
export const stages: Stage[] = config.stages as Stage[];

export const stageByKey: Record<StageKey, Stage> = Object.fromEntries(
  stages.map((s) => [s.key, s]),
) as Record<StageKey, Stage>;

/** Shared placeholder copy shown on an act detail page until real bios are added. */
export const defaultActDescription: string[] = config.defaultActDescription;

// Build the act list from the individual files; slug comes from the filename.
const acts: Act[] = Object.entries(actModules).map(([path, raw]) => {
  const slug = path.split('/').pop()!.replace(/\.json$/, '');
  const d = raw as Partial<Act>;
  return {
    slug,
    name: d.name!,
    time: d.time!,
    stage: d.stage as StageKey,
    day: d.day!,
    order: d.order,
    description: d.description,
    website: d.website,
    image: d.image,
  };
});

/** Days (ordered) with their acts. */
export const days: LineupDay[] = [...config.days]
  .sort((a, b) => a.order - b.order)
  .map((dm) => ({
    name: dm.name,
    sub: dm.sub || undefined,
    acts: acts.filter((a) => a.day === dm.name),
  }));

/** Acts for a given day + stage, in schedule order. */
export function actsForStage(day: LineupDay, stage: StageKey): Act[] {
  return day.acts
    .filter((a) => a.stage === stage)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Flat list of every act (used to generate detail routes). */
export const allActs: Act[] = days.flatMap((d) => d.acts);

export function getAct(slug: string): Act | undefined {
  return allActs.find((a) => a.slug === slug);
}
