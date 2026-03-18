import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + ':' + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { action, pin, new_pin } = await req.json();
    const salt = user.id;

    switch (action) {
      case 'check': {
        const { data } = await supabaseAdmin
          .from('transaction_pins')
          .select('id')
          .eq('user_id', user.id)
          .single();
        return new Response(JSON.stringify({ has_pin: !!data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set': {
        if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
          throw new Error('PIN must be 4-6 digits');
        }
        const { data: existing } = await supabaseAdmin
          .from('transaction_pins')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (existing) throw new Error('PIN already set. Use reset to change it.');

        const pinHash = await hashPin(pin, salt);
        const { error } = await supabaseAdmin
          .from('transaction_pins')
          .insert({ user_id: user.id, pin_hash: pinHash });
        if (error) throw new Error('Failed to set PIN');

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'verify': {
        if (!pin) throw new Error('PIN required');
        const pinHash = await hashPin(pin, salt);
        const { data } = await supabaseAdmin
          .from('transaction_pins')
          .select('id')
          .eq('user_id', user.id)
          .eq('pin_hash', pinHash)
          .single();
        return new Response(JSON.stringify({ valid: !!data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reset': {
        if (!pin || !new_pin) throw new Error('Current PIN and new PIN required');
        if (new_pin.length < 4 || new_pin.length > 6 || !/^\d+$/.test(new_pin)) {
          throw new Error('New PIN must be 4-6 digits');
        }
        const currentHash = await hashPin(pin, salt);
        const { data } = await supabaseAdmin
          .from('transaction_pins')
          .select('id')
          .eq('user_id', user.id)
          .eq('pin_hash', currentHash)
          .single();
        if (!data) throw new Error('Current PIN is incorrect');

        const newHash = await hashPin(new_pin, salt);
        await supabaseAdmin
          .from('transaction_pins')
          .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error('Invalid action. Use: check, set, verify, reset');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
