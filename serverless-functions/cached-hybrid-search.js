import { createClient } from 'npm:@supabase/supabase-js@2';
import OpenAI from 'npm:openai';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
// Compute SHA-256 hash of the query
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b)=>b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async (req)=>{
  try {
    let { query } = await req.json();
    const conversation_id = req.headers.get('Conversation-Id');
    query = query.toLowerCase().trim();
    if (!query) {
      return new Response(JSON.stringify({
        error: 'Query is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    // Compute hash
    const queryHash = await sha256(query);
    // Check cache first
    const { data: cachedRow, error: cacheError } = await supabase.from('product_search_cache').select('results').eq('query_hash', queryHash).limit(1).single();
    // Any error except "no rows found" should throw
    if (cacheError && cacheError.code !== 'PGRST116') {
      return new Response(JSON.stringify({
        error: cacheError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // If cached, update conversation_id and updated_at, then return first 5 items
    if (cachedRow) {
      // Update the cached row
      const { error: updateError } = await supabase
        .from('product_search_cache')
        .update({
          conversation_id: conversation_id ?? null,
          updated_at: new Date().toISOString()
        })
        .eq('query_hash', queryHash);
      
      if (updateError) {
        // log but don't break response
        console.error('Cache update error:', updateError);
      }
      
      const firstFive = cachedRow.results.slice(0, 5);
      return new Response(JSON.stringify(firstFive), {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // If no cache: embed + hybrid_search
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: query,
      dimensions: 1536
    });
    const [{ embedding }] = embeddingResponse.data;
    const { data: documents, error: searchError } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: embedding,
      match_count: 15
    });
    if (searchError) {
      return new Response(JSON.stringify({
        error: searchError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Insert into cache
    const { error: insertError } = await supabase.from('product_search_cache').insert({
      query_hash: queryHash,
      query_text: query,
      results: documents,
      conversation_id: conversation_id ?? null
    });
    if (insertError) {
      // log but don't break response
      console.error('Cache insert error:', insertError);
    }
    // Return only first 5 when not cached
    const firstFive = documents.slice(0, 5);
    return new Response(JSON.stringify(firstFive), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
