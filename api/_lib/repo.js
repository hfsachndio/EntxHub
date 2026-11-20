// Data access. Uses MongoDB when MONGODB_URI is set (production, via the Vercel MongoDB Atlas
// integration) and an in-memory store otherwise (local development and tests).
import { MongoClient } from "mongodb";
import { ALL, CATALOG_VERSION } from "./catalog.js";
import { SEED_REVIEWS } from "./seedReviews.js";
import { sentiment } from "./ai.js";

const seedReviews = () => SEED_REVIEWS.map((r, i) => ({ _id: `RV-SEED-${i}`, target: r.target, userId: `seed-${i}`, name: r.name, rating: r.rating, title: r.title, body: r.body, sentiment: sentiment(r.body), verified: r.target.startsWith("product:"), createdAt: new Date(Date.now() - r.daysAgo * 86400000), seeded: true }));

const DB = process.env.MONGODB_DB || "entxhub";

async function mongoRepo(uri) {
  globalThis.__entxMongo ??= new MongoClient(uri, { maxPoolSize: 5, appName: "entxhub" }).connect();
  const db = (await globalThis.__entxMongo).db(DB);
  const c = (n) => db.collection(n);
  if (!globalThis.__entxReady) {
    globalThis.__entxReady = (async () => {
      await Promise.all([
        c("users").createIndex({ email: 1 }, { unique: true }),
        c("orders").createIndex({ userId: 1, createdAt: -1 }),
        c("bookings").createIndex({ userId: 1, createdAt: -1 }),
        c("bookings").createIndex({ eventId: 1 }),
        c("catalog").createIndex({ kind: 1, title: 1 }),
        c("history").createIndex({ userId: 1, at: -1 }),
        c("reviews").createIndex({ target: 1, createdAt: -1 }),
        c("reviews").createIndex({ target: 1, userId: 1 }, { unique: true }),
      ]);
      const meta = await c("meta").findOne({ _id: "catalog" });
      if ((meta?.version ?? 0) < CATALOG_VERSION || (await c("catalog").estimatedDocumentCount()) < ALL.length) {
        // refresh catalog details but keep live stock levels
        await c("catalog").bulkWrite(ALL.map(({ stock, ...d }) => ({ updateOne: { filter: { _id: d._id }, update: { $set: d, ...(stock !== undefined ? { $setOnInsert: { stock } } : {}) }, upsert: true } })));
        await c("meta").updateOne({ _id: "catalog" }, { $set: { version: CATALOG_VERSION, at: new Date() } }, { upsert: true });
      }
      if ((await c("reviews").estimatedDocumentCount()) === 0) await c("reviews").insertMany(seedReviews());
    })().catch((e) => { globalThis.__entxReady = undefined; throw e; });
  }
  await globalThis.__entxReady;
  return {
    kind: "mongodb",
    findUser: (email) => c("users").findOne({ email }),
    insertUser: async (u) => { await c("users").insertOne(u); return u; },
    updateUser: (id, set) => c("users").updateOne({ _id: id }, { $set: set }),
    getCart: async (userId) => (await c("carts").findOne({ _id: userId }))?.items ?? [],
    setCart: (userId, items) => c("carts").updateOne({ _id: userId }, { $set: { items, updatedAt: new Date() } }, { upsert: true }),
    catalogGet: (kind, id) => c("catalog").findOne({ _id: `${kind}:${id}` }),
    catalogList: (kind) => c("catalog").find(kind ? { kind } : {}).sort({ title: 1 }).toArray(),
    catalogSearch: (q) => {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return c("catalog").find({ $or: [{ title: rx }, { type: rx }, { genres: rx }, { category: rx }] }).limit(10).toArray();
    },
    // Atomic stock decrement: only succeeds while enough stock is left.
    takeStock: async (id, qty) => (await c("catalog").updateOne({ _id: `product:${id}`, stock: { $gte: qty } }, { $inc: { stock: -qty } })).modifiedCount === 1,
    returnStock: (id, qty) => c("catalog").updateOne({ _id: `product:${id}` }, { $inc: { stock: qty } }),
    insertOrder: async (o) => { await c("orders").insertOne(o); return o; },
    listOrders: (userId) => c("orders").find({ userId }).sort({ createdAt: -1 }).limit(30).toArray(),
    getOrder: (id) => c("orders").findOne({ _id: id }),
    updateOrder: (id, set) => c("orders").updateOne({ _id: id }, { $set: set }),
    hasPurchased: async (userId, productId) => !!(await c("orders").findOne({ userId, status: { $ne: "Cancelled" }, "lines.id": productId })),
    upsertReview: (r) => c("reviews").replaceOne({ target: r.target, userId: r.userId }, r, { upsert: true }),
    listReviews: (target) => c("reviews").find({ target }).sort({ createdAt: -1 }).limit(100).toArray(),
    listReviewsByUser: (userId) => c("reviews").find({ userId }).toArray(),
    reviewStats: () => c("reviews").aggregate([{ $group: { _id: "$target", n: { $sum: 1 }, avg: { $avg: "$rating" } } }]).toArray(),
    getWishlist: async (userId) => (await c("wishlists").findOne({ _id: userId }))?.items ?? [],
    setWishlist: (userId, items) => c("wishlists").updateOne({ _id: userId }, { $set: { items, updatedAt: new Date() } }, { upsert: true }),
    seatsSold: async (eventId) => (await c("bookings").aggregate([{ $match: { eventId, status: "Confirmed" } }, { $group: { _id: null, n: { $sum: "$tickets" } } }]).toArray())[0]?.n ?? 0,
    insertBooking: async (b) => { await c("bookings").insertOne(b); return b; },
    listBookings: (userId) => c("bookings").find({ userId }).sort({ createdAt: -1 }).limit(20).toArray(),
    cancelBooking: async (userId, id) => (await c("bookings").updateOne({ _id: id, userId, status: "Confirmed" }, { $set: { status: "Cancelled", cancelledAt: new Date() } })).modifiedCount === 1,
    insertMessage: (m) => c("messages").insertOne(m),
    addHistory: (userId, titleId) => c("history").updateOne({ userId, titleId }, { $set: { at: new Date() } }, { upsert: true }),
    listHistory: (userId) => c("history").find({ userId }).sort({ at: -1 }).limit(12).toArray(),
    stats: async () => ({
      users: await c("users").countDocuments(), orders: await c("orders").countDocuments(),
      bookings: await c("bookings").countDocuments({ status: "Confirmed" }), messages: await c("messages").countDocuments(),
    }),
  };
}

function memoryRepo() {
  const m = (globalThis.__entxMem ??= { users: new Map(), carts: new Map(), catalog: new Map(ALL.map((d) => [d._id, structuredClone(d)])), orders: [], bookings: [], messages: [], history: [], reviews: seedReviews(), wishlists: new Map() });
  const byDate = (k) => (a, b) => b[k] - a[k];
  return {
    kind: "memory",
    findUser: async (email) => m.users.get(email) ?? null,
    insertUser: async (u) => { if (m.users.has(u.email)) throw Object.assign(new Error("dup"), { code: 11000 }); m.users.set(u.email, u); return u; },
    updateUser: async (id, set) => { for (const u of m.users.values()) if (u._id === id) Object.assign(u, set); },
    getCart: async (userId) => m.carts.get(userId) ?? [],
    setCart: async (userId, items) => { m.carts.set(userId, items); },
    catalogGet: async (kind, id) => m.catalog.get(`${kind}:${id}`) ?? null,
    catalogList: async (kind) => [...m.catalog.values()].filter((d) => !kind || d.kind === kind).sort((a, b) => a.title.localeCompare(b.title)),
    catalogSearch: async (q) => [...m.catalog.values()].filter((d) => [d.title, d.type, d.category, ...(d.genres ?? [])].join(" ").toLowerCase().includes(q.toLowerCase())).slice(0, 10),
    takeStock: async (id, qty) => { const p = m.catalog.get(`product:${id}`); if (!p || p.stock < qty) return false; p.stock -= qty; return true; },
    returnStock: async (id, qty) => { const p = m.catalog.get(`product:${id}`); if (p) p.stock += qty; },
    insertOrder: async (o) => { m.orders.push(o); return o; },
    listOrders: async (userId) => m.orders.filter((o) => o.userId === userId).sort(byDate("createdAt")),
    getOrder: async (id) => m.orders.find((o) => o._id === id) ?? null,
    updateOrder: async (id, set) => { const o = m.orders.find((x) => x._id === id); if (o) Object.assign(o, set); },
    hasPurchased: async (userId, productId) => m.orders.some((o) => o.userId === userId && o.status !== "Cancelled" && o.lines.some((l) => l.id === productId)),
    upsertReview: async (r) => { m.reviews = m.reviews.filter((x) => !(x.target === r.target && x.userId === r.userId)); m.reviews.push(r); },
    listReviews: async (target) => m.reviews.filter((r) => r.target === target).sort(byDate("createdAt")),
    listReviewsByUser: async (userId) => m.reviews.filter((r) => r.userId === userId),
    reviewStats: async () => { const g = new Map(); for (const r of m.reviews) { const x = g.get(r.target) ?? { _id: r.target, n: 0, sum: 0 }; x.n++; x.sum += r.rating; g.set(r.target, x); } return [...g.values()].map((x) => ({ _id: x._id, n: x.n, avg: x.sum / x.n })); },
    getWishlist: async (userId) => m.wishlists.get(userId) ?? [],
    setWishlist: async (userId, items) => { m.wishlists.set(userId, items); },
    seatsSold: async (eventId) => m.bookings.filter((b) => b.eventId === eventId && b.status === "Confirmed").reduce((n, b) => n + b.tickets, 0),
    insertBooking: async (b) => { m.bookings.push(b); return b; },
    listBookings: async (userId) => m.bookings.filter((b) => b.userId === userId).sort(byDate("createdAt")),
    cancelBooking: async (userId, id) => { const b = m.bookings.find((x) => x._id === id && x.userId === userId && x.status === "Confirmed"); if (!b) return false; b.status = "Cancelled"; return true; },
    insertMessage: async (msg) => { m.messages.push(msg); },
    addHistory: async (userId, titleId) => { m.history = m.history.filter((h) => !(h.userId === userId && h.titleId === titleId)); m.history.push({ userId, titleId, at: new Date() }); },
    listHistory: async (userId) => m.history.filter((h) => h.userId === userId).sort(byDate("at")).slice(0, 12),
    stats: async () => ({ users: m.users.size, orders: m.orders.length, bookings: m.bookings.filter((b) => b.status === "Confirmed").length, messages: m.messages.length }),
  };
}

let repo;
export function getRepo() {
  repo ??= (process.env.MONGODB_URI ? mongoRepo(process.env.MONGODB_URI) : Promise.resolve(memoryRepo())).catch((e) => { repo = undefined; throw e; });
  return repo;
}
