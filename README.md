# EntXHub – Entertainment Website

EntXHub is a multi-page entertainment website where visitors can browse **movies**, **games** and **events**, view details and trailers, and shop for merchandise with a cart.

Built with **HTML5, CSS3 and vanilla JavaScript** (no framework), with Ionicons and the Inter font.

**Live site:** https://entxhub.vercel.app

## Features
- **Accounts:** sign up, log in (with validation) and log out; demo Google/Facebook sign-in
- **Search:** live search across movies, anime, web series, podcasts, games, events and products
- **Watch:** each title opens its own details page and official trailer
- **Shop:** price filter, colour/size pickers, product pages with size and quantity, quick add to cart
- **Events:** book tickets for any event straight into the cart
- **Cart and checkout:** change quantities, remove items, live totals, place an order
- **Games:** details and trailer for every game
- **Help pages:** pricing plans, FAQ, help center, terms, privacy and a working contact form
- Fully responsive, from phones to desktops

Accounts, cart and orders are stored in the visitor's own browser (local storage), so the site runs on any static host.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home page with featured movies, games and events |
| `movie.html`, `showmore.html`, `movie-details.html` | Movie catalogue, full listing and details |
| `player.html` | Trailer page (links to the official trailer on YouTube) |
| `games.html` | Games catalogue |
| `events.html` | Upcoming events |
| `shop.html`, `product-info.html`, `cart.html` | Merchandise shop, product page and cart |
| `aboutus.html`, `loginmain.html`, `signup.html` | About, sign-in and sign-up pages |
| `info.html` | Pricing, FAQ, help center, terms, privacy and contact form |

## Run locally

It is a static site: open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Team

Built as a team project by **Umair Aslam** ([@UMAIRAsM](https://github.com/UMAIRAsM)) and **Hafsah Zulfiqar** ([@hfsachndio](https://github.com/hfsachndio)).
Original repository: [UMAIRAsM/Ent-X-Hub](https://github.com/UMAIRAsM/Ent-X-Hub).

This copy fixes local Windows file paths so the site works when hosted, compresses images, links trailers to YouTube instead of bundling video files, switches to a single clean sans-serif font, makes every button and link functional and makes the layout responsive.
