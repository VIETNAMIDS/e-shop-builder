import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getEmailTemplate(otp: string, email: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); border-radius: 8px; margin-bottom: 20px;">
                <span style="color: #000; font-size: 24px; font-weight: bold; letter-spacing: 2px;">BONZ STORE</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Xác thực tài khoản</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #b0b0b0; font-size: 16px; line-height: 1.6;">
                Xin chào <strong style="color: #00d4ff;">${email}</strong>,
              </p>
              <p style="margin: 0 0 30px; color: #b0b0b0; font-size: 16px; line-height: 1.6;">
                Chúng tôi nhận được yêu cầu xác thực tài khoản của bạn. Vui lòng sử dụng mã OTP bên dưới để hoàn tất quá trình:
              </p>
              
              <!-- OTP Box -->
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; padding: 20px 40px; background: linear-gradient(135deg, #1e3a5f 0%, #0d2137 100%); border: 2px solid #00d4ff; border-radius: 12px; box-shadow: 0 0 30px rgba(0,212,255,0.3);">
                  <span style="font-size: 42px; font-weight: bold; color: #00d4ff; letter-spacing: 12px; font-family: 'Courier New', monospace;">${otp}</span>
                </div>
              </div>
              
              <p style="margin: 30px 0 0; color: #888; font-size: 14px; text-align: center;">
                ⏱️ Mã có hiệu lực trong <strong style="color: #ff6b6b;">5 phút</strong>
              </p>
              
              <!-- Warning -->
              <div style="margin-top: 30px; padding: 20px; background: rgba(255,107,107,0.1); border-left: 4px solid #ff6b6b; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #ff6b6b; font-size: 14px;">
                  ⚠️ <strong>Cảnh báo bảo mật:</strong> Không chia sẻ mã này với bất kỳ ai. Nhân viên BONZ STORE sẽ không bao giờ yêu cầu mã OTP của bạn.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 10px; color: #666; font-size: 12px; text-align: center;">
                Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email hoặc liên hệ hỗ trợ.
              </p>
              <p style="margin: 0; color: #444; font-size: 12px; text-align: center;">
                © 2024 BONZ STORE. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendEmailWithGmail(to: string, subject: string, html: string): Promise<void> {
  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gmailUser || !gmailPassword) {
    throw new Error("Gmail credentials not configured");
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: gmailUser,
        password: gmailPassword,
      },
    },
  });

  try {
    await client.send({
      from: `BONZ STORE <${gmailUser}>`,
      to: to,
      subject: subject,
      content: "Vui lòng xem email này bằng trình duyệt hỗ trợ HTML",
      html: html,
    });
    console.log("Email sent successfully via Gmail SMTP");
  } finally {
    await client.close();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { email, action, otp: userOtp } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "send") {
      // Check if already sent recently (rate limiting)
      const { data: existing } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('email', email)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        const expiresAt = new Date(existing.expires_at).getTime();
        const createdAt = new Date(existing.created_at).getTime();
        const timeSinceSend = Date.now() - createdAt;
        
        // Rate limit: 60 seconds between sends
        if (timeSinceSend < 60000) {
          const waitTime = Math.ceil((60000 - timeSinceSend) / 1000);
          return new Response(
            JSON.stringify({ error: `Vui lòng đợi ${waitTime} giây trước khi gửi lại` }),
            { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // Delete old OTPs for this email
      await supabase
        .from('otp_codes')
        .delete()
        .eq('email', email);

      // Generate new OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      // Store OTP in database
      const { error: insertError } = await supabase
        .from('otp_codes')
        .insert({
          email,
          code: otp,
          expires_at: expiresAt,
          attempts: 0
        });

      if (insertError) {
        console.error("Failed to store OTP:", insertError);
        throw new Error("Failed to store OTP");
      }

      // Send email via Gmail
      const subject = `🔐 Mã xác thực BONZ STORE - ${otp.substring(0, 2)}****`;
      await sendEmailWithGmail(email, subject, getEmailTemplate(otp, email));

      console.log("OTP email sent to:", email);

      return new Response(
        JSON.stringify({ success: true, message: "OTP đã được gửi đến email của bạn" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } else if (action === "verify") {
      // Get stored OTP from database
      const { data: stored, error: fetchError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !stored) {
        return new Response(
          JSON.stringify({ error: "Không tìm thấy mã OTP. Vui lòng yêu cầu mã mới." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const expiresAt = new Date(stored.expires_at).getTime();
      if (expiresAt < Date.now()) {
        // Delete expired OTP
        await supabase.from('otp_codes').delete().eq('id', stored.id);
        return new Response(
          JSON.stringify({ error: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (stored.code !== userOtp) {
        const newAttempts = stored.attempts + 1;
        
        if (newAttempts >= 5) {
          // Delete OTP after too many attempts
          await supabase.from('otp_codes').delete().eq('id', stored.id);
          return new Response(
            JSON.stringify({ error: "Nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới." }),
            { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        // Update attempts count
        await supabase
          .from('otp_codes')
          .update({ attempts: newAttempts })
          .eq('id', stored.id);

        return new Response(
          JSON.stringify({ error: `Mã OTP không đúng. Còn ${5 - newAttempts} lần thử.`, attemptsLeft: 5 - newAttempts }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Success - delete OTP
      await supabase.from('otp_codes').delete().eq('id', stored.id);

      return new Response(
        JSON.stringify({ success: true, verified: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});