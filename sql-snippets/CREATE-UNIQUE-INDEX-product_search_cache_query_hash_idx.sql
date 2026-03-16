CREATE UNIQUE INDEX product_search_cache_query_hash_idx
  ON product_search_cache(query_hash);
