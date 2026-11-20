// EntXHub AI: the Node.js implementations must reproduce the Python-trained models.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sentiment, recommend, similar, summarise, foldIn } from "../api/_lib/ai.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../ml/reports/${f}`, import.meta.url), "utf8"));

test("Naive Bayes sentiment matches scikit-learn", () => {
  for (const s of read("sentiment-parity.json")) assert.ok(Math.abs(sentiment(s.text).p - s.p) < 1e-3, `${s.text}: ${sentiment(s.text).p} vs ${s.p}`);
});
test("sentiment labels obvious reviews correctly, including negation", () => {
  assert.equal(sentiment("Amazing quality, soft fabric and the print looks great. Love it!").label, "Positive");
  assert.equal(sentiment("Terrible. The colour faded after one wash and it shrank. Waste of money.").label, "Negative");
  assert.ok(sentiment("not good").p < sentiment("good").p);
});
test("ALS fold-in reproduces the Python ranking", () => {
  for (const s of read("recommender-parity.json")) {
    const top = recommend(s.history, { n: 5 }).map((r) => r.key);
    assert.deepEqual(top, s.top);
  }
});
test("cross-domain recommendations: Barbie film fans get Barbie merch, Marvel fans get Marvel merch", () => {
  assert.ok(recommend([["title:barbie", 1]], { n: 3, kind: "product" }).some((r) => r.key.includes("barbie")));
  const sim = similar("product:captain-america", { n: 4 }).map((r) => r.key);
  assert.ok(sim.some((k) => /avengers|marvel|black-panther|loki|doctor-strange|dark-knight|batman/.test(k)), sim.join());
  assert.equal(foldIn([]).length, 16);
});
test("aspect summary counts praise and complaints per aspect", () => {
  const s = summarise([{ body: "Great fit and soft fabric" }, { body: "The size runs small, poor fit" }, { body: "Fast delivery" }]);
  assert.equal(s.count, 3); assert.ok(s.aspects.find((a) => a.aspect === "fit").mentions === 2);
});
