import { useEffect, useState } from 'react';
import { THEMES, ThemeId, applyTheme, getStoredTheme, THEME_CHANGE_EVENT } from '@/lib/themes';

interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className = '' }: ThemeSwitcherProps) {
  const [active, setActive] = useState<ThemeId>(() => getStoredTheme());

  useEffect(() => {
    const onChange = (e: Event) => setActive((e as CustomEvent<ThemeId>).detail);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  return (
    <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label="Colour scheme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.name}
          aria-label={`${t.name} theme`}
          aria-pressed={active === t.id}
          onClick={() => applyTheme(t.id)}
          className={`relative h-[22px] w-[22px] shrink-0 overflow-hidden rounded-full border-[1.5px] border-foreground/25 transition-transform duration-200 hover:scale-[1.18] ${
            active === t.id ? 'outline outline-2 outline-offset-2 outline-foreground' : ''
          }`}
        >
          <i className="absolute inset-0 block" style={{ background: t.swatch[0], clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <i className="absolute inset-0 block" style={{ background: t.swatch[1], clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
        </button>
      ))}
    </div>
  );
}
