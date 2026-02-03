import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
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

    const { accountId, productId, requiredCoins } = await req.json();
    console.log('Purchase request:', { accountId, productId, requiredCoins });

    // Validate required coins
    if (!requiredCoins || requiredCoins <= 0 || !Number.isInteger(requiredCoins)) {
      return new Response(
        JSON.stringify({ error: 'Số xu không hợp lệ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accountId && !productId) {
      return new Response(
        JSON.stringify({ error: 'Phải có accountId hoặc productId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current user coin balance
    const { data: coinData, error: coinError } = await supabase
      .from('user_coins')
      .select('id, balance')
      .eq('user_id', user.id)
      .single();

    if (coinError || !coinData) {
      console.error('Coin balance not found:', coinError);
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy số dư xu' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Current balance:', coinData.balance, 'Required:', requiredCoins);

    // Validate sufficient balance (server-side check)
    if (coinData.balance < requiredCoins) {
      return new Response(
        JSON.stringify({ error: 'Không đủ xu', balance: coinData.balance }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify item exists and price matches
    let itemPrice = 0;
    let sellerId: string | null = null;

    if (accountId) {
      const { data: account, error: accError } = await supabase
        .from('accounts')
        .select('price, is_sold, is_free, seller_id')
        .eq('id', accountId)
        .single();

      if (accError || !account) {
        console.error('Account not found:', accError);
        return new Response(
          JSON.stringify({ error: 'Không tìm thấy tài khoản' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (account.is_sold) {
        return new Response(
          JSON.stringify({ error: 'Tài khoản đã được bán' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (account.is_free) {
        return new Response(
          JSON.stringify({ error: 'Tài khoản miễn phí không cần mua bằng xu' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate expected coin price (price / 1000, rounded up)
      itemPrice = Math.ceil(Number(account.price) / 1000);
      sellerId = account.seller_id;

      if (requiredCoins < itemPrice) {
        console.error('Price mismatch:', requiredCoins, 'vs', itemPrice);
        return new Response(
          JSON.stringify({ error: 'Số xu không khớp với giá sản phẩm', expectedPrice: itemPrice }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (productId) {
      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('price, is_free, seller_id')
        .eq('id', productId)
        .single();

      if (prodError || !product) {
        console.error('Product not found:', prodError);
        return new Response(
          JSON.stringify({ error: 'Không tìm thấy sản phẩm' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (product.is_free) {
        return new Response(
          JSON.stringify({ error: 'Sản phẩm miễn phí không cần mua bằng xu' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      itemPrice = Math.ceil(Number(product.price) / 1000);
      sellerId = product.seller_id;

      if (requiredCoins < itemPrice) {
        console.error('Price mismatch:', requiredCoins, 'vs', itemPrice);
        return new Response(
          JSON.stringify({ error: 'Số xu không khớp với giá sản phẩm', expectedPrice: itemPrice }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Perform atomic balance update with optimistic locking
    const newBalance = coinData.balance - requiredCoins;
    const { error: updateError, data: updatedCoin } = await supabase
      .from('user_coins')
      .update({ 
        balance: newBalance, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', coinData.id)
      .eq('balance', coinData.balance) // Optimistic locking - ensures balance hasn't changed
      .select()
      .single();

    if (updateError || !updatedCoin) {
      console.error('Failed to update balance (race condition?):', updateError);
      return new Response(
        JSON.stringify({ error: 'Không thể cập nhật số dư. Vui lòng thử lại.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Balance updated successfully:', coinData.balance, '->', newBalance);

    // Create approved order
    const orderData = {
      user_id: user.id,
      account_id: accountId || null,
      product_id: productId || null,
      amount: requiredCoins,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      payment_note: 'Thanh toán bằng xu',
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Failed to create order:', orderError);
      // Rollback balance
      await supabase
        .from('user_coins')
        .update({ balance: coinData.balance })
        .eq('id', coinData.id);
      
      return new Response(
        JSON.stringify({ error: 'Không thể tạo đơn hàng. Số dư đã được hoàn lại.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order created:', order.id);

    // Mark account as sold if applicable
    if (accountId) {
      const { error: soldError } = await supabase
        .from('accounts')
        .update({
          is_sold: true,
          sold_to: user.id,
          sold_at: new Date().toISOString()
        })
        .eq('id', accountId);

      if (soldError) {
        console.error('Failed to mark account as sold:', soldError);
        // Don't rollback - order is already created, admin can handle manually
      }
    }

    // Add coins to seller if applicable
    if (sellerId) {
      const { data: existingSellerCoins } = await supabase
        .from('seller_coins')
        .select('id, balance, total_earned')
        .eq('seller_id', sellerId)
        .single();

      if (existingSellerCoins) {
        await supabase
          .from('seller_coins')
          .update({ 
            balance: existingSellerCoins.balance + requiredCoins,
            total_earned: existingSellerCoins.total_earned + requiredCoins
          })
          .eq('id', existingSellerCoins.id);
        console.log('Added', requiredCoins, 'coins to seller', sellerId);
      } else {
        await supabase
          .from('seller_coins')
          .insert({
            seller_id: sellerId,
            balance: requiredCoins,
            total_earned: requiredCoins
          });
        console.log('Created seller coins record with', requiredCoins, 'coins');
      }
    }

    // Get user email and send purchase notification
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(user.id);
      if (userData?.user?.email) {
        // Get product/account title
        let productTitle = 'Sản phẩm';
        let productType: 'account' | 'product' = 'product';
        
        if (accountId) {
          const { data: acc } = await supabase.from('accounts').select('title').eq('id', accountId).single();
          productTitle = acc?.title || 'Tài khoản';
          productType = 'account';
        } else if (productId) {
          const { data: prod } = await supabase.from('products').select('title').eq('id', productId).single();
          productTitle = prod?.title || 'Sản phẩm';
          productType = 'product';
        }

        // Send email notification
        const notificationUrl = `${supabaseUrl}/functions/v1/send-purchase-notification`;
        await fetch(notificationUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: userData.user.email,
            userName: userData.user.user_metadata?.display_name || '',
            productTitle,
            productType,
            amount: requiredCoins,
            orderId: order.id
          })
        });
        console.log('Purchase notification sent to:', userData.user.email);
      }
    } catch (notifError) {
      console.error('Failed to send purchase notification:', notifError);
      // Don't fail the purchase if notification fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order, 
        newBalance,
        message: 'Mua hàng thành công!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Purchase error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
