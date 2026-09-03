import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  variant?: 'hero' | 'compact';
  className?: string;
}

export function SearchBar({ variant = 'hero', className = '' }: SearchBarProps) {
  const navigate = useNavigate();
  const [location, setLocation] = useState('');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    navigate(`/search?${params.toString()}`);
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 bg-surface-2 rounded-full px-4 py-2 border border-border ${className}`}>
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
    <div className={`bg-surface-2 rounded-2xl p-2 border border-border ${className}`}>
      <div className="flex items-center gap-2">
        {/* Location */}
        <div
          className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-3 trivara-transition cursor-pointer"
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-transparent border-0 outline-none text-sm placeholder:text-text-secondary"
            />
          </div>
        </div>

        {/* Search Button - dates and guest count now live in the Search page's
            Filters panel instead of here. */}
        <Button
          onClick={handleSearch}
          className="trivara-btn-primary h-12 w-12 rounded-xl flex-shrink-0"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
