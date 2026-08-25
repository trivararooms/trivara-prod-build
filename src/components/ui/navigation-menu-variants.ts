import { cva } from "class-variance-authority";

// Split out from navigation-menu.tsx so that file only exports components -
// having components and a plain value (cva variant) exported from the same
// file breaks Vite's fast-refresh isolation (react-refresh/only-export-components).
export const navigationMenuTriggerStyle = cva(
  "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
);
