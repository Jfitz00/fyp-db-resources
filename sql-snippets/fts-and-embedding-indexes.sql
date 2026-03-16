-- Full-text search index with explicit name
CREATE INDEX fts_idx ON product_embeddings USING gin(fts);

-- Vector index with explicit name
CREATE INDEX vector_idx ON product_embeddings USING hnsw (embedding vector_ip_ops);
