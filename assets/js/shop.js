/* EntXHub store: catalogue, product pages, reviews with AI sentiment, AI recommendations, wishlist, cart,
   checkout (Stripe Checkout, a test-card gateway or cash on delivery) and order tracking.
   Prices, stock, coupons and shipping are always worked out by the API (api/_lib/shop.js). */
(function () {
  'use strict';
  const root = document.getElementById('shop-app'); // absent on title pages, which only use the reviews widget
  if (!window.EntX) return;
  const { api, auth, cart, store, toast, modal, esc, rs, trailerModal, findTitle } = window.EntX;
  const view = root ? root.dataset.view : null;
  const params = new URLSearchParams(location.search);

  // ---------- styles ----------
  const css = document.createElement('style');
  css.textContent = `
  .sx-hero{padding-top:150px;padding-bottom:80px}
  #shop-app span,.entx-extras span,#reviews span{display:inline}
  .sx-stars{white-space:nowrap}
  #shop-app a:not([class]),#shop-app a.sx-accent,#shop-app a.sx-muted,#reviews a:not([class]){display:inline}
  #shop-app input[type=radio],#shop-app input[type=checkbox]{width:auto;display:inline-block;vertical-align:middle}
  #shop-app .sx-dist .bar,#reviews .sx-dist .bar{display:block}
  #shop-app{color:#e8e6e3;font-family:Inter,system-ui,sans-serif}
  #shop-app a{color:inherit}
  .sx-loading{color:#aaa;padding:40px 0;text-align:center}
  .sx-h1{font-size:34px;font-weight:800;color:#fff;margin:0 0 4px}.sx-sub{color:#a9a9b3;margin:0 0 22px}
  .sx-accent{color:hsl(17,68%,58%)}
  .sx-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:18px}
  .sx-chip{border:1px solid #3a3a4a;background:#17171f;color:#ddd;border-radius:99px;padding:7px 14px;font-size:14px;cursor:pointer}
  .sx-chip.on{background:hsl(17,68%,58%);border-color:hsl(17,68%,58%);color:#fff}
  .sx-input,.sx-select{background:#111119;border:1px solid #333344;color:#fff;border-radius:10px;padding:10px 12px;font-size:15px;width:100%}
  .sx-input:focus,.sx-select:focus{outline:2px solid hsl(17,68%,58%);outline-offset:1px}
  .sx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px}
  .sx-card{background:#15151d;border:1px solid #262633;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;position:relative;transition:.2s}
  .sx-card:hover{transform:translateY(-3px);border-color:#3b3b4f}
  .sx-card img{width:100%;aspect-ratio:4/5;object-fit:cover;background:#eee}
  .sx-card .b{padding:12px 14px 14px;display:flex;flex-direction:column;gap:4px;flex:1}
  .sx-card .t{font-weight:700;color:#fff;font-size:16px;text-decoration:none}
  .sx-muted{color:#9a9aa6;font-size:13px}
  .sx-price{font-weight:800;color:#fff;font-size:17px}.sx-was{color:#888;text-decoration:line-through;font-size:13px;margin-left:6px;font-weight:500}
  .sx-badge{position:absolute;left:10px;top:10px;background:#e0412f;color:#fff;font-size:12px;font-weight:700;padding:3px 8px;border-radius:99px}
  .sx-heart{position:absolute;right:10px;top:10px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:18px;cursor:pointer;display:grid;place-items:center}
  .sx-heart.on{color:#ff5a6e}
  .sx-stars{color:#f5b301;letter-spacing:1px;font-size:14px}.sx-stars .off{color:#555}
  .sx-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:hsl(17,68%,58%);color:#fff!important;border:0;border-radius:10px;padding:11px 18px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none}
  .sx-btn:disabled{opacity:.5;cursor:not-allowed}
  .sx-btn.ghost{background:transparent;border:1px solid hsl(17,68%,58%);color:hsl(17,68%,58%)!important}
  .sx-btn.sm{padding:7px 12px;font-size:13px}
  .sx-panel{background:#15151d;border:1px solid #262633;border-radius:16px;padding:20px}
  .sx-two{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px}
  .sx-side{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:24px;align-items:start}
  @media (max-width:900px){.sx-two,.sx-side{grid-template-columns:1fr}.sx-hero{padding-top:110px}}
  .sx-size{display:flex;gap:8px;flex-wrap:wrap}.sx-size button{min-width:52px;padding:9px 12px;border-radius:10px;border:1px solid #3a3a4a;background:#111119;color:#fff;font-weight:700;cursor:pointer}
  .sx-size button.on{border-color:hsl(17,68%,58%);background:hsla(17,68%,58%,.18)}
  .sx-qty{display:inline-flex;align-items:center;border:1px solid #3a3a4a;border-radius:10px;overflow:hidden}
  .sx-qty button{width:36px;height:38px;border:0;background:#1d1d27;color:#fff;font-size:18px;cursor:pointer}.sx-qty span{min-width:40px;text-align:center;font-weight:700}
  .sx-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:15px}.sx-row.total{border-top:1px solid #2c2c3a;margin-top:6px;padding-top:12px;font-size:19px;font-weight:800;color:#fff}
  .sx-line{display:grid;grid-template-columns:84px 1fr auto;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid #23232f}
  .sx-line img{width:84px;height:100px;object-fit:cover;border-radius:10px;background:#eee}
  .sx-progress{height:8px;background:#26263a;border-radius:99px;overflow:hidden;margin:8px 0 4px}.sx-progress i{display:block;height:100%;background:linear-gradient(90deg,hsl(17,68%,58%),#f3b33d)}
  .sx-ai{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:99px;background:rgba(139,92,246,.18);color:#c4b5fd;text-transform:uppercase}
  .sx-sent{font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px}.sx-sent.Positive{background:rgba(34,197,94,.16);color:#4ade80}.sx-sent.Negative{background:rgba(239,68,68,.16);color:#f87171}.sx-sent.Mixed{background:rgba(234,179,8,.16);color:#facc15}
  .sx-review{border-top:1px solid #23232f;padding:14px 0}
  .sx-dist{display:grid;grid-template-columns:40px 1fr 30px;gap:8px;align-items:center;font-size:13px}.sx-dist .bar{height:7px;background:#26263a;border-radius:99px;overflow:hidden}.sx-dist .bar i{display:block;height:100%;background:#f5b301}
  .sx-tabs{display:flex;gap:4px;border-bottom:1px solid #2a2a38;margin-bottom:12px}.sx-tabs button{background:none;border:0;color:#aaa;padding:10px 14px;font-weight:700;cursor:pointer;border-bottom:2px solid transparent}.sx-tabs button.on{color:#fff;border-color:hsl(17,68%,58%)}
  .sx-label{display:block;font-size:13px;color:#b9b9c4;margin:12px 0 5px}
  .sx-pay{border:1px solid #333344;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;display:block}.sx-pay.on{border-color:hsl(17,68%,58%);background:hsla(17,68%,58%,.08)}.sx-pay.off{opacity:.55;cursor:not-allowed}
  .sx-pay input{margin-right:8px;accent-color:hsl(17,68%,58%)}
  .sx-note{font-size:13px;color:#a9a9b3;background:#101018;border:1px dashed #333344;border-radius:10px;padding:10px 12px;margin-top:10px}
  .sx-timeline{display:flex;flex-wrap:wrap;gap:0;margin:16px 0}.sx-step{flex:1;min-width:110px;text-align:center;position:relative;padding-top:26px;font-size:13px;color:#888}
  .sx-step::before{content:"";position:absolute;top:8px;left:50%;width:14px;height:14px;border-radius:50%;background:#333344;transform:translateX(-50%);z-index:1}
  .sx-step::after{content:"";position:absolute;top:14px;left:-50%;width:100%;height:2px;background:#333344}.sx-step:first-child::after{display:none}
  .sx-step.done{color:#fff;font-weight:700}.sx-step.done::before{background:hsl(17,68%,58%)}.sx-step.done::after{background:hsl(17,68%,58%)}
  .sx-status{display:inline-block;font-size:12px;font-weight:800;padding:4px 10px;border-radius:99px;background:#26263a;color:#ddd}
  .sx-status.Delivered{background:rgba(34,197,94,.16);color:#4ade80}.sx-status.Cancelled{background:rgba(239,68,68,.16);color:#f87171}.sx-status.Shipped,.sx-status.Out{background:rgba(59,130,246,.16);color:#93c5fd}
  .sx-strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(170px,1fr);gap:14px;overflow-x:auto;padding-bottom:6px}
  .sx-mini{background:#15151d;border:1px solid #262633;border-radius:14px;overflow:hidden;text-decoration:none;display:block}
  .sx-mini img{width:100%;aspect-ratio:4/5;object-fit:cover;background:#eee}.sx-mini div{padding:8px 10px;font-size:14px;color:#fff;font-weight:600}.sx-mini small{display:block;color:#9a9aa6;font-weight:500}
  .sx-section{margin-top:34px}.sx-section h2{color:#fff;font-size:22px;font-weight:800;margin:0 0 4px;display:flex;align-items:center;gap:10px}
  .sx-empty{text-align:center;padding:50px 20px;color:#aaa}.sx-empty b{display:block;color:#fff;font-size:20px;margin-bottom:6px}
  .sx-err{color:#f87171;font-size:14px;margin-top:8px}
  @media print{header,footer,.go-top,.sx-noprint{display:none!important}body{background:#fff!important}#shop-app,#shop-app *{color:#000!important;background:#fff!important;border-color:#ccc!important}.sx-hero{padding:0}}
  `;
  document.head.appendChild(css);

  // ---------- helpers ----------
  const stars = (r) => { const n = Math.round(r || 0); return `<span class="sx-stars" aria-label="${r ?? 0} out of 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`; };
  const off = (p) => (p.compareAt && p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0);
  const priceHtml = (p) => `<span class="sx-price">${rs(p.price)}</span>${p.compareAt && p.compareAt > p.price ? `<span class="sx-was">${rs(p.compareAt)}</span>` : ''}`;
  const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const loginFirst = (next) => { toast('Please log in first. Your cart is kept.'); setTimeout(() => { location.href = 'loginmain.html?next=' + encodeURIComponent(next); }, 900); };
  // wishlist: server for signed-in users, this browser for guests
  const wish = {
    ids: () => store.get('wishlist', []),
    async load() { if (auth.current()) { try { store.set('wishlist', (await api('wishlist')).map((p) => p.id)); } catch (e) { /* keep local */ } } },
    async toggle(id) {
      if (auth.current()) { const r = await api('wishlist', { body: { id } }); store.set('wishlist', r.items); return r.saved; }
      const list = wish.ids(); const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]; store.set('wishlist', next); return next.includes(id);
    },
  };
  const viewed = { add(key) { const v = store.get('viewed', []).filter((k) => k !== key); v.unshift(key); store.set('viewed', v.slice(0, 15)); }, all: () => store.get('viewed', []) };
  const recsUrl = (kind, n = 8, extra = []) => `recommendations?kind=${kind}&n=${n}&seed=${encodeURIComponent([...extra, ...viewed.all()].slice(0, 15).join(','))}`;
  const mini = (it) => it.kind === 'product'
    ? `<a class="sx-mini" href="product-info.html?id=${esc(it.id)}"><img src="${esc(it.img)}" alt="" loading="lazy"><div>${esc(it.title)}<small>${rs(it.price)}</small></div></a>`
    : `<a class="sx-mini" href="movie-details.html?id=${esc(it.id)}"><img src="${esc(it.img)}" alt="" loading="lazy"><div>${esc(it.title)}<small>${esc(it.type)} · watch trailer</small></div></a>`;
  async function recSection(el, title, url, hint) {
    try {
      const r = await api(url); const items = Array.isArray(r) ? r : r.items;
      if (!items.length) { el.innerHTML = ''; return; }
      el.innerHTML = `<div class="sx-section"><h2>${esc(title)} <span class="sx-ai">AI</span></h2><p class="sx-muted" style="margin:0 0 12px">${esc(hint)}</p><div class="sx-strip">${items.map(mini).join('')}</div></div>`;
    } catch (e) { el.innerHTML = ''; }
  }
  function card(p) {
    const saved = wish.ids().includes(p.id);
    return `<div class="sx-card">
      ${off(p) ? `<span class="sx-badge">-${off(p)}%</span>` : ''}
      <button class="sx-heart ${saved ? 'on' : ''}" data-wish="${esc(p.id)}" aria-label="${saved ? 'Remove from' : 'Save to'} wishlist" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>
      <a href="product-info.html?id=${esc(p.id)}"><img src="${esc(p.img)}" alt="${esc(p.title)}" loading="lazy"></a>
      <div class="b">
        <span class="sx-muted">${esc(p.franchise)} · ${esc(p.category)}</span>
        <a class="t" href="product-info.html?id=${esc(p.id)}">${esc(p.title)}</a>
        <div>${p.rating ? `${stars(p.rating)} <span class="sx-muted">(${p.reviews})</span>` : '<span class="sx-muted">No reviews yet</span>'}</div>
        <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:6px">
          <div>${priceHtml(p)}</div>
          ${p.stock === 0 ? '<span class="sx-muted">Sold out</span>' : `<a class="sx-btn sm" href="product-info.html?id=${esc(p.id)}">Choose size</a>`}
        </div>
        ${p.stock > 0 && p.stock <= 5 ? `<span style="color:#facc15;font-size:13px">Only ${p.stock} left</span>` : ''}
      </div></div>`;
  }
  function bindHearts(scope) {
    scope.querySelectorAll('[data-wish]').forEach((b) => b.onclick = async (e) => {
      e.preventDefault();
      try { const on = await wish.toggle(b.dataset.wish); b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡'; b.setAttribute('aria-pressed', on); toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist'); }
      catch (err) { toast(err.message); }
    });
  }

  // ---------- catalogue ----------
  async function renderShop() {
    document.title = 'Shop · EntXHub merch store';
    const products = await api('products');
    const state = { q: params.get('q') || '', cat: 'All', fr: 'All', sort: 'featured', max: Math.max(...products.map((p) => p.price)) };
    const cats = ['All', ...new Set(products.map((p) => p.category))], frs = ['All', ...new Set(products.map((p) => p.franchise))];
    root.innerHTML = `
      <h1 class="sx-h1">Shop <span class="sx-accent">merch</span></h1>
      <p class="sx-sub">Official-style tees and sets from your favourite films and series. Free standard delivery over Rs 3,000 · 7-day returns · pay by card or cash on delivery.</p>
      <div id="sx-recs"></div>
      <div class="sx-section"></div>
      <div class="sx-bar" role="group" aria-label="Category">${cats.map((c) => `<button class="sx-chip ${c === 'All' ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="sx-bar">
        <div style="flex:2;min-width:200px"><input class="sx-input" id="sx-q" placeholder="Search products" value="${esc(state.q)}" aria-label="Search products"></div>
        <div style="flex:1;min-width:150px"><select class="sx-select" id="sx-fr" aria-label="Franchise">${frs.map((f) => `<option>${esc(f)}</option>`).join('')}</select></div>
        <div style="flex:1;min-width:170px"><select class="sx-select" id="sx-sort" aria-label="Sort"><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="rating">Top rated</option><option value="sale">Biggest discount</option></select></div>
        <label style="flex:1;min-width:190px;font-size:14px">Max price: <b id="sx-maxv">${rs(state.max)}</b><input type="range" id="sx-max" min="1000" max="${state.max}" step="100" value="${state.max}" style="width:100%;accent-color:hsl(17,68%,58%)"></label>
      </div>
      <p class="sx-muted" id="sx-count"></p>
      <div class="sx-grid" id="sx-grid"></div>`;
    const draw = () => {
      let list = products.filter((p) => (state.cat === 'All' || p.category === state.cat) && (state.fr === 'All' || p.franchise === state.fr) && p.price <= state.max && `${p.title} ${p.franchise} ${p.category}`.toLowerCase().includes(state.q.toLowerCase()));
      const sorters = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rating: (a, b) => (b.rating || 0) - (a.rating || 0), sale: (a, b) => off(b) - off(a), featured: (a, b) => (b.reviews || 0) - (a.reviews || 0) };
      list = list.sort(sorters[state.sort]);
      root.querySelector('#sx-count').textContent = `${list.length} product${list.length === 1 ? '' : 's'}`;
      const grid = root.querySelector('#sx-grid');
      grid.innerHTML = list.length ? list.map(card).join('') : '<div class="sx-empty"><b>No products match</b>Try another category or a higher price.</div>';
      bindHearts(grid);
    };
    root.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { state.cat = b.dataset.cat; root.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('on', x === b)); draw(); });
    root.querySelector('#sx-q').oninput = (e) => { state.q = e.target.value; draw(); };
    root.querySelector('#sx-fr').onchange = (e) => { state.fr = e.target.value; draw(); };
    root.querySelector('#sx-sort').onchange = (e) => { state.sort = e.target.value; draw(); };
    root.querySelector('#sx-max').oninput = (e) => { state.max = Number(e.target.value); root.querySelector('#sx-maxv').textContent = rs(state.max); draw(); };
    draw();
    const signedIn = !!auth.current();
    recSection(root.querySelector('#sx-recs'), signedIn || viewed.all().length ? 'Recommended for you' : 'Popular with fans', recsUrl('product', 6, viewed.all().length ? [] : ['title:barbie', 'title:avengers-infinity-war']),
      'Picked by our matrix-factorisation model from what you watched, saved and bought.');
  }

  // ---------- product page ----------
  async function renderProduct() {
    const p = await api('product?id=' + encodeURIComponent(params.get('id') || 'barbie-tshirt'));
    document.title = `${p.title} · EntXHub shop`;
    viewed.add('product:' + p.id);
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = `${p.title}: ${p.description} ${rs(p.price)}, sizes ${p.sizes.join(', ')}.`;
    const ld = document.createElement('script'); ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.title, image: location.origin + '/' + p.img, description: p.description, brand: { '@type': 'Brand', name: p.franchise }, sku: p.id,
      offers: { '@type': 'Offer', priceCurrency: 'PKR', price: p.price, availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: location.href },
      ...(p.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.average, reviewCount: p.count } } : {}) });
    document.head.appendChild(ld);
    let size = null, qty = 1;
    const saved = wish.ids().includes(p.id);
    const title = p.relatedTitle;
    const tm = title && findTitle(title.id);
    root.innerHTML = `
      <p class="sx-muted sx-noprint"><a href="shop.html">Shop</a> / ${esc(p.category)} / ${esc(p.title)}</p>
      <div class="sx-two">
        <div style="position:relative">${off(p) ? `<span class="sx-badge">-${off(p)}%</span>` : ''}<img src="${esc(p.img)}" alt="${esc(p.title)}" style="width:100%;border-radius:18px;background:#eee;aspect-ratio:4/5;object-fit:cover"></div>
        <div>
          <span class="sx-muted">${esc(p.franchise)} · ${esc(p.category)}</span>
          <h1 class="sx-h1" style="margin-top:4px">${esc(p.title)}</h1>
          <div style="margin:6px 0 14px">${p.count ? `${stars(p.average)} <a href="#reviews" class="sx-muted">${p.average} · ${p.count} review${p.count === 1 ? '' : 's'}</a>` : '<span class="sx-muted">No reviews yet</span>'}</div>
          <div style="font-size:26px">${priceHtml(p)} ${off(p) ? `<span style="color:#4ade80;font-size:14px;font-weight:700;margin-left:6px">Save ${rs(p.compareAt - p.price)}</span>` : ''}</div>
          <p class="sx-muted" style="margin:4px 0 16px">Price includes sales tax. ${p.stock === 0 ? '<b style="color:#f87171">Sold out</b>' : p.stock <= 5 ? `<b style="color:#facc15">Only ${p.stock} left in stock</b>` : '<b style="color:#4ade80">In stock</b>'}</p>
          <div class="sx-label">Colour: <b style="color:#fff">${esc(p.colors.join(', '))}</b></div>
          <div class="sx-label">Size <a href="#" id="sx-guide" class="sx-accent" style="margin-left:8px">Size guide</a></div>
          <div class="sx-size" role="radiogroup" aria-label="Size">${p.sizes.map((s) => `<button type="button" role="radio" aria-checked="false" data-size="${esc(s)}">${esc(s)}</button>`).join('')}</div>
          <div class="sx-label">Quantity</div>
          <div class="sx-qty"><button type="button" data-q="-1" aria-label="Decrease">−</button><span id="sx-qv">1</span><button type="button" data-q="1" aria-label="Increase">+</button></div>
          <p class="sx-err" id="sx-perr" role="alert"></p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
            <button class="sx-btn" id="sx-add" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button>
            <button class="sx-btn ghost" id="sx-buy" ${p.stock === 0 ? 'disabled' : ''}>Buy now</button>
            <button class="sx-btn ghost" id="sx-wish" aria-pressed="${saved}">${saved ? '♥ Saved' : '♡ Wishlist'}</button>
          </div>
          <div class="sx-note">🚚 Standard delivery Rs 200, free over Rs 3,000 · ⚡ Express next day Rs 450 · ↩ 7-day returns · 💳 Card or cash on delivery</div>
          ${title ? `<div class="sx-panel" style="margin-top:16px;display:flex;gap:14px;align-items:center"><img src="${esc(title.img)}" alt="" style="width:56px;height:76px;object-fit:cover;border-radius:8px"><div style="flex:1"><div class="sx-muted">From the ${esc(title.type.toLowerCase())}</div><b style="color:#fff">${esc(title.title)}</b></div>${tm && tm.trailer ? `<button class="sx-btn sm" id="sx-trailer">▶ Trailer</button>` : `<a class="sx-btn sm" href="movie-details.html?id=${esc(title.id)}">View</a>`}</div>` : ''}
          <div class="sx-tabs" style="margin-top:22px" role="tablist"><button class="on" data-tab="d">Description</button><button data-tab="m">Material & care</button><button data-tab="s">Delivery & returns</button></div>
          <div id="sx-tab" class="sx-muted" style="font-size:15px;line-height:1.6"></div>
        </div>
      </div>
      <div id="reviews" class="sx-section"></div>
      <div id="sx-also"></div><div id="sx-recs"></div>`;
    const tabs = { d: esc(p.description), m: `${esc(p.material)}. Machine wash cold inside out, do not tumble dry, iron on reverse.`, s: 'Orders placed before 3 pm ship the same day. Standard delivery takes 3–5 working days, express arrives the next working day in Karachi, Lahore and Islamabad. Unworn items can be returned within 7 days for a full refund.' };
    const setTab = (k) => { root.querySelector('#sx-tab').innerHTML = tabs[k]; root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === k)); };
    root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => setTab(b.dataset.tab)); setTab('d');
    root.querySelectorAll('[data-size]').forEach((b) => b.onclick = () => { size = b.dataset.size; root.querySelectorAll('[data-size]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); root.querySelector('#sx-perr').textContent = ''; });
    root.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { qty = Math.max(1, Math.min(Math.max(1, Math.min(10, p.stock)), qty + Number(b.dataset.q))); root.querySelector('#sx-qv').textContent = qty; });
    const add = () => {
      if (!size) { root.querySelector('#sx-perr').textContent = 'Please choose a size.'; return false; }
      const inCart = cart.items().filter((i) => i.id === p.id).reduce((n, i) => n + i.qty, 0);
      if (inCart + qty > p.stock) { root.querySelector('#sx-perr').textContent = `Only ${p.stock} in stock (you already have ${inCart} in your cart).`; return false; }
      cart.add({ id: p.id, title: p.title, price: p.price, img: p.img, type: p.category, option: size }, qty); return true;
    };
    root.querySelector('#sx-add').onclick = add;
    root.querySelector('#sx-buy').onclick = () => { if (add()) location.href = 'cart.html'; };
    root.querySelector('#sx-wish').onclick = async (e) => { try { const on = await wish.toggle(p.id); e.target.textContent = on ? '♥ Saved' : '♡ Wishlist'; toast(on ? 'Saved to your wishlist' : 'Removed from your wishlist'); } catch (err) { toast(err.message); } };
    root.querySelector('#sx-guide').onclick = (e) => { e.preventDefault(); modal(`<h3>Size guide</h3><p>Chest width, laid flat (cm)</p><table style="width:100%;color:#ddd;font-size:14px;margin-top:8px"><tr><th align="left">Size</th><th>Chest</th><th>Length</th></tr>${[['S', 48, 66], ['M', 51, 69], ['L', 54, 72], ['XL', 57, 74], ['4-5Y', 36, 46], ['6-7Y', 39, 50], ['8-9Y', 42, 55], ['10-11Y', 45, 60]].filter(([s]) => p.sizes.includes(s)).map(([s, c, l]) => `<tr><td>${s}</td><td align="center">${c}</td><td align="center">${l}</td></tr>`).join('')}</table><p style="margin-top:10px">Between sizes? Customers say this ${esc(p.category.toLowerCase())} fits true to size.</p>`); };
    const tb = root.querySelector('#sx-trailer'); if (tb) tb.onclick = () => trailerModal(tm.title, tm.trailer, `<a class="entx-btn" href="movie-details.html?id=${esc(tm.id)}">More about ${esc(tm.title)}</a>`);
    renderReviews(root.querySelector('#reviews'), `product:${p.id}`, p);
    const also = root.querySelector('#sx-also');
    if (p.alsoBought.length) also.innerHTML = `<div class="sx-section"><h2>Customers also bought <span class="sx-ai">AI</span></h2><p class="sx-muted" style="margin:0 0 12px">Items that sit closest to this one in the recommender's learned taste space.</p><div class="sx-strip">${p.alsoBought.map(mini).join('')}</div></div>`;
    recSection(root.querySelector('#sx-recs'), 'You might also like', recsUrl('title', 6, ['product:' + p.id]), 'Films and series fans of this item watch, from the same model.');
  }

  // ---------- reviews (shared by product and title pages) ----------
  async function renderReviews(el, target, ctx) {
    const data = ctx && ctx.reviews ? ctx : await api('reviews?target=' + encodeURIComponent(target));
    const s = data.summary || { aspects: [] };
    el.innerHTML = `
      <h2>Reviews ${data.count ? `<span class="sx-muted" style="font-size:15px;font-weight:600">${data.average} out of 5 · ${data.count}</span>` : ''}</h2>
      <div class="sx-two" style="margin-top:12px">
        <div class="sx-panel">
          ${data.count ? `<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><div style="font-size:42px;font-weight:800;color:#fff">${data.average}</div><div>${stars(data.average)}<div class="sx-muted">${data.count} rating${data.count === 1 ? '' : 's'}</div></div></div>
          ${data.distribution.map((d) => `<div class="sx-dist"><span>${d.stars} ★</span><span class="bar"><i style="width:${data.count ? (d.count / data.count) * 100 : 0}%"></i></span><span class="sx-muted">${d.count}</span></div>`).join('')}
          <div style="margin-top:16px"><span class="sx-ai">AI review summary</span>
            <p style="margin:8px 0 6px;color:#ddd">${s.positiveShare}% of reviews read as positive.</p>
            ${s.aspects.length ? s.aspects.map((a) => `<div class="sx-row" style="padding:4px 0"><span style="text-transform:capitalize">${esc(a.aspect)}</span><span class="sx-muted">${a.mentions} mention${a.mentions === 1 ? '' : 's'} · <b style="color:${a.share >= 60 ? '#4ade80' : a.share >= 40 ? '#facc15' : '#f87171'}">${a.share}% positive</b></span></div>`).join('') : '<p class="sx-muted">Not enough detail in the reviews yet.</p>'}
            <p class="sx-muted" style="font-size:12px;margin-top:8px">Each review is scored by a Naive Bayes sentiment model trained on 12,000+ human-labelled movie and product reviews.</p>
          </div>` : '<p class="sx-muted">No reviews yet. Be the first to share your thoughts.</p>'}
        </div>
        <form class="sx-panel" id="sx-rform">
          <b style="color:#fff">Write a review</b>
          <div class="sx-label">Your rating</div>
          <div class="sx-size" id="sx-rate">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-r="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">${n} ★</button>`).join('')}</div>
          <label class="sx-label" for="sx-rt">Title (optional)</label><input class="sx-input" id="sx-rt" maxlength="80">
          <label class="sx-label" for="sx-rb">Your review</label><textarea class="sx-input" id="sx-rb" rows="4" placeholder="How was the fit, fabric, print, delivery…?"></textarea>
          <div id="sx-live" class="sx-muted" style="min-height:24px;margin-top:8px"></div>
          <p class="sx-err" id="sx-rerr" role="alert"></p>
          <button class="sx-btn" type="submit">Post review</button>
        </form>
      </div>
      <div id="sx-rlist" style="margin-top:10px">${data.reviews.map((r) => `
        <div class="sx-review"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">${stars(r.rating)}<b style="color:#fff">${esc(r.title || '')}</b><span class="sx-sent ${r.sentiment.label}" title="AI sentiment ${Math.round(r.sentiment.p * 100)}% positive">${r.sentiment.label}</span>${r.verified ? '<span style="color:#4ade80;font-size:12px;font-weight:700">✓ Verified purchase</span>' : ''}</div>
        <p style="margin:6px 0;color:#ddd">${esc(r.body)}</p><span class="sx-muted">${esc(r.name)} · ${date(r.createdAt)}</span></div>`).join('')}</div>`;
    let rating = 0;
    el.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { rating = Number(b.dataset.r); el.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', Number(x.dataset.r) <= rating)); });
    let t;
    el.querySelector('#sx-rb').oninput = (e) => {
      clearTimeout(t); const text = e.target.value.trim();
      if (text.length < 8) { el.querySelector('#sx-live').innerHTML = ''; return; }
      t = setTimeout(async () => { try { const s2 = await api('ai/sentiment', { body: { text } }); el.querySelector('#sx-live').innerHTML = `<span class="sx-ai">AI</span> This reads as <span class="sx-sent ${s2.label}">${s2.label}</span> (${Math.round(s2.p * 100)}% positive)${s2.words.length ? ` · key words: ${s2.words.map((w) => `<b style="color:${w.weight > 0 ? '#4ade80' : '#f87171'}">${esc(w.word)}</b>`).join(', ')}` : ''}`; } catch (err) { /* ignore */ } }, 350);
    };
    el.querySelector('#sx-rform').onsubmit = async (e) => {
      e.preventDefault();
      if (!auth.current()) return loginFirst(location.pathname.slice(1) + location.search + '#reviews');
      try {
        await api('reviews', { body: { target, rating, title: el.querySelector('#sx-rt').value, body: el.querySelector('#sx-rb').value } });
        toast('Thanks! Your review is live.'); renderReviews(el, target);
      } catch (err) { el.querySelector('#sx-rerr').textContent = err.message; }
    };
  }
  window.EntX.renderReviews = renderReviews;
  window.EntX.recSection = recSection;
  window.EntX.miniCard = mini;

  // ---------- cart ----------
  async function renderCart() {
    document.title = 'Your cart · EntXHub';
    const items = cart.items();
    if (!items.length) {
      root.innerHTML = `<h1 class="sx-h1">Your cart</h1><div class="sx-empty"><b>Your cart is empty</b>Browse the shop or book an event.<div style="margin-top:16px"><a class="sx-btn" href="shop.html">Go to the shop</a></div></div><div id="sx-recs"></div>`;
      recSection(root.querySelector('#sx-recs'), 'Recommended for you', recsUrl('product', 6, ['title:barbie']), 'From our recommender.');
      return;
    }
    const state = { coupon: store.get('coupon', ''), shipping: store.get('shipping', 'standard') };
    root.innerHTML = `<h1 class="sx-h1">Your cart</h1><p class="sx-sub" id="sx-cc"></p>
      <div class="sx-side"><div class="sx-panel" id="sx-lines"></div><div class="sx-panel" id="sx-sum"><p class="sx-muted">Working out your total…</p></div></div><div id="sx-recs"></div>`;
    const lines = root.querySelector('#sx-lines');
    const draw = async () => {
      const list = cart.items();
      if (!list.length) return renderCart();
      root.querySelector('#sx-cc').textContent = `${cart.count()} item${cart.count() === 1 ? '' : 's'}`;
      lines.innerHTML = list.map((i, n) => `<div class="sx-line"><img src="${esc(i.img)}" alt=""><div><a href="${i.type === 'Event ticket' ? 'events.html' : 'product-info.html?id=' + esc(i.id)}" style="color:#fff;font-weight:700;text-decoration:none">${esc(i.title)}</a><div class="sx-muted">${esc(i.type || '')}${i.option ? ' · Size ' + esc(i.option) : ''} · ${rs(i.price)} each</div>
        <div style="display:flex;gap:10px;align-items:center;margin-top:8px"><div class="sx-qty"><button data-dec="${n}" aria-label="Decrease">−</button><span>${i.qty}</span><button data-inc="${n}" aria-label="Increase">+</button></div><button class="sx-btn ghost sm" data-del="${n}">Remove</button>${i.type !== 'Event ticket' ? `<button class="sx-btn ghost sm" data-later="${n}">Save for later</button>` : ''}</div></div>
        <b style="color:#fff">${rs(i.price * i.qty)}</b></div>`).join('') + '<a href="shop.html" class="sx-accent" style="display:inline-block;margin-top:12px">← Continue shopping</a>';
      lines.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => { const it = cart.items(); it[b.dataset.inc].qty = Math.min(20, it[b.dataset.inc].qty + 1); cart.save(it); draw(); });
      lines.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => { const it = cart.items(); it[b.dataset.dec].qty--; if (it[b.dataset.dec].qty < 1) it.splice(b.dataset.dec, 1); cart.save(it); draw(); });
      lines.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { const it = cart.items(); const [g] = it.splice(b.dataset.del, 1); cart.save(it); toast('Removed ' + g.title); draw(); });
      lines.querySelectorAll('[data-later]').forEach((b) => b.onclick = async () => { const it = cart.items(); const [g] = it.splice(b.dataset.later, 1); cart.save(it); if (!wish.ids().includes(g.id)) await wish.toggle(g.id).catch(() => {}); toast(`${g.title} moved to your wishlist`); draw(); });
      let q;
      try { q = await api('cart/quote', { body: { items: list, coupon: state.coupon, shipping: state.shipping } }); }
      catch (err) { root.querySelector('#sx-sum').innerHTML = `<p class="sx-err">${esc(err.message)}</p>`; return; }
      const left = q.freeShippingAt ? q.freeShippingAt - (q.subtotal - q.discount) : 0;
      root.querySelector('#sx-sum').innerHTML = `
        <b style="color:#fff;font-size:18px">Order summary</b>
        ${q.shipping === 'standard' && q.freeShippingAt && !q.lines.every((l) => l.kind === 'event') ? `<div style="margin-top:10px;font-size:14px">${left > 0 ? `Add <b>${rs(left)}</b> more for free delivery` : '🎉 You get free standard delivery'}</div><div class="sx-progress"><i style="width:${Math.min(100, ((q.subtotal - q.discount) / q.freeShippingAt) * 100)}%"></i></div>` : ''}
        <label class="sx-label" for="sx-ship">Delivery</label>
        <select class="sx-select" id="sx-ship"><option value="standard" ${state.shipping === 'standard' ? 'selected' : ''}>Standard (3–5 days) · Rs 200, free over Rs 3,000</option><option value="express" ${state.shipping === 'express' ? 'selected' : ''}>Express (next day) · Rs 450</option></select>
        <label class="sx-label" for="sx-coupon">Discount code</label>
        <div style="display:flex;gap:8px"><input class="sx-input" id="sx-coupon" placeholder="e.g. WELCOME10" value="${esc(state.coupon)}"><button class="sx-btn ghost sm" id="sx-apply">Apply</button></div>
        ${q.couponNote ? `<div style="font-size:13px;margin-top:6px;color:${q.coupon ? '#4ade80' : '#f87171'}">${esc(q.couponNote)}</div>` : '<div class="sx-muted" style="margin-top:6px">Try WELCOME10, ENTX200 or FREESHIP</div>'}
        <div style="margin-top:14px">
          <div class="sx-row"><span>Subtotal</span><span>${rs(q.subtotal)}</span></div>
          ${q.discount ? `<div class="sx-row" style="color:#4ade80"><span>Discount (${esc(q.coupon)})</span><span>−${rs(q.discount)}</span></div>` : ''}
          <div class="sx-row"><span>${esc(q.shippingLabel)}</span><span>${q.delivery ? rs(q.delivery) : 'Free'}</span></div>
          <div class="sx-row total"><span>Total</span><span>${rs(q.total)}</span></div>
          <div class="sx-muted">${esc(q.taxNote)}</div>
        </div>
        ${q.problems.length ? `<div class="sx-err">${q.problems.map(esc).join('<br>')}</div>` : ''}
        <button class="sx-btn" id="sx-go" style="width:100%;margin-top:14px" ${q.problems.length ? 'disabled' : ''}>Checkout securely</button>
        <div class="sx-muted" style="text-align:center;margin-top:8px">💳 Card · Stripe · Cash on delivery</div>`;
      root.querySelector('#sx-ship').onchange = (e) => { state.shipping = e.target.value; store.set('shipping', state.shipping); draw(); };
      root.querySelector('#sx-apply').onclick = () => { state.coupon = root.querySelector('#sx-coupon').value.trim(); store.set('coupon', state.coupon); draw(); };
      root.querySelector('#sx-go').onclick = () => { if (!auth.current()) return loginFirst('checkout.html'); location.href = 'checkout.html'; };
    };
    draw();
    recSection(root.querySelector('#sx-recs'), 'Goes well with your cart', recsUrl('product', 6, items.filter((i) => i.type !== 'Event ticket').map((i) => 'product:' + i.id)), 'Suggestions from our recommender, based on what is in your cart.');
  }

  // ---------- checkout ----------
  async function renderCheckout() {
    document.title = 'Checkout · EntXHub';
    if (!auth.current()) { loginFirst('checkout.html'); root.innerHTML = '<p class="sx-loading">Redirecting to log in…</p>'; return; }
    const items = cart.items();
    if (!items.length) { root.innerHTML = `<h1 class="sx-h1">Checkout</h1><div class="sx-empty"><b>Your cart is empty</b><a class="sx-btn" href="shop.html" style="margin-top:12px">Go to the shop</a></div>`; return; }
    const cfg = await api('config');
    const saved = store.get('address', {});
    const user = auth.current();
    const state = { pay: 'card_test', shipping: store.get('shipping', 'standard'), coupon: store.get('coupon', '') };
    if (params.get('cancelled')) toast('Stripe payment was cancelled. Your order was not charged.');
    root.innerHTML = `<h1 class="sx-h1">Checkout</h1><p class="sx-sub">Signed in as ${esc(user.email)}</p>
      <form class="sx-side" id="sx-co" novalidate>
        <div>
          <div class="sx-panel"><b style="color:#fff;font-size:18px">1. Delivery details</b>
            <div class="sx-two" style="gap:12px">
              <div><label class="sx-label" for="co-name">Full name</label><input class="sx-input" id="co-name" autocomplete="name" value="${esc(saved.name || user.name || '')}" required></div>
              <div><label class="sx-label" for="co-phone">Phone</label><input class="sx-input" id="co-phone" autocomplete="tel" placeholder="03xx xxxxxxx" value="${esc(saved.phone || '')}" required></div>
            </div>
            <label class="sx-label" for="co-addr">Address</label><input class="sx-input" id="co-addr" autocomplete="street-address" placeholder="House, street, area" value="${esc(saved.address || '')}" required>
            <div class="sx-two" style="gap:12px">
              <div><label class="sx-label" for="co-city">City</label><input class="sx-input" id="co-city" autocomplete="address-level2" list="co-cities" value="${esc(saved.city || '')}" required><datalist id="co-cities"><option>Karachi</option><option>Lahore</option><option>Islamabad</option><option>Rawalpindi</option><option>Faisalabad</option><option>Multan</option><option>Peshawar</option><option>Hyderabad</option></datalist></div>
              <div><label class="sx-label" for="co-ship">Delivery</label><select class="sx-select" id="co-ship"><option value="standard">Standard (3–5 days)</option><option value="express">Express (next day)</option></select></div>
            </div>
            <label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:14px"><input type="checkbox" id="co-save" checked style="accent-color:hsl(17,68%,58%)"> Save these details for next time</label>
          </div>
          <div class="sx-panel" style="margin-top:16px"><b style="color:#fff;font-size:18px">2. Payment</b>
            <div style="margin-top:12px">
              <label class="sx-pay on" data-pay="card_test"><input type="radio" name="pay" value="card_test" checked><b>Credit / debit card</b> <span class="sx-muted">· test mode, no real money</span>
                <div id="co-card" style="margin-top:10px">
                  <label class="sx-label" for="co-num">Card number</label><input class="sx-input" id="co-num" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" maxlength="23">
                  <div class="sx-two" style="gap:12px"><div><label class="sx-label" for="co-exp">Expiry (MM/YY)</label><input class="sx-input" id="co-exp" inputmode="numeric" autocomplete="cc-exp" placeholder="12/30" maxlength="5"></div><div><label class="sx-label" for="co-cvc">CVC</label><input class="sx-input" id="co-cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4"></div></div>
                  <div class="sx-note">Test cards (same as Stripe's): <b>4242 4242 4242 4242</b> succeeds · <b>4000 0000 0000 0002</b> is declined · <b>4000 0000 0000 9995</b> has insufficient funds. Any future expiry and any 3-digit CVC. Only the last 4 digits are stored.</div>
                </div></label>
              <label class="sx-pay ${cfg.stripe ? '' : 'off'}" data-pay="stripe"><input type="radio" name="pay" value="stripe" ${cfg.stripe ? '' : 'disabled'}><b>Stripe Checkout</b> <span class="sx-muted">· secure hosted card page${cfg.stripe ? ' (test mode)' : ''}</span>
                ${cfg.stripe ? '' : '<div class="sx-muted" style="margin-top:6px">Available once the store owner adds Stripe test keys to the deployment.</div>'}</label>
              <label class="sx-pay" data-pay="cod"><input type="radio" name="pay" value="cod"><b>Cash on delivery</b> <span class="sx-muted">· pay the rider</span></label>
            </div>
          </div>
        </div>
        <div class="sx-panel" id="co-sum"><p class="sx-muted">Working out your total…</p></div>
      </form>`;
    const $ = (s) => root.querySelector(s);
    $('#co-ship').value = state.shipping;
    $('#co-num').oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '); };
    $('#co-exp').oninput = (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); e.target.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };
    root.querySelectorAll('[data-pay]').forEach((l) => l.addEventListener('click', () => {
      const r = l.querySelector('input'); if (r.disabled) return; r.checked = true; state.pay = r.value;
      root.querySelectorAll('[data-pay]').forEach((x) => x.classList.toggle('on', x === l)); $('#co-card').style.display = state.pay === 'card_test' ? '' : 'none'; summary();
    }));
    let quote = null;
    const summary = async () => {
      try { quote = await api('cart/quote', { body: { items, coupon: state.coupon, shipping: state.shipping } }); }
      catch (err) { $('#co-sum').innerHTML = `<p class="sx-err">${esc(err.message)}</p>`; return; }
      $('#co-sum').innerHTML = `<b style="color:#fff;font-size:18px">Order summary</b>
        ${quote.lines.map((l) => `<div class="sx-row"><span>${esc(l.title)}${l.option ? ' · ' + esc(l.option) : ''} × ${l.qty}</span><span>${rs(l.total)}</span></div>`).join('')}
        <div style="border-top:1px solid #2c2c3a;margin-top:6px;padding-top:6px">
        <div class="sx-row"><span>Subtotal</span><span>${rs(quote.subtotal)}</span></div>
        ${quote.discount ? `<div class="sx-row" style="color:#4ade80"><span>Discount (${esc(quote.coupon)})</span><span>−${rs(quote.discount)}</span></div>` : ''}
        <div class="sx-row"><span>${esc(quote.shippingLabel)}</span><span>${quote.delivery ? rs(quote.delivery) : 'Free'}</span></div>
        <div class="sx-row total"><span>Total</span><span>${rs(quote.total)}</span></div><div class="sx-muted">${esc(quote.taxNote)}</div></div>
        ${quote.problems.length ? `<div class="sx-err">${quote.problems.map(esc).join('<br>')}</div>` : ''}
        <p class="sx-err" id="co-err" role="alert"></p>
        <button class="sx-btn" type="submit" id="co-place" style="width:100%;margin-top:12px" ${quote.problems.length ? 'disabled' : ''}>${state.pay === 'cod' ? 'Place order' : state.pay === 'stripe' ? 'Continue to Stripe' : `Pay ${rs(quote.total)}`}</button>
        <div class="sx-muted" style="text-align:center;margin-top:8px">🔒 Prices, stock and discounts are checked again on our server.</div>`;
    };
    $('#co-ship').onchange = (e) => { state.shipping = e.target.value; store.set('shipping', state.shipping); summary(); };
    summary();
    $('#sx-co').onsubmit = async (e) => {
      e.preventDefault();
      const err = (m) => { const el = $('#co-err'); if (el) el.textContent = m; };
      const body = { items, coupon: state.coupon, shipping: state.shipping, payment: state.pay, name: $('#co-name').value.trim(), phone: $('#co-phone').value.trim(), address: $('#co-addr').value.trim(), city: $('#co-city').value.trim() };
      if (body.name.length < 2 || body.address.length < 6 || body.city.length < 2) return err('Please fill in your name, full address and city.');
      if (!/^\+?[0-9][0-9\s-]{8,14}$/.test(body.phone)) return err('Please enter a valid phone number.');
      if (state.pay === 'card_test') body.card = { number: $('#co-num').value, exp: $('#co-exp').value, cvc: $('#co-cvc').value };
      if ($('#co-save').checked) store.set('address', { name: body.name, phone: body.phone, address: body.address, city: body.city });
      const btn = $('#co-place'); btn.disabled = true; btn.textContent = state.pay === 'card_test' ? 'Processing payment…' : 'Placing order…';
      try {
        const r = await api('orders', { body });
        store.set('cart', []); store.set('coupon', ''); window.EntX.updateBadges();
        if (r.redirect) { location.href = r.redirect; return; }
        location.href = `order.html?id=${encodeURIComponent(r.order._id)}&new=1`;
      } catch (e2) { await summary(); err(e2.message); }
    };
  }

  // ---------- order details ----------
  const STEPS = ['Placed', 'Paid', 'Processing', 'Shipped', 'Out for delivery', 'Delivered'];
  async function renderOrder() {
    if (!auth.current()) { loginFirst(location.pathname.slice(1) + location.search); return; }
    const o = await api('order?id=' + encodeURIComponent(params.get('id') || ''));
    document.title = `Order ${o._id} · EntXHub`;
    const done = new Set(o.timeline.map((t) => t.s));
    const steps = STEPS.filter((s) => s !== 'Paid' || o.payment.method !== 'Cash on delivery');
    const isNew = params.get('new') || params.get('paid');
    root.innerHTML = `
      ${isNew && o.status !== 'Awaiting payment' ? `<div class="sx-panel sx-noprint" style="border-color:#2f6b45;background:#11231a;margin-bottom:18px"><b style="color:#4ade80;font-size:18px">✓ Thank you, your order is confirmed</b><div class="sx-muted">A confirmation is saved to your account${o.payment.status === 'Paid' ? ` · paid with ${esc(o.payment.brand || 'card')} ending ${esc(o.payment.last4 || '')}` : ''}.</div></div>` : ''}
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:flex-start">
        <div><h1 class="sx-h1">Order ${esc(o._id)}</h1><p class="sx-sub">Placed ${date(o.createdAt)} · <span class="sx-status ${esc(o.status.split(' ')[0])}">${esc(o.status)}</span>${o.tracking ? ` · Tracking <b>${esc(o.tracking)}</b>` : ''}</p></div>
        <div class="sx-noprint" style="display:flex;gap:8px;flex-wrap:wrap"><button class="sx-btn ghost sm" id="o-print">Print invoice</button>${o.cancellable ? '<button class="sx-btn ghost sm" id="o-cancel">Cancel order</button>' : ''}<a class="sx-btn sm" href="orders.html">All orders</a></div>
      </div>
      ${o.status === 'Cancelled' ? `<div class="sx-note">This order was cancelled${o.cancelReason ? ' (' + esc(o.cancelReason.toLowerCase()) + ')' : ''}.${o.payment.status === 'Refunded' ? ` ${rs(o.total)} has been refunded to your card.` : ''} Items were returned to stock.</div>`
        : o.status === 'Awaiting payment' ? `<div class="sx-note">Waiting for your Stripe payment. If you closed the payment page, this order is cancelled automatically after 30 minutes.</div>`
        : `<div class="sx-timeline">${steps.map((s) => `<div class="sx-step ${done.has(s) ? 'done' : ''}">${esc(s)}</div>`).join('')}</div><p class="sx-muted sx-noprint" style="margin-top:-6px">Demo store: orders move through processing and delivery automatically over a couple of hours.</p>`}
      <div class="sx-side" style="margin-top:16px">
        <div class="sx-panel">${o.lines.map((l) => `<div class="sx-line"><img src="${esc(l.img)}" alt=""><div><b style="color:#fff">${esc(l.title)}</b><div class="sx-muted">${l.option ? 'Size ' + esc(l.option) + ' · ' : ''}${l.qty} × ${rs(l.price)}</div>${l.kind === 'product' && o.status === 'Delivered' ? `<a class="sx-accent sx-noprint" href="product-info.html?id=${esc(l.id)}#reviews" style="font-size:14px">Write a review</a>` : ''}</div><b style="color:#fff">${rs(l.total)}</b></div>`).join('')}</div>
        <div class="sx-panel">
          <b style="color:#fff">Summary</b>
          <div class="sx-row"><span>Subtotal</span><span>${rs(o.subtotal)}</span></div>
          ${o.discount ? `<div class="sx-row" style="color:#4ade80"><span>Discount (${esc(o.coupon || '')})</span><span>−${rs(o.discount)}</span></div>` : ''}
          <div class="sx-row"><span>${esc(o.shippingLabel || 'Delivery')}</span><span>${o.delivery ? rs(o.delivery) : 'Free'}</span></div>
          <div class="sx-row total"><span>Total</span><span>${rs(o.total)}</span></div>
          <div class="sx-label">Payment</div><div>${esc(o.payment.method)} · <b>${esc(o.payment.status)}</b>${o.payment.last4 ? ` · ${esc(o.payment.brand)} •••• ${esc(o.payment.last4)}` : ''}${o.payment.ref ? `<div class="sx-muted">Ref ${esc(o.payment.ref)}</div>` : ''}</div>
          <div class="sx-label">Deliver to</div><div>${esc(o.name)}<br>${esc(o.address)}, ${esc(o.city || '')}<br>${esc(o.phone || '')}</div>
        </div>
      </div>`;
    root.querySelector('#o-print').onclick = () => window.print();
    const c = root.querySelector('#o-cancel');
    if (c) c.onclick = () => modal(`<h3>Cancel order ${esc(o._id)}?</h3><p>${o.payment.status === 'Paid' ? `${rs(o.total)} will be refunded to your card.` : 'Nothing has been charged.'} Items go back to stock.</p><button class="entx-btn" id="o-yes">Yes, cancel it</button>`, (m, close) => {
      m.querySelector('#o-yes').onclick = async () => { try { await api('orders/cancel', { body: { id: o._id } }); close(); toast('Order cancelled'); renderOrder(); } catch (err) { toast(err.message); } };
    });
  }

  async function renderOrders() {
    document.title = 'My orders · EntXHub';
    if (!auth.current()) { loginFirst('orders.html'); return; }
    const list = await api('orders');
    root.innerHTML = `<h1 class="sx-h1">My orders</h1><p class="sx-sub">${list.length} order${list.length === 1 ? '' : 's'}</p>` + (list.length ? `<div class="sx-panel">${list.map((o) => `
      <a href="order.html?id=${esc(o._id)}" class="sx-line" style="text-decoration:none;grid-template-columns:84px 1fr auto"><img src="${esc(o.lines[0]?.img || '')}" alt=""><div><b style="color:#fff">${esc(o._id)}</b> <span class="sx-status ${esc(o.status.split(' ')[0])}">${esc(o.status)}</span><div class="sx-muted">${date(o.createdAt)} · ${o.lines.reduce((n, l) => n + l.qty, 0)} item(s) · ${esc(o.payment.method)}</div></div><b style="color:#fff">${rs(o.total)}</b></a>`).join('')}</div>`
      : '<div class="sx-empty"><b>No orders yet</b><a class="sx-btn" href="shop.html" style="margin-top:12px">Start shopping</a></div>');
  }

  async function renderWishlist() {
    document.title = 'Wishlist · EntXHub';
    await wish.load();
    const all = await api('products');
    const list = all.filter((p) => wish.ids().includes(p.id));
    root.innerHTML = `<h1 class="sx-h1">Wishlist</h1><p class="sx-sub">${auth.current() ? 'Saved to your account' : 'Saved in this browser · log in to keep it on every device'}</p>` +
      (list.length ? `<div class="sx-grid">${list.map(card).join('')}</div>` : '<div class="sx-empty"><b>Nothing saved yet</b>Tap ♡ on any product to save it.<div style="margin-top:12px"><a class="sx-btn" href="shop.html">Browse the shop</a></div></div>') + '<div id="sx-recs"></div>';
    bindHearts(root);
    root.querySelectorAll('[data-wish]').forEach((b) => b.addEventListener('click', () => setTimeout(renderWishlist, 300)));
    recSection(root.querySelector('#sx-recs'), 'Recommended for you', recsUrl('product', 6, list.map((p) => 'product:' + p.id)), 'Based on what you saved.');
  }

  const views = { shop: renderShop, product: renderProduct, cart: renderCart, checkout: renderCheckout, order: renderOrder, orders: renderOrders, wishlist: renderWishlist };
  document.addEventListener('DOMContentLoaded', async () => {
    if (!root) return;
    await wish.load();
    try { await (views[view] || renderShop)(); }
    catch (e) { root.innerHTML = `<div class="sx-empty"><b>Something went wrong</b>${esc(e.message)}<div style="margin-top:12px"><a class="sx-btn" href="shop.html">Back to the shop</a></div></div>`; }
  });
})();
