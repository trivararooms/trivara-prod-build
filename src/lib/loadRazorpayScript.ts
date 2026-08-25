// Loads Razorpay's Checkout.js on demand instead of on every page load.
//
// This used to be a plain <script> tag in index.html, which meant every
// visitor's browser fetched and initialized Razorpay's script on every page
// - including anonymous visits and logged-in browsing that never reaches a
// booking - and it also meant Checkout.js ran (and hit its own CDN for
// sub-resources) even when Razorpay is disabled in app_settings. That's
// what was surfacing as a "Cross-Origin Read Blocking" / 403 console error
// on pages that have nothing to do with booking.
//
// Call this right before opening the Razorpay modal (see ListingDetail.tsx)
// instead. The promise is memoized so a second booking attempt in the same
// session doesn't re-fetch/re-inject the script.

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let loadPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve(true);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      // Let the caller retry on a later attempt instead of getting stuck on
      // a permanently-failed promise (e.g. a transient network blip).
      loadPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
