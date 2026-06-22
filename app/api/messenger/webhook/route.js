import { createClient } from '../../../lib/supabase';
import { NextResponse } from 'next/server';
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
    console.log('Messenger webhook verified ✅');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// ── POST: Receive messages from staff (captures their PSID) ─────────────────
export async function POST(request) {
  const rawBody = await request.text();

  // Verify the request is genuinely from Meta
  if (!verifySignature(request, rawBody)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.object !== 'page') {
    return new Response('Not a page event', { status: 400 });
  }

  const supabase = createClient();

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const psid = event.sender?.id;
      if (!psid) continue;

      // Only process actual messages (not echoes from the page itself)
      if (event.message && !event.message.is_echo) {
        console.log(`Received message from PSID: ${psid}`);

        // Check if any staff member has this PSID already stored
        const { data: existing } = await supabase
          .from('staff')
          .select('id, name, messenger_psid')
          .eq('messenger_psid', psid)
          .single();

        if (!existing) {
          // Unknown sender — send opt-in instructions
          await sendMessage(psid,
            `👋 Hi! This is Oh Hey There Matcha Cafe.\n\nTo link your account, please ask your admin to connect your Messenger to your staff profile.`
          );
        } else {
          // Known staff — acknowledge
          await sendMessage(psid,
            `✅ Hi ${existing.name}! Your Messenger is linked to OHT. You'll receive shift updates, job orders, and other notifications here.`
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
