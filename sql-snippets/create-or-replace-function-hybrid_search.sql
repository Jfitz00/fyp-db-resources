create or replace function hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int,
  full_text_weight float = 1,
  semantic_weight float = 1,
  rrf_k int = 50
)
returns table (
  product_id int,
  article_number text,
  location text,
  quantity int,
  description text,
  sales int,
  image_url text,
  barcode text,
  category text,
  full_text_rank int,
  semantic_rank int,
  hybrid_score float
)
language sql
as $$
with full_text as (
  select
    product_id,
    row_number() over (
      order by ts_rank_cd(fts, websearch_to_tsquery(query_text)) desc
    ) as rank_ix
  from
    product_embeddings
  where
    fts @@ websearch_to_tsquery(query_text)
  limit least(match_count, 30) * 2
),
semantic as (
  select
    product_id,
    row_number() over (order by embedding <#> query_embedding) as rank_ix
  from
    product_embeddings
  order by rank_ix
  limit least(match_count, 30) * 2
)
select
  pe.product_id,
  p.article_number,
  p.location,
  p.quantity,
  p.description,
  p.sales,
  p.image_url,
  p.barcode,
  p.category,
  full_text.rank_ix as full_text_rank,
  semantic.rank_ix as semantic_rank,
  (
    coalesce(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
    coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight
  ) as hybrid_score
from
  full_text
  full outer join semantic using (product_id)
  join product_embeddings pe
    on pe.product_id = coalesce(full_text.product_id, semantic.product_id)
  join products p
    on p.id = pe.product_id
order by
  hybrid_score desc
limit least(match_count, 30);
$$;
