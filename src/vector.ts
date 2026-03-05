import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

function getSupabase() {
    if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
        return null;
    }
    return createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
}

export async function storeVectorMemory(content: string, metadata: any = {}) {
    const supabase = getSupabase();
    if (!supabase) return null;

    // 1. Generate Embedding using Gemini
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(content);
    const embedding = result.embedding.values;

    // 2. Store in Supabase
    const { data, error } = await supabase
        .from('vector_memories')
        .insert([
            {
                content,
                metadata,
                embedding
            }
        ]);

    if (error) console.error('Supabase Vector Store Error:', error);
    return data;
}

export async function semanticSearch(query: string, limit: number = 5) {
    const supabase = getSupabase();
    if (!supabase) return [];

    // 1. Generate Embedding for query
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(query);
    const queryEmbedding = result.embedding.values;

    // 2. Query Supabase using match_memories RPC
    const { data, error } = await supabase.rpc('match_memories', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: limit,
    });

    if (error) {
        console.error('Supabase Semantic Search Error:', error);
        return [];
    }

    return data;
}
