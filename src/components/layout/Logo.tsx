interface LogoMarkProps {
  className?: string;
}

// Official brand mark: white bird (wing + head + tail feather) with an
// amber beak, confirmed against the user's reference image. Deliberately
// not colored from the indigo/chestnut theme tokens - the mark itself is a
// fixed asset, independent of whatever the site's background/theme is
// doing elsewhere. --foreground is used (not a literal white hex) only so
// it still adapts if the app ever gains a light theme; the amber beak is a
// literal hex since nothing in the existing palette matches it.
export function LogoMark({ className = 'h-8 w-8' }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <polygon points="46,4 10,66 52,52" fill="hsl(var(--foreground))" />
      <path d="M50 50 C58 47, 66 49, 70 56 C73 62, 70 68, 61 68 C53 68, 47 59, 50 50 Z" fill="hsl(var(--foreground))" />
      <circle cx="76" cy="54" r="9" fill="hsl(var(--foreground))" />
      <polygon points="84,52 100,55 84,58" fill="#e8a13a" />
      <polygon points="14,68 24,64 20,76" fill="hsl(var(--foreground))" />
    </svg>
  );
}

interface LogoProps {
  markClassName?: string;
  nameClassName?: string;
}

export function Logo({ markClassName = 'h-8 w-8', nameClassName = 'text-lg' }: LogoProps) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark className={markClassName} />
      <span className={`font-sans font-bold tracking-[0.1em] text-foreground leading-none ${nameClassName}`}>
        TRIVARASTAYS
      </span>
    </span>
  );
}
