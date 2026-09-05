import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateGuestsFields, GuestCounts } from '@/components/search/DateGuestsFields';

const EMPTY_GUESTS: GuestCounts = { adults: 1, children: 0, infants: 0, pets: 0 };

interface ControlledProps {
  location: string;
  checkIn?: Date;
  checkOut?: Date;
  guests: GuestCounts;
  onLocationChange: (location: string) => void;
  onCheckInChange: (date: Date | undefined) => void;
  onCheckOutChange: (date: Date | undefined) => void;
  onGuestsChange: (guests: GuestCounts) => void;
}

interface SearchBarProps {
  variant?: 'hero' | 'compact';
  className?: string;
  /**
   * Controlled mode - pass all of these (as the Search page does) to drive
   * the bar from that page's own URL-backed filter state instead of the
   * bar navigating to /search itself. Omit all of them (as the homepage
   * hero does) for the bar to manage its own state and navigate on search.
   */
  controlled?: ControlledProps;
}

export function SearchBar({ variant = 'hero', className = '', controlled }: SearchBarProps) {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [guests, setGuests] = useState<GuestCounts>(EMPTY_GUESTS);

  const isControlled = !!controlled;
  const locationValue = controlled ? controlled.location : location;
  const setLocationValue = controlled ? controlled.onLocationChange : setLocation;
  const checkInValue = controlled ? controlled.checkIn : checkIn;
  const setCheckInValue = controlled ? controlled.onCheckInChange : setCheckIn;
  const checkOutValue = controlled ? controlled.checkOut : checkOut;
  const setCheckOutValue = controlled ? controlled.onCheckOutChange : setCheckOut;
  const guestsValue = controlled ? controlled.guests : guests;
  const setGuestsValue = controlled ? controlled.onGuestsChange : setGuests;

  const handleSearch = () => {
    if (isControlled) return; // already on /search - each field updates its own filter live.

    const params = new URLSearchParams();
    if (locationValue) params.set('location', locationValue);
    if (checkInValue) params.set('checkIn', checkInValue.toISOString());
    if (checkOutValue) params.set('checkOut', checkOutValue.toISOString());
    const totalGuests = guestsValue.adults + guestsValue.children;
    if (totalGuests > 1) params.set('guests', totalGuests.toString());
    if (guestsValue.infants > 0) params.set('infants', guestsValue.infants.toString());
    if (guestsValue.pets > 0) params.set('pets', guestsValue.pets.toString());
    navigate(`/search?${params.toString()}`);
  };

  const barPadding = variant === 'hero' ? 'p-2' : 'p-1';
  const locationPadding = variant === 'hero' ? 'px-5 py-3' : 'px-4 py-2';
  const buttonSize = variant === 'hero' ? 'h-12 w-12' : 'h-9 w-9';
  const iconSize = variant === 'hero' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
      className={`flex items-center gap-1 bg-surface-2 rounded-none ${barPadding} ${className}`}
    >
      <div className={`flex-1 min-w-0 flex items-center gap-2 rounded-none hover:bg-surface-3 trivara-transition ${locationPadding}`}>
        <input
          type="text"
          placeholder="Search destinations"
          aria-label="Where"
          value={locationValue}
          onChange={(e) => setLocationValue(e.target.value)}
          className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-text-secondary"
        />
      </div>

      <div className="hidden sm:flex items-center flex-shrink-0">
        <DateGuestsFields
          checkIn={checkInValue}
          checkOut={checkOutValue}
          guests={guestsValue}
          onCheckInChange={setCheckInValue}
          onCheckOutChange={setCheckOutValue}
          onGuestsChange={setGuestsValue}
        />
      </div>

      <Button
        type="submit"
        aria-label="Search"
        className={`trivara-btn-primary ${buttonSize} rounded-full flex-shrink-0 p-0`}
      >
        <Search className={iconSize} />
      </Button>
    </form>
  );
}
