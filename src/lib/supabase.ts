import { createClient } from '@supabase/supabase-js';

// supabase-js coordinates every request it makes - auth token refresh, REST
// queries, RPC calls, all of it - through the same underlying client state
// (see AuthContext.tsx for the fuller explanation of the Web Locks issue
// this works around). When that gets wedged, ANY call through this client
// can hang forever with no error and no timeout of its own - not just the
// one getSession() call AuthContext already races against a timeout, but
// every page/service that calls .from(...)/.rpc(...)/.storage on this same
// client. That's why the "stuck loading" bug kept resurfacing on different
// pages even after fixing it in AuthContext specifically: the real hang can
// happen anywhere a request goes out, most reliably reproduced by leaving a
// tab open long enough for the session to need a refresh and then reloading.
//
// Overriding fetch here with a hard timeout means every request this client
// makes is guaranteed to settle - resolve or reject - within
// FETCH_TIMEOUT_MS. A wedged call becomes a normal, catchable error instead
// of a permanent hang, and the try/catch/finally blocks already throughout
// the service layer take it from there (clearing loading state, showing an
// empty/error state) instead of spinning forever. This doesn't fix the
// underlying Web Locks quirk - that's a browser/library-level issue outside
// our control - it just puts a ceiling on how long any single request is
// allowed to hang before the app recovers on its own.
const FETCH_TIMEOUT_MS = 15000;

function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  // Respect a caller-supplied signal too - abort on whichever fires first.
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: timeoutFetch,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      }
    }
  }
);

