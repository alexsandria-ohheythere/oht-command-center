import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ── POST: Generate a one-time LINK code for a staff member ──────────────────
export async function POST(request) {
  try {
    const { staffId } = await request.json();

    if (!staffId) {
      return Response.json({ error: 'staffId is required' }, { status: 400 });
    }

    // Use service role key so the write bypasses RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify staff member exists
    const { data: staff, error: fetchError } = await supabase
      .from('staff')
      .select('id, name, messenger_opted_in')
      .eq('id', staffId)
      .single();

    if (fetchError || !staff) {
      return Response.json({ error: 'Staff member not found', detail: fetchError?.message }, { status: 404 });
    }

    // Generate a random 8-character uppercase hex code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Save code + expiry to staff record
    const { error: updateError } = await supabase
      .from('staff')
      .update({
        messenger_link_code: code,
        messenger_link_expires_at: expiresAt,
      })
      .eq('id', staffId);

    if (updateError) {
      return Response.json({ error: 'Failed to save code', detail: updateError.message }, { status: 500 });
    }

    return Response.json({ code, expiresAt });
  } catch (err) {
    return Response.json({ error: 'Internal server error', detail: err.message }, { status: 500 });
  }
}
