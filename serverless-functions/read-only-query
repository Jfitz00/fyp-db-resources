import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as postgres from "https://deno.land/x/postgres@v0.17.0/mod.ts"

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Parse the request body
    const { query, params } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get connection details from environment variables
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    const readOnlyPassword = Deno.env.get('READ_ONLY_USER_PASSWORD')
    
    if (!dbUrl || !readOnlyPassword) {
      return new Response(
        JSON.stringify({ error: 'Database configuration missing' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse the database URL and replace with read-only user
    const url = new URL(dbUrl)
    const connectionString = `postgresql://read_only_user:${readOnlyPassword}@${url.hostname}:${url.port || '5432'}/postgres?sslmode=require`

    // Create a new pool with read-only user credentials
    const pool = new postgres.Pool(connectionString, 3, true)
    const connection = await pool.connect()

    try {
      // Add LIMIT 50 safety check if query doesn't have a LIMIT clause
      let finalQuery = query.trim()
      const hasLimit = /LIMIT\s+\d+/i.test(finalQuery)
      
      if (!hasLimit) {
        // Remove trailing semicolon if present
        finalQuery = finalQuery.replace(/;?\s*$/, '')
        finalQuery += ' LIMIT 50'
      }

      // Execute the query
      const result = await connection.queryObject({
        text: finalQuery,
        args: params || []
      })

      // Convert BigInt to string for JSON serialization
      const sanitizedData = JSON.parse(
        JSON.stringify(result.rows, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      )

      return new Response(
        JSON.stringify({
          success: true,
          data: sanitizedData,
          rowCount: result.rowCount
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    } catch (queryError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: queryError.message,
          detail: queryError.detail || null
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    } finally {
      connection.release()
      await pool.end()
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})
