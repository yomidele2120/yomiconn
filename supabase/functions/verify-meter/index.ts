import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CDH_BASE_URL = 'https://www.cheapdatahub.ng/api/v1/resellers';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CDH_API_KEY = Deno.env.get('CHEAPDATAHUB_API_KEY');
    if (!CDH_API_KEY) throw new Error('API key not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { disco, meter_no, meter_type } = await req.json();

    if (!disco || !meter_no || !meter_type) {
      throw new Error('Missing required fields: disco, meter_no, meter_type');
    }

    // Try CheapDataHub meter verification endpoint
    const verifyResponse = await fetch(`${CDH_BASE_URL}/electricity/verify/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CDH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ disco, meter_no, meter_type }),
    });

    const responseText = await verifyResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If API returns HTML or non-JSON, the verify endpoint may not exist
      // Return a simulated verification with the meter details
      console.log('Verification endpoint returned non-JSON, using fallback');
      responseData = null;
    }

    if (responseData && verifyResponse.ok) {
      // API verification succeeded
      return new Response(JSON.stringify({
        verified: true,
        customer_name: responseData.customer_name || responseData.name || responseData.customerName || 'Verified Customer',
        meter_no: meter_no,
        meter_type: meter_type,
        disco: disco,
        address: responseData.address || responseData.customer_address || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If verify endpoint doesn't exist or fails, try alternate URL patterns
    const altResponse = await fetch(`${CDH_BASE_URL}/electricity/validate/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CDH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ disco, meter_no, meter_type }),
    });

    const altText = await altResponse.text();
    let altData;
    try {
      altData = JSON.parse(altText);
    } catch {
      altData = null;
    }

    if (altData && altResponse.ok) {
      return new Response(JSON.stringify({
        verified: true,
        customer_name: altData.customer_name || altData.name || altData.customerName || 'Verified Customer',
        meter_no: meter_no,
        meter_type: meter_type,
        disco: disco,
        address: altData.address || altData.customer_address || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: Accept the meter number but mark as unverified
    // This allows the purchase to proceed even if verify endpoint isn't available
    return new Response(JSON.stringify({
      verified: false,
      customer_name: null,
      meter_no: meter_no,
      meter_type: meter_type,
      disco: disco,
      message: 'Meter verification not available. Please confirm your meter number is correct.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
