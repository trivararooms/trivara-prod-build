import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
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
    <form
      onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
      className={`flex items-center gap-3 bg-surface-2 rounded-full pl-8 pr-2 py-2.5 ${className}`}
    >
      <input
        id="search-location-input"
        type="text"
        placeholder="Search destinations"
        aria-label="Where"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="flex-1 bg-transparent border-0 outline-none text-lg placeholder:text-text-secondary"
      />
      {/* Dates and guest count now live in the Search page's Filters panel instead of here. */}
      <Button
        type="submit"
        aria-label="Search"
        className="trivara-btn-primary h-12 w-12 rounded-full flex-shrink-0 p-0"
      >
        <Search className="h-5 w-5" />
      </Button>
    </form>
  );
}
