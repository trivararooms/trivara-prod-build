interface LogoMarkProps {
  className?: string;
}

// Brand mark: the Arctic tern on its own black ground, cropped to a round
// badge (public/brand/tern-mark.png, made from public/brand/arctic-tern.png).
// The bird is white, so it always sits on its black badge rather than on
// the page colour, where it would disappear.
export function LogoMark({ className = 'h-8 w-8' }: LogoMarkProps) {
  return (
    <img
      src="/brand/tern-mark-180.png"
      srcSet="/brand/tern-mark-180.png 1x, /brand/tern-mark.png 3x"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`shrink-0 rounded-full border-2 border-foreground object-cover ${className}`}
    />
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
      <LogoMark className={markClassName} />
      <span
        className={`font-ui font-bold tracking-[0.1em] leading-none ${color ? '' : 'text-foreground'} ${nameClassName}`}
        style={{ fontStretch: '118%', ...(color ? { color } : {}) }}
      >
        TRIVARASTAYS
      </span>
    </span>
  );
}
