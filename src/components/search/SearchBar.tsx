import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays } from 'date-fns';
import { CounterInput } from '@/components/ui/CounterInput';

interface SearchBarProps {
  variant?: 'hero' | 'compact';
  className?: string;
}

export function SearchBar({ variant = 'hero', className = '' }: SearchBarProps) {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState<Date | undefined>();
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [guests, setGuests] = useState(1);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    if (checkIn) params.set('checkIn', checkIn.toISOString());
    if (checkOut) params.set('checkOut', checkOut.toISOString());
    params.set('guests', guests.toString());
    navigate(`/search?${params.toString()}`);
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 bg-surface-2 rounded-full px-4 py-2 ${className}`}>
        <Search className="h-4 w-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Search destinations"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-transparent border-0 outline-none text-sm flex-1 placeholder:text-text-secondary"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>
    );
  }

  return (
    <div className={`bg-surface-2 rounded-2xl p-2 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {/* Location */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-3 trivara-transition cursor-pointer"
          onClick={() => {
            const input = document.getElementById('search-location-input');
            if (input) input.focus();
          }}
        >
          <MapPin className="h-5 w-5 text-text-secondary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-text-meta mb-0.5 cursor-pointer">Where</label>
            <input
              id="search-location-input"
              type="text"
              placeholder="Search destinations"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-text-secondary"
            />
          </div>
        </div>

        {/* Check In */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-3 trivara-transition cursor-pointer">
              <Calendar className="h-5 w-5 text-text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-text-meta mb-0.5">Check in</label>
                <span className={`text-sm ${checkIn ? 'text-foreground' : 'text-text-secondary'}`}>
                  {checkIn ? format(checkIn, 'MMM d') : 'Add dates'}
                </span>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
            <CalendarComponent
              mode="single"
              selected={checkIn}
              onSelect={(date) => {
                setCheckIn(date);
                if (date && (!checkOut || checkOut <= date)) {
                  setCheckOut(addDays(date, 1));
                }
              }}
              disabled={(date) => date < new Date()}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Check Out */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-3 trivara-transition cursor-pointer">
              <Calendar className="h-5 w-5 text-text-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-text-meta mb-0.5">Check out</label>
                <span className={`text-sm ${checkOut ? 'text-foreground' : 'text-text-secondary'}`}>
                  {checkOut ? format(checkOut, 'MMM d') : 'Add dates'}
                </span>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
            <CalendarComponent
              mode="single"
              selected={checkOut}
              onSelect={setCheckOut}
              disabled={(date) => date < (checkIn || new Date())}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Guests */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-3 trivara-transition cursor-pointer">
                <Users className="h-5 w-5 text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-text-meta mb-0.5">Guests</label>
                  <span className="text-sm">
                    {guests} {guests === 1 ? 'guest' : 'guests'}
                  </span>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-card border-border" align="end">
              <div className="flex items-center justify-between">
                <span className="text-sm">Guests</span>
                <div className="flex items-center gap-3">
                  <CounterInput
                    value={guests}
                    onChange={setGuests}
                    min={1}
                    max={16}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            className="trivara-btn-primary h-12 w-12 rounded-xl flex-shrink-0"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
