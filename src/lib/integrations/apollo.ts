// ─── Apollo.io enrichment ──────────────────────────────────────────────────────
// Docs: https://apolloio.github.io/apollo-api-docs/?shell#people-enrichment

export interface ApolloContact {
  first_name:        string | null
  last_name:         string | null
  title:             string | null
  email:             string | null
  phone_numbers:     { raw_number: string }[]
  linkedin_url:      string | null
  organization_name: string | null
  city:              string | null
  country:           string | null
  organization?: {
    name:         string | null
    phone:        string | null
    linkedin_url: string | null
    website_url:  string | null
  }
}

export async function enrichByEmail(email: string): Promise<ApolloContact | null> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey || apiKey === 'your_apollo_key') {
    console.warn('[apollo] APOLLO_API_KEY not configured — skipping enrichment')
    return null
  }

  try {
    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        api_key: apiKey,
        email,
        reveal_personal_emails: false,
      }),
    })

    if (!res.ok) {
      console.error('[apollo] API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    const p = data?.person
    if (!p) return null

    return {
      first_name:        p.first_name        ?? null,
      last_name:         p.last_name         ?? null,
      title:             p.title             ?? null,
      email:             p.email             ?? email,
      phone_numbers:     p.phone_numbers     ?? [],
      linkedin_url:      p.linkedin_url      ?? null,
      organization_name: p.organization_name ?? p.organization?.name ?? null,
      city:              p.city              ?? null,
      country:           p.country           ?? null,
      organization: p.organization ? {
        name:         p.organization.name         ?? null,
        phone:        p.organization.phone        ?? null,
        linkedin_url: p.organization.linkedin_url ?? null,
        website_url:  p.organization.website_url  ?? null,
      } : undefined,
    }
  } catch (err: any) {
    console.error('[apollo] Fetch error:', err.message)
    return null
  }
}
