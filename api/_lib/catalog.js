// Products, events and titles stored in MongoDB on first use. Prices are always read from here on the
// server, so a visitor can't change what they pay by editing the page.
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Shop products. Prices (PKR, taxes included) are always read from here on the server.
// [id, title, price, compareAt, img, stock, category, franchise, colors, sizes, relatedTitle, description, material]
export const PRODUCTS = [
  ["barbie-tshirt", "Barbie Logo T-Shirt", 1600, 2000, "assets/images/shop1.jpg", 40, "T-Shirts", "Barbie", ["Pink"], ["S", "M", "L", "XL"], "barbie",
    "Soft pastel-pink tee with the glitter Barbie logo across the chest. Relaxed fit with dropped shoulders.", "100% combed cotton, 180 GSM"],
  ["barbie-croptop", "Barbie Crop Top", 1900, null, "assets/images/shop2.jpg", 25, "Tops", "Barbie", ["Pink"], ["S", "M", "L"], "barbie",
    "Boxy cropped top in bubblegum pink with the classic Barbie script logo.", "95% cotton, 5% elastane"],
  ["batman-tshirt", "Batman Pocket T-Shirt", 1600, null, "assets/images/shop3.jpg", 30, "T-Shirts", "DC", ["White"], ["S", "M", "L", "XL"], "the-dark-knight-rises",
    "Clean white tee with a Batman comic-panel print on the chest pocket.", "100% cotton jersey"],
  ["dark-knight-shirt", "Dark Knight T-Shirt", 1500, 1800, "assets/images/shop4.jpg", 18, "T-Shirts", "DC", ["Black"], ["S", "M", "L", "XL"], "the-dark-knight-rises",
    "Black tee with a bold Dark Knight bat graphic in electric blue.", "100% cotton, 200 GSM"],
  ["captain-america", "Captain America T-Shirt", 1300, null, "assets/images/shop5.jpg", 22, "T-Shirts", "Marvel", ["White"], ["S", "M", "L", "XL"], "avengers-infinity-war",
    "White tee with a retro Captain America comic print.", "100% cotton"],
  ["avengers-tshirt", "Avengers Lounge Set", 2450, 2900, "assets/images/shop6.jpg", 35, "Sets", "Marvel", ["Cream"], ["S", "M", "L"], "avengers-infinity-war",
    "Two-piece tee and shorts set covered in Spider-Man, Iron Man and Captain America badges.", "100% cotton, brushed inside"],
  ["simba-tshirt", "Lion King Simba T-Shirt", 1500, null, "assets/images/shop7.jpg", 20, "T-Shirts", "Disney", ["Cream"], ["S", "M", "L"], null,
    "All-over Simba print on a soft cream tee.", "100% organic cotton"],
  ["barbie-tshirt-classic", "Barbie Logo T-Shirt (Kids)", 1200, null, "assets/images/shop1.jpg", 15, "Kids", "Barbie", ["Pink"], ["4-5Y", "6-7Y", "8-9Y", "10-11Y"], "barbie",
    "The Barbie glitter-logo tee in kids' sizes.", "100% combed cotton"],
].map(([id, title, price, compareAt, img, stock, category, franchise, colors, sizes, relatedTitle, description, material]) =>
  ({ _id: `product:${id}`, kind: "product", id, title, price, compareAt, img, stock, category, franchise, colors, sizes, relatedTitle, description, material }));

export const EVENTS = [
  ["music-night", "Unforgettable Night of Music", 1200, "koko.jpg", 300], ["carnival", "Carnival", 1000, "themepark.jpg", 500],
  ["boat-parade", "Boat Parade", 800, "boat.jpg", 200], ["echoes-of-emotion", "Echoes of Emotion (Drama)", 1500, "concert.jpg", 150],
].map(([id, title, price, img, capacity]) => ({ _id: `event:${id}`, kind: "event", id, title, price, img, capacity }));

const FRANCHISE = { barbie: "Barbie", "the-dark-knight-rises": "DC", joker: "DC", "avengers-infinity-war": "Marvel", "black-panther": "Marvel", "doctor-strange-in-the-multiverse-of-madness": "Marvel", loki: "Marvel" };
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
].map(([title, type, img, genres]) => ({ _id: `title:${slug(title)}`, kind: "title", id: slug(title), title, type, img, genres: genres.split(", "), franchise: FRANCHISE[slug(title)] ?? null }));

export const PLANS = { Free: 0, Plus: 499, Premium: 999 };
export const ALL = [...PRODUCTS, ...EVENTS, ...TITLES];
// Bump when catalog fields change so existing databases pick up the new details (stock is kept).
export const CATALOG_VERSION = 2;

// Discount codes, validated on the server at checkout.
export const COUPONS = {
  WELCOME10: { type: "percent", value: 10, label: "10% off your order" },
  ENTX200: { type: "fixed", value: 200, min: 2000, label: "Rs 200 off orders over Rs 2,000" },
  FREESHIP: { type: "shipping", value: 0, label: "Free standard delivery" },
};
export const SHIPPING = { standard: { label: "Standard (3–5 days)", fee: 200, freeOver: 3000 }, express: { label: "Express (next day)", fee: 450 } };
