import { createClient } from '../../../../lib/supabase';

// ── POST /api/messenger/send ─────────────────────────────────────────────────
// Body: { staffId: string, message: string }
// Looks up the staff member's PSID and sends them a Messenger message.
// Safe to call fire-and-forget — always returns 200 so it never breaks the caller.

export async function POST(request) {
  try {
    const { staffId, message } = await request.json()
    if (!staffId || !message) return Response.json({ ok: false, error: 'Missing staffId or message' })

    const supabase = createClient()

    const { data: staff } = await supabase
      .from('staff')
      .select('messenger_psid, messenger_opted_in, name, first_name')
      .eq('id', staffId)
      .single()

    if (!staff || !staff.messenger_opted_in || !staff.messenger_psid) {
      return Response.json({ ok: false, error: 'Staff not linked to Messenger' })
    }

    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: staff.messenger_psid },
          message: { text: message },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      console.error('[Messenger Send]', err)
      return Response.json({ ok: false, error: err })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[Messenger Send] Unexpected error:', err)
    return Response.json({ ok: false, error: err.message })
  }
}
