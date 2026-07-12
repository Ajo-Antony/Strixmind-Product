import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return res
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      { cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => { res.cookies.set({ name, value, ...options }) },
          remove: (name, options) => { res.cookies.set({ name, value: '', ...options }) },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    // Allow all API routes and /login without session redirect in middleware
    const isApi = req.nextUrl.pathname.startsWith('/api/')
    const isPublic = isApi || req.nextUrl.pathname.startsWith('/login')

    if (!session && !isPublic) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  } catch (err) {
    console.warn('[AI Studio] Middleware session fetch failed:', err)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
