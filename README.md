# EntXHub – Entertainment Website

EntXHub is a multi-page entertainment website where visitors can browse **movies**, **games** and **events**, view details and trailers, and shop for merchandise with a cart.

**Full stack:** HTML5, CSS3 and vanilla JavaScript on the front end; a **Node.js REST API** (Vercel serverless function) with **MongoDB Atlas** for accounts, carts, orders, event bookings, plans, watch history and contact messages.

**Live site:** https://entxhub.vercel.app

## Features
- **Accounts:** sign up and log in with passwords hashed by bcrypt and a JWT session; demo Google/Facebook sign-in; "My account" with orders, bookings, plan and recently viewed titles
- **Search:** live MongoDB search across movies, anime, web series, podcasts, events and products (titles, genres, categories)
- **Watch:** 35 movies, web series, anime and podcasts; every poster, card and carousel slide opens its own details page, and Play opens an in-site player with the official trailer (YouTube privacy-enhanced embed)
- **Shop:** price filter, colour/size pickers, product pages with size and quantity, quick add to cart
- **Events:** live seats left per event, instant booking (capacity enforced on the server) and cancellation
- **Cart and checkout:** guest cart kept in the browser and merged into the account on login; signed-in carts saved in MongoDB; orders priced on the server with atomic stock checks
- **Games:** every game opens its trailer in a pop-up player, with a link to play it or its official page
- **Help pages:** pricing plans, FAQ, help center, terms, privacy and a working contact form
- **Home page:** every slide, scrolling picture and section title links to its page, title, game, event or product
- **Pick up where you left off:** the last page you visited is remembered for your account, and logging in takes you straight back to it
- Fully responsive, from phones to desktops

## Backend

| | |
|---|---|
| API | `api/index.js` — one Vercel serverless function (Node.js 20), routed by path |
| Database | MongoDB Atlas (free cluster via the Vercel integration): `users`, `carts`, `orders`, `bookings`, `catalog`, `history`, `messages` with indexes; catalog seeded on first run |
| Security | bcrypt password hashes, JWT bearer tokens, server-side prices, stock and seat checks, input validation |
| Tests | `npm test` — end-to-end API tests (in-memory store, same code paths) |

Endpoints: `auth/signup`, `auth/login`, `auth/demo`, `auth/me`, `catalog`, `events`, `cart` (GET/PUT), `orders`, `bookings`, `bookings/cancel`, `subscription`, `history`, `messages`, `health`.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home page with featured movies, games and events |
| `movie.html`, `showmore.html`, `movie-details.html` | Catalogue with poster carousel, full listing and per-title details (`movie-details.html?id=`) |
| `player.html` | In-site trailer player for the chosen title (`player.html?id=`) |
| `games.html` | Games catalogue |
| `events.html` | Upcoming events |
| `shop.html`, `product-info.html`, `cart.html` | Merchandise shop, product page and cart |
| `aboutus.html`, `loginmain.html`, `signup.html` | About, sign-in and sign-up pages |
| `info.html` | Pricing, FAQ, help center, terms, privacy and contact form |

## Run locally

```bash
npm install
npm run dev        # site + API on http://localhost:8080 (in-memory data; set MONGODB_URI to use MongoDB)
npm test
```

The pages alone can also be opened from any static host:

```bash
npx serve .
```

## Team

Built as a team project by **Umair Aslam** ([@UMAIRAsM](https://github.com/UMAIRAsM)) and **Hafsah Zulfiqar** ([@hfsachndio](https://github.com/hfsachndio)).
Original repository: [UMAIRAsM/Ent-X-Hub](https://github.com/UMAIRAsM/Ent-X-Hub).

This copy fixes local Windows file paths so the site works when hosted, compresses images, plays official trailers through YouTube embeds instead of bundling video files, switches to a single clean sans-serif font, makes every button and link functional and makes the layout responsive.
