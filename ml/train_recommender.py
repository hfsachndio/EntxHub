"""Implicit-feedback matrix factorisation (ALS) for EntXHub "Recommended for you" and "Customers also bought".

Items: every title (movies, series, anime, podcasts) and every shop product, in one embedding space, so a
Barbie fan who watched the film is shown the Barbie T-shirt and vice versa.
Data: synthetic users with 1–3 taste profiles (genres / franchises / formats) generating views, wishlist adds and
purchases with confidence weights (view 1, wishlist 3, purchase 5), plus popularity noise.
Evaluation: leave-one-out per user (the last interaction is hidden), Hit@10 and NDCG@10, against a
popularity baseline. Inference: users are folded in from their own history with the exact ALS normal
equations, so new users and guests get recommendations immediately.
"""
import json, os, random, math
import numpy as np

random.seed(5); np.random.seed(5)
OUT = "../api/_lib/models/recommender.json"
CATALOG = json.load(open("items.json"))  # written by export_items.mjs from api/_lib/catalog.js
items = CATALOG["items"]; ids = [i["key"] for i in items]; index = {k: n for n, k in enumerate(ids)}

PROFILES = {
    "superhero": lambda i: i.get("franchise") in ("Marvel", "DC") or i["key"] in ("title:avengers-infinity-war", "title:black-panther", "title:doctor-strange-in-the-multiverse-of-madness", "title:loki", "title:the-dark-knight-rises", "title:joker"),
    "barbie_family": lambda i: i.get("franchise") in ("Barbie", "Disney") or i["key"] in ("title:barbie", "title:pokemon"),
    "anime": lambda i: i.get("type") == "Anime",
    "scifi": lambda i: any(g in i.get("genres", []) for g in ("Science Fiction",)),
    "crime_drama": lambda i: any(g in i.get("genres", []) for g in ("Crime",)) and i.get("type") in ("Movie", "Web Series"),
    "thriller_mystery": lambda i: any(g in i.get("genres", []) for g in ("Mystery", "Thriller", "Psychological Thriller")),
    "podcasts": lambda i: i.get("type") == "Podcast",
    "action_epics": lambda i: "Action" in i.get("genres", []) and "Adventure" in i.get("genres", []),
    "pakistani": lambda i: i["key"] in ("title:maula-jatt", "title:tauha-ibne-jalil", "title:junaid-akram", "title:muzammil-hassan"),
}
POP = np.array([1.0 + (3.0 if i.get("kind") == "title" and i.get("type") == "Movie" else 0.8) for i in items]); POP /= POP.sum()

def make_users(n=4000):
    users = []
    for _ in range(n):
        tastes = random.sample(list(PROFILES), random.choice([1, 1, 2, 2, 3]))
        liked = [k for k, it in enumerate(items) if any(PROFILES[t](it) for t in tastes)]
        if not liked: continue
        events = {}
        for _ in range(random.randint(4, 14)):
            j = random.choice(liked) if random.random() < 0.82 else int(np.random.choice(len(items), p=POP))
            kind = items[j]["kind"]
            w = 5 if (kind == "product" and random.random() < 0.6) else 3 if random.random() < 0.15 else 1
            events[j] = max(events.get(j, 0), w)
        if len(events) >= 3: users.append(list(events.items()))
    return users

def als(R, k=16, alpha=2.0, reg=0.1, iters=12):
    """R: list of user interaction lists [(item, weight)]. Returns item factors Y (n_items × k)."""
    n_u, n_i = len(R), len(items)
    X = np.random.normal(0, 0.1, (n_u, k)); Y = np.random.normal(0, 0.1, (n_i, k))
    by_item = [[] for _ in range(n_i)]
    for u, ev in enumerate(R):
        for i, w in ev: by_item[i].append((u, w))
    I = np.eye(k)
    for _ in range(iters):
        YtY = Y.T @ Y
        for u, ev in enumerate(R): X[u] = solve(YtY, Y, ev, alpha, reg, I)
        XtX = X.T @ X
        for i in range(n_i): Y[i] = solve(XtX, X, by_item[i], alpha, reg, I)
    return Y

def solve(BtB, B, ev, alpha, reg, I):
    A = BtB + reg * I; b = np.zeros(B.shape[1])
    for j, w in ev:
        c = 1 + alpha * w; v = B[j]
        A += (c - 1) * np.outer(v, v); b += c * v
    return np.linalg.solve(A, b)

def fold_in(Y, YtY, ev, alpha, reg):
    return solve(YtY, Y, ev, alpha, reg, np.eye(Y.shape[1]))

def evaluate(Y, test, alpha, reg, k=10):
    YtY = Y.T @ Y; hits = ndcg = 0
    pop = np.zeros(len(items))
    for ev, _ in test:
        for i, w in ev: pop[i] += 1
    ph = pn = 0
    for ev, held in test:
        u = fold_in(Y, YtY, ev, alpha, reg); s = Y @ u
        seen = {i for i, _ in ev}; s[list(seen)] = -1e9
        top = list(np.argsort(-s)[:k])
        if held in top: hits += 1; ndcg += 1 / math.log2(top.index(held) + 2)
        p = pop.copy(); p[list(seen)] = -1e9; ptop = list(np.argsort(-p)[:k])
        if held in ptop: ph += 1; pn += 1 / math.log2(ptop.index(held) + 2)
    n = len(test)
    return {"hit_at_10": round(hits / n, 4), "ndcg_at_10": round(ndcg / n, 4), "popularity_hit_at_10": round(ph / n, 4), "popularity_ndcg_at_10": round(pn / n, 4), "users": n}

def main():
    users = make_users(); random.shuffle(users)
    cut = int(len(users) * 0.85)
    train = users[:cut]
    test = []
    for ev in users[cut:]:
        held = ev[-1][0]; test.append((ev[:-1], held))
    alpha, reg, k = 2.0, 0.1, 16
    Y = als(train, k=k, alpha=alpha, reg=reg)
    metrics = evaluate(Y, test, alpha, reg)
    os.makedirs("reports", exist_ok=True)
    YtY = Y.T @ Y
    export = {"name": "entxhub-recommender", "version": 1, "type": "implicit_als", "k": k, "alpha": alpha, "reg": reg, "items": ids,
              "factors": Y.round(5).tolist(), "YtY": YtY.round(5).tolist(), "metrics": {**metrics, "train_users": len(train), "interactions": sum(len(u) for u in train)}}
    json.dump(export, open(OUT, "w"), separators=(",", ":"))
    # parity: fold-in scores for a few histories
    samples = []
    for ev, _ in test[:12]:
        u = fold_in(Y, YtY, ev, alpha, reg); s = Y @ u
        samples.append({"history": [[ids[i], w] for i, w in ev], "top": [ids[j] for j in np.argsort(-s) if j not in {i for i, _ in ev}][:5], "score0": round(float(s[0]), 5)})
    json.dump(samples, open("reports/recommender-parity.json", "w"), indent=1)
    md = ["# Recommender – evaluation", "", f"Implicit ALS, k = {k}, α = {alpha}, λ = {reg}, 12 iterations · {len(items)} items (titles + products) · {len(train):,} training users, {metrics['users']:,} test users (leave-one-out)", "",
          "| Model | Hit@10 | NDCG@10 |", "|---|---|---|", f"| ALS matrix factorisation | {metrics['hit_at_10']} | {metrics['ndcg_at_10']} |", f"| Most popular (baseline) | {metrics['popularity_hit_at_10']} | {metrics['popularity_ndcg_at_10']} |"]
    open("reports/recommender.md", "w").write("\n".join(md) + "\n"); json.dump(metrics, open("reports/recommender.json", "w"), indent=1)
    print(metrics, "KB", os.path.getsize(OUT) // 1024)

if __name__ == "__main__": main()
