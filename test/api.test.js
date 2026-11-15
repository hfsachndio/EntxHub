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
  it("places an order with server-side prices and empties the cart", async () => {
    const r = await call("POST", "/api/orders", { name: "Ali", address: "House 1, Street 2, Karachi", items: [{ id: "batman-tshirt", qty: 2, price: 1 }, { id: "carnival", qty: 3 }] });
    assert.equal(r.status, 201);
    assert.equal(r.body.subtotal, 1600 * 2 + 1000 * 3);
    assert.equal(r.body.total, r.body.subtotal + 50 + Math.round(r.body.subtotal * 0.005));
    assert.equal((await call("GET", "/api/cart")).body.length, 0);
    assert.equal((await call("GET", "/api/orders")).body.length, 1);
    assert.equal((await call("GET", "/api/bookings")).body[0].tickets, 3);
  });
  it("refuses to sell more than the stock", async () => {
    const r = await call("POST", "/api/orders", { name: "Ali", address: "House 1, Street 2, Karachi", items: [{ id: "barbie-tshirt-classic", qty: 16 }] });
    assert.equal(r.status, 409);
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
    assert.ok(s.body.some((x) => x.title === "Batman T-Shirt"));
  });
  it("chooses a plan and accepts contact messages", async () => {
    assert.equal((await call("POST", "/api/subscription", { plan: "Premium" })).body.plan, "Premium");
    assert.equal((await call("GET", "/api/auth/me")).body.plan, "Premium");
    assert.equal((await call("POST", "/api/messages", { name: "A", email: "x", message: "hi" }, null)).status, 400);
    assert.equal((await call("POST", "/api/messages", { name: "Ali", email: "ali@example.com", message: "Hello there" }, null)).status, 201);
  });
});
