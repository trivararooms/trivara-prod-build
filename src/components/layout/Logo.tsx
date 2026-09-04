interface LogoMarkProps {
  className?: string;
  color?: string;
}

// Official brand mark: bird (wing + head + tail feather) with an amber
// beak, confirmed against the user's reference image. Deliberately not
// colored from the indigo/chestnut theme tokens - the mark itself is a
// fixed asset, independent of whatever the site's background/theme is
// doing elsewhere. Defaults to --foreground (off-white) so it still adapts
// if the app ever gains a light theme, but callers can override it (e.g.
// the homepage header wants it black) - the amber beak stays fixed either
// way, it's a brand detail, not a themeable color.
export function LogoMark({ className = 'h-8 w-8', color = 'hsl(var(--foreground))' }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <polygon points="46,4 10,66 52,52" fill={color} />
      <path d="M50 50 C58 47, 66 49, 70 56 C73 62, 70 68, 61 68 C53 68, 47 59, 50 50 Z" fill={color} />
      <circle cx="76" cy="54" r="9" fill={color} />
      <polygon points="84,52 100,55 84,58" fill="#e8a13a" />
      <polygon points="14,68 24,64 20,76" fill={color} />
    </svg>
  );
}

interface LogoProps {
  markClassName?: string;
  nameClassName?: string;
  color?: string;
}

export function Logo({ markClassName = 'h-8 w-8', nameClassName = 'text-lg', color }: LogoProps) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark className={markClassName} color={color} />
      <span
        className={`font-sans font-bold tracking-[0.1em] leading-none ${color ? '' : 'text-foreground'} ${nameClassName}`}
        style={color ? { color } : undefined}
      >
        TRIVARASTAYS
      </span>
    </span>
  );
}
