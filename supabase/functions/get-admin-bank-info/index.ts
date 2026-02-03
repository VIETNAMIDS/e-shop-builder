import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the specific admin bank account for coin purchases
    // This is the main account: MB Bank - 0762694589
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('bank_name, bank_account_name, bank_account_number, bank_qr_url')
      .eq('bank_account_number', '0762694589')
      .eq('bank_name', 'mb bank')
      .eq('bank_account_name', 'bonz vip')
      .maybeSingle();

    if (sellerError) {
      console.error('Error fetching seller:', sellerError);
      throw sellerError;
    }

    if (!seller) {
      // Fallback: try to get any admin with complete bank info
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const adminUserIds = adminRoles.map(r => r.user_id);
        const { data: fallbackSeller } = await supabase
          .from('sellers')
          .select('bank_name, bank_account_name, bank_account_number, bank_qr_url')
          .in('user_id', adminUserIds)
          .eq('is_profile_complete', true)
          .not('bank_name', 'is', null)
          .not('bank_account_number', 'is', null)
          .limit(1)
          .maybeSingle();

        if (fallbackSeller) {
          return new Response(
            JSON.stringify({ bankInfo: fallbackSeller }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ bankInfo: null, message: 'No bank info found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ bankInfo: seller }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
