import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[admin-products] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.log('[admin-products] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role - CRITICAL SECURITY CHECK
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.log('[admin-products] User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Access denied: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[admin-products] Admin verified:', user.id);

    // Get seller profile for this admin (fallback if not provided)
    const { data: sellerData } = await supabaseAdmin
      .from('sellers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const defaultSellerId = sellerData?.id || null;

    const { action, data } = await req.json();

    switch (action) {
      case 'create': {
        // Use provided seller_id or fallback to current admin's seller profile
        const sellerId = data.seller_id || defaultSellerId;
        
        const productData = {
          title: data.title?.trim(),
          description: data.description?.trim() || null,
          price: data.is_free ? 0 : parseFloat(data.price) || 0,
          is_free: !!data.is_free,
          category: data.category || 'other',
          image_url: data.image_url?.trim() || null,
          tech_stack: data.tech_stack || [],
          download_url: data.download_url?.trim() || null,
          created_by: user.id,
          seller_id: sellerId,
        };

        if (!productData.title) {
          return new Response(
            JSON.stringify({ error: 'Product title is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: newProduct, error } = await supabaseAdmin
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) {
          console.error('[admin-products] Create error:', error);
          throw error;
        }

        console.log('[admin-products] Product created:', newProduct.id);
        return new Response(
          JSON.stringify({ success: true, data: newProduct }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!data.id) {
          return new Response(
            JSON.stringify({ error: 'Product ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData = {
          title: data.title?.trim(),
          description: data.description?.trim() || null,
          price: data.is_free ? 0 : parseFloat(data.price) || 0,
          is_free: !!data.is_free,
          category: data.category || 'other',
          image_url: data.image_url?.trim() || null,
          tech_stack: data.tech_stack || [],
          download_url: data.download_url?.trim() || null,
          // Update seller_id if provided
          ...(data.seller_id && { seller_id: data.seller_id }),
        };

        const { data: updatedProduct, error } = await supabaseAdmin
          .from('products')
          .update(updateData)
          .eq('id', data.id)
          .select()
          .single();

        if (error) {
          console.error('[admin-products] Update error:', error);
          throw error;
        }

        console.log('[admin-products] Product updated:', data.id);
        return new Response(
          JSON.stringify({ success: true, data: updatedProduct }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!data.id) {
          return new Response(
            JSON.stringify({ error: 'Product ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // First, set product_id to null in any orders referencing this product
        const { error: ordersError } = await supabaseAdmin
          .from('orders')
          .update({ product_id: null })
          .eq('product_id', data.id);

        if (ordersError) {
          console.error('[admin-products] Error updating orders:', ordersError);
          // Continue anyway - the orders might not exist
        }

        // Now delete the product
        const { error } = await supabaseAdmin
          .from('products')
          .delete()
          .eq('id', data.id);

        if (error) {
          console.error('[admin-products] Delete error:', error);
          return new Response(
            JSON.stringify({ error: error.message || 'Failed to delete product' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[admin-products] Product deleted:', data.id);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin-products] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
