// Shop logic: server-side pricing (coupons, shipping), payments (Stripe Checkout, a test-card gateway, cash on
// delivery), order status, reviews with AI sentiment, wishlist and recommendations.
import crypto from "node:crypto";
import { COUPONS, SHIPPING } from "./catalog.js";
import { recommend, sentiment, similar, summarise } from "./ai.js";

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const id = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
const STRIPE = () => process.env.STRIPE_SECRET_KEY || "";

// ---------- pricing ----------
/** Prices a cart from the catalog. Never trusts prices sent by the browser. */
export async function quote(db, { items, coupon, shipping = "standard" }) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, "Your cart is empty");
  if (items.length > 30) throw new HttpError(400, "Too many items");
  const lines = [], problems = [];
  for (const i of items) {
    const qty = Math.max(1, Math.min(20, Number(i.qty) | 0));
    const product = await db.catalogGet("product", String(i.id));
    const event = product ? null : await db.catalogGet("event", String(i.id));
    const item = product ?? event;
    if (!item) { problems.push(`${i.title || i.id} is no longer available`); continue; }
    const option = i.option ? String(i.option).slice(0, 30) : "";
    if (product && option && product.sizes && !product.sizes.some((s) => option.includes(s))) problems.push(`${product.title}: size ${option} is not offered`);
    if (product && product.stock < qty) problems.push(product.stock ? `Only ${product.stock} × ${product.title} left` : `${product.title} is sold out`);
    lines.push({ id: item.id, kind: item.kind, title: item.title, option, qty, price: item.price, compareAt: item.compareAt ?? null, total: item.price * qty, img: item.img, stock: product ? product.stock : null });
  }
  const subtotal = lines.reduce((t, l) => t + l.total, 0);
  const code = String(coupon || "").trim().toUpperCase();
  const c = code ? COUPONS[code] : null;
  let discount = 0, couponNote = null, freeShip = false;
  if (code && !c) couponNote = `“${code}” isn't a valid code`;
  else if (c && c.min && subtotal < c.min) couponNote = `${code} needs an order over Rs ${c.min.toLocaleString("en-PK")}`;
  else if (c) { if (c.type === "percent") discount = Math.round((subtotal * c.value) / 100); if (c.type === "fixed") discount = Math.min(subtotal, c.value); if (c.type === "shipping") freeShip = true; couponNote = c.label; }
  const method = SHIPPING[shipping] ? shipping : "standard";
  const onlyTickets = lines.every((l) => l.kind === "event");
  const s = SHIPPING[method];
  const delivery = onlyTickets ? 0 : freeShip || (s.freeOver && subtotal - discount >= s.freeOver) ? 0 : s.fee;
  const total = Math.max(0, subtotal - discount + delivery);
  return { lines, subtotal, discount, coupon: c && !(c.min && subtotal < c.min) ? code : null, couponNote, shipping: method, shippingLabel: onlyTickets ? "E-tickets (no delivery)" : s.label, delivery, total,
    taxNote: "Prices include sales tax", freeShippingAt: s.freeOver ?? null, problems };
}

// ---------- payments ----------
const luhn = (n) => { let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; };
const brand = (n) => (/^4/.test(n) ? "Visa" : /^(5[1-5]|2[2-7])/.test(n) ? "Mastercard" : /^3[47]/.test(n) ? "Amex" : "Card");
/**
 * Built-in TEST card gateway (no real money): validates the card like a processor would and follows Stripe's
 * test-card conventions: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined, 4000 0000 0000 9995 has insufficient funds.
 */
export function chargeTestCard(card, amount) {
  const number = String(card?.number || "").replace(/\D/g, "");
  const [mm, yy] = String(card?.exp || "").split(/\s*\/\s*/).map((v) => parseInt(v, 10));
  const cvc = String(card?.cvc || "");
  if (number.length < 13 || number.length > 19 || !luhn(number)) throw new HttpError(402, "Card number is invalid");
  if (!(mm >= 1 && mm <= 12) || !(yy >= 0)) throw new HttpError(402, "Expiry date is invalid");
  const exp = new Date(2000 + (yy % 100), mm, 1);
  if (exp <= new Date()) throw new HttpError(402, "This card has expired");
  if (!/^\d{3,4}$/.test(cvc)) throw new HttpError(402, "Security code is invalid");
  if (number === "4000000000000002") throw new HttpError(402, "Your card was declined (test card)");
  if (number === "4000000000009995") throw new HttpError(402, "Insufficient funds (test card)");
  return { method: "Card (test mode)", status: "Paid", ref: id("TEST"), brand: brand(number), last4: number.slice(-4), amount, paidAt: new Date() };
}

async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: { Authorization: `Bearer ${STRIPE()}`, ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(502, data?.error?.message || "Stripe request failed");
  return data;
}
/** Stripe Checkout (hosted payment page). Amounts are sent as one line for the order total, in PKR paisa. */
export async function stripeSession(order, origin) {
  const p = { mode: "payment", "payment_method_types[0]": "card", client_reference_id: order._id, customer_email: order.email,
    success_url: `${origin}/order.html?id=${order._id}&paid=stripe&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/checkout.html?cancelled=${order._id}`,
    "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "pkr", "line_items[0][price_data][unit_amount]": String(order.total * 100),
    "line_items[0][price_data][product_data][name]": `EntXHub order ${order._id}`, "metadata[orderId]": order._id };
  return stripe("checkout/sessions", p);
}
export const stripeConfigured = () => !!STRIPE();
export async function stripeVerify(sessionId) { return stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`); }

// ---------- order status ----------
const MIN = 60_000;
/** Demo fulfilment timeline: paid / cash-on-delivery orders move along over time. */
export function withStatus(o) {
  if (!o) return o;
  const t = Date.now() - new Date(o.paidAt || o.createdAt).getTime();
  const steps = [{ s: "Placed", at: o.createdAt }];
  if (o.payment?.status === "Paid") steps.push({ s: "Paid", at: o.payment.paidAt || o.createdAt });
  let status = o.status;
  if (!["Cancelled", "Awaiting payment", "Payment failed"].includes(o.status)) {
    const flow = [["Processing", 1], ["Shipped", 5], ["Out for delivery", 30], ["Delivered", 120]];
    for (const [s, m] of flow) if (t >= m * MIN) { status = s; steps.push({ s, at: new Date(new Date(o.paidAt || o.createdAt).getTime() + m * MIN) }); }
  }
  if (o.status === "Cancelled") steps.push({ s: "Cancelled", at: o.cancelledAt });
  const tracking = ["Shipped", "Out for delivery", "Delivered"].includes(status) ? `TCS-${o._id.slice(-8)}` : null;
  return { ...o, status, timeline: steps, tracking, cancellable: ["Placed", "Paid", "Processing"].includes(status) || o.status === "Awaiting payment" };
}

export async function createOrder(db, me, body, origin) {
  const { name, phone, address, city, coupon, shipping, payment, card } = body;
  if (String(name || "").trim().length < 2) throw new HttpError(400, "Enter the full name for delivery");
  if (!/^\+?[0-9][0-9\s-]{8,14}$/.test(String(phone || ""))) throw new HttpError(400, "Enter a valid phone number");
  if (String(address || "").trim().length < 6 || String(city || "").trim().length < 2) throw new HttpError(400, "Enter your full address and city");
  const method = ["cod", "card_test", "stripe"].includes(payment) ? payment : "cod";
  if (method === "stripe" && !stripeConfigured()) throw new HttpError(503, "Stripe isn't set up on this deployment. Use the test card or cash on delivery.");
  const q = await quote(db, { items: body.items, coupon, shipping });
  if (q.problems.length) throw new HttpError(409, q.problems[0]);
  // reserve stock atomically before taking payment
  const taken = [];
  for (const l of q.lines.filter((l) => l.kind === "product")) {
    if (!(await db.takeStock(l.id, l.qty))) { for (const t of taken) await db.returnStock(t.id, t.qty); throw new HttpError(409, `${l.title} is out of stock in that quantity`); }
    taken.push(l);
  }
  const order = { _id: id("EX"), userId: me.id, email: me.email, name: String(name).trim().slice(0, 80), phone: String(phone).trim().slice(0, 20),
    address: String(address).trim().slice(0, 300), city: String(city).trim().slice(0, 60),
    lines: q.lines.map(({ stock, ...l }) => l), subtotal: q.subtotal, discount: q.discount, coupon: q.coupon, shipping: q.shipping, shippingLabel: q.shippingLabel, delivery: q.delivery, total: q.total,
    payment: { method: method === "cod" ? "Cash on delivery" : method === "stripe" ? "Stripe Checkout" : "Card (test mode)", status: method === "cod" ? "Due on delivery" : "Pending" },
    status: method === "stripe" ? "Awaiting payment" : "Placed", createdAt: new Date() };
  try {
    if (method === "card_test") { order.payment = chargeTestCard(card, order.total); order.paidAt = order.payment.paidAt; order.status = "Paid"; }
  } catch (e) { for (const t of taken) await db.returnStock(t.id, t.qty); throw e; }
  let redirect = null;
  if (method === "stripe") {
    try { const s = await stripeSession(order, origin); order.payment.sessionId = s.id; redirect = s.url; }
    catch (e) { for (const t of taken) await db.returnStock(t.id, t.qty); throw e; }
  }
  await db.insertOrder(order);
  for (const l of q.lines.filter((l) => l.kind === "event")) {
    await db.insertBooking({ _id: id("BK"), userId: me.id, eventId: l.id, title: l.title, tickets: l.qty, amount: l.total, orderId: order._id, status: "Confirmed", createdAt: new Date() });
  }
  await db.setCart(me.id, []);
  return { order: withStatus(order), redirect };
}

/** Confirms a Stripe payment on return from Checkout (and releases stock for abandoned ones). */
export async function refreshOrder(db, o) {
  if (!o) return o;
  if (o.status === "Awaiting payment" && o.payment?.sessionId && stripeConfigured()) {
    const s = await stripeVerify(o.payment.sessionId).catch(() => null);
    if (s?.payment_status === "paid") {
      const set = { status: "Paid", paidAt: new Date(), payment: { ...o.payment, status: "Paid", ref: s.payment_intent, paidAt: new Date() } };
      await db.updateOrder(o._id, set); return { ...o, ...set };
    }
  }
  if (o.status === "Awaiting payment" && Date.now() - new Date(o.createdAt).getTime() > 30 * MIN) {
    for (const l of o.lines.filter((l) => l.kind === "product")) await db.returnStock(l.id, l.qty);
    const set = { status: "Cancelled", cancelledAt: new Date(), cancelReason: "Payment not completed" };
    await db.updateOrder(o._id, set); return { ...o, ...set };
  }
  return o;
}

export async function cancelOrder(db, me, orderId) {
  const o = withStatus(await refreshOrder(db, await db.getOrder(String(orderId))));
  if (!o || o.userId !== me.id) throw new HttpError(404, "Order not found");
  if (!o.cancellable) throw new HttpError(409, `This order is ${o.status.toLowerCase()} and can't be cancelled`);
  for (const l of o.lines.filter((l) => l.kind === "product")) await db.returnStock(l.id, l.qty);
  const set = { status: "Cancelled", cancelledAt: new Date(), cancelReason: "Cancelled by customer", ...(o.payment?.status === "Paid" ? { payment: { ...o.payment, status: "Refunded", refundedAt: new Date() } } : {}) };
  await db.updateOrder(o._id, set);
  return withStatus({ ...o, ...set });
}

// ---------- reviews ----------
export async function addReview(db, me, body) {
  const target = String(body.target || "");
  const [kind, itemId] = target.split(":");
  if (!["product", "title"].includes(kind) || !(await db.catalogGet(kind, itemId))) throw new HttpError(404, "Item not found");
  const rating = Math.round(Number(body.rating));
  const text = String(body.body || "").trim();
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, "Choose a rating from 1 to 5 stars");
  if (text.length < 10) throw new HttpError(400, "Write at least a sentence (10+ characters)");
  const verified = kind === "product" ? await db.hasPurchased(me.id, itemId) : false;
  const r = { _id: id("RV"), target, userId: me.id, name: me.name || "Customer", rating, title: String(body.title || "").trim().slice(0, 80), body: text.slice(0, 1500),
    sentiment: sentiment(text), verified, createdAt: new Date() };
  await db.upsertReview(r);
  return r;
}
export async function reviewsFor(db, target) {
  const list = await db.listReviews(target);
  const n = list.length, avg = n ? list.reduce((s, r) => s + r.rating, 0) / n : null;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: list.filter((r) => r.rating === s).length }));
  return { reviews: list.map(({ userId, ...r }) => r), count: n, average: avg == null ? null : Math.round(avg * 10) / 10, distribution: dist, summary: summarise(list) };
}

// ---------- recommendations ----------
/** The user's interactions with weights the recommender was trained on: view 1, wishlist 3, purchase / 4-5★ review 5. */
export async function userHistory(db, userId) {
  const [history, orders, wishlist, reviews] = await Promise.all([db.listHistory(userId), db.listOrders(userId), db.getWishlist(userId), db.listReviewsByUser(userId)]);
  const w = new Map();
  const add = (k, v) => w.set(k, Math.max(w.get(k) ?? 0, v));
  history.forEach((h) => add(`title:${h.titleId}`, 1));
  wishlist.forEach((p) => add(`product:${p}`, 3));
  orders.filter((o) => o.status !== "Cancelled").forEach((o) => o.lines.forEach((l) => l.kind === "product" && add(`product:${l.id}`, 5)));
  reviews.filter((r) => r.rating >= 4).forEach((r) => add(r.target, 5));
  return [...w.entries()];
}
export async function recommendations(db, history, kind, n = 8) {
  const recs = recommend(history, { n, kind });
  return Promise.all(recs.map(async (r) => { const [k, i] = r.key.split(":"); const item = await db.catalogGet(k, i); return item ? { ...item, score: Math.round(r.score * 1000) / 1000 } : null; })).then((x) => x.filter(Boolean));
}
export async function similarItems(db, key, kind, n = 6) {
  return Promise.all(similar(key, { n, kind }).map(async (r) => { const [k, i] = r.key.split(":"); const item = await db.catalogGet(k, i); return item ? { ...item, score: Math.round(r.score * 1000) / 1000 } : null; })).then((x) => x.filter(Boolean));
}
