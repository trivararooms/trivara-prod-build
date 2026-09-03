interface LogoMarkProps {
  className?: string;
}

// Placeholder brand mark (indigo wing/head/tail, white body, chestnut beak) -
// not an official asset yet, swap the <svg> below out once one exists.
export function LogoMark({ className = 'h-8 w-8' }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <polygon points="46,4 10,66 52,52" fill="hsl(var(--primary))" />
      <path d="M50 50 C58 47, 66 49, 70 56 C73 62, 70 68, 61 68 C53 68, 47 59, 50 50 Z" fill="hsl(var(--foreground))" />
      <circle cx="76" cy="54" r="9" fill="hsl(var(--primary))" />
      <polygon points="84,52 100,55 84,58" fill="hsl(var(--accent))" />
      <polygon points="14,68 24,64 20,76" fill="hsl(var(--primary))" />
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
