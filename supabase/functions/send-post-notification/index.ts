import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  postId: string;
  postTitle: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { postId, postTitle }: NotificationRequest = await req.json();

    if (!postId || !postTitle) {
      return new Response(JSON.stringify({ error: "Missing postId or postTitle" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to insert notifications for all users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get all user IDs (excluding the admin who posted)
    const { data: allUsers, error: usersError } = await adminClient
      .from("profiles")
      .select("user_id")
      .neq("user_id", user.id);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    if (!allUsers || allUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create notifications for all users
    const notifications = allUsers.map((u) => ({
      user_id: u.user_id,
      title: "Bài viết mới",
      message: postTitle,
      type: "post",
      reference_id: postId,
      is_read: false,
    }));

    const { error: insertError } = await adminClient
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      throw insertError;
    }

    console.log(`Sent notifications to ${allUsers.length} users for post: ${postTitle}`);

    return new Response(
      JSON.stringify({ success: true, count: allUsers.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-post-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
