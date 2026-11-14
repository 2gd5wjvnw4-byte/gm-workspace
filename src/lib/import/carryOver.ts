import type { MergedCampaignData } from './types';

export function formatCarryOverIds(merged: MergedCampaignData): string {
  const lines: string[] = [];
  const moduleTitle = merged.meta?.title ?? 'Campaign';
  const moduleId = merged.meta?.module_id ?? 'mod-unknown';

  lines.push(`# Carry-over IDs — ${moduleTitle} (${moduleId})`);
  lines.push('');

  const addSection = (heading: string, items: Array<{ id: string; label: string }>) => {
    lines.push(`## ${heading}`);
    if (items.length === 0) {
      lines.push('(none)');
    } else {
      for (const item of items) {
        lines.push(`- ${item.id}: ${item.label}`);
      }
    }
    lines.push('');
  };

  addSection(
    'Entities',
    merged.entities.map((e) => ({ id: e.id, label: e.name }))
  );
  addSection(
    'Truths',
    merged.truths.map((t) => ({ id: t.id, label: t.title }))
  );
  addSection(
    'Factions',
    merged.factions.map((f) => ({ id: f.id, label: f.name }))
  );
  addSection(
    'Clocks',
    merged.clocks.map((k) => ({ id: k.id, label: k.name }))
  );
  addSection(
    'Random Tables',
    merged.random_tables.map((rt) => ({ id: rt.id, label: rt.name }))
  );
  addSection(
    'Trackers',
    merged.trackers.map((tr) => ({ id: tr.id, label: tr.label }))
  );

  return lines.join('\n').trimEnd() + '\n';
}
