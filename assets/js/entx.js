/* EntXHub site features: sign-in, cart, product pages, search, bookings, game details,
   movie details and real targets for every footer/social/genre link.
   Data is kept in the visitor's browser (localStorage), so the static site works anywhere. */
(function () {
  'use strict';

  // ---------- storage helpers ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('entx-' + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('entx-' + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ } },
  };
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const params = new URLSearchParams(location.search);
  const rs = (n) => 'Rs ' + Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // ---------- UI: styles, toast, modal ----------
  const css = document.createElement('style');
  css.textContent = `
  .entx-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#1d1d2b;color:#fff;border:1px solid hsl(17,68%,58%);padding:12px 18px;border-radius:10px;z-index:10000;opacity:0;transition:.25s;font-size:15px;max-width:90vw;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  .entx-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .entx-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
  .entx-modal{background:#14141f;color:#eee;border:1px solid #2c2c3d;border-radius:14px;max-width:460px;width:100%;padding:24px;position:relative;max-height:90vh;overflow:auto}
  .entx-modal h3{color:#fff;margin:0 0 6px;font-size:22px}.entx-modal p{color:#bbb;margin:6px 0;font-size:15px;line-height:1.5}
  .entx-modal img{width:100%;border-radius:10px;margin-bottom:12px;max-height:220px;object-fit:cover}
  .entx-modal label{display:block;font-size:14px;color:#ccc;margin:12px 0 4px}
  .entx-modal input,.entx-modal select,.entx-modal textarea{width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#0d0d16;color:#fff;font-size:15px}
  .entx-close{position:absolute;right:12px;top:8px;background:none;border:0;color:#aaa;font-size:26px;cursor:pointer}
  .entx-btn{display:inline-block;background:hsl(17,68%,58%);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:15px;margin-top:14px;text-decoration:none}
  .entx-btn.ghost{background:transparent;border:1px solid hsl(17,68%,58%);color:hsl(17,68%,58%);margin-left:8px}
  .entx-results{position:absolute;right:0;top:calc(100% + 6px);width:320px;max-height:360px;overflow:auto;background:#14141f;border:1px solid #2c2c3d;border-radius:10px;z-index:1001;text-align:left}
  .entx-results a{display:flex;gap:10px;align-items:center;padding:8px 10px;color:#eee;text-decoration:none;border-bottom:1px solid #222}
  .entx-results a:hover{background:#1f1f2e}.entx-results img{width:44px;height:44px;object-fit:cover;border-radius:6px}
  .entx-results small{color:hsl(17,68%,58%);display:block;font-size:12px}.entx-results .none{padding:12px;color:#999}
  .entx-badge{position:absolute;top:-4px;right:-6px;background:hsl(17,68%,58%);color:#fff;border-radius:99px;font-size:11px;min-width:18px;height:18px;display:grid;place-items:center;padding:0 4px}
  .entx-add{width:100%;margin-top:8px;background:hsl(17,68%,58%);color:#fff;border:0;border-radius:6px;padding:8px;font-weight:600;cursor:pointer}
  .entx-qty{display:inline-flex;align-items:center;gap:8px}.entx-qty button{width:28px;height:28px;border-radius:6px;border:1px solid #999;background:transparent;cursor:pointer;font-weight:700}
  .entx-empty{padding:30px 10px;text-align:center;color:#777}
  .circle.entx-on{outline:3px solid #fff;outline-offset:2px}
  .entx-hidden{display:none!important}`;
  document.head.appendChild(css);

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'entx-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
  }
  function modal(html, onReady) {
    const bg = document.createElement('div');
    bg.className = 'entx-modal-bg';
    bg.innerHTML = `<div class="entx-modal" role="dialog" aria-modal="true"><button class="entx-close" aria-label="Close">&times;</button>${html}</div>`;
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.classList.contains('entx-close') || e.target.dataset.close !== undefined) close(); });
    document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
    document.body.appendChild(bg);
    if (onReady) onReady(bg.querySelector('.entx-modal'), close);
    return close;
  }

  // ---------- catalog (used by search, product and movie pages) ----------
  const MOVIES = [
    ['The Dark Knight Rises', 'Movie', 'assets/images/m1.png', 'Action, Crime, Drama'], ['Maula Jatt', 'Movie', 'assets/images/m5.png', 'Action, Drama'],
    ['Inception', 'Movie', 'assets/images/m2.png', 'Action, Science Fiction, Thriller'], ['Interstellar', 'Movie', 'assets/images/m3.png', 'Adventure, Drama, Science Fiction'],
    ['Jurassic World', 'Movie', 'assets/images/m4.png', 'Action, Adventure, Science Fiction'], ['Oppenheimer', 'Movie', 'assets/images/moooovie1.jpg', 'Biography, Drama, History'],
    ['Avengers Infinity War', 'Movie', 'assets/images/m6.png', 'Action, Adventure, Science Fiction'],
    ['Tokyo Ghoul', 'Anime', 'assets/images/tokyo ghoul.png', 'Action, Dark Fantasy, Horror'], ['Death Note', 'Anime', 'assets/images/death note.png', 'Mystery, Psychological Thriller'],
    ['Attack On Titan', 'Anime', 'assets/images/attack on titians.png', 'Action, Dark Fantasy'], ['Dragon Ball Z', 'Anime', 'assets/images/dragon ball z.png', 'Action, Adventure, Martial Arts'],
    ['One Piece', 'Anime', 'assets/images/one piece.png', 'Action, Adventure, Comedy'], ['Pokemon', 'Anime', 'assets/images/pokemon.png', 'Adventure, Family'],
    ['Naruto', 'Anime', 'assets/images/aruto.png', 'Action, Adventure, Martial Arts'],
    ['Lucifer', 'Web Series', 'assets/images/ws1.png', 'Crime, Drama, Fantasy'], ['Dark', 'Web Series', 'assets/images/ws2.png', 'Mystery, Science Fiction, Thriller'],
    ['Money Heist', 'Web Series', 'assets/images/ws5.png', 'Action, Crime, Thriller'], ['Peaky Blinders', 'Web Series', 'assets/images/ws4.png', 'Crime, Drama'],
    ['Loki', 'Web Series', 'assets/images/ws3.png', 'Action, Adventure, Fantasy'], ['Squid Game', 'Web Series', 'assets/images/ws6.png', 'Drama, Survival, Thriller'],
    ['Stranger Things', 'Web Series', 'assets/images/ws7.png', 'Drama, Horror, Science Fiction'],
    ['Tauha Ibne Jalil', 'Podcast', 'assets/images/p1.png', 'Talk, Lifestyle'], ['Gold Minds', 'Podcast', 'assets/images/p4.png', 'Talk, Business'],
    ['Junaid Akram', 'Podcast', 'assets/images/p2.png', 'Talk, Comedy'], ['Muzammil Hassan', 'Podcast', 'assets/images/p3.png', 'Talk, Education'],
  ].map(([title, type, img, genres]) => ({ id: slug(title), title, type, img, genres }));

  const PRODUCTS = [
    ['barbie-tshirt', 'Barbie T-Shirt', 1600, 'assets/images/shop1.jpg'], ['barbie-croptop', 'Barbie CropTop', 1900, 'assets/images/shop2.jpg'],
    ['batman-tshirt', 'Batman T-Shirt', 1600, 'assets/images/shop3.jpg'], ['dark-knight-shirt', 'Dark Knight Shirt', 1500, 'assets/images/shop4.jpg'],
    ['captain-america', 'Captain America', 1300, 'assets/images/shop5.jpg'], ['avengers-tshirt', 'Avengers T-Shirt', 1450, 'assets/images/shop6.jpg'],
    ['simba-tshirt', 'Simba T-Shirt', 1500, 'assets/images/shop7.jpg'], ['barbie-tshirt-classic', 'Barbie T-Shirt (Classic)', 1200, 'assets/images/shop1.jpg'],
  ].map(([id, title, price, img]) => ({ id, title, price, img, type: 'Clothing' }));

  const GAMES = {
    'abd47e100099495.60427765e8914.jpg': ['Red Dead Redemption 2', 'Open-world western adventure'], 'asphalt 8.jpg': ['Asphalt 8', 'Arcade racing'],
    'fortnite-1920x1080-hd-cvavgntkwzkn72rg.jpg': ['Fortnite', 'Battle royale'], 'marvels-spider-man-2560x1440-12229.jpeg': ["Marvel's Spider-Man", 'Superhero action'],
    'gta 5.jpg': ['GTA V', 'Open-world crime'], 'minion-rush-5120x2880-12236.jpg': ['Minion Rush', 'Endless runner'],
    'gta vice city.jpg': ['GTA Vice City', 'Open-world crime classic'], 'sonic-generations-hd-398arg8tmhi6x186.jpg': ['Sonic Generations', 'Platformer'],
    'cod black ops 3.jpg': ['Call of Duty: Black Ops III', 'First-person shooter'], 'batman.jpg': ['Batman: Arkham Knight', 'Action adventure'],
    'gta 4.jpg': ['GTA IV', 'Open-world crime'], 'nfs underrcover.jpg': ['Need for Speed: Undercover', 'Street racing'],
    'residen evil.jpeg': ['Resident Evil', 'Survival horror'], 'desktop-wallpaper-need-for-speed-underground-3-nfs-underground-2.jpg': ['Need for Speed: Underground 2', 'Street racing'],
    'babrie.jpeg': ['Barbie Dreamhouse Adventures', 'Family simulation'], 'san andreas.jpg': ['GTA San Andreas', 'Open-world crime classic'],
    'Need-For-Speed-series-1024x562.jpeg': ['Need for Speed', 'Racing series'], 'HD-wallpaper-kay-o-x-jett-valorant-game-poster.jpg': ['Valorant', 'Tactical shooter'],
    'subway surfer.jpg': ['Subway Surfers', 'Endless runner'], 'shadow fight arena.jpg': ['Shadow Fight Arena', 'Fighting'],
    'ludo.webp': ['Ludo King', 'Board game'], 'mars.webp': ['Mars: Mars', 'Arcade flyer'], 'ummi.png': ['Ummi', 'Casual game'], 'coc.webp': ['Clash of Clans', 'Strategy'],
  };

  const EVENTS = [
    { id: 'music-night', title: 'Unforgettable Night of Music', price: 1200, img: 'koko.jpg' },
    { id: 'carnival', title: 'Carnival', price: 1000, img: 'themepark.jpg' },
    { id: 'boat-parade', title: 'Boat Parade', price: 800, img: 'boat.jpg' },
    { id: 'echoes-of-emotion', title: "Echoes of Emotion (Drama)", price: 1500, img: 'concert.jpg' },
  ];

  // ---------- auth (demo accounts stored in this browser) ----------
  const auth = {
    users: () => store.get('users', {}),
    current: () => store.get('session', null),
    signUp(email, password) {
      const users = auth.users();
      if (users[email]) throw new Error('An account with this email or phone already exists. Please log in.');
      users[email] = { email, password, name: email.split('@')[0] };
      store.set('users', users); store.set('session', { email, name: users[email].name });
    },
    logIn(email, password) {
      const u = auth.users()[email];
      if (!u || u.password !== password) throw new Error('Incorrect email/phone or password.');
      store.set('session', { email, name: u.name });
    },
    logOut() { store.set('session', null); },
  };

  function renderAuthButtons() {
    const user = auth.current();
    document.querySelectorAll('a[href="loginmain.html"], a[href="./loginmain.html"]').forEach((a) => {
      const btn = a.querySelector('button');
      if (!user) return;
      if (btn) btn.textContent = 'Log out (' + user.name + ')';
      else if (/login/i.test(a.textContent)) a.textContent = 'Log out';
      a.addEventListener('click', (e) => { e.preventDefault(); auth.logOut(); toast('You have been logged out.'); setTimeout(() => location.reload(), 600); });
    });
  }

  function wireAuthForm(mode) {
    const form = document.querySelector('form');
    if (!form) return;
    const inputs = form.querySelectorAll('input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = (inputs[0] && inputs[0].value || '').trim();
      const pass = inputs[1] ? inputs[1].value : '';
      try {
        if (!email) throw new Error('Please enter your email or phone.');
        if (pass.length < 6) throw new Error('Password must be at least 6 characters.');
        if (mode === 'signup') {
          if (inputs[2] && inputs[2].value !== pass) throw new Error('Passwords do not match.');
          auth.signUp(email, pass); toast('Account created. Welcome to EntXHub!');
        } else {
          auth.logIn(email, pass); toast('Welcome back!');
        }
        setTimeout(() => { location.href = params.get('next') || 'index.html'; }, 900);
      } catch (err) { toast(err.message); }
    });
    form.querySelectorAll('.go, .fb').forEach((el) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const provider = el.classList.contains('go') ? 'Google' : 'Facebook';
        const email = 'guest.' + provider.toLowerCase() + '@entxhub.demo';
        const users = auth.users(); users[email] = users[email] || { email, password: Math.random().toString(36), name: provider + ' user' };
        store.set('users', users); store.set('session', { email, name: users[email].name });
        toast('Signed in with ' + provider + ' (demo).');
        setTimeout(() => { location.href = 'index.html'; }, 900);
      });
    });
  }

  // ---------- cart ----------
  const cart = {
    items: () => store.get('cart', []),
    save(items) { store.set('cart', items); updateBadges(); },
    add(item, qty = 1) {
      const items = cart.items();
      const key = item.id + (item.option ? '|' + item.option : '');
      const found = items.find((i) => i.key === key);
      if (found) found.qty += qty; else items.push({ ...item, key, qty });
      cart.save(items);
      toast(`Added to cart: ${item.title}${item.option ? ' (' + item.option + ')' : ''}`);
    },
    count: () => cart.items().reduce((n, i) => n + i.qty, 0),
  };
  function updateBadges() {
    const n = cart.count();
    document.querySelectorAll('.cartlogo').forEach((b) => {
      b.style.position = 'relative';
      let badge = b.querySelector('.entx-badge');
      if (!badge) { badge = document.createElement('span'); badge.className = 'entx-badge'; b.appendChild(badge); }
      badge.textContent = n; badge.classList.toggle('entx-hidden', n === 0);
    });
  }

  function renderCartPage() {
    const cartCol = document.querySelector('.col-md-8.cart');
    const summary = document.querySelector('.summary');
    if (!cartCol || !summary) return;
    const titleRow = cartCol.querySelector('.title');
    const back = cartCol.querySelector('.back-to-shop');
    cartCol.querySelectorAll(':scope > .row').forEach((r) => r.remove());
    const list = document.createElement('div');
    titleRow.after(list);
    const draw = () => {
      const items = cart.items();
      const count = items.reduce((n, i) => n + i.qty, 0);
      const subtotal = items.reduce((n, i) => n + i.qty * i.price, 0);
      const delivery = items.length ? 50 : 0;
      const tax = Math.round(subtotal * 0.005);
      titleRow.querySelector('.text-muted').textContent = count + (count === 1 ? ' item' : ' items');
      list.innerHTML = items.length ? items.map((i, idx) => `
        <div class="row ${idx % 2 ? '' : 'border-top border-bottom'}"><div class="row main align-items-center">
          <div class="col-2"><img class="img-fluid" src="${esc(i.img)}" alt=""></div>
          <div class="col"><div class="row text-muted">${esc(i.type || 'Item')}</div><div class="row">${esc(i.title)}${i.option ? ' · ' + esc(i.option) : ''}</div></div>
          <div class="col"><span class="entx-qty"><button data-dec="${idx}" aria-label="Decrease">−</button><b>${i.qty}</b><button data-inc="${idx}" aria-label="Increase">+</button></span></div>
          <div class="col">${rs(i.price * i.qty)} <span class="close" data-del="${idx}" role="button" title="Remove" style="cursor:pointer">&#10005;</span></div>
        </div></div>`).join('') : '<div class="entx-empty">Your cart is empty. <a href="shop.html">Browse the shop</a> or <a href="events.html">book an event</a>.</div>';
      const rows = summary.querySelectorAll('.row');
      const setRow = (label, val) => rows.forEach((r) => { const c = r.querySelectorAll('.col'); if (c[0] && c[0].textContent.trim().toUpperCase() === label) c[1].textContent = val; });
      setRow('ITEMS', String(count)); setRow('TOTAL', rs(subtotal)); setRow('DELIVERY', rs(delivery)); setRow('TAX', rs(tax)); setRow('TOTAL PRICE', rs(subtotal + delivery + tax));
      list.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => { const it = cart.items(); it[b.dataset.inc].qty++; cart.save(it); draw(); });
      list.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => { const it = cart.items(); const i = it[b.dataset.dec]; i.qty--; if (i.qty < 1) it.splice(b.dataset.dec, 1); cart.save(it); draw(); });
      list.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { const it = cart.items(); const [gone] = it.splice(b.dataset.del, 1); cart.save(it); toast('Removed ' + gone.title); draw(); });
    };
    if (back) { back.style.cursor = 'pointer'; back.onclick = () => { location.href = 'shop.html'; }; }
    draw();
    const checkout = summary.querySelector('button');
    if (checkout) checkout.onclick = () => {
      const items = cart.items();
      if (!items.length) return toast('Your cart is empty.');
      const total = summary.querySelectorAll('.row'); const totalText = [...total].pop().querySelectorAll('.col')[1].textContent;
      const user = auth.current();
      modal(`<h3>Checkout</h3><p>${items.length} item(s) · <b>${esc(totalText)}</b></p>
        <form id="entx-co"><label>Full name</label><input required value="${user ? esc(user.name) : ''}">
        <label>Delivery address</label><textarea required rows="2"></textarea>
        <label>Payment</label><select><option>Cash on delivery</option><option>Card on delivery</option></select>
        <button class="entx-btn" type="submit">Place order</button></form>`, (m, close) => {
        m.querySelector('#entx-co').onsubmit = (e) => {
          e.preventDefault();
          const orders = store.get('orders', []); const id = 'EX-' + Date.now().toString().slice(-6);
          orders.push({ id, items, total: totalText, at: new Date().toISOString() }); store.set('orders', orders);
          cart.save([]); close(); draw();
          modal(`<h3>Order placed</h3><p>Your order <b>${id}</b> has been placed. You'll pay on delivery.</p><a class="entx-btn" href="shop.html">Continue shopping</a>`);
        };
      });
    };
  }

  // ---------- shop ----------
  function enhanceShop() {
    const cards = [...document.querySelectorAll('.product-card')];
    cards.forEach((card, i) => {
      const p = PRODUCTS[i] || { id: 'item-' + i, title: card.querySelector('h3').textContent.trim(), price: parseInt(card.querySelector('.price').textContent.replace(/\D/g, ''), 10), img: card.querySelector('img').getAttribute('src'), type: 'Clothing' };
      card.dataset.price = p.price;
      const link = card.closest('a');
      if (link) link.setAttribute('href', 'product-info.html?id=' + p.id);
      const add = document.createElement('button');
      add.className = 'entx-add'; add.type = 'button'; add.textContent = 'Add to cart';
      add.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cart.add({ id: p.id, title: p.title, price: p.price, img: p.img, type: 'Clothing', option: 'Medium' }); });
      card.appendChild(add);
    });
    // working price filter (Rs 0 – 2000)
    const range = document.getElementById('priceRange');
    if (range) {
      range.min = 0; range.max = 2000; range.step = 50; range.value = 2000;
      let out = document.getElementById('entx-price-out');
      if (!out) { out = document.createElement('p'); out.id = 'entx-price-out'; out.style.color = 'beige'; range.after(out); }
      const apply = () => {
        out.textContent = 'Up to ' + rs(range.value);
        let shown = 0;
        cards.forEach((c) => { const ok = Number(c.dataset.price) <= Number(range.value); (c.closest('a') || c).classList.toggle('entx-hidden', !ok); shown += ok; });
        out.textContent += ` · ${shown} product${shown === 1 ? '' : 's'}`;
      };
      range.addEventListener('input', apply); apply();
    }
    // color and size pickers become real selectable options
    document.querySelectorAll('.circle').forEach((c) => {
      c.style.cursor = 'pointer'; c.title = 'Select colour';
      c.addEventListener('click', () => { document.querySelectorAll('.circle').forEach((x) => x.classList.remove('entx-on')); c.classList.add('entx-on'); toast('Colour selected: ' + (c.classList[1] || '')); });
    });
    document.querySelectorAll('.left-column div').forEach((d) => {
      const m = d.textContent.match(/^\s*\[\]\s*(Small|Medium|Large)\s*$/);
      if (m) d.innerHTML = `<label style="cursor:pointer"><input type="checkbox" value="${m[1]}"> ${m[1]}</label>`;
    });
  }

  function enhanceProductPage() {
    const p = PRODUCTS.find((x) => x.id === params.get('id')) || PRODUCTS[0];
    const title = [...document.querySelectorAll('h3')].find((h) => /T-Shirt|Crop|Shirt/i.test(h.textContent));
    if (title) title.innerHTML = '&nbsp;' + esc(p.title);
    document.title = p.title + ' · EntXHub Shop';
    const featured = document.getElementById('featured-image');
    if (featured) featured.src = p.img;
    document.querySelectorAll('.small-Img').forEach((img) => {
      img.src = p.img; img.style.cursor = 'pointer';
      img.onclick = () => { featured.src = img.src; document.querySelectorAll('.small-Img').forEach((x) => x.classList.remove('sm-card')); img.classList.add('sm-card'); };
    });
    document.querySelectorAll('h4, h2, p').forEach((el) => { if (/^\s*Rs\.?\s*\d/.test(el.textContent) && el.children.length === 0) el.textContent = rs(p.price); });
    const addBtn = [...document.querySelectorAll('button')].find((b) => /add to cart/i.test(b.textContent));
    if (addBtn) addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const qtyInput = document.querySelector('.quantity input');
      const size = document.getElementById('size');
      const qty = Math.max(1, parseInt(qtyInput && qtyInput.value, 10) || 1);
      cart.add({ id: p.id, title: p.title, price: p.price, img: p.img, type: 'Clothing', option: size ? size.options[size.selectedIndex].text : '' }, qty);
    });
  }

  // ---------- events ----------
  function enhanceEvents() {
    [...document.querySelectorAll('button')].filter((b) => /book now/i.test(b.textContent)).forEach((btn, i) => {
      const ev = EVENTS[i] || { id: 'event-' + i, title: 'Event', price: 1000, img: 'concert.jpg' };
      const block = btn.closest('[class^="container"]');
      const priceEl = block && [...block.querySelectorAll('p')].find((p) => /Price/i.test(p.textContent));
      if (priceEl) { const n = parseInt(priceEl.textContent.replace(/\D/g, ''), 10); if (n) ev.price = n; }
      const h = block && block.querySelector('h2'); if (h) ev.title = h.textContent.trim();
      const img = block && block.querySelector('img'); if (img) ev.img = img.getAttribute('src');
      btn.addEventListener('click', () => {
        modal(`<h3>Book: ${esc(ev.title)}</h3><p>${rs(ev.price)} per ticket</p>
          <label>Tickets</label><input type="number" id="entx-t" min="1" max="10" value="1">
          <p id="entx-tt">Total: ${rs(ev.price)}</p>
          <button class="entx-btn" id="entx-cart">Add to cart</button><button class="entx-btn ghost" data-close>Cancel</button>`, (m, close) => {
          const t = m.querySelector('#entx-t');
          t.oninput = () => { m.querySelector('#entx-tt').textContent = 'Total: ' + rs(ev.price * Math.max(1, t.value | 0)); };
          m.querySelector('#entx-cart').onclick = () => { cart.add({ id: ev.id, title: ev.title, price: ev.price, img: ev.img, type: 'Event ticket' }, Math.max(1, t.value | 0)); close(); };
        });
      });
    });
  }

  // ---------- games ----------
  function enhanceGames() {
    document.querySelectorAll('.image a[href="#"], .image-row a[href="#"]').forEach((a) => {
      const img = a.querySelector('img'); if (!img) return;
      const file = decodeURIComponent(img.getAttribute('src').split('/').pop());
      const [name, genre] = GAMES[file] || [img.alt || 'Game', 'Game'];
      a.setAttribute('href', 'https://www.google.com/search?q=' + encodeURIComponent(name + ' game'));
      a.title = name;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        modal(`<img src="${esc(img.getAttribute('src'))}" alt=""><h3>${esc(name)}</h3><p>${esc(genre)}</p>
          <a class="entx-btn" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' official trailer')}">Watch trailer</a>
          <a class="entx-btn ghost" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(name + ' game')}">Game info</a>`);
      });
    });
  }

  // ---------- movies ----------
  function enhanceMovieCards() {
    document.querySelectorAll('.movie-card').forEach((card) => {
      const t = card.querySelector('.card-title'); const a = card.querySelector('a');
      if (!t || !a) return;
      const m = MOVIES.find((x) => x.title.toLowerCase() === t.textContent.trim().toLowerCase());
      if (m) card.querySelectorAll('a').forEach((link) => { if (/movie-details/.test(link.getAttribute('href') || '')) link.setAttribute('href', 'movie-details.html?id=' + m.id); });
    });
  }
  function enhanceMovieDetails() {
    const m = MOVIES.find((x) => x.id === params.get('id')) || MOVIES.find((x) => x.id === 'peaky-blinders');
    document.title = m.title + ' · EntXHub';
    const banner = document.querySelector('.movie-detail-banner img'); if (banner) { banner.src = m.img; banner.alt = m.title + ' poster'; }
    const sub = document.querySelector('.detail-subtitle'); if (sub) sub.textContent = m.type;
    const title = document.querySelector('.detail-title');
    if (title) { const words = m.title.split(' '); const last = words.pop(); title.innerHTML = esc(words.join(' ')) + (words.length ? ' ' : '') + '<strong>' + esc(last) + '</strong>'; }
    const genreWrap = document.querySelector('.movie-detail .ganre-wrapper');
    if (genreWrap) genreWrap.innerHTML = m.genres.split(', ').map((g, i, arr) => `<a href="movie.html">${esc(g)}${i < arr.length - 1 ? ',' : ''}</a>`).join(' ');
    const story = document.querySelector('.storyline');
    if (story && m.id !== 'peaky-blinders') story.textContent = `${m.title} is a ${m.genres.toLowerCase()} ${m.type.toLowerCase()} available to stream on EntXHub. Press play to watch the official trailer.`;
    document.querySelectorAll('a[href="player.html"]').forEach((a) => a.setAttribute('href', 'player.html?id=' + m.id));
  }
  function enhancePlayer() {
    const m = MOVIES.find((x) => x.id === params.get('id')) || MOVIES.find((x) => x.id === 'peaky-blinders');
    const link = document.querySelector('.trailer-link');
    if (link) {
      link.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(m.title + ' official trailer');
      const img = link.querySelector('img'); if (img) { img.src = m.img; img.alt = m.title; }
      const p = link.querySelector('p'); if (p) p.innerHTML = '&#9654; Watch the official ' + esc(m.title) + ' trailer on YouTube';
    }
    document.querySelectorAll('h1, h2').forEach((h) => { if (/peaky/i.test(h.textContent)) h.textContent = m.title; });
  }

  // ---------- search ----------
  function setupSearch() {
    const box = document.getElementById('search-box');
    const input = box && box.querySelector('input');
    if (!input) return;
    box.style.position = box.style.position || 'absolute';
    const results = document.createElement('div');
    results.className = 'entx-results entx-hidden';
    box.appendChild(results);
    const all = [
      ...MOVIES.map((m) => ({ title: m.title, sub: m.type, img: m.img, href: 'movie-details.html?id=' + m.id })),
      ...PRODUCTS.map((p) => ({ title: p.title, sub: 'Shop · ' + rs(p.price), img: p.img, href: 'product-info.html?id=' + p.id })),
      ...EVENTS.map((e) => ({ title: e.title, sub: 'Event · ' + rs(e.price), img: e.img, href: 'events.html' })),
      ...Object.entries(GAMES).map(([f, [n, g]]) => ({ title: n, sub: 'Game · ' + g, img: 'game pictures/' + f, href: 'games.html' })),
    ];
    const run = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.classList.add('entx-hidden'); return; }
      const hits = all.filter((x) => (x.title + ' ' + x.sub).toLowerCase().includes(q)).slice(0, 8);
      results.innerHTML = hits.length ? hits.map((h) => `<a href="${esc(h.href)}"><img src="${esc(h.img)}" alt=""><span>${esc(h.title)}<small>${esc(h.sub)}</small></span></a>`).join('') : '<div class="none">No results for “' + esc(input.value) + '”</div>';
      results.classList.remove('entx-hidden');
    };
    input.addEventListener('input', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = results.querySelector('a'); if (first) location.href = first.href; } if (e.key === 'Escape') results.classList.add('entx-hidden'); });
  }

  // ---------- placeholder links → real destinations ----------
  function fixPlaceholderLinks() {
    const map = {
      'tv show': 'movie.html#webseries-section-button', 'web series': 'movie.html#webseries-section-button', 'pricing': 'info.html#pricing',
      'faq': 'info.html#faq', 'help center': 'info.html#help', 'terms of use': 'info.html#terms', 'privacy': 'info.html#privacy',
      'stream': 'movie.html', 'play': 'games.html', 'shop': 'shop.html', 'attend': 'events.html', 'contact us': 'info.html#contact',
    };
    const social = { 'logo-facebook': 'https://www.facebook.com/', 'logo-twitter': 'https://x.com/', 'logo-pinterest': 'https://www.pinterest.com/', 'logo-linkedin': 'https://www.linkedin.com/', 'logo-instagram': 'https://www.instagram.com/', 'logo-youtube': 'https://www.youtube.com/' };
    document.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (href && href !== '#' && !/^javascript/i.test(href)) return;
      if (a.closest('.image, .image-row, .movie-detail .ganre-wrapper')) return;
      const icon = a.querySelector('ion-icon');
      if (icon && social[icon.getAttribute('name')]) { a.href = social[icon.getAttribute('name')]; a.target = '_blank'; a.rel = 'noopener'; return; }
      const key = a.textContent.trim().toLowerCase().replace(/[.,]$/, '');
      if (map[key]) { a.href = map[key]; return; }
      if (a.querySelector('button') && /contact/i.test(a.textContent)) a.href = 'info.html#contact';
    });
  }

  function wireContactForm() {
    document.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
      if (!auth.current()) { toast('Please log in or sign up to choose a plan.'); setTimeout(() => { location.href = 'loginmain.html?next=info.html%23pricing'; }, 1200); return; }
      store.set('plan', b.dataset.plan); toast(b.dataset.plan + ' plan selected. Enjoy!');
    }));
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msgs = store.get('messages', []);
      msgs.push(Object.fromEntries(new FormData(form))); store.set('messages', msgs);
      form.reset(); toast("Thanks! Your message has been sent. We'll reply within 24 hours.");
    });
  }

  // ---------- init ----------
  document.addEventListener('DOMContentLoaded', () => {
    fixPlaceholderLinks();
    setupSearch();
    renderAuthButtons();
    updateBadges();
    if (page === 'loginmain.html') wireAuthForm('login');
    if (page === 'signup.html') wireAuthForm('signup');
    if (page === 'shop.html') enhanceShop();
    if (page === 'product-info.html') enhanceProductPage();
    if (page === 'cart.html') renderCartPage();
    if (page === 'events.html') enhanceEvents();
    if (page === 'games.html') enhanceGames();
    if (page === 'movie.html' || page === 'showmore.html') enhanceMovieCards();
    if (page === 'movie-details.html') enhanceMovieDetails();
    if (page === 'player.html') enhancePlayer();
    if (page === 'info.html') wireContactForm();
  });
})();
