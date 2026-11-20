// EntXHub REST API: one Vercel serverless function (Node.js) routed by path. vercel.json rewrites
// /api/<path> to /api?path=<path>. Data lives in MongoDB (see _lib/repo.js).
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getRepo } from "./_lib/repo.js";
import { COUPONS, PLANS, SHIPPING } from "./_lib/catalog.js";
import * as shop from "./_lib/shop.js";
import { recommenderInfo, sentimentInfo, sentiment } from "./_lib/ai.js";

const SECRET = () => process.env.JWT_SECRET || "entxhub-dev-secret";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9\s-]{8,14}$/;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const id = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
const publicUser = (u) => ({ id: u._id, email: u.email, name: u.name, plan: u.plan ?? null });
const sign = (u) => jwt.sign({ sub: u._id, email: u.email, name: u.name }, SECRET(), { expiresIn: "7d" });

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.length > 100_000) throw new HttpError(413, "Request is too large");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, "Invalid JSON"); }
}

function auth(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) throw new HttpError(401, "Please log in first");
  try { const p = jwt.verify(h.slice(7), SECRET()); return { id: p.sub, email: p.email, name: p.name }; }
  catch { throw new HttpError(401, "Your session has expired. Please log in again."); }
}

const routes = {
  "GET health": async (_req, db) => ({ status: "ok", database: db.kind }),

  "POST auth/signup": async (req, db) => {
    const { email, password, name } = await readBody(req);
    const login = String(email || "").trim().toLowerCase();
    if (!EMAIL.test(login) && !PHONE.test(login)) throw new HttpError(400, "Enter a valid email address or phone number");
    if (String(password || "").length < 6) throw new HttpError(400, "Password must be at least 6 characters");
    const user = { _id: id("U"), email: login, name: String(name || login.split("@")[0]).slice(0, 60), passwordHash: await bcrypt.hash(password, 10), createdAt: new Date() };
    try { await db.insertUser(user); } catch (e) { if (e.code === 11000) throw new HttpError(409, "An account with this email or phone already exists. Please log in."); throw e; }
    return { token: sign(user), user: publicUser(user) };
  },

  "POST auth/login": async (req, db) => {
    const { email, password } = await readBody(req);
    const user = await db.findUser(String(email || "").trim().toLowerCase());
    if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) throw new HttpError(401, "Incorrect email/phone or password");
    await db.updateUser(user._id, { lastLoginAt: new Date() });
    return { token: sign(user), user: publicUser(user) };
  },

  // "Continue with Google/Facebook" demo: a per-provider demo account (no real OAuth).
  "POST auth/demo": async (req, db) => {
    const { provider } = await readBody(req);
    const p = provider === "Facebook" ? "facebook" : "google";
    const email = `guest.${p}@entxhub.demo`;
    let user = await db.findUser(email);
    if (!user) {
      user = { _id: id("U"), email, name: `${p === "google" ? "Google" : "Facebook"} user`, passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10), createdAt: new Date() };
      try { await db.insertUser(user); } catch (e) { if (e.code !== 11000) throw e; user = await db.findUser(email); }
    }
    return { token: sign(user), user: publicUser(user) };
  },

  "GET auth/me": async (req, db) => {
    const me = auth(req);
    const user = await db.findUser(me.email);
    if (!user) throw new HttpError(401, "Account not found");
    return publicUser(user);
  },

  "GET catalog": async (req, db) => {
    const url = new URL(req.url, "http://x");
    const q = (url.searchParams.get("q") || "").trim();
    if (q) return q.length < 2 ? [] : db.catalogSearch(q.slice(0, 40));
    return db.catalogList(url.searchParams.get("kind") || undefined);
  },

  "GET events": async (_req, db) => {
    const events = await db.catalogList("event");
    return Promise.all(events.map(async (e) => ({ ...e, seatsLeft: e.capacity - (await db.seatsSold(e.id)) })));
  },

  "GET cart": async (req, db) => db.getCart(auth(req).id),
  "PUT cart": async (req, db) => {
    const me = auth(req);
    const { items } = await readBody(req);
    if (!Array.isArray(items) || items.length > 50) throw new HttpError(400, "Invalid cart");
    const clean = items.map((i) => ({
      key: String(i.key).slice(0, 80), id: String(i.id).slice(0, 60), title: String(i.title).slice(0, 80), price: Number(i.price) || 0,
      img: String(i.img || "").slice(0, 200), type: String(i.type || "").slice(0, 30), option: i.option ? String(i.option).slice(0, 30) : "", qty: Math.max(1, Math.min(20, Number(i.qty) | 0)),
    }));
    await db.setCart(me.id, clean);
    return clean;
  },

  // ---------- shop ----------
  "GET config": async () => ({ stripe: shop.stripeConfigured(), shipping: SHIPPING, coupons: Object.entries(COUPONS).map(([code, c]) => ({ code, label: c.label })) }),
  "GET products": async (_req, db) => {
    const [list, stats] = await Promise.all([db.catalogList("product"), db.reviewStats()]);
    const by = new Map(stats.map((s) => [s._id, s]));
    return list.map((p) => ({ ...p, rating: by.get(`product:${p.id}`) ? Math.round(by.get(`product:${p.id}`).avg * 10) / 10 : null, reviews: by.get(`product:${p.id}`)?.n ?? 0 }));
  },
  "GET product": async (req, db) => {
    const pid = new URL(req.url, "http://x").searchParams.get("id") || "";
    const p = await db.catalogGet("product", pid);
    if (!p) throw new HttpError(404, "Product not found");
    const [reviews, alsoBought, related] = await Promise.all([shop.reviewsFor(db, `product:${p.id}`), shop.similarItems(db, `product:${p.id}`, "product", 4),
      p.relatedTitle ? db.catalogGet("title", p.relatedTitle) : null]);
    return { ...p, ...reviews, alsoBought, relatedTitle: related };
  },
  "POST cart/quote": async (req, db) => shop.quote(db, await readBody(req)),
  "POST orders": async (req, db) => {
    const me = auth(req);
    const origin = req.headers.origin || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    return shop.createOrder(db, me, await readBody(req), origin);
  },
  "GET order": async (req, db) => {
    const me = auth(req);
    const o = await shop.refreshOrder(db, await db.getOrder(new URL(req.url, "http://x").searchParams.get("id") || ""));
    if (!o || o.userId !== me.id) throw new HttpError(404, "Order not found");
    return shop.withStatus(o);
  },
  "POST orders/cancel": async (req, db) => shop.cancelOrder(db, auth(req), (await readBody(req)).id),
  "GET reviews": async (req, db) => shop.reviewsFor(db, new URL(req.url, "http://x").searchParams.get("target") || ""),
  "POST reviews": async (req, db) => shop.addReview(db, auth(req), await readBody(req)),
  "POST ai/sentiment": async (req) => sentiment(String((await readBody(req)).text || "").slice(0, 2000)),
  "GET ai/models": async () => ({ sentiment: sentimentInfo(), recommender: recommenderInfo() }),
  "GET wishlist": async (req, db) => {
    const ids = await db.getWishlist(auth(req).id);
    return (await Promise.all(ids.map((i) => db.catalogGet("product", i)))).filter(Boolean);
  },
  "POST wishlist": async (req, db) => {
    const me = auth(req);
    const { id: pid } = await readBody(req);
    if (!(await db.catalogGet("product", String(pid)))) throw new HttpError(404, "Product not found");
    const list = await db.getWishlist(me.id);
    const next = list.includes(pid) ? list.filter((x) => x !== pid) : [...list, String(pid)].slice(-50);
    await db.setWishlist(me.id, next);
    return { items: next, saved: next.includes(pid) };
  },
  // Personalised picks from the matrix-factorisation model: signed-in users from their history,
  // guests from the items they viewed in this browser (?seed=title:x,product:y).
  "GET recommendations": async (req, db) => {
    const url = new URL(req.url, "http://x");
    const kind = ["title", "product"].includes(url.searchParams.get("kind")) ? url.searchParams.get("kind") : undefined;
    let history = [];
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer ")) { try { history = await shop.userHistory(db, auth(req).id); } catch { history = []; } }
    for (const k of (url.searchParams.get("seed") || "").split(",").filter(Boolean).slice(0, 20)) if (!history.some(([x]) => x === k)) history.push([k, 1]);
    const items = await shop.recommendations(db, history, kind, Math.min(12, Number(url.searchParams.get("n")) || 8));
    return { personalised: history.length > 0, basedOn: history.length, items };
  },
  "GET similar": async (req, db) => {
    const url = new URL(req.url, "http://x");
    const kind = ["title", "product"].includes(url.searchParams.get("kind")) ? url.searchParams.get("kind") : undefined;
    return shop.similarItems(db, url.searchParams.get("key") || "", kind, Math.min(12, Number(url.searchParams.get("n")) || 6));
  },
  "GET orders": async (req, db) => {
    const me = auth(req);
    const list = await db.listOrders(me.id);
    return Promise.all(list.map(async (o) => shop.withStatus(await shop.refreshOrder(db, o))));
  },

  "POST bookings": async (req, db) => {
    const me = auth(req);
    const { eventId, tickets } = await readBody(req);
    const event = await db.catalogGet("event", String(eventId));
    if (!event) throw new HttpError(404, "Event not found");
    const n = Math.max(1, Math.min(10, Number(tickets) | 0));
    const left = event.capacity - (await db.seatsSold(event.id));
    if (n > left) throw new HttpError(409, left ? `Only ${left} seats left` : "This event is sold out");
    return db.insertBooking({ _id: id("BK"), userId: me.id, eventId: event.id, title: event.title, tickets: n, amount: n * event.price, status: "Confirmed", createdAt: new Date() });
  },
  "GET bookings": async (req, db) => db.listBookings(auth(req).id),
  "POST bookings/cancel": async (req, db) => {
    const me = auth(req);
    const { id: bookingId } = await readBody(req);
    if (!(await db.cancelBooking(me.id, String(bookingId)))) throw new HttpError(404, "Booking not found or already cancelled");
    return { ok: true };
  },

  "POST subscription": async (req, db) => {
    const me = auth(req);
    const { plan } = await readBody(req);
    if (!PLANS[plan]) throw new HttpError(400, "Unknown plan");
    await db.updateUser(me.id, { plan, planSince: new Date() });
    return { plan, price: PLANS[plan] };
  },

  "POST history": async (req, db) => {
    const me = auth(req);
    const { id: titleId } = await readBody(req);
    if (!(await db.catalogGet("title", String(titleId)))) throw new HttpError(404, "Title not found");
    await db.addHistory(me.id, String(titleId));
    return { ok: true };
  },
  "GET history": async (req, db) => {
    const rows = await db.listHistory(auth(req).id);
    return Promise.all(rows.map(async (h) => ({ ...(await db.catalogGet("title", h.titleId)), watchedAt: h.at })));
  },

  "POST messages": async (req, db) => {
    const { name, email, subject, message } = await readBody(req);
    if (!String(name || "").trim() || !EMAIL.test(String(email || "")) || String(message || "").trim().length < 5) throw new HttpError(400, "Please fill in your name, a valid email and a message");
    await db.insertMessage({ _id: id("MSG"), name: String(name).slice(0, 80), email: String(email).slice(0, 120), subject: String(subject || "").slice(0, 120), message: String(message).slice(0, 2000), createdAt: new Date() });
    return { ok: true };
  },

  "GET stats": async (_req, db) => db.stats(),
};

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const path = (url.searchParams.get("path") || url.pathname.replace(/^\/api\/?/, "")).replace(/\/+$/, "");
  const route = routes[`${req.method} ${path}`];
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!route) throw new HttpError(404, "Not found");
    const db = await getRepo();
    const out = await route(req, db);
    res.statusCode = req.method === "POST" && path !== "auth/login" && path !== "auth/demo" ? 201 : 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    const status = e.status ?? 500;
    if (status >= 500) console.error(e);
    res.statusCode = status;
    res.end(JSON.stringify({ error: status >= 500 ? "Something went wrong. Please try again." : e.message }));
  }
}
