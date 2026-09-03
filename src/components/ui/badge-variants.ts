import { cva } from "class-variance-authority";

// Split out from badge.tsx so that file only exports the Badge component -
// having a component and a plain value (cva variants) exported from the same
// file breaks Vite's fast-refresh isolation (react-refresh/only-export-components).
export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-morderline text-[10px] tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
