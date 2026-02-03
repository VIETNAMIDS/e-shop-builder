import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to call send-order-notification edge function
async function sendNotification(supabaseUrl: string, type: string, data: Record<string, unknown>) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-order-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ type, ...data }),
    });
    const result = await response.json();
    console.log('Notification sent:', result);
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { action, data } = await req.json();
    console.log('Action:', action, 'Data:', JSON.stringify(data));

    let result;

    switch (action) {
      case 'list':
        console.log('Fetching orders for seller...');
        
        // First, get the seller_id for this admin
        const { data: sellerData } = await supabase
          .from('sellers')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        const sellerId = sellerData?.id;
        console.log('Seller ID:', sellerId);
        
        // Fetch orders with account/product seller info
        const { data: allOrders, error: listError } = await supabase
          .from('orders')
          .select(`
            id,
            account_id,
            product_id,
            user_id,
            status,
            amount,
            payment_note,
            created_at,
            approved_at,
            approved_by,
            accounts (
              id,
              title,
              account_username,
              image_url,
              category,
              seller_id,
              sellers (
                id,
                display_name,
                bank_name,
                bank_account_name,
                bank_account_number
              )
            ),
            products (
              id,
              title,
              image_url,
              category,
              download_url,
              seller_id,
              sellers (
                id,
                display_name,
                bank_name,
                bank_account_name,
                bank_account_number
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (listError) {
          console.error('List error:', listError);
          throw listError;
        }

        // Filter orders to only show ones for this seller's products/accounts
        const orders = sellerId 
          ? allOrders?.filter(o => {
              const accountSellerId = (o.accounts as any)?.seller_id;
              const productSellerId = (o.products as any)?.seller_id;
              return accountSellerId === sellerId || productSellerId === sellerId;
            })
          : allOrders; // If no seller profile, show all (for backward compatibility)

        // Get user profiles separately
        const userIds = [...new Set(orders?.map(o => o.user_id) || [])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        const ordersWithProfiles = orders?.map(o => ({
          ...o,
          buyer_name: profileMap.get(o.user_id) || null,
          // Determine order type
          order_type: o.product_id ? 'product' : 'account',
          // Unified item info
          item_title: o.product_id 
            ? (o.products as any)?.title 
            : (o.accounts as any)?.title,
          item_image: o.product_id 
            ? (o.products as any)?.image_url 
            : (o.accounts as any)?.image_url,
          item_category: o.product_id 
            ? (o.products as any)?.category 
            : (o.accounts as any)?.category,
          // Seller info
          seller_name: o.product_id 
            ? (o.products as any)?.sellers?.display_name 
            : (o.accounts as any)?.sellers?.display_name,
          seller_bank: o.product_id 
            ? (o.products as any)?.sellers 
            : (o.accounts as any)?.sellers,
        }));

        console.log('Orders fetched:', ordersWithProfiles?.length);
        result = ordersWithProfiles;
        break;

      case 'approve':
        console.log('Approving order:', data.orderId);
        
        // Get order details first with account/product info
        const { data: order, error: orderFetchError } = await supabase
          .from('orders')
          .select(`
            account_id, 
            product_id,
            user_id, 
            status,
            amount,
            accounts (title, seller_id),
            products (title, download_url, seller_id)
          `)
          .eq('id', data.orderId)
          .single();

        if (orderFetchError || !order) {
          console.error('Order not found:', orderFetchError);
          throw new Error('Order not found');
        }

        if (order.status !== 'pending') {
          throw new Error('Order already processed');
        }

        // Update order status
        const { error: approveError } = await supabase
          .from('orders')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: user.id
          })
          .eq('id', data.orderId);

        if (approveError) {
          console.error('Approve error:', approveError);
          throw approveError;
        }

        // If it's an account order, mark account as sold
        if (order.account_id) {
          const { error: soldError } = await supabase
            .from('accounts')
            .update({
              is_sold: true,
              sold_to: order.user_id,
              sold_at: new Date().toISOString()
            })
            .eq('id', order.account_id);

          if (soldError) {
            console.error('Mark sold error:', soldError);
            throw soldError;
          }
        }

        // Add coins to seller's balance
        const orderSellerId = order.product_id 
          ? (order.products as any)?.seller_id 
          : (order.accounts as any)?.seller_id;
        
        if (orderSellerId) {
          // Convert amount (VND) to coins (1 coin = 1000 VND)
          const coinsToAdd = Math.floor(order.amount);
          
          // Check if seller has coins record
          const { data: existingSellerCoins } = await supabase
            .from('seller_coins')
            .select('id, balance, total_earned')
            .eq('seller_id', orderSellerId)
            .single();

          if (existingSellerCoins) {
            // Update balance
            const { error: coinError } = await supabase
              .from('seller_coins')
              .update({ 
                balance: existingSellerCoins.balance + coinsToAdd,
                total_earned: existingSellerCoins.total_earned + coinsToAdd
              })
              .eq('id', existingSellerCoins.id);

            if (coinError) {
              console.error('Update seller coins error:', coinError);
            } else {
              console.log('Added', coinsToAdd, 'coins to seller', orderSellerId);
            }
          } else {
            // Create new coins record
            const { error: insertError } = await supabase
              .from('seller_coins')
              .insert({
                seller_id: orderSellerId,
                balance: coinsToAdd,
                total_earned: coinsToAdd
              });

            if (insertError) {
              console.error('Insert seller coins error:', insertError);
            } else {
              console.log('Created seller coins record with', coinsToAdd, 'coins');
            }
          }
        }

        // Get buyer email and send notification
        const { data: buyerData } = await supabase.auth.admin.getUserById(order.user_id);
        if (buyerData?.user?.email) {
          // Get item title based on order type
          let itemTitle = '';
          if (order.product_id) {
            const productsData = order.products as unknown as { title: string; download_url: string } | null;
            itemTitle = productsData?.title || 'Sản phẩm';
          } else {
            const accountsData = order.accounts as unknown as { title: string } | { title: string }[] | null;
            itemTitle = Array.isArray(accountsData) ? accountsData[0]?.title : accountsData?.title || 'Tài khoản';
          }
          
          await sendNotification(supabaseUrl, 'order_approved', {
            orderId: data.orderId,
            userEmail: buyerData.user.email,
            accountTitle: itemTitle,
            amount: order.amount
          });
        }

        console.log('Order approved successfully');
        result = { success: true };
        break;

      case 'reject':
        console.log('Rejecting order:', data.orderId);
        
        // Get order details with account/product info for notification
        const { data: rejectOrder, error: rejectFetchError } = await supabase
          .from('orders')
          .select(`
            status,
            user_id,
            amount,
            account_id,
            product_id,
            accounts (title),
            products (title)
          `)
          .eq('id', data.orderId)
          .single();

        if (rejectFetchError || !rejectOrder) {
          throw new Error('Order not found');
        }

        if (rejectOrder.status !== 'pending') {
          throw new Error('Order already processed');
        }

        const { error: rejectError } = await supabase
          .from('orders')
          .update({ status: 'rejected' })
          .eq('id', data.orderId);

        if (rejectError) {
          console.error('Reject error:', rejectError);
          throw rejectError;
        }

        // Get buyer email and send notification
        const { data: rejectBuyerData } = await supabase.auth.admin.getUserById(rejectOrder.user_id);
        if (rejectBuyerData?.user?.email) {
          let rejectItemTitle = '';
          if (rejectOrder.product_id) {
            const rejectProductsData = rejectOrder.products as unknown as { title: string } | null;
            rejectItemTitle = rejectProductsData?.title || 'Sản phẩm';
          } else {
            const rejectAccountsData = rejectOrder.accounts as unknown as { title: string } | { title: string }[] | null;
            rejectItemTitle = Array.isArray(rejectAccountsData) ? rejectAccountsData[0]?.title : rejectAccountsData?.title || 'Tài khoản';
          }
          
          await sendNotification(supabaseUrl, 'order_rejected', {
            orderId: data.orderId,
            userEmail: rejectBuyerData.user.email,
            accountTitle: rejectItemTitle,
            amount: rejectOrder.amount
          });
        }

        console.log('Order rejected');
        result = { success: true };
        break;

      case 'getCredentials':
        // Get credentials for a purchased account - only for buyer
        console.log('Getting credentials for account:', data.accountId, 'for user:', data.userId);
        
        // Verify the user has an approved order for this account
        const { data: approvedOrder, error: checkOrderError } = await supabase
          .from('orders')
          .select('id')
          .eq('account_id', data.accountId)
          .eq('user_id', data.userId)
          .eq('status', 'approved')
          .single();

        if (checkOrderError || !approvedOrder) {
          console.error('No approved order found');
          throw new Error('No approved order found for this account');
        }

        const { data: credentials, error: credError } = await supabase
          .from('account_credentials')
          .select('account_password, account_email, account_phone')
          .eq('account_id', data.accountId)
          .single();

        if (credError) {
          // Fallback: get from accounts table if credentials not migrated yet
          const { data: account, error: accError } = await supabase
            .from('accounts')
            .select('account_password, account_email, account_phone')
            .eq('id', data.accountId)
            .single();
          
          if (accError) throw accError;
          result = account;
        } else {
          result = credentials;
        }
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
