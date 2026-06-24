import { createBrowserClient } from '@supabase/ssr';
import crypto from 'crypto';

// ── Verify webhook signature from Meta ──────────────────────────────────────
function verifySignature(req, body) {
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ── GET: Meta webhook verification handshake ────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// ── POST: Receive messages from staff ───────────────────────────────────────
export async function POST(request) {
  const rawBody = await request.text();

  if (!verifySignature(request, rawBody)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.object !== 'page') {
    return new Response('Not a page event', { status: 400 });
  }

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const psid = event.sender?.id;
      if (!psid) continue;

      if (event.message && !event.message.is_echo) {
        const text = (event.message.text || '').trim();

        // ── Handle LINK-xxxxxxxx codes ──────────────────────────────────────
        if (text.toUpperCase().startsWith('LINK-')) {
          const code = text.toUpperCase().replace('LINK-', '').trim();

          // Look up staff member with this exact code
          const { data: staff } = await supabase
            .from('staff')
            .select('id, first_name, last_name, messenger_psid, messenger_link_code, messenger_link_expires_at')
            .eq('messenger_link_code', code)
            .single();

          if (!staff) {
            await sendMessage(psid,
              `❌ That code wasn't recognised. Please get a fresh code from your OHT Staff Portal and try again.`
            );
            continue;
          }

          // Check if code is expired
          const now = new Date();
          const expires = new Date(staff.messenger_link_expires_at);
          if (now > expires) {
            await sendMessage(psid,
              `⏰ That code has expired. Please log in to your OHT Staff Portal to generate a new one.`
            );
            continue;
          }

          // Check if already linked to a different PSID
          if (staff.messenger_psid && staff.messenger_psid !== psid) {
            await sendMessage(psid,
              `⚠️ This account is already linked to a different Messenger. Please contact your admin if you need to re-link.`
            );
            continue;
          }

          // All good — link them!
          await supabase
            .from('staff')
            .update({
              messenger_psid: psid,
              messenger_opted_in: true,
              messenger_link_code: null,         // invalidate code immediately
              messenger_link_expires_at: null,
            })
            .eq('id', staff.id);

          await sendMessage(psid,
            `✅ You're all set, ${staff.first_name}!\n\nYour Messenger is now linked to Oh Hey There. You'll receive notifications here for:\n• Shift assignments\n• Job orders\n• Contracts\n• Payslips\n• Day-off updates\n• And more!\n\nWelcome aboard 🎉`
          );

          continue;
        }

        // ── Any other message — check if known staff ─────────────────────
        const { data: existing } = await supabase
          .from('staff')
          .select('id, first_name, last_name, messenger_opted_in')
          .eq('messenger_psid', psid)
          .single();

        if (existing && existing.messenger_opted_in) {
          // Already linked — friendly acknowledgement
          await sendMessage(psid,
            `👋 Hi ${existing.first_name}! Your account is already linked. You'll receive your OHT notifications here automatically.`
          );
        } else {
          // Unknown sender — generic response, no instructions leaked
          await sendMessage(psid,
            `👋 Hi! This is the Oh Hey There Matcha Cafe notification line.\n\nThis channel is for OHT staff only. If you're a staff member, please log in to your portal to get your unique link code.`
          );
        }
      }
    }
  }

  return new Response('EVENT_RECEIVED', { status: 200 });
}

// ── Helper: Send a message via Meta Send API ────────────────────────────────
async function sendMessage(psid, text) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    console.error('Meta Send API error:', err);
  }
}
