/* EntXHub site features: accounts, cart, checkout, event bookings, plans, watch history, search,
   product / movie pages and real targets for every footer/social/genre link.
   Everything is stored by the Node.js API in MongoDB (/api, see api/index.js). The browser only keeps
   the session token and a guest cart until the visitor logs in. */
(function () {
  'use strict';

  // ---------- storage helpers ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('entx-' + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('entx-' + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ } },
  };
  // ---------- API ----------
  async function api(path, opts = {}) {
    const sess = store.get('session', null);
    const res = await fetch('/api/' + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(sess && sess.token ? { Authorization: 'Bearer ' + sess.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && sess) { store.set('session', null); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }
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
  .entx-hidden{display:none!important}
  .entx-modal.entx-video{max-width:880px;padding:18px}
  .entx-frame{position:relative;width:100%;padding-top:56.25%;background:#000;border-radius:10px;overflow:hidden;margin-top:10px}
  .entx-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
  .entx-carcap{position:absolute;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 12px;padding:8px 16px;border-radius:12px;background:rgba(10,10,18,.82);border:1px solid #2c2c3d;color:#ddd;z-index:20;width:max-content;max-width:94vw;text-align:center}
  .entx-carcap b{color:#fff;font-size:17px}.entx-carcap span{color:#aaa;font-size:13px}.entx-carcap .entx-btn{margin:0;padding:6px 14px;font-size:14px}
  .entx-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.entx-actions .entx-btn{margin:0}
  .entx-back{display:inline-block;color:#fff;text-decoration:none;font-weight:600;margin-bottom:12px}
  .entx-ptitle{color:#fff;font-size:28px;margin:16px 0 4px}.entx-pmeta{color:#ccc;margin:4px 0}.entx-pmeta a{color:hsl(17,68%,58%)}
  a.entx-imglink{display:contents}.section-title h1 a{color:inherit;text-decoration:none}.section-title h1 a:hover{color:hsl(17,68%,58%)}`;
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
  // [title, type, poster, genres, year, YouTube trailer id, storyline]
  const MOVIES = [
    ['The Dark Knight Rises', 'Movie', 'assets/images/m1.png', 'Action, Crime, Drama', 2012, 'g8evyE9TuYk', 'Eight years after taking the blame for Harvey Dent, Bruce Wayne is pulled out of hiding when the masked revolutionary Bane takes Gotham hostage.'],
    ['Maula Jatt', 'Movie', 'assets/images/m5.png', 'Action, Drama', 2022, 'pEWqOAcYgpQ', 'The Legend of Maula Jatt: a fearless Punjabi hero faces the brutal Noori Natt and his clan in an epic feud of honour and revenge.'],
    ['Inception', 'Movie', 'assets/images/m2.png', 'Action, Science Fiction, Thriller', 2010, 'Qwe6qXFTdgc', 'A thief who steals secrets from inside dreams is offered one last job: plant an idea in a target\'s mind instead of taking one.'],
    ['Interstellar', 'Movie', 'assets/images/m3.png', 'Adventure, Drama, Science Fiction', 2014, 'zSWdZVtXT7E', 'With Earth running out of food, a former pilot leads a team through a wormhole to find humanity a new home among the stars.'],
    ['Jurassic World', 'Movie', 'assets/images/m4.png', 'Action, Adventure, Science Fiction', 2015, 'RFinNxS5KN4', 'A fully working dinosaur park on Isla Nublar faces disaster when a genetically engineered hybrid escapes its enclosure.'],
    ['Oppenheimer', 'Movie', 'assets/images/moooovie1.jpg', 'Biography, Drama, History', 2023, 'bK6ldnjE3Y0', 'The story of J. Robert Oppenheimer, the physicist who led the Manhattan Project, and the cost of building the atomic bomb.'],
    ['Avengers Infinity War', 'Movie', 'assets/images/m6.png', 'Action, Adventure, Science Fiction', 2018, '6ZfuNTqbHE8', 'The Avengers and their allies unite to stop Thanos from collecting all six Infinity Stones and wiping out half of all life.'],
    ['Barbie', 'Movie', 'assets/images/slide11.png', 'Comedy, Adventure, Fantasy', 2023, 'pBk4NYhWNMM', 'Barbie and Ken leave the perfect world of Barbieland and discover the joys and perils of living in the real world.'],
    ['Death on the Nile', 'Movie', 'assets/images/slide12.png', 'Crime, Mystery, Thriller', 2022, 'dZRqB0JLizw', 'Detective Hercule Poirot\'s holiday on a luxury Nile steamer turns into a murder hunt when a newlywed heiress is killed on board.'],
    ['Joker', 'Movie', 'assets/images/slide19.png', 'Crime, Drama, Thriller', 2019, 'zAGVQLHvwOY', 'Failed comedian Arthur Fleck, ignored by a crumbling Gotham, slides into madness and becomes the Joker.'],
    ['Black Panther', 'Movie', 'assets/images/slide18.png', 'Action, Adventure, Science Fiction', 2018, 'xjDjIWPwcPU', 'T\'Challa returns home to rule the hidden nation of Wakanda, but a powerful challenger threatens his throne and the world.'],
    ['Doctor Strange in the Multiverse of Madness', 'Movie', 'assets/images/upcoming-2.png', 'Action, Fantasy, Horror', 2022, 'aWzlQ2N6qqg', 'Doctor Strange opens the door to the multiverse and must face alternate versions of himself and a terrifying new threat.'],
    ['The Northman', 'Movie', 'assets/images/upcoming-1.png', 'Action, Adventure, Drama', 2022, 'oMSdFM12hOw', 'A young Viking prince sets out to avenge his murdered father, rescue his mother and kill his treacherous uncle.'],
    ['Memory', 'Movie', 'assets/images/upcoming-3.png', 'Action, Crime, Thriller', 2022, '77Dqqomrvxo', 'An expert assassin losing his memory refuses one last job and becomes the target of the people who hired him.'],
    ['The Unbearable Weight of Massive Talent', 'Movie', 'assets/images/upcoming-4.png', 'Action, Comedy', 2022, 'CKTRbKch2K4', 'Nicolas Cage plays himself, a broke actor hired to attend a superfan\'s birthday who gets dragged into a real CIA operation.'],
    ['Tokyo Ghoul', 'Anime', 'assets/images/tokyo ghoul.png', 'Action, Dark Fantasy, Horror', 2014, 'vGuQeQsoRgU', 'College student Ken Kaneki becomes half-ghoul after a deadly encounter and must survive in a hidden world of flesh-eating ghouls.'],
    ['Death Note', 'Anime', 'assets/images/death note.png', 'Mystery, Psychological Thriller', 2006, 'NlJZ-YgAt-c', 'A brilliant student finds a notebook that kills anyone whose name is written in it, and a genius detective sets out to catch him.'],
    ['Attack On Titan', 'Anime', 'assets/images/attack on titians.png', 'Action, Dark Fantasy', 2013, 'LV-nazLVmgo', 'Humanity lives behind giant walls to hide from man-eating Titans, until the day the walls are broken and Eren Yeager vows revenge.'],
    ['Dragon Ball Z', 'Anime', 'assets/images/dragon ball z.png', 'Action, Adventure, Martial Arts', 1989, 'Bh481ps0sGE', 'Goku and his friends defend Earth from ever stronger enemies, from Saiyan warriors to the tyrant Frieza.'],
    ['One Piece', 'Anime', 'assets/images/one piece.png', 'Action, Adventure, Comedy', 1999, '1KMcoJBMWE4', 'Monkey D. Luffy and his Straw Hat crew sail the Grand Line in search of the legendary treasure, the One Piece.'],
    ['Pokemon', 'Anime', 'assets/images/pokemon.png', 'Adventure, Family', 2023, '_c_hMehCORQ', 'Pokémon Horizons follows Liko and Roy as they travel the world with their Pokémon and uncover the mysteries of their pendants.'],
    ['Naruto', 'Anime', 'assets/images/aruto.png', 'Action, Adventure, Martial Arts', 2007, '22R0j8UKRzY', 'Naruto Uzumaki returns to the Hidden Leaf stronger than ever to protect his friends and bring Sasuke home.'],
    ['Lucifer', 'Web Series', 'assets/images/ws1.png', 'Crime, Drama, Fantasy', 2016, 'X4bF_quwNtw', 'Bored of ruling Hell, Lucifer Morningstar opens a nightclub in Los Angeles and starts helping the LAPD solve crimes.'],
    ['Dark', 'Web Series', 'assets/images/ws2.png', 'Mystery, Science Fiction, Thriller', 2017, 'ESEUoa-mz2c', 'The disappearance of two children in a small German town exposes a time-travel conspiracy that spans four families and three generations.'],
    ['Money Heist', 'Web Series', 'assets/images/ws5.png', 'Action, Crime, Thriller', 2021, 'sOK-lHOIJZ8', 'The Professor and his team in red jumpsuits pull off the most ambitious robberies in Spain, against the police and against time.'],
    ['Peaky Blinders', 'Web Series', 'assets/images/ws4.png', 'Crime, Drama', 2022, '2nsT9uQPIrk', 'A British crime drama set in post-war Birmingham, following Thomas Shelby and his family as they build an empire through crime and politics.'],
    ['Loki', 'Web Series', 'assets/images/ws3.png', 'Action, Adventure, Fantasy', 2021, 'nW948Va-l10', 'After stealing the Tesseract, Loki is arrested by the Time Variance Authority and forced to help fix the timeline he broke.'],
    ['Squid Game', 'Web Series', 'assets/images/ws6.png', 'Drama, Survival, Thriller', 2021, 'oqxAJKy0ii4', 'Hundreds of people in debt accept an invitation to play children\'s games for a huge cash prize, where losing means death.'],
    ['Stranger Things', 'Web Series', 'assets/images/ws7.png', 'Drama, Horror, Science Fiction', 2022, 'a3thyAnShck', 'In season 4, the friends from Hawkins are split apart as a new evil from the Upside Down, Vecna, begins to hunt the town.'],
    ['Vikings Valhalla', 'Web Series', 'assets/images/slide14.png', 'Action, Adventure, Drama', 2022, 'Yi4YnwFT7Gk', 'A hundred years after Vikings, Leif Eriksson, Freydís and Harald Sigurdsson fight for power as Viking rule clashes with Christian England.'],
    ['Tauha Ibne Jalil', 'Podcast', 'assets/images/p1.png', 'Talk, Lifestyle', 2023, 'P5AFbrsFXi0', 'Story of Change: Tuaha Ibn Jalil talks about faith, failure and finding purpose.'],
    ['Gold Minds', 'Podcast', 'assets/images/p4.png', 'Talk, Business', 2023, '9Kejiecz2R0', 'Gold Minds with Kevin Hart: candid conversations with artists and entrepreneurs about the journeys behind their success.'],
    ['Andrew Tate', 'Podcast', 'assets/images/p5.png', 'Talk, Interview', 2022, 'iv-C4CVGk28', 'A long-form interview with Patrick Bet-David on the PBD Podcast.'],
    ['Junaid Akram', 'Podcast', 'assets/images/p2.png', 'Talk, Comedy', 2023, 'g-4Y0tqlKUA', 'Junaid Akram\'s Podcast: comedy, life advice and honest chats with guests from across Pakistan.'],
    ['Muzammil Hassan', 'Podcast', 'assets/images/p3.png', 'Talk, Education', 2024, 'e5tsbtQxqPc', 'The TBT Podcast with Muzamil Hasan: history, business and big ideas explained with guests.'],
  ].map(([title, type, img, genres, year, trailer, story]) => ({ id: slug(title), title, type, img, genres, year, trailer, story }));
  // posters used by the movie.html carousel and the home page → title ids
  const POSTERS = { 'slide11.png': 'barbie', 'slide12.png': 'death-on-the-nile', 'slide13.png': 'money-heist', 'slide14.png': 'vikings-valhalla',
    'slide15.png': 'doctor-strange-in-the-multiverse-of-madness', 'slide17.png': 'stranger-things', 'slide18.png': 'black-panther', 'slide19.png': 'joker',
    'upcoming-1.png': 'the-northman', 'upcoming-2.png': 'doctor-strange-in-the-multiverse-of-madness', 'upcoming-3.png': 'memory', 'upcoming-4.png': 'the-unbearable-weight-of-massive-talent' };

  const PRODUCTS = [
    ['barbie-tshirt', 'Barbie T-Shirt', 1600, 'assets/images/shop1.jpg'], ['barbie-croptop', 'Barbie CropTop', 1900, 'assets/images/shop2.jpg'],
    ['batman-tshirt', 'Batman T-Shirt', 1600, 'assets/images/shop3.jpg'], ['dark-knight-shirt', 'Dark Knight Shirt', 1500, 'assets/images/shop4.jpg'],
    ['captain-america', 'Captain America', 1300, 'assets/images/shop5.jpg'], ['avengers-tshirt', 'Avengers T-Shirt', 1450, 'assets/images/shop6.jpg'],
    ['simba-tshirt', 'Simba T-Shirt', 1500, 'assets/images/shop7.jpg'], ['barbie-tshirt-classic', 'Barbie T-Shirt (Classic)', 1200, 'assets/images/shop1.jpg'],
  ].map(([id, title, price, img]) => ({ id, title, price, img, type: 'Clothing' }));

  // game artwork file → [name, genre, YouTube trailer id, where to play / official page]
  const GAMES = {
    'abd47e100099495.60427765e8914.jpg': ['Red Dead Redemption 2', 'Open-world western adventure', 'gmA6MrX81z4', 'https://www.rockstargames.com/reddeadredemption2'],
    'asphalt 8.jpg': ['Asphalt 8', 'Arcade racing', 'jpSGZsgga_I', 'https://www.gameloft.com/game/asphalt-8'],
    'fortnite-1920x1080-hd-cvavgntkwzkn72rg.jpg': ['Fortnite', 'Battle royale', 'qpKtzf5fXn4', 'https://www.fortnite.com/'],
    'marvels-spider-man-2560x1440-12229.jpeg': ["Marvel's Spider-Man", 'Superhero action', 'q4GdJVvdxss', 'https://www.playstation.com/en-us/games/marvels-spider-man-remastered/'],
    'gta 5.jpg': ['GTA V', 'Open-world crime', 'hvoD7ehZPcM', 'https://www.rockstargames.com/gta-v'],
    'minion-rush-5120x2880-12236.jpg': ['Minion Rush', 'Endless runner', 'E4HclOqb4D4', 'https://www.gameloft.com/game/minion-rush'],
    'gta vice city.jpg': ['GTA Vice City', 'Open-world crime classic', 'm8oQllwqw_I', 'https://www.rockstargames.com/games/vicecity'],
    'sonic-generations-hd-398arg8tmhi6x186.jpg': ['Sonic Generations', 'Platformer', 'O9N8D1LTdug', 'https://www.sonicthehedgehog.com/'],
    'cod black ops 3.jpg': ['Call of Duty: Black Ops III', 'First-person shooter', 'qAUYNIDEJ6o', 'https://www.callofduty.com/'],
    'batman.jpg': ['Batman: Arkham Knight', 'Action adventure', 'JeGAQXY2FzI', 'https://store.steampowered.com/app/208650/'],
    'gta 4.jpg': ['GTA IV', 'Open-world crime', 'M80K51DosFo', 'https://www.rockstargames.com/IV'],
    'nfs underrcover.jpg': ['Need for Speed: Undercover', 'Street racing', 'mkHJzHIbQQg', 'https://www.ea.com/games/need-for-speed'],
    'residen evil.jpeg': ['Resident Evil 4', 'Survival horror', 'Id2EaldBaWw', 'https://www.residentevil.com/re4/'],
    'desktop-wallpaper-need-for-speed-underground-3-nfs-underground-2.jpg': ['Need for Speed: Underground 2', 'Street racing', 'xYVIrJBJOhE', 'https://www.ea.com/games/need-for-speed'],
    'babrie.jpeg': ['Barbie Dreamhouse Adventures', 'Family simulation', 'unzg4mn12zA', 'https://www.budgestudios.com/en/'],
    'san andreas.jpg': ['GTA San Andreas', 'Open-world crime classic', 'daw8xhaGj2s', 'https://www.rockstargames.com/sanandreas'],
    'Need-For-Speed-series-1024x562.jpeg': ['Need for Speed Unbound', 'Racing', 'H2Y8XCe7F9E', 'https://www.ea.com/games/need-for-speed/need-for-speed-unbound'],
    'HD-wallpaper-kay-o-x-jett-valorant-game-poster.jpg': ['Valorant', 'Tactical shooter', 'AnGdzz-XWcE', 'https://playvalorant.com/'],
    'subway surfer.jpg': ['Subway Surfers', 'Endless runner', 'fGy-x3H-nxU', 'https://poki.com/en/g/subway-surfers'],
    'shadow fight arena.jpg': ['Shadow Fight Arena', 'Fighting', 'Ej_PukZhbTs', 'https://shadowfight.com/'],
    'ludo.webp': ['Ludo King', 'Board game', 'KDvdoBJiu20', 'https://ludoking.com/'],
    'mars.webp': ['Mars: Mars', 'Arcade flyer', 'gImaYwpEc2I', 'https://pomelogames.com/'],
    'ummi.png': ['Ummi', 'Casual game', '', 'https://www.google.com/search?q=Ummi+game'],
    'coc.webp': ['Clash of Clans', 'Strategy', 'XH3Xu1-cvII', 'https://supercell.com/en/games/clashofclans/'],
    'game1.jpeg': ['PUBG Mobile', 'Battle royale', 'uCd6tbUAy6o', 'https://www.pubgmobile.com/'],
    'game2.jpeg': ['Daria: A Kingdom Simulator', 'Strategy', '', 'https://www.google.com/search?q=Daria+A+Kingdom+Simulator'],
    'game3.jpeg': ['Bloodborne', 'Action RPG', 'G203e1HhixY', 'https://www.playstation.com/en-us/games/bloodborne/'],
    'game4.jpeg': ['God of War II', 'Action adventure', 'oe0OmX9hINA', 'https://www.playstation.com/en-us/god-of-war/'],
  };

  const EVENTS = [
    { id: 'music-night', title: 'Unforgettable Night of Music', price: 1200, img: 'koko.jpg' },
    { id: 'carnival', title: 'Carnival', price: 1000, img: 'themepark.jpg' },
    { id: 'boat-parade', title: 'Boat Parade', price: 800, img: 'boat.jpg' },
    { id: 'echoes-of-emotion', title: "Echoes of Emotion (Drama)", price: 1500, img: 'concert.jpg' },
  ];

  // ---------- auth (accounts in MongoDB, passwords hashed with bcrypt, JWT session) ----------
  const auth = {
    current: () => store.get('session', null),
    async start(res) { store.set('session', { token: res.token, email: res.user.email, name: res.user.name, plan: res.user.plan }); await cart.mergeGuest(); },
    async signUp(email, password) { await auth.start(await api('auth/signup', { body: { email, password } })); },
    async logIn(email, password) { await auth.start(await api('auth/login', { body: { email, password } })); },
    logOut() { store.set('session', null); store.set('cart', []); },
  };

  function renderAuthButtons() {
    const user = auth.current();
    document.querySelectorAll('a[href="loginmain.html"], a[href="./loginmain.html"]').forEach((a) => {
      const btn = a.querySelector('button');
      if (!user) return;
      if (btn) btn.textContent = 'My account';
      else if (/login/i.test(a.textContent)) a.textContent = 'My account';
      a.addEventListener('click', (e) => { e.preventDefault(); openAccount(); });
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
      (async () => {
        try {
          if (!email) throw new Error('Please enter your email or phone.');
          if (pass.length < 6) throw new Error('Password must be at least 6 characters.');
          const submit = form.querySelector('button, [type=submit]'); if (submit) submit.disabled = true;
          if (mode === 'signup') {
            if (inputs[2] && inputs[2].value !== pass) throw new Error('Passwords do not match.');
            await auth.signUp(email, pass); toast('Account created. Welcome to EntXHub!');
          } else {
            await auth.logIn(email, pass); toast('Welcome back!');
          }
          setTimeout(() => { location.href = resumeTarget((auth.current() || {}).email); }, 900);
        } catch (err) { toast(err.message); const submit = form.querySelector('button, [type=submit]'); if (submit) submit.disabled = false; }
      })();
    });
  }

  // ---------- cart ----------
  // Guests keep their cart in this browser; signed-in carts are saved to MongoDB.
  const cart = {
    items: () => store.get('cart', []),
    save(items) {
      store.set('cart', items); updateBadges();
      if (auth.current()) api('cart', { method: 'PUT', body: { items } }).catch((e) => toast(e.message));
    },
    async load() {
      if (!auth.current()) return;
      try { store.set('cart', await api('cart')); updateBadges(); } catch (e) { /* offline: keep local copy */ }
    },
    async mergeGuest() {
      const guest = store.get('cart', []);
      let server = [];
      try { server = await api('cart'); } catch (e) { /* ignore */ }
      for (const g of guest) { const f = server.find((s) => s.key === g.key); if (f) f.qty += g.qty; else server.push(g); }
      store.set('cart', server);
      if (guest.length) await api('cart', { method: 'PUT', body: { items: server } }).catch(() => {});
    },
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
      if (!auth.current()) { toast('Please log in to place your order. Your cart is kept.'); setTimeout(() => { location.href = 'loginmain.html?next=cart.html'; }, 1100); return; }
      const total = summary.querySelectorAll('.row'); const totalText = [...total].pop().querySelectorAll('.col')[1].textContent;
      const user = auth.current();
      modal(`<h3>Checkout</h3><p>${items.length} item(s) · <b>${esc(totalText)}</b></p>
        <form id="entx-co"><label>Full name</label><input name="name" required value="${user ? esc(user.name) : ''}">
        <label>Delivery address</label><textarea name="address" required minlength="6" rows="2"></textarea>
        <label>Payment</label><select name="payment"><option>Cash on delivery</option><option>Card on delivery</option></select>
        <button class="entx-btn" type="submit">Place order</button></form>`, (m, close) => {
        m.querySelector('#entx-co').onsubmit = async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.target));
          const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Placing order…';
          try {
            const order = await api('orders', { body: { ...f, items: items.map((i) => ({ id: i.id, qty: i.qty, option: i.option })) } });
            store.set('cart', []); updateBadges(); close(); draw();
            modal(`<h3>Order placed</h3><p>Your order <b>${esc(order._id)}</b> for <b>${rs(order.total)}</b> has been saved. You'll pay on delivery.</p><a class="entx-btn" href="shop.html">Continue shopping</a><button class="entx-btn ghost" id="entx-acc">My orders</button>`, (mm) => { mm.querySelector('#entx-acc').onclick = openAccount; });
          } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = 'Place order'; }
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
      if (block && !block.id) block.id = ev.id;
      const priceEl = block && [...block.querySelectorAll('p')].find((p) => /Price/i.test(p.textContent));
      if (priceEl) { const n = parseInt(priceEl.textContent.replace(/\D/g, ''), 10); if (n) ev.price = n; }
      const h = block && block.querySelector('h2'); if (h) ev.title = h.textContent.trim();
      const img = block && block.querySelector('img'); if (img) ev.img = img.getAttribute('src');
      btn.addEventListener('click', () => {
        modal(`<h3>Book: ${esc(ev.title)}</h3><p>${rs(ev.price)} per ticket</p>
          <label>Tickets</label><input type="number" id="entx-t" min="1" max="10" value="1">
          <p id="entx-tt">Total: ${rs(ev.price)}</p>
          <p id="entx-seats" style="color:#9a9">Checking seats…</p>
          <button class="entx-btn" id="entx-book">Book now</button><button class="entx-btn ghost" id="entx-cart">Add to cart</button>`, (m, close) => {
          const t = m.querySelector('#entx-t');
          t.oninput = () => { m.querySelector('#entx-tt').textContent = 'Total: ' + rs(ev.price * Math.max(1, t.value | 0)); };
          api('events').then((list) => { const live = list.find((x) => x.id === ev.id); m.querySelector('#entx-seats').textContent = live ? live.seatsLeft + ' seats left' : ''; }).catch(() => { m.querySelector('#entx-seats').textContent = ''; });
          m.querySelector('#entx-cart').onclick = () => { cart.add({ id: ev.id, title: ev.title, price: ev.price, img: ev.img, type: 'Event ticket' }, Math.max(1, t.value | 0)); close(); };
          m.querySelector('#entx-book').onclick = async () => {
            if (!auth.current()) { toast('Please log in to book tickets.'); setTimeout(() => { location.href = 'loginmain.html?next=events.html'; }, 1100); return; }
            try {
              const b = await api('bookings', { body: { eventId: ev.id, tickets: Math.max(1, t.value | 0) } });
              close(); modal(`<h3>Booking confirmed</h3><p><b>${esc(b.title)}</b> · ${b.tickets} ticket(s) · ${rs(b.amount)}</p><p>Booking reference <b>${esc(b._id)}</b>. Show it at the gate.</p><button class="entx-btn" id="entx-acc">My bookings</button>`, (mm) => { mm.querySelector('#entx-acc').onclick = openAccount; });
            } catch (err) { toast(err.message); }
          };
        });
      });
    });
  }

  // ---------- trailers (YouTube privacy-enhanced embed) ----------
  const embed = (id) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  const ytWatch = (id) => 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
  const gameImg = (file) => (/^game\d\.jpeg$/.test(file) ? 'assets/images/' : 'game pictures/') + file;
  function trailerModal(title, id, extraHtml) {
    const bg = document.createElement('div');
    bg.className = 'entx-modal-bg';
    bg.innerHTML = `<div class="entx-modal entx-video"><button class="entx-close" aria-label="Close">&times;</button><h3>${esc(title)}</h3>
      <div class="entx-frame"><iframe src="${embed(id)}" title="${esc(title)} trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>${extraHtml || ''}</div>`;
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.classList.contains('entx-close')) close(); });
    document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
    document.body.appendChild(bg);
  }

  // ---------- games ----------
  function openGame(file) {
    const [name, genre, trailer, site] = GAMES[file] || ['Game', 'Game', '', ''];
    const links = `<p>${esc(genre)}</p><a class="entx-btn" target="_blank" rel="noopener" href="${esc(site)}">Play / official page</a>`;
    if (trailer) trailerModal(name, trailer, links);
    else modal(`<img src="${esc(gameImg(file))}" alt=""><h3>${esc(name)}</h3>${links}`);
  }
  function enhanceGames() {
    document.querySelectorAll('.image a, .image-row a').forEach((a) => {
      const img = a.querySelector('img'); if (!img) return;
      const file = decodeURIComponent(img.getAttribute('src').split('/').pop());
      if (!GAMES[file]) return;
      a.setAttribute('href', 'games.html?game=' + encodeURIComponent(file));
      a.title = GAMES[file][0] + ' · watch trailer';
      a.addEventListener('click', (e) => { e.preventDefault(); openGame(file); });
    });
    const g = params.get('game'); if (g && GAMES[g]) openGame(g);
  }

  // ---------- movies ----------
  const findTitle = (id) => MOVIES.find((x) => x.id === id);
  function enhanceMovieCards() {
    document.querySelectorAll('.movie-card').forEach((card) => {
      const t = card.querySelector('.card-title'); const a = card.querySelector('a');
      if (!t || !a) return;
      const m = MOVIES.find((x) => x.title.toLowerCase() === t.textContent.trim().toLowerCase());
      if (m) card.querySelectorAll('a').forEach((link) => { if (/movie-details/.test(link.getAttribute('href') || '')) link.setAttribute('href', 'movie-details.html?id=' + m.id); });
    });
    // big poster carousel: clicking the poster in the middle opens it; a caption under it offers trailer + details
    const car = document.getElementById('carousel');
    if (!car) return;
    const idOf = (item) => { const img = item && item.querySelector('img'); return img ? POSTERS[img.getAttribute('src').split('/').pop()] || 'podcasts' : null; };
    const cap = document.createElement('div');
    cap.className = 'entx-carcap';
    const draw = () => {
      const sel = car.querySelector('.selected'); const id = idOf(sel); const m = findTitle(id);
      car.querySelectorAll(':scope > div').forEach((d) => { d.style.cursor = 'pointer'; d.title = (findTitle(idOf(d)) || { title: 'EntXHub Podcasts' }).title; });
      cap.innerHTML = m
        ? `<b>${esc(m.title)}</b><span>${esc(m.type)} · ${m.year} · ${esc(m.genres)}</span><a class="entx-btn" href="player.html?id=${m.id}">&#9654; Play trailer</a><a class="entx-btn ghost" href="movie-details.html?id=${m.id}">Details</a>`
        : `<b>EntXHub Podcasts</b><span>New episodes every week</span><a class="entx-btn" href="#podcast-section-button">Browse podcasts</a>`;
    };
    let wasSelected = false;
    car.addEventListener('pointerdown', (e) => { const item = e.target.closest('#carousel > div'); wasSelected = !!(item && item.classList.contains('selected')); }, true);
    car.addEventListener('click', (e) => {
      const item = e.target.closest('#carousel > div');
      if (!item || !wasSelected) return;
      const id = idOf(item);
      location.href = findTitle(id) ? 'movie-details.html?id=' + id : '#podcast-section-button';
    });
    // the carousel is shifted up with a CSS transform, so the caption is pinned just under the visible posters
    document.body.appendChild(cap);
    const place = () => { const r = car.getBoundingClientRect(); const imgs = [...car.querySelectorAll('img')].map((i) => i.getBoundingClientRect()).filter((b) => b.width && b.right > 0 && b.left < innerWidth); const bottom = Math.min(r.bottom, Math.max(r.top, ...imgs.map((b) => b.bottom))); cap.style.top = (bottom + window.scrollY + 8) + 'px'; };
    window.addEventListener('resize', place); setTimeout(place, 60); setTimeout(place, 600); place();
    new MutationObserver(() => { draw(); setTimeout(place, 450); }).observe(car, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    draw();
  }
  function enhanceMovieDetails() {
    const m = findTitle(params.get('id')) || findTitle('peaky-blinders');
    document.title = m.title + ' · EntXHub';
    const banner = document.querySelector('.movie-detail-banner img'); if (banner) { banner.src = m.img; banner.alt = m.title + ' poster'; }
    const sub = document.querySelector('.detail-subtitle'); if (sub) sub.textContent = m.type + ' · ' + m.year;
    const title = document.querySelector('.detail-title');
    if (title) { const words = m.title.split(' '); const last = words.pop(); title.innerHTML = esc(words.join(' ')) + (words.length ? ' ' : '') + '<strong>' + esc(last) + '</strong>'; }
    const genreWrap = document.querySelector('.movie-detail .ganre-wrapper');
    const section = { 'Movie': 'movie-section-button', 'Anime': 'anime-section-button', 'Web Series': 'webseries-section-button', 'Podcast': 'podcast-section-button' }[m.type];
    if (genreWrap) genreWrap.innerHTML = m.genres.split(', ').map((g, i, arr) => `<a href="movie.html#${section}">${esc(g)}${i < arr.length - 1 ? ',' : ''}</a>`).join(' ');
    const story = document.querySelector('.storyline');
    if (story) story.textContent = m.story;
    document.querySelectorAll('a[href^="player.html"]').forEach((a) => a.setAttribute('href', 'player.html?id=' + m.id));
    const content = document.querySelector('.movie-detail-content');
    if (content && !content.querySelector('.entx-actions')) {
      const act = document.createElement('div');
      act.className = 'entx-actions';
      act.innerHTML = `<a class="entx-btn" href="player.html?id=${m.id}">&#9654; ${m.type === 'Podcast' ? 'Play episode' : 'Play trailer'}</a><a class="entx-btn ghost" href="movie.html#${section}">More ${esc(m.type === 'Web Series' ? 'series' : m.type.toLowerCase() + (m.type === 'Anime' ? '' : 's'))}</a>`;
      content.appendChild(act);
    }
  }
  function recordHistory() {
    const m = findTitle(params.get('id')) || findTitle('peaky-blinders');
    if (!m) return;
    const v = store.get('viewed', []).filter((k) => k !== 'title:' + m.id); v.unshift('title:' + m.id); store.set('viewed', v.slice(0, 15));
    if (auth.current()) api('history', { body: { id: m.id } }).catch(() => {});
  }
  // AI extras on a title page: more like this, merch from the same world, and reviews with sentiment
  function titleExtras() {
    const m = findTitle(params.get('id')) || findTitle('peaky-blinders');
    const host = document.querySelector('.movie-detail');
    if (!m || !host || !window.EntX.recSection) return;
    const box = document.createElement('section');
    box.className = 'container entx-extras'; box.id = 'shop-extras';
    box.innerHTML = '<div id="x-more"></div><div id="x-merch"></div><div id="reviews" class="sx-section"></div>';
    host.insertAdjacentElement('afterend', box);
    window.EntX.recSection(box.querySelector('#x-more'), 'More like ' + m.title, `similar?key=title:${m.id}&kind=title&n=8`, 'Titles closest to this one in our recommender\'s learned taste space.');
    window.EntX.recSection(box.querySelector('#x-merch'), 'Shop the look', `similar?key=title:${m.id}&kind=product&n=4`, 'Merch that fans of this title buy.');
    window.EntX.renderReviews(box.querySelector('#reviews'), 'title:' + m.id);
  }
  // "Recommended for you" row at the top of the Watch page
  function watchRecommendations() {
    const anchor = document.querySelector('.titleeee') || document.querySelector('.upcoming');
    if (!anchor) return;
    const seed = store.get('viewed', []).join(',');
    const box = document.createElement('section');
    box.className = 'container entx-extras';
    anchor.insertAdjacentElement('beforebegin', box);
    const draw = (items, personalised) => {
      if (!items.length) return;
      box.innerHTML = `<div class="sx-section" style="margin:10px 0 30px"><h2 style="color:#fff;font-size:24px;font-weight:800">${personalised ? 'Recommended for you' : 'Popular right now'} <span class="sx-ai">AI</span></h2>
        <p style="color:#9a9aa6;margin:0 0 12px">${personalised ? 'Picked by a matrix-factorisation model from what you have watched' : 'Watch a few trailers and this row becomes personal'}.</p>
        <div class="sx-strip">${items.map((t) => `<a class="sx-mini" href="movie-details.html?id=${esc(t.id)}"><img src="${esc(t.img)}" alt="" loading="lazy"><div>${esc(t.title)}<small>${esc(t.type)}</small></div></a>`).join('')}</div></div>`;
    };
    api(`recommendations?kind=title&n=10&seed=${encodeURIComponent(seed || 'title:oppenheimer,title:interstellar,title:squid-game')}`)
      .then((r) => draw(r.items, !!seed || auth.current())).catch(() => {});
  }
  function enhancePlayer() {
    const m = findTitle(params.get('id')) || findTitle('peaky-blinders');
    document.title = m.title + ' · Trailer · EntXHub';
    document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.75)), url("${m.img}")`;
    const box = document.getElementById('video-container');
    if (!box) return;
    box.innerHTML = `<a href="movie-details.html?id=${m.id}" class="entx-back">&larr; Back to ${esc(m.title)}</a>
      <div class="entx-frame"><iframe src="${embed(m.trailer)}" title="${esc(m.title)} ${m.type === 'Podcast' ? 'episode' : 'official trailer'}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
      <h1 class="entx-ptitle">${esc(m.title)}</h1><p class="entx-pmeta">${esc(m.type)} · ${m.year} · ${esc(m.genres)}</p>
      <p class="entx-pmeta"><a href="${ytWatch(m.trailer)}" target="_blank" rel="noopener">Open on YouTube</a> · <a href="movie.html">Browse more titles</a></p>`;
  }

  // ---------- home page: every picture and section title leads somewhere ----------
  function enhanceHome() {
    const slideTargets = { 'logo 111.png': ['games.html', 'Games'], 'logo 112.png': ['events.html', 'Events'], 'logo 113.png': ['movie.html', 'Watch'], 'logo 114.png': ['movie.html#movie-section-button', 'Movies'], 'logo 115.png': ['events.html', 'Events'] };
    const shopIds = { 'shop1.jpg': 'barbie-tshirt', 'shop3.jpg': 'batman-tshirt', 'shop4.jpg': 'dark-knight-shirt', 'shop5.jpg': 'captain-america' };
    const eventIds = ['music-night', 'carnival', 'boat-parade', 'echoes-of-emotion'];
    const target = (file) => {
      if (slideTargets[file]) return slideTargets[file];
      if (POSTERS[file]) return ['movie-details.html?id=' + POSTERS[file], findTitle(POSTERS[file]).title];
      const ev = file.match(/^event(\d)\.jpeg$/); if (ev) return ['events.html#' + eventIds[ev[1] - 1], 'Events'];
      if (GAMES[file]) return ['games.html?game=' + encodeURIComponent(file), GAMES[file][0]];
      if (shopIds[file]) return ['product-info.html?id=' + shopIds[file], 'Shop'];
      return null;
    };
    document.querySelectorAll('.mySlides img, .image-scroll-wrapper img').forEach((img) => {
      if (img.closest('a')) return;
      const t = target(decodeURIComponent(img.getAttribute('src').split('/').pop()));
      if (!t) return;
      const a = document.createElement('a'); a.href = t[0]; a.title = t[1]; a.className = 'entx-imglink';
      img.parentNode.insertBefore(a, img); a.appendChild(img);
    });
    const sections = { movies: 'movie.html', events: 'events.html', games: 'games.html', shop: 'shop.html' };
    document.querySelectorAll('.section-title h1').forEach((h) => {
      const href = sections[h.textContent.trim().toLowerCase()]; if (!href || h.querySelector('a')) return;
      h.innerHTML = `<a href="${href}">${esc(h.textContent.trim())} <span aria-hidden="true">&rarr;</span></a>`;
    });
  }

  // ---------- resume where you left off ----------
  // Every page you open is remembered per account (and for guests); after logging in you return to it.
  const RESUME_SKIP = ['loginmain.html', 'signup.html', 'login.html'];
  function rememberPage() {
    if (RESUME_SKIP.includes(page)) return;
    const here = page + location.search + location.hash;
    store.set('last-page', here);
    const u = auth.current(); if (u && u.email) { const all = store.get('last-pages', {}); all[u.email.toLowerCase()] = here; store.set('last-pages', all); }
  }
  function resumeTarget(email) {
    const next = params.get('next'); if (next && !/^(https?:)?\/\//i.test(next)) return next;
    const mine = email && store.get('last-pages', {})[email.toLowerCase()];
    return mine || store.get('last-page', null) || 'index.html';
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
      ...Object.entries(GAMES).map(([f, [n, g]]) => ({ title: n, sub: 'Game · ' + g, img: gameImg(f), href: 'games.html?game=' + encodeURIComponent(f) })),
    ];
    const href = (d) => d.kind === 'product' ? 'product-info.html?id=' + d.id : d.kind === 'event' ? 'events.html' : 'movie-details.html?id=' + d.id;
    const sub = (d) => d.kind === 'product' ? 'Shop · ' + rs(d.price) : d.kind === 'event' ? 'Event · ' + rs(d.price) : d.type + ' · ' + (d.genres || []).slice(0, 2).join(', ');
    let seq = 0;
    const run = async () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.classList.add('entx-hidden'); return; }
      const mine = ++seq;
      let hits;
      try {
        // MongoDB search across titles, genres and products
        const found = q.length < 2 ? [] : await api('catalog?q=' + encodeURIComponent(q));
        hits = found.map((d) => ({ title: d.title, sub: sub(d), img: d.img, href: href(d) }));
        hits.push(...all.filter((x) => x.sub.startsWith('Game') && x.title.toLowerCase().includes(q)));
        hits = hits.slice(0, 8);
      } catch (e) { hits = all.filter((x) => (x.title + ' ' + x.sub).toLowerCase().includes(q)).slice(0, 8); }
      if (mine !== seq) return;
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
    document.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', async () => {
      if (!auth.current()) { toast('Please log in or sign up to choose a plan.'); setTimeout(() => { location.href = 'loginmain.html?next=info.html%23pricing'; }, 1200); return; }
      try { const r = await api('subscription', { body: { plan: b.dataset.plan } }); const s2 = auth.current(); s2.plan = r.plan; store.set('session', s2); toast(r.plan + ' plan activated on your account (' + rs(r.price) + '/month).'); }
      catch (err) { toast(err.message); }
    }));
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button'); if (btn) btn.disabled = true;
      try { await api('messages', { body: Object.fromEntries(new FormData(form)) }); form.reset(); toast("Thanks! Your message has been sent. We'll reply within 24 hours."); }
      catch (err) { toast(err.message); }
      finally { if (btn) btn.disabled = false; }
    });
  }

  // ---------- my account: orders, bookings, plan, watch history ----------
  async function openAccount() {
    const user = auth.current();
    if (!user) { location.href = 'loginmain.html'; return; }
    const close = modal(`<h3>My account</h3><p>${esc(user.name)} · ${esc(user.email)}</p><div id="entx-acc-body"><p>Loading…</p></div>
      <a class="entx-btn" href="orders.html">My orders</a> <a class="entx-btn ghost" href="wishlist.html">Wishlist</a> <button class="entx-btn ghost" id="entx-logout">Log out</button>`, (m) => {
      m.querySelector('#entx-logout').onclick = () => { rememberPage(); auth.logOut(); toast('You have been logged out.'); setTimeout(() => location.reload(), 600); };
    });
    try {
      const [me, orders, bookings, history] = await Promise.all([api('auth/me'), api('orders'), api('bookings'), api('history')]);
      const body = document.getElementById('entx-acc-body'); if (!body) return;
      const row = (l, r) => `<div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid #2c2c3d;padding:8px 0;font-size:14px"><span>${l}</span><span style="color:#ccc;white-space:nowrap">${r}</span></div>`;
      body.innerHTML = `<p><b>Plan:</b> ${me.plan ? esc(me.plan) : 'Free'} · <a href="info.html#pricing" style="color:hsl(17,68%,58%)">change</a></p>
        <h4 style="margin:14px 0 4px;color:#fff">Orders (${orders.length})</h4>${orders.map((o) => row(`<b>${esc(o._id)}</b> · ${o.lines.reduce((n, l) => n + l.qty, 0)} item(s)`, rs(o.total) + ' · ' + new Date(o.createdAt).toLocaleDateString())).join('') || '<p>No orders yet.</p>'}
        <h4 style="margin:14px 0 4px;color:#fff">Bookings (${bookings.length})</h4>${bookings.map((b) => row(`${esc(b.title)} · ${b.tickets} ticket(s) <small style="color:${b.status === 'Confirmed' ? '#7c7' : '#c77'}">${b.status}</small>`, b.status === 'Confirmed' ? `<a href="#" data-cancel="${esc(b._id)}" style="color:#e88">Cancel</a>` : '')).join('') || '<p>No bookings yet.</p>'}
        <h4 style="margin:14px 0 4px;color:#fff">Recently viewed</h4>${history.length ? '<p>' + history.map((h) => `<a href="movie-details.html?id=${esc(h.id)}" style="color:hsl(17,68%,58%)">${esc(h.title)}</a>`).join(', ') + '</p>' : '<p>Nothing yet.</p>'}`;
      body.querySelectorAll('[data-cancel]').forEach((a) => a.onclick = async (e) => {
        e.preventDefault();
        try { await api('bookings/cancel', { body: { id: a.dataset.cancel } }); toast('Booking cancelled.'); close(); openAccount(); } catch (err) { toast(err.message); }
      });
    } catch (err) { const body = document.getElementById('entx-acc-body'); if (body) body.innerHTML = '<p>' + esc(err.message) + '</p>'; }
  }

  // shared with assets/js/shop.js
  window.EntX = { api, auth, cart, store, toast, modal, esc, rs, slug, openAccount, updateBadges, trailerModal, MOVIES, findTitle: (id) => MOVIES.find((x) => x.id === id) };

  // ---------- init ----------
  document.addEventListener('DOMContentLoaded', () => {
    rememberPage();
    if (page === 'index.html') enhanceHome();
    fixPlaceholderLinks();
    setupSearch();
    renderAuthButtons();
    updateBadges();
    cart.load();
    if (page === 'loginmain.html') wireAuthForm('login');
    if (page === 'signup.html') wireAuthForm('signup');
    // shop, product, cart, checkout and order pages are rendered by assets/js/shop.js
    if (page === 'events.html') { enhanceEvents(); const t = location.hash && document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); }
    if (page === 'games.html') enhanceGames();
    if (page === 'movie.html' || page === 'showmore.html') enhanceMovieCards();
    if (page === 'movie-details.html') { enhanceMovieDetails(); recordHistory(); titleExtras(); }
    if (page === 'movie.html') watchRecommendations();
    if (page === 'player.html') enhancePlayer();
    if (page === 'info.html') wireContactForm();
  });
})();
