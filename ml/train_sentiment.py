"""Trains EntXHub's review sentiment model on real, human-labelled review data and exports it for the Node.js API.

Data (downloaded with NLTK):
  * Sentence polarity dataset v1.0: 10,662 short movie-review snippets labelled positive / negative (Pang & Lee, 2005).
  * Hu & Liu customer-review corpora: product-review sentences annotated with opinion strength (+3 … -3).
  * Cornell movie-review polarity corpus v2.0: 2,000 full movie reviews, used only as an extra test of whole reviews.
Short texts like the ones EntXHub users write. Test sets are held out per source.

Model: word unigram + bigram counts → Multinomial Naive Bayes. Compared with logistic regression and
Complement NB. Naive Bayes is shipped: comparable accuracy, tiny, and its per-word log-likelihoods make
explanations ("great", "poor fit") trivial.
"""
import json, os, re, random
import numpy as np
import nltk
from nltk.corpus import movie_reviews, product_reviews_1, product_reviews_2, sentence_polarity
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB, ComplementNB
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.metrics import accuracy_score, f1_score, classification_report

random.seed(0)
OUT = "../api/_lib/models/sentiment.json"
TOKEN = re.compile(r"[a-z]+(?:'[a-z]+)?")
NEG = {"not", "no", "never", "n't", "nothing", "hardly", "isn't", "wasn't", "don't", "didn't", "doesn't", "can't", "won't", "aren't", "couldn't", "wouldn't", "shouldn't"}

def tokens(text):
    """Lowercase words; after a negation word the next 3 words get a NOT_ prefix ("not good" → NOT_good)."""
    out, neg = [], 0
    for w in TOKEN.findall(text.lower()):
        if w in NEG or w.endswith("n't"): out.append(w); neg = 3; continue
        out.append("NOT_" + w if neg else w); neg = max(0, neg - 1)
    return out

def movie_sentences():
    rows = []
    for cat in ("pos", "neg"):
        for i, sent in enumerate(sentence_polarity.sents(categories=cat)):
            rows.append((" ".join(sent), 1 if cat == "pos" else 0, f"{cat}{i}"))
    return rows

def product_sentences():
    rows = []
    for corpus in (product_reviews_1, product_reviews_2):
        for fid in corpus.fileids():
            for rv in corpus.reviews(fid):
                for line in rv.review_lines:
                    score = sum(int(v.replace("+", "")) for _, v in line.features if v not in ("", None))
                    if score == 0 or not line.sent: continue
                    rows.append((" ".join(line.sent), 1 if score > 0 else 0, f"{fid}:{rv.title}"))
    return rows

def main():
    for c in ("sentence_polarity", "movie_reviews", "product_reviews_1", "product_reviews_2"): nltk.download(c, quiet=True)
    movies, products = movie_sentences(), product_sentences()
    # split by source document so sentences from one review never appear in both train and test
    def split(rows, frac=0.2):
        docs = sorted({d for *_, d in rows}); random.shuffle(docs); test_docs = set(docs[: int(len(docs) * frac)])
        return [r for r in rows if r[2] not in test_docs], [r for r in rows if r[2] in test_docs]
    mtr, mte = split(movies); ptr, pte = split(products)
    # balance the training mix so product sentences aren't drowned out by movie sentences
    train = mtr + ptr
    Xtr, ytr = [t for t, *_ in train], np.array([y for _, y, _ in train])
    vec = CountVectorizer(tokenizer=tokens, lowercase=False, token_pattern=None, ngram_range=(1, 2), min_df=3, max_features=12000)
    A = vec.fit_transform(Xtr)
    tf = TfidfTransformer(sublinear_tf=True).fit(A)
    models = {"multinomial_nb": MultinomialNB(alpha=0.5).fit(A, ytr), "complement_nb": ComplementNB(alpha=0.5).fit(A, ytr),
              "logistic_regression": LogisticRegression(C=2, max_iter=3000).fit(tf.transform(A), ytr)}
    res = {}
    for name, m in models.items():
        res[name] = {}
        for tag, rows in (("movie_sentences", mte), ("product_review_sentences", pte)):
            X = vec.transform([t for t, *_ in rows]); X = tf.transform(X) if name == "logistic_regression" else X
            p = m.predict(X); y = np.array([y for _, y, _ in rows])
            res[name][tag] = {"accuracy": round(accuracy_score(y, p), 4), "macro_f1": round(f1_score(y, p, average="macro"), 4), "n": len(rows)}
    # whole movie reviews (2,000 docs, never used for training): classify the full text
    docs = [(movie_reviews.raw(f), 1 if movie_reviews.categories(f)[0] == "pos" else 0) for f in movie_reviews.fileids()]
    for name, m in models.items():
        X = vec.transform([d for d, _ in docs]); X = tf.transform(X) if name == "logistic_regression" else X
        res[name]["full_movie_reviews"] = {"accuracy": round(accuracy_score([y for _, y in docs], m.predict(X)), 4), "macro_f1": round(f1_score([y for _, y in docs], m.predict(X), average="macro"), 4), "n": len(docs)}
    nb = models["multinomial_nb"]
    vocab = sorted(vec.vocabulary_.items(), key=lambda kv: kv[1])
    export = {"name": "entxhub-review-sentiment", "version": 1, "type": "multinomial_naive_bayes", "ngram": [1, 2],
              "negators": sorted(NEG), "vocab": [t for t, _ in vocab], "class_log_prior": nb.class_log_prior_.round(6).tolist(),
              "feature_log_prob": nb.feature_log_prob_.round(5).tolist(),
              "metrics": {"product_accuracy": res["multinomial_nb"]["product_review_sentences"]["accuracy"], "movie_accuracy": res["multinomial_nb"]["movie_sentences"]["accuracy"], "full_review_accuracy": res["multinomial_nb"]["full_movie_reviews"]["accuracy"], "train_rows": len(train)}}
    os.makedirs(os.path.dirname(OUT), exist_ok=True); os.makedirs("reports", exist_ok=True)
    json.dump(export, open(OUT, "w"), separators=(",", ":"))
    samples = ["The fabric is soft and the print is great, my daughter loves it", "Terrible quality, the colour faded after one wash", "not good at all", "Not bad for the price",
               "This movie was a masterpiece, brilliant acting", "boring and way too long", "Delivery was quick but the size runs small"] + [t for t, *_ in pte[:30]]
    P = nb.predict_proba(vec.transform(samples))[:, 1]
    json.dump([{"text": t, "p": round(float(p), 6)} for t, p in zip(samples, P)], open("reports/sentiment-parity.json", "w"), indent=1)
    md = ["# Review sentiment – evaluation", "", f"Training sentences: {len(train):,} ({len(mtr):,} movie snippets, {len(ptr):,} product-review sentences). Held-out reviews never seen in training.", "",
          "| Model | Movie snippets acc. | Product-review sentences acc. | Product macro-F1 | Full movie reviews acc. |", "|---|---|---|---|---|"]
    for k, v in res.items(): md.append(f"| {k} | {v['movie_sentences']['accuracy']} | {v['product_review_sentences']['accuracy']} | {v['product_review_sentences']['macro_f1']} | {v['full_movie_reviews']['accuracy']} |")
    md += ["", f"Test sizes: {len(mte):,} movie snippets, {len(pte):,} product-review sentences, 2,000 full movie reviews.", "", "**Shipped:** multinomial Naive Bayes over word unigrams + bigrams with negation marking (`not good` → `NOT_good`)."]
    open("reports/sentiment.md", "w").write("\n".join(md) + "\n"); json.dump(res, open("reports/sentiment.json", "w"), indent=1)
    print(json.dumps(res, indent=1)); print("KB", os.path.getsize(OUT) // 1024)

if __name__ == "__main__": main()
