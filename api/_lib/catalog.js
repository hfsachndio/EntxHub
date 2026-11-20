// Products, events and titles stored in MongoDB on first use. Prices are always read from here on the
// server, so a visitor can't change what they pay by editing the page.
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const PRODUCTS = [
  ["barbie-tshirt", "Barbie T-Shirt", 1600, "assets/images/shop1.jpg", 40], ["barbie-croptop", "Barbie CropTop", 1900, "assets/images/shop2.jpg", 25],
  ["batman-tshirt", "Batman T-Shirt", 1600, "assets/images/shop3.jpg", 30], ["dark-knight-shirt", "Dark Knight Shirt", 1500, "assets/images/shop4.jpg", 18],
  ["captain-america", "Captain America", 1300, "assets/images/shop5.jpg", 22], ["avengers-tshirt", "Avengers T-Shirt", 1450, "assets/images/shop6.jpg", 35],
  ["simba-tshirt", "Simba T-Shirt", 1500, "assets/images/shop7.jpg", 20], ["barbie-tshirt-classic", "Barbie T-Shirt (Classic)", 1200, "assets/images/shop1.jpg", 15],
].map(([id, title, price, img, stock]) => ({ _id: `product:${id}`, kind: "product", id, title, price, img, stock, category: "Clothing" }));

export const EVENTS = [
  ["music-night", "Unforgettable Night of Music", 1200, "koko.jpg", 300], ["carnival", "Carnival", 1000, "themepark.jpg", 500],
  ["boat-parade", "Boat Parade", 800, "boat.jpg", 200], ["echoes-of-emotion", "Echoes of Emotion (Drama)", 1500, "concert.jpg", 150],
].map(([id, title, price, img, capacity]) => ({ _id: `event:${id}`, kind: "event", id, title, price, img, capacity }));

export const TITLES = [
  ["The Dark Knight Rises", "Movie", "assets/images/m1.png", "Action, Crime, Drama"], ["Maula Jatt", "Movie", "assets/images/m5.png", "Action, Drama"],
  ["Inception", "Movie", "assets/images/m2.png", "Action, Science Fiction, Thriller"], ["Interstellar", "Movie", "assets/images/m3.png", "Adventure, Drama, Science Fiction"],
  ["Jurassic World", "Movie", "assets/images/m4.png", "Action, Adventure, Science Fiction"], ["Oppenheimer", "Movie", "assets/images/moooovie1.jpg", "Biography, Drama, History"],
  ["Avengers Infinity War", "Movie", "assets/images/m6.png", "Action, Adventure, Science Fiction"], ["Tokyo Ghoul", "Anime", "assets/images/tokyo ghoul.png", "Action, Dark Fantasy, Horror"],
  ["Death Note", "Anime", "assets/images/death note.png", "Mystery, Psychological Thriller"], ["Attack On Titan", "Anime", "assets/images/attack on titians.png", "Action, Dark Fantasy"],
  ["Dragon Ball Z", "Anime", "assets/images/dragon ball z.png", "Action, Adventure, Martial Arts"], ["One Piece", "Anime", "assets/images/one piece.png", "Action, Adventure, Comedy"],
  ["Pokemon", "Anime", "assets/images/pokemon.png", "Adventure, Family"], ["Naruto", "Anime", "assets/images/aruto.png", "Action, Adventure, Martial Arts"],
  ["Lucifer", "Web Series", "assets/images/ws1.png", "Crime, Drama, Fantasy"], ["Dark", "Web Series", "assets/images/ws2.png", "Mystery, Science Fiction, Thriller"],
  ["Money Heist", "Web Series", "assets/images/ws5.png", "Action, Crime, Thriller"], ["Peaky Blinders", "Web Series", "assets/images/ws4.png", "Crime, Drama"],
  ["Loki", "Web Series", "assets/images/ws3.png", "Action, Adventure, Fantasy"], ["Squid Game", "Web Series", "assets/images/ws6.png", "Drama, Survival, Thriller"],
  ["Stranger Things", "Web Series", "assets/images/ws7.png", "Drama, Horror, Science Fiction"], ["Vikings Valhalla", "Web Series", "assets/images/slide14.png", "Action, Adventure, Drama"],
  ["Barbie", "Movie", "assets/images/slide11.png", "Comedy, Adventure, Fantasy"], ["Death on the Nile", "Movie", "assets/images/slide12.png", "Crime, Mystery, Thriller"],
  ["Joker", "Movie", "assets/images/slide19.png", "Crime, Drama, Thriller"], ["Black Panther", "Movie", "assets/images/slide18.png", "Action, Adventure, Science Fiction"],
  ["Doctor Strange in the Multiverse of Madness", "Movie", "assets/images/upcoming-2.png", "Action, Fantasy, Horror"], ["The Northman", "Movie", "assets/images/upcoming-1.png", "Action, Adventure, Drama"],
  ["Memory", "Movie", "assets/images/upcoming-3.png", "Action, Crime, Thriller"], ["The Unbearable Weight of Massive Talent", "Movie", "assets/images/upcoming-4.png", "Action, Comedy"],
  ["Andrew Tate", "Podcast", "assets/images/p5.png", "Talk, Interview"], ["Tauha Ibne Jalil", "Podcast", "assets/images/p1.png", "Talk, Lifestyle"],
  ["Gold Minds", "Podcast", "assets/images/p4.png", "Talk, Business"], ["Junaid Akram", "Podcast", "assets/images/p2.png", "Talk, Comedy"],
  ["Muzammil Hassan", "Podcast", "assets/images/p3.png", "Talk, Education"],
].map(([title, type, img, genres]) => ({ _id: `title:${slug(title)}`, kind: "title", id: slug(title), title, type, img, genres: genres.split(", ") }));

export const PLANS = { Free: 0, Plus: 499, Premium: 999 };
export const ALL = [...PRODUCTS, ...EVENTS, ...TITLES];
