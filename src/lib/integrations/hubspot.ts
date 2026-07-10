// ─── HubSpot contact creation ─────────────────────────────────────────────────
// Uses HUBSPOT_PRIVATE_APP_TOKEN (Private App token from HubSpot settings)
// Docs: https://developers.hubspot.com/docs/api/crm/contacts

export interface HubSpotContactInput {
  email:              string
  first_name?:        string | null
  last_name?:         string | null
  phone?:             string | null
  job_title?:         string | null
  company?:           string | null
  city?:              string | null
  country?:           string | null
  linkedin_url?:      string | null
  company_phone?:     string | null
  company_linkedin?:  string | null
  website?:           string | null
  lead_source?:       string
}

export async function createHubSpotContact(
  contact: HubSpotContactInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  if (!token || token === 'your_hubspot_token') {
    console.warn('[hubspot] HUBSPOT_PRIVATE_APP_TOKEN not configured — skipping')
    return { ok: false, error: 'HubSpot not configured' }
  }

  const properties: Record<string, string> = {}
  if (contact.email)             properties.email            = contact.email
  if (contact.first_name)        properties.firstname        = contact.first_name
  if (contact.last_name)         properties.lastname         = contact.last_name
  if (contact.phone)             properties.phone            = contact.phone
  if (contact.job_title)         properties.jobtitle         = contact.job_title
  if (contact.company)           properties.company          = contact.company
  if (contact.city)              properties.city             = contact.city
  if (contact.country)           properties.country          = contact.country
  if (contact.linkedin_url)      properties.hs_linkedin_url  = contact.linkedin_url
  if (contact.company_phone)     properties.company_phone    = contact.company_phone
  if (contact.website)           properties.website          = contact.website
  if (contact.lead_source)       properties.lead_source      = contact.lead_source

  try {
    // First try to create; if duplicate email, update instead
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ properties }),
    })

    const data = await res.json()

    // 409 = already exists → upsert via search + update
    if (res.status === 409) {
      return upsertHubSpotContact(contact.email, properties, token)
    }

    if (!res.ok) {
      console.error('[hubspot] Create failed:', data)
      return { ok: false, error: data?.message ?? 'HubSpot create failed' }
    }

    return { ok: true, id: data.id }
  } catch (err: any) {
    console.error('[hubspot] Error:', err.message)
    return { ok: false, error: err.message }
  }
}

async function upsertHubSpotContact(
  email: string,
  properties: Record<string, string>,
  token: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    // Search for existing contact by email
    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        limit: 1,
      }),
    })
    const searchData = await searchRes.json()
    const existingId = searchData?.results?.[0]?.id
    if (!existingId) return { ok: false, error: 'Contact not found for upsert' }

    // Update existing
    const updateRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ properties }),
    })
    if (!updateRes.ok) return { ok: false, error: 'HubSpot update failed' }
    return { ok: true, id: existingId }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
