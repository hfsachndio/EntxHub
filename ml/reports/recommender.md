# Recommender – evaluation

Implicit ALS, k = 16, α = 2.0, λ = 0.1, 12 iterations · 43 items (titles + products) · 3,377 training users, 596 test users (leave-one-out)

| Model | Hit@10 | NDCG@10 |
|---|---|---|
| ALS matrix factorisation | 0.6174 | 0.3596 |
| Most popular (baseline) | 0.3943 | 0.1948 |
