interface Destination {
  city: string;
  state: string;
  listings: number;
  image: string;
}

interface DestinationPanelsProps {
  destinations: Destination[];
  activeCity: string;
  onSelect: (city: string) => void;
}

/**
 * Popular destinations as tall rounded panels that expand on hover (and
 * stay expanded while selected). Selecting one filters the live
 * "Every stay, on the map" section below instead of leaving the page.
 */
export function DestinationPanels({ destinations, activeCity, onSelect }: DestinationPanelsProps) {
  return (
    <div className="flex h-auto flex-col gap-3 md:h-[520px] md:flex-row">
      {destinations.map((dest) => {
        const active = activeCity.toLowerCase() === dest.city.toLowerCase();
        return (
          <button
            key={`${dest.city}-${dest.state}`}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? '' : dest.city)}
            className={`group nu relative h-28 flex-1 overflow-hidden rounded-[30px] text-left text-white transition-[flex,height] duration-700 ease-[cubic-bezier(.2,.7,.2,1)] hover:h-56 hover:flex-[3.6] md:h-auto md:hover:h-auto ${
              active ? 'h-56 flex-[3.6] outline outline-[3px] -outline-offset-[3px] outline-accent md:h-auto' : ''
            }`}
          >
            <img
              src={dest.image}
              alt=""
              loading="lazy"
              className={`absolute inset-0 h-full w-full object-cover transition-[transform,filter] duration-[1200ms] group-hover:scale-105 group-hover:[filter:none] ${
                active ? 'scale-105 [filter:none]' : '[filter:brightness(.62)_saturate(.8)]'
              }`}
            />
            <span className="absolute inset-x-5 bottom-[22px]">
              <b className="block whitespace-nowrap font-display text-[34px] font-light leading-none">{dest.city}</b>
              <span
                className={`mt-2 inline-block max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-black/45 px-0 py-1 font-ui text-[11px] font-bold backdrop-blur-md transition-all duration-500 group-hover:max-w-[240px] group-hover:px-3 ${
                  active ? 'max-w-[240px] px-3' : ''
                }`}
              >
                {dest.listings} {dest.listings === 1 ? 'stay' : 'stays'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
