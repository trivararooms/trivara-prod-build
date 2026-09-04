import { Calendar as CalendarIcon, Users } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { CounterInput } from '@/components/ui/CounterInput';

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
}

interface DateGuestsFieldsProps {
  checkIn?: Date;
  checkOut?: Date;
  guests: GuestCounts;
  onCheckInChange: (date: Date | undefined) => void;
  onCheckOutChange: (date: Date | undefined) => void;
  onGuestsChange: (guests: GuestCounts) => void;
}

const totalGuests = (g: GuestCounts) => g.adults + g.children;

/**
 * The date-range + guest-count pickers, shared between the search bar
 * (hero and the Search page's compact bar - see SearchBar.tsx) and used to
 * live inside the Search page's Filters sheet as separate, duplicated UI.
 * One implementation now, so both places behave identically.
 */
export function DateGuestsFields({ checkIn, checkOut, guests, onCheckInChange, onCheckOutChange, onGuestsChange }: DateGuestsFieldsProps) {
  const triggerClass = 'flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-surface-3 trivara-transition cursor-pointer text-sm whitespace-nowrap';

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={triggerClass}>
            <CalendarIcon className="h-4 w-4 text-text-secondary flex-shrink-0" />
            <span className={checkIn ? 'text-foreground' : 'text-text-secondary'}>
              {checkIn && checkOut ? `${format(checkIn, 'MMM d')} - ${format(checkOut, 'MMM d')}` : checkIn ? format(checkIn, 'MMM d') : 'Dates'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
          <div className="flex">
            <CalendarComponent
              mode="single"
              selected={checkIn}
              onSelect={(date) => {
                onCheckInChange(date);
                if (date && (!checkOut || checkOut <= date)) onCheckOutChange(addDays(date, 1));
              }}
              disabled={(date) => date < new Date()}
              initialFocus
              className="pointer-events-auto"
            />
            <CalendarComponent
              mode="single"
              selected={checkOut}
              onSelect={onCheckOutChange}
              disabled={(date) => date < (checkIn || new Date())}
              className="pointer-events-auto"
            />
          </div>
          {checkIn && (
            <div className="p-2 border-t border-border">
              <button
                type="button"
                className="text-sm text-text-secondary hover:text-foreground px-2 py-1 rounded trivara-transition hover:bg-surface-2"
                onClick={() => { onCheckInChange(undefined); onCheckOutChange(undefined); }}
              >
                Clear dates
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={triggerClass}>
            <Users className="h-4 w-4 text-text-secondary flex-shrink-0" />
            <span className={totalGuests(guests) > 1 || guests.infants > 0 ? 'text-foreground' : 'text-text-secondary'}>
              {totalGuests(guests) > 1 ? `${totalGuests(guests)} guests` : 'Guests'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 bg-card border-border space-y-4 p-4" align="start">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Adults</p>
              <p className="text-xs text-text-meta">Ages 13+</p>
            </div>
            <CounterInput value={guests.adults} onChange={(v) => onGuestsChange({ ...guests, adults: v })} min={1} max={16} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Children</p>
              <p className="text-xs text-text-meta">Ages 2-12</p>
            </div>
            <CounterInput value={guests.children} onChange={(v) => onGuestsChange({ ...guests, children: v })} min={0} max={16} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Infants</p>
              <p className="text-xs text-text-meta">Under 2</p>
            </div>
            <CounterInput value={guests.infants} onChange={(v) => onGuestsChange({ ...guests, infants: v })} min={0} max={5} />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
