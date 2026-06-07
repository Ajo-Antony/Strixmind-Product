/**
 * /api/knowledge  — Knowledge Base + RAG (Retrieval-Augmented Generation)
 *
 * Flow:  Message → Retriever → Knowledge Base → Relevant Docs → AI Response
 *
 * Sources supported:
 *   - Product catalog
 *   - Boutique FAQs
 *   - Policies (return, exchange, size)
 *   - Pricing sheets
 *
 * GET  /api/knowledge          → list all documents
 * POST /api/knowledge          → add a document
 * POST /api/knowledge/retrieve → RAG: find relevant chunks + generate answer
 * DELETE /api/knowledge?id=    → delete a document
 */
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai'

// ── Document types ────────────────────────────────────────────────────────────
type DocCategory =
  | 'product_catalog'
  | 'faq'
  | 'policy'
  | 'pricing'
  | 'general'

interface KnowledgeChunk {
  id: string
  document_id: string
  category: DocCategory
  title: string
  content: string
  keywords: string[]
  similarity_score?: number
}

// ── Simple keyword-based retriever (pgvector-ready) ───────────────────────────
async function retrieveRelevantChunks(
  query: string,
  db: any,
  limit = 5
): Promise<KnowledgeChunk[]> {
  // Extract keywords from query for matching
  const keywords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s₹]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)

  if (!keywords.length) return []

  // Text search across knowledge_documents
  // When pgvector is enabled, replace with embedding similarity search
  const { data: docs } = await db
    .from('knowledge_documents')
    .select('id, category, title, content, keywords, metadata')
    .or(keywords.map((kw: string) => `content.ilike.%${kw}%`).join(','))
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(limit * 2)   // over-fetch then rank

  if (!docs?.length) return []

  // Score by keyword hits
  const scored = docs.map((doc: any) => {
    const text = `${doc.title} ${doc.content}`.toLowerCase()
    const hits = keywords.filter((kw: string) => text.includes(kw)).length
    return { ...doc, similarity_score: hits / keywords.length }
  })

  return scored
    .sort((a: any, b: any) => b.similarity_score - a.similarity_score)
    .slice(0, limit)
}

// ── Format retrieved context for AI ──────────────────────────────────────────
function buildContext(chunks: KnowledgeChunk[]): string {
  if (!chunks.length) return ''
  return chunks.map((c, i) =>
    `[Source ${i+1}: ${c.title} (${c.category.replace(/_/g,' ')})]:\n${c.content}`
  ).join('\n\n---\n\n')
}

// ── GET: list documents ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search   = searchParams.get('search')

  let query = db.from('knowledge_documents').select('*').order('created_at', { ascending: false })
  if (category) query = query.eq('category', category)
  if (search)   query = query.ilike('content', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── POST: add document OR run RAG retrieval ───────────────────────────────────
export async function POST(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'add'

  // ── RAG: retrieve + generate ──────────────────────────────────────────────
  if (action === 'retrieve') {
    try {
      const { query, conversation_id, lead_id, generate_answer = true } = await req.json()
      if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

      const chunks = await retrieveRelevantChunks(query, db)
      const context = buildContext(chunks)

      let answer: string | null = null

      if (generate_answer && context) {
        const { text } = await callAI({
          systemPrompt: `You are a helpful assistant for a premium bridal boutique. Answer the customer's question using ONLY the provided knowledge base context.
If the context doesn't contain enough information, say "I'll need to check that for you — please give me a moment!" rather than guessing.
Keep answers concise, warm, and under 150 words. Use emojis naturally.
Do NOT mention "the context" or "knowledge base" to the customer.`,
          messages: [
            { role: 'user', content: `Knowledge base context:\n\n${context}` },
            { role: 'assistant', content: 'I have reviewed the relevant information.' },
            { role: 'user', content: query },
          ],
          temperature: 0.4,
          maxTokens: 300,
          taskType: 'rag_answer',
          size: 'small',
          conversationId: conversation_id,
          leadId: lead_id,
        })
        answer = text
      }

      return NextResponse.json({
        data: {
          query,
          chunks_found:  chunks.length,
          sources:       chunks.map(c => ({ id: c.id, title: c.title, category: c.category, score: c.similarity_score })),
          context_used:  !!context,
          answer,
        }
      })
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // ── Add a knowledge document ──────────────────────────────────────────────
  try {
    const body = await req.json()
    const { title, content, category = 'general', metadata = {} } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'title and content required' }, { status: 400 })
    }

    // Auto-extract keywords from content
    const keywords = content
      .toLowerCase()
      .replace(/[^a-z0-9\s₹]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 3)
      .filter((w: string, i: number, arr: string[]) => arr.indexOf(w) === i)
      .slice(0, 30)

    const { data, error } = await db.from('knowledge_documents').insert({
      title,
      content,
      category: category as DocCategory,
      keywords,
      metadata,
      active: true,
      created_at: new Date().toISOString(),
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE: remove a document ─────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const db = createSupabaseServiceClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db.from('knowledge_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { deleted: true } })
}
