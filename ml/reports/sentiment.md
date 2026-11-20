# Review sentiment – evaluation

Training sentences: 11,110 (8,530 movie snippets, 2,580 product-review sentences). Held-out reviews never seen in training.

| Model | Movie snippets acc. | Product-review sentences acc. | Product macro-F1 | Full movie reviews acc. |
|---|---|---|---|---|
| multinomial_nb | 0.7772 | 0.7756 | 0.7609 | 0.664 |
| complement_nb | 0.7735 | 0.7766 | 0.7639 | 0.6635 |
| logistic_regression | 0.7739 | 0.7756 | 0.7666 | 0.732 |

Test sizes: 2,132 movie snippets, 1,043 product-review sentences, 2,000 full movie reviews.

**Shipped:** multinomial Naive Bayes over word unigrams + bigrams with negation marking (`not good` → `NOT_good`).
