import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Check if user is admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('User is not admin:', roleError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verified');

    // Get seller profile for this admin
    const { data: sellerData } = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const sellerId = sellerData?.id || null;

    // Parse request body
    const { action, data } = await req.json();
    console.log('Action:', action, 'Data:', JSON.stringify(data));

    let result;

    switch (action) {
      case 'create':
        console.log('Creating account...');
        // Use provided seller_id or fall back to current admin's seller_id
        const createSellerId = data.seller_id || sellerId;
        
        const { data: newAccount, error: createError } = await supabase
          .from('accounts')
          .insert({
            title: data.title,
            description: data.description || null,
            account_username: data.account_username,
            account_password: data.account_password,
            account_email: data.account_email || null,
            account_phone: data.account_phone || null,
            price: data.price || 0,
            category: data.category || 'other',
            image_url: data.image_url || null,
            created_by: user.id,
            seller_id: createSellerId,
            is_free: data.is_free || false,
          })
          .select()
          .single();

        if (createError) {
          console.error('Create error:', createError);
          throw createError;
        }
        console.log('Account created:', newAccount.id);
        result = newAccount;
        break;

      case 'update':
        console.log('Updating account:', data.id);
        // Update seller_id if provided
        const updateData: Record<string, unknown> = {
          title: data.title,
          description: data.description || null,
          account_username: data.account_username,
          account_password: data.account_password,
          account_email: data.account_email || null,
          account_phone: data.account_phone || null,
          price: data.price || 0,
          category: data.category || 'other',
          image_url: data.image_url || null,
          is_free: data.is_free || false,
        };
        if (data.seller_id) {
          updateData.seller_id = data.seller_id;
        }
        
        const { data: updatedAccount, error: updateError } = await supabase
          .from('accounts')
          .update(updateData)
          .eq('id', data.id)
          .select()
          .single();

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }
        console.log('Account updated:', updatedAccount.id);
        result = updatedAccount;
        break;

      case 'delete':
        console.log('Deleting account:', data.id);
        const { error: deleteError } = await supabase
          .from('accounts')
          .delete()
          .eq('id', data.id);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError;
        }
        console.log('Account deleted');
        result = { success: true };
        break;

      case 'getDetails':
        // Get full account details including sensitive info (admin only)
        console.log('Getting account details:', data.id);
        const { data: accountDetails, error: detailsError } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', data.id)
          .single();

        if (detailsError) {
          console.error('Details error:', detailsError);
          throw detailsError;
        }
        result = accountDetails;
        break;

      case 'markSold':
        console.log('Marking account as sold:', data.id, 'is_sold:', data.is_sold);
        const { data: soldAccount, error: soldError } = await supabase
          .from('accounts')
          .update({
            is_sold: data.is_sold,
            sold_at: data.is_sold ? new Date().toISOString() : null,
          })
          .eq('id', data.id)
          .select()
          .single();

        if (soldError) {
          console.error('Mark sold error:', soldError);
          throw soldError;
        }
        console.log('Account marked as:', data.is_sold ? 'sold' : 'available');
        result = soldAccount;
        break;

      default:
        console.error('Invalid action:', action);
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
