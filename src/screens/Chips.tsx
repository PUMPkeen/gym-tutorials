import type { Group } from '../db';

interface Props {
  label: string;
  groups: Group[];
  selected: string[];
  onToggle: (id: string) => void;
  /** single = radio-like (main group), multi = checkboxes (extra groups, workout) */
  single?: boolean;
  counts?: Map<string, number>;
  exclude?: string[];
}

export function ChipSelect({ label, groups, selected, onToggle, single, counts, exclude = [] }: Props) {
  return (
    <div class="chips" role={single ? 'radiogroup' : 'group'} aria-label={label}>
      {groups
        .filter((g) => !exclude.includes(g.id))
        .map((g) => {
          const on = selected.includes(g.id);
          return (
            <button
              type="button"
              key={g.id}
              role={single ? 'radio' : 'checkbox'}
              aria-checked={on}
              class={`chip ${on ? 'on' : ''}`}
              onClick={() => onToggle(g.id)}
            >
              {g.name}
              {counts ? ` ${counts.get(g.id) ?? 0}` : ''}
            </button>
          );
        })}
    </div>
  );
}
