import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Global rate limiting - Anti-DDoS protection
const globalRequestCount = { count: 0, resetTime: Date.now() + 60000 };
const ipRequestMap = new Map<string, { count: number; resetTime: number; blocked: boolean }>();

// Configuration
const GLOBAL_MAX_REQUESTS = 1000; // Max 1000 requests per minute globally
const IP_MAX_REQUESTS = 50; // Max 50 requests per minute per IP
const BLOCK_THRESHOLD = 100; // Block IP after 100 requests in a minute
const BLOCK_DURATION = 300000; // Block for 5 minutes
const RATE_WINDOW = 60000; // 1 minute window

interface RateLimitRequest {
  action: 'check' | 'status' | 'unblock';
  ip?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get('x-forwarded-for') || 
                   req.headers.get('cf-connecting-ip') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';

  const now = Date.now();

  try {
    const body: RateLimitRequest = await req.json().catch(() => ({ action: 'check' }));

    // Reset global counter if window expired
    if (now > globalRequestCount.resetTime) {
      globalRequestCount.count = 0;
      globalRequestCount.resetTime = now + RATE_WINDOW;
    }

    // Get or create IP record
    let ipRecord = ipRequestMap.get(clientIP);
    if (!ipRecord || now > ipRecord.resetTime) {
      ipRecord = { count: 0, resetTime: now + RATE_WINDOW, blocked: false };
      ipRequestMap.set(clientIP, ipRecord);
    }

    // Check if IP is blocked
    if (ipRecord.blocked) {
      if (now > ipRecord.resetTime) {
        // Unblock after duration
        ipRecord.blocked = false;
        ipRecord.count = 0;
        ipRecord.resetTime = now + RATE_WINDOW;
      } else {
        console.log(`[rate-limiter] Blocked IP attempted access: ${clientIP}`);
        return new Response(
          JSON.stringify({ 
            error: 'IP bị chặn do hoạt động đáng ngờ',
            blocked: true,
            retryAfter: Math.ceil((ipRecord.resetTime - now) / 1000)
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Increment counters
    globalRequestCount.count++;
    ipRecord.count++;

    // Check global limit (DDoS protection)
    if (globalRequestCount.count > GLOBAL_MAX_REQUESTS) {
      console.log(`[rate-limiter] GLOBAL LIMIT EXCEEDED - Possible DDoS attack!`);
      return new Response(
        JSON.stringify({ 
          error: 'Hệ thống đang quá tải. Vui lòng thử lại sau.',
          overloaded: true,
          retryAfter: 60
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check IP limit
    if (ipRecord.count > BLOCK_THRESHOLD) {
      // Auto-block suspicious IP
      ipRecord.blocked = true;
      ipRecord.resetTime = now + BLOCK_DURATION;
      console.log(`[rate-limiter] IP BLOCKED for suspicious activity: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: 'IP bị chặn do hoạt động đáng ngờ',
          blocked: true,
          retryAfter: BLOCK_DURATION / 1000
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (ipRecord.count > IP_MAX_REQUESTS) {
      console.log(`[rate-limiter] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: 'Quá nhiều yêu cầu. Vui lòng chờ.',
          limited: true,
          retryAfter: Math.ceil((ipRecord.resetTime - now) / 1000)
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle admin actions (requires auth)
    if (body.action === 'status' || body.action === 'unblock') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      
      if (!user || user.email !== 'adminvip@gmail.com') {
        return new Response(
          JSON.stringify({ error: 'Root admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.action === 'status') {
        const blockedIPs = Array.from(ipRequestMap.entries())
          .filter(([_, v]) => v.blocked)
          .map(([ip, v]) => ({ ip, unblockAt: new Date(v.resetTime).toISOString() }));

        return new Response(
          JSON.stringify({
            globalRequests: globalRequestCount.count,
            globalLimit: GLOBAL_MAX_REQUESTS,
            blockedIPs,
            activeIPs: ipRequestMap.size
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.action === 'unblock' && body.ip) {
        const record = ipRequestMap.get(body.ip);
        if (record) {
          record.blocked = false;
          record.count = 0;
          console.log(`[rate-limiter] IP unblocked by admin: ${body.ip}`);
        }
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Normal request - allowed
    return new Response(
      JSON.stringify({ 
        allowed: true,
        requestsRemaining: IP_MAX_REQUESTS - ipRecord.count
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[rate-limiter] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
