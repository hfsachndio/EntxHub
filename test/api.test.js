// End-to-end API tests against the in-memory store (same code paths as MongoDB).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./dev-server.js";

let server, base, token;
const call = async (method, path, body, tk = token) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};

before(async () => { server = await startServer(0); base = `http://localhost:${server.address().port}`; });
after(() => server.close());

describe("accounts", () => {
  it("signs up, rejects duplicates and bad passwords, logs in", async () => {
    assert.equal((await call("POST", "/api/auth/signup", { email: "a@b.co", password: "123" })).status, 400);
    const s = await call("POST", "/api/auth/signup", { email: "Ali@Example.com", password: "secret123" });
    assert.equal(s.status, 201); assert.equal(s.body.user.email, "ali@example.com");
    assert.equal((await call("POST", "/api/auth/signup", { email: "ali@example.com", password: "secret123" })).status, 409);
    assert.equal((await call("POST", "/api/auth/login", { email: "ali@example.com", password: "nope" })).status, 401);
    const l = await call("POST", "/api/auth/login", { email: "ali@example.com", password: "secret123" });
    assert.equal(l.status, 200); token = l.body.token;
    assert.equal((await call("GET", "/api/auth/me")).body.email, "ali@example.com");
  });
  it("blocks protected routes without a token", async () => {
    assert.equal((await call("GET", "/api/orders", null, null)).status, 401);
  });
});

describe("shopping", () => {
  it("saves the cart on the server", async () => {
    const r = await call("PUT", "/api/cart", { items: [{ key: "batman-tshirt|Medium", id: "batman-tshirt", title: "Batman T-Shirt", price: 1, qty: 2, option: "Medium" }] });
    assert.equal(r.body.length, 1);
    assert.equal((await call("GET", "/api/cart")).body[0].qty, 2);
  });
  const addr = { name: "Ali Khan", phone: "0300 1234567", address: "House 1, Street 2, Gulshan", city: "Karachi" };
  it("quotes with server prices, coupons and free-shipping threshold", async () => {
    const q = await call("POST", "/api/cart/quote", { items: [{ id: "batman-tshirt", qty: 1, price: 1 }] });
    assert.equal(q.body.subtotal, 1600); assert.equal(q.body.delivery, 200); assert.equal(q.body.total, 1800);
    const c = await call("POST", "/api/cart/quote", { items: [{ id: "batman-tshirt", qty: 2 }], coupon: "welcome10" });
    assert.equal(c.body.discount, 320); assert.equal(c.body.coupon, "WELCOME10"); assert.equal(c.body.delivery, 200);
    const big = await call("POST", "/api/cart/quote", { items: [{ id: "avengers-tshirt", qty: 2 }], shipping: "standard" });
    assert.equal(big.body.delivery, 0);
    assert.match((await call("POST", "/api/cart/quote", { items: [{ id: "batman-tshirt", qty: 1 }], coupon: "ENTX200" })).body.couponNote, /over/);
  });
  it("places a cash-on-delivery order with server-side prices and empties the cart", async () => {
    const r = await call("POST", "/api/orders", { ...addr, payment: "cod", items: [{ id: "batman-tshirt", qty: 2, price: 1, option: "M" }, { id: "carnival", qty: 3 }] });
    assert.equal(r.status, 201);
    assert.equal(r.body.order.subtotal, 1600 * 2 + 1000 * 3);
    assert.equal(r.body.order.total, r.body.order.subtotal);  // over Rs 3,000: free standard delivery
    assert.equal(r.body.order.payment.status, "Due on delivery");
    assert.equal((await call("GET", "/api/cart")).body.length, 0);
    assert.equal((await call("GET", "/api/orders")).body.length, 1);
    assert.equal((await call("GET", "/api/bookings")).body[0].tickets, 3);
  });
  it("pays with the test card gateway, handles declines and validates the card", async () => {
    const ok = await call("POST", "/api/orders", { ...addr, payment: "card_test", shipping: "express", card: { number: "4242 4242 4242 4242", exp: "12/30", cvc: "123" }, items: [{ id: "simba-tshirt", qty: 1 }] });
    assert.equal(ok.status, 201); assert.equal(ok.body.order.payment.status, "Paid"); assert.equal(ok.body.order.payment.last4, "4242"); assert.equal(ok.body.order.delivery, 450);
    assert.ok(!JSON.stringify(ok.body).includes("4242424242424242"));
    const declined = await call("POST", "/api/orders", { ...addr, payment: "card_test", card: { number: "4000 0000 0000 0002", exp: "12/30", cvc: "123" }, items: [{ id: "simba-tshirt", qty: 1 }] });
    assert.equal(declined.status, 402);
    assert.equal((await call("POST", "/api/orders", { ...addr, payment: "card_test", card: { number: "4242 4242 4242 4241", exp: "12/30", cvc: "123" }, items: [{ id: "simba-tshirt", qty: 1 }] })).status, 402);
    const p = await call("GET", "/api/product?id=simba-tshirt");
    assert.equal(p.body.stock, 19, "declined payments must not keep stock");
  });
  it("Stripe is refused cleanly when not configured", async () => {
    assert.equal((await call("GET", "/api/config")).body.stripe, false);
    assert.equal((await call("POST", "/api/orders", { ...addr, payment: "stripe", items: [{ id: "simba-tshirt", qty: 1 }] })).status, 503);
  });
  it("shows order status and cancels with a refund and restocked items", async () => {
    const o = (await call("GET", "/api/orders")).body.find((x) => x.payment.status === "Paid");
    const one = await call("GET", `/api/order?id=${o._id}`);
    assert.equal(one.body.status, "Paid"); assert.ok(one.body.cancellable);
    const c = await call("POST", "/api/orders/cancel", { id: o._id });
    assert.equal(c.body.status, "Cancelled"); assert.equal(c.body.payment.status, "Refunded");
    assert.equal((await call("GET", "/api/product?id=simba-tshirt")).body.stock, 20);
    assert.equal((await call("POST", "/api/orders/cancel", { id: o._id })).status, 409);
  });
  it("refuses to sell more than the stock", async () => {
    const r = await call("POST", "/api/orders", { ...addr, items: [{ id: "barbie-tshirt-classic", qty: 16 }] });
    assert.equal(r.status, 409);
  });
  it("reviews get AI sentiment and a verified-purchase badge", async () => {
    const r = await call("POST", "/api/reviews", { target: "product:batman-tshirt", rating: 5, body: "Excellent quality, soft cotton and a great print. Love it!" });
    assert.equal(r.status, 201); assert.equal(r.body.sentiment.label, "Positive"); assert.equal(r.body.verified, true);
    const bad = await call("POST", "/api/reviews", { target: "product:dark-knight-shirt", rating: 1, body: "Terrible fabric, it shrank and the print faded. Waste of money." });
    assert.equal(bad.body.sentiment.label, "Negative"); assert.equal(bad.body.verified, false);
    const list = await call("GET", "/api/reviews?target=product:batman-tshirt");
    assert.ok(list.body.count >= 3 && list.body.average > 0 && list.body.summary.aspects.length > 0);
  });
  it("wishlist toggles and recommendations use the user's history", async () => {
    assert.equal((await call("POST", "/api/wishlist", { id: "captain-america" })).body.saved, true);
    assert.equal((await call("GET", "/api/wishlist")).body[0].id, "captain-america");
    const rec = await call("GET", "/api/recommendations?n=5");
    assert.equal(rec.body.personalised, true); assert.equal(rec.body.items.length, 5);
    const guest = await call("GET", "/api/recommendations?kind=product&seed=title:barbie", null, null);
    assert.ok(guest.body.items.some((p) => p.id.includes("barbie")));
    const p = await call("GET", "/api/product?id=barbie-tshirt");
    assert.equal(p.body.relatedTitle.id, "barbie"); assert.equal(p.body.alsoBought.length, 4);
  });
});

describe("events, history, contact", () => {
  it("books tickets, tracks seats and cancels", async () => {
    const before = (await call("GET", "/api/events")).body.find((e) => e.id === "boat-parade").seatsLeft;
    const b = await call("POST", "/api/bookings", { eventId: "boat-parade", tickets: 4 });
    assert.equal(b.status, 201); assert.equal(b.body.amount, 3200);
    assert.equal((await call("GET", "/api/events")).body.find((e) => e.id === "boat-parade").seatsLeft, before - 4);
    assert.equal((await call("POST", "/api/bookings/cancel", { id: b.body._id })).status, 201);
    assert.equal((await call("GET", "/api/events")).body.find((e) => e.id === "boat-parade").seatsLeft, before);
  });
  it("records watch history and searches the catalog", async () => {
    await call("POST", "/api/history", { id: "inception" });
    assert.equal((await call("GET", "/api/history")).body[0].title, "Inception");
    const s = await call("GET", "/api/catalog?q=batman");
    assert.ok(s.body.some((x) => x.title === "Batman Pocket T-Shirt"));
  });
  it("chooses a plan and accepts contact messages", async () => {
    assert.equal((await call("POST", "/api/subscription", { plan: "Premium" })).body.plan, "Premium");
    assert.equal((await call("GET", "/api/auth/me")).body.plan, "Premium");
    assert.equal((await call("POST", "/api/messages", { name: "A", email: "x", message: "hi" }, null)).status, 400);
    assert.equal((await call("POST", "/api/messages", { name: "Ali", email: "ali@example.com", message: "Hello there" }, null)).status, 201);
  });
});
