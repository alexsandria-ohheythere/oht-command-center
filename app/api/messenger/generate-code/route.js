import { createClient } from '../../../../lib/supabase';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { staffId } = await request.json();
    if (!staffId) {
      return Response.json({ error: 'staffId required' }, { status: 400 });
    }

    const supabase = createClient();

    // Verify the staff member exists
    const { data: staff, error } = await supabase
      .from('staff')
      .select('id, name, messenger_opted_in')
      .eq('id', staffId)
      .single();

    if (error || !staff) {
      return Response.json({ error: 'Staff not found' }, { status: 404 });
    }

    if (staff.messenger_opted_in) {
      return Response.json({ error: 'Already linked' }, { status: 400 });
    }

    // Generate a random 8-character uppercase code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await supabase
      .from('staff')
      .update({
        messenger_link_code: code,
        messenger_link_expires_at: expiresAt.toISOString(),
      })
      .eq('id', staffId);

    return Response.json({ code, expiresAt });
  } catch (err) {
    console.error('generate-code error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
