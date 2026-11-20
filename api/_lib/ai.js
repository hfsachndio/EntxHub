// EntXHub AI: review sentiment (Naive Bayes trained on real review corpora) and recommendations
// (implicit ALS matrix factorisation over titles + products). Trained in ml/, served here with no external services.
import SENT from "./models/sentiment.json" with { type: "json" };
import REC from "./models/recommender.json" with { type: "json" };

// ---------- sentiment ----------
const vocab = new Map(SENT.vocab.map((t, i) => [t, i]));
const NEG = new Set(SENT.negators);
export function tokens(text) {
  const out = []; let neg = 0;
  for (const w of String(text).toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []) {
    if (NEG.has(w) || w.endsWith("n't")) { out.push(w); neg = 3; continue; }
    out.push(neg ? "NOT_" + w : w); neg = Math.max(0, neg - 1);
  }
  return out;
}
/** Positive-class probability with the words that pushed it most either way. */
export function sentiment(text) {
  const t = tokens(text);
  const grams = [...t, ...t.slice(1).map((w, i) => `${t[i]} ${w}`)];
  const ll = [...SENT.class_log_prior];
  const contrib = [];
  for (const g of grams) {
    const i = vocab.get(g); if (i === undefined) continue;
    ll[0] += SENT.feature_log_prob[0][i]; ll[1] += SENT.feature_log_prob[1][i];
    contrib.push([g, SENT.feature_log_prob[1][i] - SENT.feature_log_prob[0][i]]);
  }
  const m = Math.max(...ll), p = Math.exp(ll[1] - m) / (Math.exp(ll[0] - m) + Math.exp(ll[1] - m));
  const label = p >= 0.58 ? "Positive" : p <= 0.42 ? "Negative" : "Mixed";
  contrib.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return { p: Math.round(p * 1e4) / 1e4, label, words: contrib.slice(0, 4).map(([g, w]) => ({ word: g.replace(/NOT_/g, "not "), weight: Math.round(w * 100) / 100 })) };
}

const ASPECTS = { fit: ["fit", "size", "sizes", "small", "large", "tight", "loose", "fits"], fabric: ["fabric", "material", "cotton", "soft", "quality", "stitching", "wash", "faded"],
  print: ["print", "design", "logo", "colour", "color", "graphic", "glitter"], delivery: ["delivery", "shipping", "arrived", "packaging", "late", "quick", "fast"], price: ["price", "value", "worth", "expensive", "cheap"] };
/** Per-aspect sentiment across reviews: which aspects customers praise or complain about. */
export function summarise(reviews) {
  const out = [];
  for (const [aspect, words] of Object.entries(ASPECTS)) {
    const hits = reviews.filter((r) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(r.body)));
    if (!hits.length) continue;
    const pos = hits.filter((r) => (r.sentiment?.p ?? sentiment(r.body).p) >= 0.5).length;
    out.push({ aspect, mentions: hits.length, positive: pos, share: Math.round((pos / hits.length) * 100) });
  }
  const all = reviews.map((r) => r.sentiment?.p ?? sentiment(r.body).p);
  return { aspects: out.sort((a, b) => b.mentions - a.mentions), positiveShare: all.length ? Math.round((all.filter((p) => p >= 0.5).length / all.length) * 100) : null, count: reviews.length };
}
export const sentimentInfo = () => ({ name: SENT.name, type: SENT.type, features: SENT.vocab.length, metrics: SENT.metrics });

// ---------- recommendations ----------
const itemIndex = new Map(REC.items.map((k, i) => [k, i]));
const K = REC.k;
/** Solves A x = b for a small dense system (Gaussian elimination with partial pivoting). */
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
/** User vector from their interactions [[itemKey, weight]] via the ALS normal equations (fold-in). */
export function foldIn(history) {
  const A = REC.YtY.map((row, i) => row.map((v, j) => v + (i === j ? REC.reg : 0))); const b = new Array(K).fill(0);
  for (const [key, w] of history) {
    const i = itemIndex.get(key); if (i === undefined) continue;
    const y = REC.factors[i], c = 1 + REC.alpha * w;
    for (let r = 0; r < K; r++) { b[r] += c * y[r]; for (let s = 0; s < K; s++) A[r][s] += (c - 1) * y[r] * y[s]; }
  }
  return solve(A, b);
}
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
/** Ranked item keys for a user history, excluding what they already interacted with. */
export function recommend(history, { n = 8, kind } = {}) {
  const known = history.filter(([k]) => itemIndex.has(k));
  if (!known.length) return [];
  const u = foldIn(known), seen = new Set(known.map(([k]) => k));
  return REC.items.map((key, i) => ({ key, score: dot(u, REC.factors[i]) }))
    .filter((x) => !seen.has(x.key) && (!kind || x.key.startsWith(kind + ":"))).sort((a, b) => b.score - a.score).slice(0, n);
}
/** Items most similar to one item (cosine similarity of the learned factors): "more like this", "customers also bought". */
export function similar(key, { n = 6, kind } = {}) {
  const i = itemIndex.get(key); if (i === undefined) return [];
  const a = REC.factors[i], na = Math.hypot(...a);
  return REC.items.map((k, j) => ({ key: k, score: dot(a, REC.factors[j]) / (na * Math.hypot(...REC.factors[j]) || 1) }))
    .filter((x) => x.key !== key && (!kind || x.key.startsWith(kind + ":"))).sort((p, q) => q.score - p.score).slice(0, n);
}
export const recommenderInfo = () => ({ name: REC.name, type: REC.type, k: REC.k, items: REC.items.length, metrics: REC.metrics });
