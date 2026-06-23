import { createClient } from '../../../../lib/supabase';
import crypto from 'crypto';

// ── POST: Generate a one-time LINK code for a staff member ──────────────────
export async function POST(request) {
  try {
    const { staffId } = await request.json();

    if (!staffId) {
      return Response.json({ error: 'staffId is required' }, { status: 400 });
    }

    const supabase = createClient();

    // Verify staff member exists
    const { data: staff, error: fetchError } = await supabase
      .from('staff')
      .select('id, name, messenger_opted_in')
      .eq('id', staffId)
      .single();

    if (fetchError || !staff) {
      return Response.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Generate a random 8-character uppercase alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F7B2C1"

    // Code expires in 15 minutes
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
      console.error('[generate-code] Supabase update error:', updateError);
      return Response.json({ error: 'Failed to save code' }, { status: 500 });
    }

    return Response.json({ code, expiresAt });
  } catch (err) {
    console.error('[generate-code] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
