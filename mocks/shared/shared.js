/* Shared data + behaviours for the 3 Trivara mocks. Data mirrors what the backend supports:
   listings (price/night INR, max guests, property type, rating, instant-book vs request, pets, amenity ids,
   accessibility ids, cancellation tier, is_featured), discount_rules (first-time user), saved_listings,
   host verified badge, per-category review scores, conversations (message host). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

  const THEMES = [
    { id: 'paper', name: 'Paper', sw: ['#F6F1E7', '#F9B312'] },
    { id: 'chalk', name: 'Chalk', sw: ['#FFFFFF', '#E8412C'] },
    { id: 'obsidian', name: 'Obsidian', sw: ['#09090B', '#FFB020'] },
    { id: 'forest', name: 'Forest', sw: ['#0E1912', '#C8E86B'] },
    { id: 'ocean', name: 'Ocean', sw: ['#E9F0F7', '#1E5BFF'] },
  ];

  const AM = { wifi: 'Wifi', kitchen: 'Kitchen', parking: 'Free parking', pool: 'Pool', hot_tub: 'Hot tub', air_conditioning: 'Air conditioning',
    workspace: 'Dedicated workspace', fireplace: 'Fireplace', beach_access: 'Beach access', patio: 'Patio', bbq: 'BBQ grill',
    outdoor_dining: 'Outdoor dining', pets_allowed: 'Pets allowed', step_free_access: 'Step-free access', wide_doorways: 'Wide doorways', accessible_bathroom: 'Accessible bathroom' };

  const DESTS = [
    { id: 'Coorg', tag: 'Coffee hills', n: 38, hue: 150 }, { id: 'Hampi', tag: 'Boulder ruins', n: 21, hue: 28 },
    { id: 'Gokarna', tag: 'Cliff beaches', n: 17, hue: 200 }, { id: 'Chikkamagaluru', tag: 'Estates', n: 29, hue: 95 },
    { id: 'Mysuru', tag: 'Heritage', n: 24, hue: 12 }, { id: 'Kabini', tag: 'Forest & river', n: 12, hue: 120 },
    { id: 'Bengaluru', tag: 'City stays', n: 64, hue: 255 },
  ];

  const L = [
    { id: 'l1', t: 'Mist Estate Villa', city: 'Coorg', loc: 'Madikeri, Karnataka', type: 'Villa', price: 8400, r: 4.9, rc: 212, g: 6, bd: 3, instant: true, pets: true, feat: true, hue: 150, lat: 12.42, lng: 75.74, pol: 'Moderate',
      am: ['wifi', 'kitchen', 'parking', 'fireplace', 'patio', 'bbq', 'pets_allowed'], host: 'Ananya R.', blurb: 'Teak-floored estate house wrapped in coffee and silver oak. Wake up inside a cloud.' },
    { id: 'l2', t: 'Boulder Loft', city: 'Hampi', loc: 'Hospet, Karnataka', type: 'Loft', price: 3200, r: 4.8, rc: 148, g: 2, bd: 1, instant: false, pets: false, feat: true, hue: 28, lat: 15.33, lng: 76.46, pol: 'Flexible',
      am: ['wifi', 'air_conditioning', 'workspace', 'patio'], host: 'Kiran M.', blurb: 'Stone-and-lime loft balanced between granite boulders. Sunrise over the Tungabhadra.' },
    { id: 'l3', t: 'Cliff House', city: 'Gokarna', loc: 'Gokarna, Karnataka', type: 'House', price: 6900, r: 4.7, rc: 96, g: 4, bd: 2, instant: true, pets: false, feat: true, hue: 200, lat: 14.55, lng: 74.32, pol: 'Moderate',
      am: ['wifi', 'beach_access', 'kitchen', 'patio', 'outdoor_dining', 'air_conditioning'], host: 'Sana D.', blurb: 'Open-air living room on a laterite cliff. A private path to a quiet cove.' },
    { id: 'l4', t: 'Coffee Cottage', city: 'Chikkamagaluru', loc: 'Chikkamagaluru, Karnataka', type: 'Cottage', price: 4800, r: 4.9, rc: 184, g: 4, bd: 2, instant: true, pets: true, feat: true, hue: 95, lat: 13.32, lng: 75.77, pol: 'Flexible',
      am: ['wifi', 'kitchen', 'parking', 'fireplace', 'pets_allowed', 'step_free_access'], host: 'Rohan P.', blurb: 'Plantation cottage with a verandah made for filter coffee and monsoon.' },
    { id: 'l5', t: 'Heritage Haveli', city: 'Mysuru', loc: 'Mysuru, Karnataka', type: 'Heritage', price: 5600, r: 4.6, rc: 77, g: 5, bd: 3, instant: false, pets: false, feat: true, hue: 12, lat: 12.3, lng: 76.65, pol: 'Strict',
      am: ['wifi', 'air_conditioning', 'kitchen', 'parking', 'wide_doorways', 'accessible_bathroom'], host: 'Meera V.', blurb: 'A courtyard house from 1932, restored by hand. Rosewood, red oxide, quiet.' },
    { id: 'l6', t: 'Riverside Tent', city: 'Kabini', loc: 'H.D. Kote, Karnataka', type: 'Tent', price: 7200, r: 4.8, rc: 119, g: 3, bd: 1, instant: true, pets: false, feat: false, hue: 120, lat: 11.95, lng: 76.35, pol: 'Moderate',
      am: ['wifi', 'outdoor_dining', 'bbq', 'patio'], host: 'Dev S.', blurb: 'Canvas suite on the Kabini backwaters. Elephants come to drink at dusk.' },
    { id: 'l7', t: 'Indiranagar Studio', city: 'Bengaluru', loc: 'Indiranagar, Bengaluru', type: 'Studio', price: 2900, r: 4.5, rc: 233, g: 2, bd: 1, instant: true, pets: false, feat: false, hue: 255, lat: 12.97, lng: 77.64, pol: 'Flexible',
      am: ['wifi', 'workspace', 'air_conditioning', 'kitchen', 'step_free_access', 'gym_access'], host: 'Isha K.', blurb: 'Light-filled studio, fast wifi, and a proper desk. Walk to every good coffee shop.' },
    { id: 'l8', t: 'Plantation Pool Retreat', city: 'Chikkamagaluru', loc: 'Sakleshpur, Karnataka', type: 'Villa', price: 11200, r: 4.9, rc: 64, g: 8, bd: 4, instant: false, pets: true, feat: false, hue: 170, lat: 12.94, lng: 75.78, pol: 'Strict',
      am: ['wifi', 'pool', 'kitchen', 'parking', 'hot_tub', 'bbq', 'pets_allowed', 'outdoor_dining'], host: 'Arjun N.', blurb: 'Infinity pool over a green valley. Staff, a cook, and nothing on the calendar.' },
  ];

  /* generated "photograph": layered landscape, deterministic per listing + variant */
  function art(l, v = 0, w = 800, h = 600) {
    const hh = (l.hue + v * 24) % 360, id = `a${l.id}${v}`;
    const sunx = 120 + ((v * 211 + l.hue * 3) % 520), suny = 120 + (v * 37) % 100;
    const water = ['Gokarna', 'Kabini'].includes(l.city);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hh},55%,${v % 2 ? 62 : 76}%)"/><stop offset="1" stop-color="hsl(${(hh + 28) % 360},70%,${v % 2 ? 78 : 90}%)"/></linearGradient>
      <radialGradient id="${id}g"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#${id}s)"/>
      <circle cx="${sunx}" cy="${suny}" r="120" fill="url(#${id}g)"/><circle cx="${sunx}" cy="${suny}" r="34" fill="hsl(${(hh + 40) % 360},90%,92%)"/>
      <path d="M0 ${h * .62} Q ${w * .2} ${h * .42} ${w * .42} ${h * .58} T ${w} ${h * .5} V${h} H0Z" fill="hsl(${hh},28%,48%)" opacity=".8"/>
      <path d="M0 ${h * .7} Q ${w * .3} ${h * .5} ${w * .6} ${h * .68} T ${w} ${h * .6} V${h} H0Z" fill="hsl(${hh},32%,34%)"/>
      ${water ? `<rect y="${h * .78}" width="${w}" height="${h * .22}" fill="hsl(${hh},45%,60%)" opacity=".85"/><path d="M0 ${h * .84}H${w}M0 ${h * .9}H${w}" stroke="#fff" stroke-opacity=".35" stroke-dasharray="40 30"/>` :
      `<path d="M0 ${h * .82} Q ${w * .4} ${h * .66} ${w} ${h * .8} V${h} H0Z" fill="hsl(${hh},36%,22%)"/>`}
      <g fill="hsl(${hh},30%,12%)"><rect x="${w * .56}" y="${h * .6}" width="${w * .14}" height="${h * .12}"/><path d="M${w * .54} ${h * .6} L${w * .63} ${h * .5} L${w * .72} ${h * .6}Z"/><rect x="${w * .6}" y="${h * .64}" width="14" height="22" fill="hsl(${(hh + 40) % 360},90%,75%)"/></g>
      <filter id="${id}n"><feTurbulence baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .08 0"/></filter><rect width="${w}" height="${h}" filter="url(#${id}n)"/></svg>`;
    return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
  }

  /* ---------- state ---------- */
  const S = { f: new Set(), sort: 'rec', dest: 'all', max: 12000, q: '', range: { s: null, e: null }, g: { adults: 2, children: 0, infants: 0, pets: 0 } };
  const saved = new Set(JSON.parse((() => { try { return localStorage.getItem('tv-saved') || '[]'; } catch (e) { return '[]'; } })()));
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const load = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  const FILTERS = { instant: l => l.instant, pets: l => l.pets, pool: l => l.am.includes('pool'), wifi: l => l.am.includes('wifi'),
    workspace: l => l.am.includes('workspace'), stepfree: l => l.am.includes('step_free_access'), beach: l => l.am.includes('beach_access') };

  function filtered() {
    let r = L.filter(l => [...S.f].every(k => FILTERS[k](l)) && l.price <= S.max && (S.dest === 'all' || l.city === S.dest) &&
      l.g >= S.g.adults + S.g.children && (!S.g.pets || l.pets) && (!S.q || (l.t + l.loc + l.city + l.type).toLowerCase().includes(S.q.toLowerCase())));
    const by = { rec: (a, b) => b.rc - a.rc, lo: (a, b) => a.price - b.price, hi: (a, b) => b.price - a.price, top: (a, b) => b.r - a.r, new: (a, b) => b.id.localeCompare(a.id) }[S.sort];
    return r.sort(by);
  }

  /* ---------- theme ---------- */
  function initThemes(mock) {
    const key = 'tv-theme-' + mock;
    const set = id => {
      document.documentElement.dataset.theme = id; store(key, id);
      $$('.themes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id));
      document.dispatchEvent(new CustomEvent('themechange', { detail: id }));
    };
    $$('.themes').forEach(c => {
      c.innerHTML = THEMES.map(t => `<button data-id="${t.id}" title="${t.name}" aria-label="${t.name} theme"><i style="background:${t.sw[0]}"></i><i style="background:${t.sw[1]}"></i></button>`).join('');
      c.onclick = e => { const b = e.target.closest('button'); if (b) set(b.dataset.id); };
    });
    set(load(key) || new URLSearchParams(location.search).get('theme') || 'paper');
  }

  /* ---------- date range ---------- */
  const BOOKED = new Set(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-27', '2026-11-03']);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  function rangeCal(el, months = 1) {
    let y = 2026, m = 9;
    const today = new Date(2026, 9, 7);
    const draw = () => {
      const blocks = [];
      for (let k = 0; k < months; k++) {
        const base = new Date(y, m + k, 1), first = (base.getDay() + 6) % 7, dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        let cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<div class="rc-w">${d}</div>`).join('') + '<div></div>'.repeat(first);
        for (let d = 1; d <= dim; d++) {
          const dt = new Date(base.getFullYear(), base.getMonth(), d), s = S.range.s, e = S.range.e;
          const off = dt < today || BOOKED.has(iso(dt));
          const cls = ['rc-d', off ? 'off' : '', s && +dt === +s ? 's' : '', e && +dt === +e ? 'e' : '', s && e && dt > s && dt < e ? 'in' : '', s && e && +dt === +s ? 'in' : '', s && e && +dt === +e ? 'in' : ''].join(' ');
          cells += `<div class="${cls}"><button ${off ? 'disabled' : ''} data-d="${iso(dt)}">${d}</button></div>`;
        }
        blocks.push(`<div class="rc-m"><div class="rc-h">${k === 0 ? '<button data-n="-1" aria-label="Previous month">‹</button>' : '<span></span>'}<span>${base.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>${k === months - 1 ? '<button data-n="1" aria-label="Next month">›</button>' : '<span></span>'}</div><div class="rc-g">${cells}</div></div>`);
      }
      el.innerHTML = `<div class="rc">${blocks.join('')}</div><div class="rc-note">Struck-through dates are already booked.</div>`;
    };
    el.onclick = e => {
      const n = e.target.closest('[data-n]'); if (n) { m += +n.dataset.n; if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; } draw(); return; }
      const b = e.target.closest('[data-d]'); if (!b || b.disabled) return;
      const d = new Date(b.dataset.d + 'T00:00'), { s, e: en } = S.range;
      if (!s || (s && en)) S.range = { s: d, e: null };
      else if (d <= s) S.range = { s: d, e: null };
      else { let blocked = false; for (let t = new Date(s); t < d; t.setDate(t.getDate() + 1)) if (BOOKED.has(iso(t))) blocked = true; S.range = blocked ? { s: d, e: null } : { s, e: d }; }
      draw(); sync();
    };
    draw();
  }
  const nights = () => S.range.s && S.range.e ? Math.round((S.range.e - S.range.s) / 864e5) : 0;
  const dateText = () => !S.range.s ? 'Add dates' : !S.range.e ? fmt(S.range.s) + ' → …' : `${fmt(S.range.s)} → ${fmt(S.range.e)} · ${nights()}n`;
  const gText = () => { const n = S.g.adults + S.g.children, p = S.g.pets; return `${n} guest${n > 1 ? 's' : ''}${S.g.infants ? ` · ${S.g.infants} infant${S.g.infants > 1 ? 's' : ''}` : ''}${p ? ` · ${p} pet${p > 1 ? 's' : ''}` : ''}`; };

  /* ---------- guests ---------- */
  const GMAX = { adults: 12, children: 8, infants: 5, pets: 3 }, GMIN = { adults: 1, children: 0, infants: 0, pets: 0 };
  function guestsMarkup() {
    const rows = [['adults', 'Adults', 'Age 13+'], ['children', 'Children', 'Ages 2–12'], ['infants', 'Infants', 'Under 2 · not counted in capacity'], ['pets', 'Pets', 'Only pet-friendly stays']];
    return rows.map(([k, a, b]) => `<div class="gst" data-k="${k}"><div><b>${a}</b><small>${b}</small></div><div class="ctl"><button data-d="-1" aria-label="Fewer ${a}">−</button><output>${S.g[k]}</output><button data-d="1" aria-label="More ${a}">+</button></div></div>`).join('');
  }
  function bindGuests(root) {
    root.innerHTML = guestsMarkup();
    const draw = () => $$('.gst', root).forEach(r => { const k = r.dataset.k; $('output', r).textContent = S.g[k]; $('[data-d="-1"]', r).disabled = S.g[k] <= GMIN[k]; $('[data-d="1"]', r).disabled = S.g[k] >= GMAX[k]; });
    root.onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; const k = b.closest('.gst').dataset.k; S.g[k] = Math.min(GMAX[k], Math.max(GMIN[k], S.g[k] + +b.dataset.d)); draw(); sync(); };
    draw();
  }

  /* ---------- sync hooks ---------- */
  const listeners = [];
  const onChange = fn => listeners.push(fn);
  function sync() { $$('[data-dates]').forEach(e => e.textContent = dateText()); $$('[data-gsum]').forEach(e => e.textContent = gText()); listeners.forEach(f => f()); }

  function bindFilters() {
    $$('[data-f]').forEach(b => b.onclick = () => { const k = b.dataset.f; S.f.has(k) ? S.f.delete(k) : S.f.add(k); $$(`[data-f="${k}"]`).forEach(x => x.classList.toggle('on', S.f.has(k))); sync(); });
    $$('[data-sort]').forEach(s => s.onchange = () => { S.sort = s.value; sync(); });
    $$('[data-price]').forEach(s => s.oninput = () => { S.max = +s.value; $$('[data-price-out]').forEach(o => o.textContent = S.max >= 12000 ? '₹12,000+' : inr(S.max)); sync(); });
    $$('[data-dest]').forEach(b => b.onclick = () => { S.dest = S.dest === b.dataset.dest ? 'all' : b.dataset.dest; $$('[data-dest]').forEach(x => x.classList.toggle('on', x.dataset.dest === S.dest)); sync(); toast(S.dest === 'all' ? 'All of Karnataka' : S.dest); });
    $$('[data-q]').forEach(i => i.oninput = () => { S.q = i.value; sync(); });
  }

  /* ---------- hover link: list <-> map ---------- */
  function hot(id, on) { $$(`[data-id="${id}"]`).forEach(e => e.classList.toggle('hot', on)); }
  document.addEventListener('mouseover', e => { const t = e.target.closest('[data-id]'); if (t && !t.dataset.nohot) hot(t.dataset.id, true); });
  document.addEventListener('mouseout', e => { const t = e.target.closest('[data-id]'); if (t && !t.dataset.nohot) hot(t.dataset.id, false); });

  /* ---------- map ---------- */
  const OUT = [[74.1, 15.3], [74.4, 16.3], [74.9, 17.2], [75.7, 17.9], [76.4, 18.4], [77.2, 18.2], [77.6, 17.4], [77.3, 16.4], [77.4, 15.7], [77.2, 15.0], [77.6, 14.3], [78.0, 13.7], [78.5, 13.2], [78.3, 12.6], [77.8, 12.1], [77.2, 11.7], [76.5, 11.6], [75.9, 11.9], [75.6, 12.5], [75.0, 13.3], [74.6, 14.2]];
  const P = (lng, lat) => [((lng - 73.8) / 5) * 400, ((18.7 - lat) / 7.4) * 520];
  function mountMap(el, onPick) {
    const draw = () => {
      const list = filtered();
      const city = [['Bengaluru', 77.59, 12.97], ['Mysuru', 76.64, 12.3], ['Hampi', 76.46, 15.33], ['Mangaluru', 74.85, 12.91], ['Belagavi', 74.5, 15.85]];
      const pins = list.map(l => { const [x, y] = P(l.lng, l.lat), t = inr(l.price), w = t.length * 7 + 16;
        return `<g class="pin" data-id="${l.id}" transform="translate(${x},${y})"><rect x="${-w / 2}" y="-12" width="${w}" height="24"/><text y="4">${t}</text></g>`; }).join('');
      el.innerHTML = `<svg viewBox="0 0 400 520" role="img" aria-label="Map of stays across Karnataka"><g class="grid">${[...Array(9)].map((_, i) => `<line x1="0" x2="400" y1="${i * 65}" y2="${i * 65}"/><line y1="0" y2="520" x1="${i * 50}" x2="${i * 50}"/>`).join('')}</g>
      <path class="land" d="M${OUT.map(p => P(...p).join(',')).join('L')}Z"/>${city.map(([n, a, b]) => { const [x, y] = P(a, b); return `<circle cx="${x}" cy="${y}" r="2" fill="var(--ink2)"/><text class="city" x="${x + 6}" y="${y + 3}">${n}</text>`; }).join('')}${pins}</svg>`;
    };
    el.onclick = e => { const p = e.target.closest('.pin'); if (p) onPick && onPick(p.dataset.id); };
    onChange(draw); draw();
  }

  /* ---------- hearts ---------- */
  const heartSvg = '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.4 12 21 12 21Z"/></svg>';
  const heart = id => `<button class="heart ${saved.has(id) ? 'on' : ''}" data-save="${id}" aria-label="Save stay" aria-pressed="${saved.has(id)}">${heartSvg}</button>`;
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-save]'); if (!h) return; e.stopImmediatePropagation();
    const id = h.dataset.save; saved.has(id) ? saved.delete(id) : saved.add(id); store('tv-saved', JSON.stringify([...saved]));
    $$(`[data-save="${id}"]`).forEach(x => { x.classList.toggle('on', saved.has(id)); x.setAttribute('aria-pressed', saved.has(id)); });
    toast(saved.has(id) ? 'Saved to your wishlist' : 'Removed from wishlist'); $$('[data-saved-n]').forEach(n => n.textContent = saved.size);
  });

  /* ---------- toast ---------- */
  let tt; function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 1800); }

  /* ---------- pricing (mock figures; first-time-user discount_rule = 10%) ---------- */
  function quote(l) {
    const n = Math.max(nights(), 1), sub = l.price * n, off = Math.round(sub * .1), fee = Math.round((sub - off) * .06);
    return { n, sub, off, fee, total: sub - off + fee };
  }

  /* ---------- listing detail dialog (structure shared, skin per mock) ---------- */
  function detail(id) {
    const l = L.find(x => x.id === id); if (!l) return;
    let d = $('#dlg'); if (!d) { d = document.createElement('div'); d.id = 'dlg'; d.className = 'dlg'; document.body.appendChild(d); d.onclick = e => { if (e.target === d || e.target.closest('[data-close]')) d.classList.remove('open'); }; document.addEventListener('keydown', e => { if (e.key === 'Escape') d.classList.remove('open'); }); }
    const q = quote(l), cats = [['Cleanliness', 4.9], ['Accuracy', 4.8], ['Communication', 5.0], ['Value', 4.6], ['Location', 4.9]];
    const sim = L.filter(x => x.id !== l.id && x.city === l.city || x.type === l.type && x.id !== l.id).slice(0, 3);
    d.innerHTML = `<div class="dlg-in"><div class="dlg-x"><span style="font:12px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink2)">${l.city} / ${l.type}</span><div style="display:flex;gap:8px"><button>Share</button><button data-close>Close ✕</button></div></div>
      <div class="d-gal">${[0, 1, 2, 3, 4].map(v => `<div style="background-image:${art(l, v)}"></div>`).join('')}</div>
      <div class="d-body"><div>
        <h2>${l.t}</h2><p class="d-meta">${l.type} in ${l.loc} · up to ${l.g} guests · ${l.bd} bedroom${l.bd > 1 ? 's' : ''}</p>
        <div class="d-badges"><span class="ok">★ ${l.r} · ${l.rc} reviews</span><span>✓ Verified host · ${l.host}</span><span>${l.instant ? '⚡ Instant Book' : '✉ Request to Book'}</span>${l.pets ? '<span>Pets welcome</span>' : ''}</div>
        <p>${l.blurb}</p>
        <h4>What this place offers</h4><ul class="d-am">${l.am.map(a => `<li>${AM[a] || a}</li>`).join('')}</ul>
        <h4>Review breakdown</h4><div class="d-rv">${cats.map(([n, v]) => `<div><span>${n}</span><i style="--w:${v / 5 * 100}%"></i><em>${v.toFixed(1)}</em></div>`).join('')}</div>
        <h4>Cancellation · ${l.pol}</h4><p class="d-pol">${{ Flexible: 'Free cancellation up to 24 hours before check-in.', Moderate: 'Free cancellation up to 5 days before check-in; 50% after.', Strict: '50% refund up to 7 days before check-in; none after.' }[l.pol]}</p>
        <h4>Similar stays</h4><div style="display:flex;gap:10px;flex-wrap:wrap">${sim.map(s => `<button class="chip" data-open="${s.id}">${s.t} · ${inr(s.price)}</button>`).join('')}</div>
      </div>
      <aside class="d-book"><div class="pr">${inr(l.price)} <small>/ night</small></div>
        <div class="dts" data-toggle-cal><span data-dates>${dateText()}</span><span>▾</span></div>
        <div class="d-gst" id="dcal" style="padding:14px"></div>
        <div class="dts" data-toggle-g><span data-gsum>${gText()}</span><span>▾</span></div>
        <div class="d-gst" id="dg"></div>
        <div class="d-q"><div><span>${inr(l.price)} × ${q.n} night${q.n > 1 ? 's' : ''}</span><span>${inr(q.sub)}</span></div><div class="off"><span>First-stay offer · 10% off</span><span>−${inr(q.off)}</span></div><div><span>Service fee</span><span>${inr(q.fee)}</span></div><div class="tot"><span>Total</span><span>${inr(q.total)}</span></div></div>
        <button class="btn" data-book>${l.instant ? 'Instant Book · pay with Razorpay' : 'Request to Book'}</button>
        <button class="btn ghost" data-msg>Message ${l.host.split(' ')[0]}</button></aside></div></div>`;
    rangeCal($('#dcal', d), 1); bindGuests($('#dg', d));
    const rerender = () => { if (d.classList.contains('open')) { const q2 = quote(l); const box = $('.d-q', d); if (box) box.innerHTML = `<div><span>${inr(l.price)} × ${q2.n} night${q2.n > 1 ? 's' : ''}</span><span>${inr(q2.sub)}</span></div><div class="off"><span>First-stay offer · 10% off</span><span>−${inr(q2.off)}</span></div><div><span>Service fee</span><span>${inr(q2.fee)}</span></div><div class="tot"><span>Total</span><span>${inr(q2.total)}</span></div>`; } };
    onChange(rerender);
    d.onclick = e => {
      if (e.target === d || e.target.closest('[data-close]')) return d.classList.remove('open');
      if (e.target.closest('[data-toggle-cal]')) return $('#dcal', d).classList.toggle('open');
      if (e.target.closest('[data-toggle-g]')) return $('#dg', d).classList.toggle('open');
      const o = e.target.closest('[data-open]'); if (o) return detail(o.dataset.open);
      if (e.target.closest('[data-book]')) return toast(l.instant ? 'Mock: opens Razorpay checkout' : 'Mock: request sent to host for approval');
      if (e.target.closest('[data-msg]')) return toast('Mock: opens conversation with ' + l.host);
    };
    d.classList.add('open'); d.scrollTop = 0;
  }
  document.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o && !o.closest('#dlg')) detail(o.dataset.open); });

  /* ---------- misc fx ---------- */
  function reveal() { const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12 }); $$('.rv').forEach(e => io.observe(e)); }
  function count() { $$('[data-count]').forEach(el => { const to = +el.dataset.count, dec = +(el.dataset.dec || 0); const io = new IntersectionObserver(([x]) => { if (!x.isIntersecting) return; io.disconnect(); const t0 = performance.now(); const f = t => { const p = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toFixed(dec); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }); io.observe(el); }); }
  function scramble(el, text) {
    const ch = '█▓▒░<>/\\{}[]#$%&*+=?01'; const t0 = performance.now(), D = 900;
    const f = t => { const p = Math.min(1, (t - t0) / D); el.textContent = [...text].map((c, i) => c === ' ' ? ' ' : (i / text.length < p ? c : ch[Math.floor(Math.random() * ch.length)])).join(''); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f);
  }

  window.TV = { $, $$, inr, L, DESTS, AM, S, art, heart, filtered, initThemes, rangeCal, bindGuests, bindFilters, onChange, sync, mountMap, detail, toast, reveal, count, scramble, quote, dateText, gText, nights, THEMES, saved };
})();
