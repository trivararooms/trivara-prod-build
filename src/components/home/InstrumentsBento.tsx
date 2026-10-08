// "Built like instruments, not brochures." - static product copy, only
// describing behaviour the platform already has (guest/pet rules, itemised
// pricing, Instant Book vs Request, verified hosts, category reviews).

const card = 'nu rv relative flex flex-col justify-between overflow-hidden p-[26px]';
const tag = 'font-ui text-[11px] font-bold uppercase tracking-[0.14em] opacity-65';
const pillRow = 'flex justify-between rounded-full bg-background px-3.5 py-2 shadow-[inset_2px_2px_6px_var(--nu-lo),inset_-2px_-2px_6px_var(--nu-hi)]';

export function InstrumentsBento() {
  return (
    <div className="grid auto-rows-[210px] grid-cols-2 gap-[18px] lg:grid-cols-6">
      <div className={`${card} col-span-2 bg-accent text-accent-foreground lg:col-span-3 lg:row-span-2`} style={{ background: 'hsl(var(--accent))' }}>
        <div>
          <span className={tag}>01 · Guests</span>
          <h3 className="mt-3">Adults, children, infants — and pets.</h3>
        </div>
        <div>
          <p className="mb-4 max-w-[34ch] text-sm opacity-80">
            Infants never count against capacity. Bringing a dog? We only show homes that say yes.
          </p>
          <div className="font-display text-[96px] font-light italic leading-[0.9]">
            + − <span className="text-[40px] not-italic">🐾</span>
          </div>
        </div>
      </div>

      <div className={`${card} col-span-2 lg:col-span-3`}>
        <div>
          <span className={tag}>02 · Pricing</span>
          <h3 className="mt-2">
            Every rupee <em className="text-text-secondary">itemised.</em>
          </h3>
        </div>
        <div className="grid gap-2 font-ui text-xs font-semibold text-text-secondary">
          <div className={pillRow}><span>₹8,400 × 3 nights</span><span>₹25,200</span></div>
          <div className={pillRow}><span>First-stay offer · 10%</span><span>−₹2,520</span></div>
          <div className={`${pillRow} text-foreground`}><span>Total</span><span>₹24,235</span></div>
        </div>
      </div>

      <div className={`${card} col-span-2 lg:col-span-2`}>
        <span className={tag}>03 · Booking</span>
        <div>
          <h3>
            Instant Book <em className="text-text-secondary">or</em> Request.
          </h3>
          <p className="mt-2 max-w-[34ch] text-sm text-text-secondary">Hosts choose per listing. You always see which, before you pay.</p>
        </div>
      </div>

      <div className={`${card} lg:col-span-1`}>
        <span className={tag}>04 · Trust</span>
        <div className="font-display text-[64px] font-light italic leading-[0.9]">✓</div>
        <p className="text-sm text-text-secondary">Verified hosts</p>
      </div>

      <div className={`${card} col-span-2 lg:col-span-3`}>
        <span className={tag}>05 · Reviews</span>
        <div className="grid gap-2 font-ui text-xs font-semibold text-text-secondary">
          <div className={pillRow}><span>Cleanliness</span><span className="text-foreground">4.9</span></div>
          <div className={pillRow}><span>Accuracy</span><span className="text-foreground">4.8</span></div>
          <div className={pillRow}><span>Communication</span><span className="text-foreground">5.0</span></div>
          <div className={pillRow}><span>Value · Location</span><span className="text-foreground">4.6 · 4.9</span></div>
        </div>
      </div>

      <div className={`${card} col-span-2 lg:col-span-3`}>
        <div className="flex items-center justify-between">
          <span className={tag}>06 · Planner</span>
          <span className="flex gap-1.5">
            {['Dates', 'Guests', 'Pets'].map((k) => (
              <span key={k} className="nu-chip rounded-full px-2.5 py-1 font-ui text-[11px] font-semibold">{k}</span>
            ))}
          </span>
        </div>
        <div>
          <h3>
            Plan it in one place. <em className="text-text-secondary">No pop-ups.</em>
          </h3>
          <p className="mt-2 max-w-[34ch] text-sm text-text-secondary">Pick dates, set guests and pets, and watch results update live.</p>
        </div>
      </div>
    </div>
  );
}
