import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ROOT ADMIN - Only this email can add/remove other admins
const ROOT_ADMIN_EMAIL = 'adminvip@gmail.com';

// Rate limiting storage (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // Max 30 requests per minute per IP

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    console.log(`[admin-users] Rate limit exceeded for: ${identifier}`);
    return false;
  }
  
  record.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get('x-forwarded-for') || 
                   req.headers.get('cf-connecting-ip') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  
  // Check rate limit
  if (!checkRateLimit(clientIP)) {
    console.log(`[admin-users] DDOS Protection: Blocking ${clientIP}`);
    return new Response(
      JSON.stringify({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
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
      console.log('[admin-users] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.log('[admin-users] Invalid token:', authError?.message);
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
      console.log('[admin-users] User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Access denied: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if current user is ROOT ADMIN
    const isRootAdmin = user.email === ROOT_ADMIN_EMAIL;
    console.log(`[admin-users] Admin verified: ${user.id}, isRootAdmin: ${isRootAdmin}`);

    // Parse body and improve detection for action field from various client shapes.
    let body: any = null;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.log('[admin-users] Failed to parse JSON body:', parseErr);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[admin-users] Received body:', JSON.stringify(body));

    // Try to extract action from several possible locations
    let action: any = body?.action ?? body?.actionName ?? body?.type ?? body?.payload?.action ?? body?.data?.action;
    // If action is an object with nested 'action' key
    if (!action && typeof body === 'object') {
      for (const key of Object.keys(body)) {
        const val = (body as any)[key];
        if (typeof val === 'string') continue;
        if (val && typeof val === 'object' && (val.action || val.type)) {
          action = val.action ?? val.type;
          body = val.data ? val.data : body;
          break;
        }
      }
    }

    const data = body?.data ?? body?.payload ?? body;

    if (!action) {
      console.log('[admin-users] Missing action. Full body:', JSON.stringify(body));
      return new Response(
        JSON.stringify({ error: 'Missing action in request body', received: body }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize action (allow case-insensitive)
    const actionKey = String(action).toLowerCase();
    const actionMap: Record<string, string> = {
      list: 'list',
      addadmin: 'addAdmin',
      removeadmin: 'removeAdmin',
      deleteuser: 'deleteUser',
      addseller: 'addSeller',
      removeseller: 'removeSeller',
      ensurerootadmin: 'ensureRootAdmin'
    };

    const normalizedAction = actionMap[actionKey];
    if (!normalizedAction) {
      console.log('[admin-users] Invalid action received:', action, 'body:', JSON.stringify(body));
      return new Response(
        JSON.stringify({ error: `Invalid action: ${action}`, received: body }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (normalizedAction) {
      case 'list': {
        // Get all profiles with roles
        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from('profiles')
          .select('user_id, display_name, avatar_url, created_at');

        if (profilesError) throw profilesError;

        // Get all user roles
        const { data: roles, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, role');

        if (rolesError) throw rolesError;

        // Get user emails for root admin identification
        const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers();

        // Combine data
        // Fetch sellers to mark isSeller
        const { data: sellersList, error: sellersError } = await supabaseAdmin
          .from('sellers')
          .select('user_id');

        if (sellersError) throw sellersError;

        const usersWithRoles = profiles?.map(profile => {
          const userRoles = roles?.filter(r => r.user_id === profile.user_id) || [];
          const authUser = allUsers?.find(u => u.id === profile.user_id);
          const isUserRootAdmin = authUser?.email === ROOT_ADMIN_EMAIL;
          const isUserSeller = sellersList?.some(s => s.user_id === profile.user_id) || false;
          
          return {
            ...profile,
            email: authUser?.email,
            roles: userRoles.map(r => r.role),
            isAdmin: userRoles.some(r => r.role === 'admin'),
            isRootAdmin: isUserRootAdmin,
            isSeller: isUserSeller,
          };
        }) || [];

        console.log('[admin-users] Listed users:', usersWithRoles.length);
        return new Response(
          JSON.stringify({ success: true, data: usersWithRoles, currentUserIsRootAdmin: isRootAdmin }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'addAdmin': {
        if (!data?.userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ONLY ROOT ADMIN can add other admins
        if (!isRootAdmin) {
          console.log('[admin-users] Non-root admin tried to add admin:', user.id);
          return new Response(
            JSON.stringify({ error: 'Chỉ Admin Gốc mới có quyền thêm admin khác!' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if already admin
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', data.userId)
          .eq('role', 'admin')
          .maybeSingle();

        if (existingRole) {
          return new Response(
            JSON.stringify({ error: 'User is already an admin' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: data.userId, role: 'admin' });

        if (error) throw error;

        console.log('[admin-users] Admin role added by ROOT:', data.userId);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'ensureRootAdmin': {
        // Ensure the ROOT_ADMIN_EMAIL user has 'admin' role
        // Only allow current root to run this
        if (!isRootAdmin) {
          return new Response(
            JSON.stringify({ error: 'Chỉ Admin Gốc mới có quyền thực hiện hành động này' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find user by email
        const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers();
        const rootUser = allUsers?.find(u => u.email === ROOT_ADMIN_EMAIL);
        if (!rootUser) {
          return new Response(
            JSON.stringify({ error: `Không tìm thấy user với email ${ROOT_ADMIN_EMAIL}` }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check existing role
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', rootUser.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (existingRole) {
          return new Response(JSON.stringify({ success: true, message: 'Root user already has admin role' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { error: insertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: rootUser.id, role: 'admin' });

        if (insertError) throw insertError;

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'addSeller': {
        if (!data.userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ONLY ROOT ADMIN can add sellers via this endpoint
        if (!isRootAdmin) {
          console.log('[admin-users] Non-root admin tried to add seller:', user.id);
          return new Response(
            JSON.stringify({ error: 'Chỉ Admin Gốc mới có quyền thêm seller!' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if seller already exists
        const { data: existingSeller } = await supabaseAdmin
          .from('sellers')
          .select('id')
          .eq('user_id', data.userId)
          .maybeSingle();

        if (existingSeller) {
          return new Response(
            JSON.stringify({ error: 'User is already a seller' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create a minimal seller profile (admin can update details later)
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .select('display_name')
          .eq('user_id', data.userId)
          .maybeSingle();

        const displayName = profileData?.display_name || 'Seller';

        const { error: insertError } = await supabaseAdmin
          .from('sellers')
          .insert({
            user_id: data.userId,
            display_name: displayName,
            is_profile_complete: false
          });

        if (insertError) throw insertError;

        console.log('[admin-users] Seller added by ROOT:', data.userId);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'removeSeller': {
        if (!data.userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ONLY ROOT ADMIN can remove sellers via this endpoint
        if (!isRootAdmin) {
          console.log('[admin-users] Non-root admin tried to remove seller:', user.id);
          return new Response(
            JSON.stringify({ error: 'Chỉ Admin Gốc mới có quyền xóa seller!' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseAdmin
          .from('sellers')
          .delete()
          .eq('user_id', data.userId);

        if (error) throw error;

        console.log('[admin-users] Seller removed by ROOT:', data.userId);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'removeAdmin': {
        if (!data?.userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ONLY ROOT ADMIN can remove other admins
        if (!isRootAdmin) {
          console.log('[admin-users] Non-root admin tried to remove admin:', user.id);
          return new Response(
            JSON.stringify({ error: 'Chỉ Admin Gốc mới có quyền xóa admin khác!' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prevent self-removal
        if (data.userId === user.id) {
          return new Response(
            JSON.stringify({ error: 'Không thể xóa quyền admin của chính bạn' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if target is root admin
        const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(data.userId);
        if (targetUser?.email === ROOT_ADMIN_EMAIL) {
          return new Response(
            JSON.stringify({ error: 'Không thể xóa quyền Admin Gốc!' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', data.userId)
          .eq('role', 'admin');

        if (error) throw error;

        console.log('[admin-users] Admin role removed by ROOT:', data.userId);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteUser': {
        if (!data?.userId) {
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Prevent self-deletion
        if (data.userId === user.id) {
          return new Response(
            JSON.stringify({ error: 'Không thể xóa tài khoản của chính bạn' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if target is an admin
        const { data: targetRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', data.userId)
          .eq('role', 'admin')
          .maybeSingle();

        // Only ROOT ADMIN can delete other admins
        if (targetRole && !isRootAdmin) {
          console.log('[admin-users] Non-root admin tried to delete admin:', user.id);
          return new Response(
            JSON.stringify({ error: 'Chỉ Admin Gốc mới có quyền xóa tài khoản admin khác!' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if target is root admin (protect root admin from deletion)
        const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(data.userId);
        if (targetUser?.email === ROOT_ADMIN_EMAIL) {
          return new Response(
            JSON.stringify({ error: 'Không thể xóa tài khoản Admin Gốc!' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);

        if (error) throw error;

        console.log('[admin-users] User deleted:', data.userId);
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
    console.error('[admin-users] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

