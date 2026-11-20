# EntXHub ML

| Model | Type | Script | Exported to |
|---|---|---|---|
| Review sentiment | NLP: multinomial Naive Bayes over word unigrams + bigrams, with negation marking | `train_sentiment.py` | `api/_lib/models/sentiment.json` |
| Recommender | Implicit-feedback matrix factorisation (ALS), titles and products in one embedding space | `train_recommender.py` (after `node export_items.mjs`) | `api/_lib/models/recommender.json` |

Both run inside the Node.js API (`api/_lib/ai.js`) with no Python, GPU or paid AI service. `npm test` checks the JS results against the Python ones (`reports/*-parity.json`).

```bash
pip install -r requirements.txt
python train_sentiment.py                       # downloads the corpora with NLTK
node export_items.mjs && python train_recommender.py
cd .. && npm test
```

## Sentiment model card

- **Data (real, human-labelled):** Pang & Lee sentence polarity v1.0 (10,662 movie-review snippets), Hu & Liu customer-review corpora (product-review sentences with opinion scores), and the Cornell movie-review polarity v2.0 corpus (2,000 full reviews, used only for testing).
- **Features:** word unigrams + bigrams (12,000 most frequent), with the three words after a negation prefixed `NOT_` so "not good" ≠ "good".
- **Model:** multinomial Naive Bayes (α = 0.5), compared with Complement NB and logistic regression. Labels: Positive (p ≥ 0.58), Negative (p ≤ 0.42), Mixed in between.
- **Used for:** a sentiment chip on every review, a live "this reads as…" preview while writing, and the AI review summary (share of positive reviews plus per-aspect sentiment for fit, fabric, print, delivery and price).

## Recommender model card

- **Data:** synthetic users with 1–3 taste profiles (superhero, Barbie/family, anime, sci-fi, crime drama, thriller, podcasts, action epics, Pakistani titles) generating views (weight 1), wishlist adds (3) and purchases (5), plus popularity noise.
- **Model:** implicit ALS (Hu, Koren & Volinsky 2008): k = 16, α = 2, λ = 0.1, 12 iterations, written in NumPy.
- **Evaluation:** leave-one-out per held-out user, Hit@10 and NDCG@10, against a most-popular baseline.
- **Inference:** a user's vector is folded in from their own history (views, wishlist, orders, 4–5★ reviews; guests: titles and products viewed in the browser) by solving the ALS normal equations, so recommendations work from the first click. Item-to-item cosine similarity powers "More like this", "Shop the look" and "Customers also bought".

## Results

Training sentences: 11,110 (8,530 movie snippets, 2,580 product-review sentences). Held-out reviews never seen in training.

| Model | Movie snippets acc. | Product-review sentences acc. | Product macro-F1 | Full movie reviews acc. |
|---|---|---|---|---|
| multinomial_nb | 0.7772 | 0.7756 | 0.7609 | 0.664 |
| complement_nb | 0.7735 | 0.7766 | 0.7639 | 0.6635 |
| logistic_regression | 0.7739 | 0.7756 | 0.7666 | 0.732 |

Test sizes: 2,132 movie snippets, 1,043 product-review sentences, 2,000 full movie reviews.

**Shipped:** multinomial Naive Bayes over word unigrams + bigrams with negation marking (`not good` → `NOT_good`).


Implicit ALS, k = 16, α = 2.0, λ = 0.1, 12 iterations · 43 items (titles + products) · 3,377 training users, 596 test users (leave-one-out)

| Model | Hit@10 | NDCG@10 |
|---|---|---|
| ALS matrix factorisation | 0.6174 | 0.3596 |
| Most popular (baseline) | 0.3943 | 0.1948 |

