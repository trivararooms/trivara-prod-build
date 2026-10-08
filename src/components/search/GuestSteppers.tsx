import type { GuestCounts } from '@/components/search/DateGuestsFields';

interface GuestSteppersProps {
  guests: GuestCounts;
  onChange: (guests: GuestCounts) => void;
}

const ROWS: { key: keyof GuestCounts; label: string; hint: string; min: number; max: number }[] = [
  { key: 'adults', label: 'Adults', hint: 'Age 13+', min: 1, max: 16 },
  { key: 'children', label: 'Children', hint: 'Ages 2-12', min: 0, max: 16 },
  { key: 'infants', label: 'Infants', hint: 'Under 2 - not counted in capacity', min: 0, max: 5 },
  { key: 'pets', label: 'Pets', hint: 'Only pet-friendly stays', min: 0, max: 5 },
];

/**
 * Inline guest counters with big +/- buttons (the mock's planner), used
 * wherever the guest picker is shown open rather than in a popover.
 */
export function GuestSteppers({ guests, onChange }: GuestSteppersProps) {
  return (
    <div>
      {ROWS.map(({ key, label, hint, min, max }) => (
        <div key={key} className="flex items-center justify-between border-b border-border py-3 last:border-0">
          <div>
            <p className="font-medium">{label}</p>
            <p className="text-xs text-text-secondary">{hint}</p>
          </div>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              aria-label={`Fewer ${label.toLowerCase()}`}
              disabled={guests[key] <= min}
              onClick={() => onChange({ ...guests, [key]: guests[key] - 1 })}
              className="nu-chip grid h-11 w-11 place-items-center rounded-full text-[22px] leading-none transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              −
            </button>
            <output className="min-w-[1.5rem] text-center font-ui text-xl font-extrabold tabular-nums" aria-live="polite">
              {guests[key]}
            </output>
            <button
              type="button"
              aria-label={`More ${label.toLowerCase()}`}
              disabled={guests[key] >= max}
              onClick={() => onChange({ ...guests, [key]: guests[key] + 1 })}
              className="nu-chip grid h-11 w-11 place-items-center rounded-full text-[22px] leading-none transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
