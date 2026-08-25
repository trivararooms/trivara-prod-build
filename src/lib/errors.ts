// Small helper so `catch` blocks don't need `catch (error: any)` just to read
// `.message` off an unknown thrown value. TypeScript's caught value is
// `unknown` by default (or `any` if you type it that way, which defeats the
// point) - this narrows it safely instead.
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}
