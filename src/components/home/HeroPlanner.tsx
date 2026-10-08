import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Search, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { GuestSteppers } from '@/components/search/GuestSteppers';
import { HomeSearchState, quickRanges, totalGuests } from '@/lib/homeSearch';

interface HeroPlannerProps {
  state: HomeSearchState;
  onChange: (patch: Partial<HomeSearchState>) => void;
  resultCount: number | null;
}

type Tab = 'dates' | 'guests';

const dateLabel = (s: HomeSearchState) =>
  s.checkIn && s.checkOut
    ? `${format(s.checkIn, 'd MMM')} → ${format(s.checkOut, 'd MMM')}`
    : s.checkIn
      ? `${format(s.checkIn, 'd MMM')} → …`
      : 'Add dates';

const guestLabel = (s: HomeSearchState) => {
  const n = totalGuests(s.guests);
  const parts = [`${n} guest${n === 1 ? '' : 's'}`];
  if (s.guests.infants) parts.push(`${s.guests.infants} infant${s.guests.infants === 1 ? '' : 's'}`);
  if (s.guests.pets) parts.push(`${s.guests.pets} pet${s.guests.pets === 1 ? '' : 's'}`);
  return parts.join(' · ');
};

/**
 * The hero's glass planner: where / dates / guests-and-pets all open inline
 * (no popovers, no search button). Every change updates the shared home
 * search state, which drives the live "Every stay, on the map" section
 * further down the page - the stay count here links straight to it.
 */
export function HeroPlanner({ state, onChange, resultCount }: HeroPlannerProps) {
  const [tab, setTab] = useState<Tab>('dates');
  const quicks = useMemo(() => quickRanges(), []);
  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);

  const tabClass = (active: boolean) =>
    `flex-1 rounded-full px-3 py-3 font-ui text-[13px] font-bold transition-all duration-200 ${
      active ? 'bg-accent text-accent-foreground shadow-[0_8px_24px_-8px_var(--glow)]' : 'text-text-secondary hover:text-foreground'
    }`;

  return (
    <div className="glass grid gap-3.5 p-5 text-foreground">
      <label className="nu-in flex items-center gap-3 rounded-full px-[18px] py-3">
        <Search className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        <input
          type="text"
          value={state.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Search Coorg, Hampi, Gokarna…"
          aria-label="Where"
          autoComplete="off"
          className="flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-text-secondary"
        />
      </label>

      <div className="nu-in flex gap-1.5 rounded-full p-[5px]" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'dates'} className={tabClass(tab === 'dates')} onClick={() => setTab('dates')}>
          <CalendarDays className="mr-1.5 inline h-4 w-4" /> Dates
        </button>
        <button type="button" role="tab" aria-selected={tab === 'guests'} className={tabClass(tab === 'guests')} onClick={() => setTab('guests')}>
          <Users className="mr-1.5 inline h-4 w-4" /> Guests &amp; pets
        </button>
      </div>

      {tab === 'dates' ? (
        <div>
          <div className="mb-2.5 flex flex-wrap gap-2">
            {quicks.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => onChange({ checkIn: q.from, checkOut: q.to })}
                className="nu-chip rounded-full px-4 py-2.5 font-ui text-[13px] font-semibold transition-transform active:scale-95"
              >
                {q.label}
              </button>
            ))}
            {state.checkIn && (
              <button
                type="button"
                onClick={() => onChange({ checkIn: undefined, checkOut: undefined })}
                className="rounded-full px-3 py-2.5 font-ui text-[13px] text-text-secondary hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <Calendar
            mode="range"
            selected={{ from: state.checkIn, to: state.checkOut } as DateRange}
            onSelect={(range: DateRange | undefined) => onChange({ checkIn: range?.from, checkOut: range?.to })}
            disabled={(date) => date < today}
            numberOfMonths={1}
            showOutsideDays={false}
            className="pointer-events-auto mx-auto w-fit p-0"
          />
        </div>
      ) : (
        <GuestSteppers guests={state.guests} onChange={(guests) => onChange({ guests })} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text-secondary">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> <b className="font-semibold text-foreground">{dateLabel(state)}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> <b className="font-semibold text-foreground">{guestLabel(state)}</b>
        </span>
        <a href="#explore" className="group font-semibold text-foreground">
          <b>{resultCount ?? '…'}</b> {resultCount === 1 ? 'stay' : 'stays'}
          <span className="ml-1 inline-block transition-transform group-hover:translate-y-0.5">↓</span>
        </a>
      </div>
    </div>
  );
}

export function SeeAllResultsLink({ query }: { query: string }) {
  return (
    <Link
      to={`/search${query ? `?${query}` : ''}`}
      className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-ui text-sm font-bold text-accent-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-8px_var(--glow)]"
    >
      See all results →
    </Link>
  );
}
