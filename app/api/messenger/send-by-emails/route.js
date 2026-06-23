import { createClient } from '../../../../lib/supabase';

// ── POST /api/messenger/send-by-emails ───────────────────────────────────────
// Body: { emails: string[], message: string }
// Looks up staff by email, sends Messenger to each one that is opted in.
// Safe to fire-and-forget — always returns 200.

export async function POST(request) {
  try {
    const { emails, message } = await request.json()
    if (!emails?.length || !message) return Response.json({ ok: false, error: 'Missing emails or message' })

    const supabase = createClient()

    const { data: staffList } = await supabase
      .from('staff')
      .select('id, messenger_psid, messenger_opted_in, email')
      .in('email', emails)

    if (!staffList?.length) return Response.json({ ok: false, error: 'No staff found for those emails' })

    const linked = staffList.filter(s => s.messenger_opted_in && s.messenger_psid)
    if (!linked.length) return Response.json({ ok: false, error: 'None of those staff have Messenger linked' })

    await Promise.allSettled(linked.map(s =>
      fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: s.messenger_psid },
            message: { text: message },
          }),
        }
      )
    ))

    return Response.json({ ok: true, sent: linked.length })
  } catch (err) {
    console.error('[Messenger send-by-emails]', err)
    return Response.json({ ok: false, error: err.message })
  }
}
