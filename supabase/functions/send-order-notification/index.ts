import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'order_created' | 'order_approved' | 'order_rejected';
  orderId: string;
  userEmail?: string;
  accountTitle?: string;
  amount?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, orderId, userEmail, accountTitle, amount }: NotificationRequest = await req.json();

    console.log('Sending notification:', { type, orderId, userEmail });

    let subject = '';
    let html = '';

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(price);
    };

    switch (type) {
      case 'order_created':
        subject = '🛒 Đơn hàng mới cần xác nhận';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #10b981;">📦 Đơn hàng mới!</h1>
            <p>Có đơn hàng mới cần xác nhận:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Tài khoản:</strong> ${accountTitle || 'N/A'}</p>
              <p><strong>Số tiền:</strong> ${amount ? formatPrice(amount) : 'N/A'}</p>
              <p><strong>Mã đơn:</strong> ${orderId}</p>
            </div>
            <p>Vui lòng đăng nhập trang Admin để xác nhận thanh toán.</p>
          </div>
        `;
        break;

      case 'order_approved':
        subject = '✅ Đơn hàng của bạn đã được duyệt!';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #10b981;">🎉 Chúc mừng!</h1>
            <p>Đơn hàng của bạn đã được duyệt thành công!</p>
            <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Tài khoản:</strong> ${accountTitle || 'N/A'}</p>
              <p><strong>Số tiền:</strong> ${amount ? formatPrice(amount) : 'N/A'}</p>
            </div>
            <p>Bạn có thể xem thông tin tài khoản trong mục <strong>"Đơn hàng của tôi"</strong> trên website.</p>
            <p style="color: #f59e0b; margin-top: 20px;">⚠️ Lưu ý: Vui lòng đổi mật khẩu sau khi đăng nhập để bảo vệ tài khoản của bạn.</p>
          </div>
        `;
        break;

      case 'order_rejected':
        subject = '❌ Đơn hàng bị từ chối';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #ef4444;">😔 Rất tiếc!</h1>
            <p>Đơn hàng của bạn đã bị từ chối.</p>
            <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Tài khoản:</strong> ${accountTitle || 'N/A'}</p>
              <p><strong>Số tiền:</strong> ${amount ? formatPrice(amount) : 'N/A'}</p>
            </div>
            <p>Lý do có thể là:</p>
            <ul>
              <li>Chưa nhận được thanh toán</li>
              <li>Thông tin thanh toán không khớp</li>
              <li>Tài khoản đã được bán cho người khác</li>
            </ul>
            <p>Vui lòng liên hệ Admin nếu bạn cần hỗ trợ.</p>
          </div>
        `;
        break;

      default:
        throw new Error('Invalid notification type');
    }

    // Get admin emails for order_created notifications
    let recipients: string[] = [];

    if (type === 'order_created') {
      // Get all admin user IDs
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) {
        console.error('Error fetching admin roles:', rolesError);
      } else if (adminRoles && adminRoles.length > 0) {
        // Get admin emails from auth.users
        for (const role of adminRoles) {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(role.user_id);
          if (!userError && userData?.user?.email) {
            recipients.push(userData.user.email);
          }
        }
      }
    } else {
      // For order_approved and order_rejected, send to the buyer
      if (userEmail) {
        recipients.push(userEmail);
      }
    }

    console.log('Recipients:', recipients);

    if (recipients.length === 0) {
      console.log('No recipients found, skipping email');
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: 'Bonz Store <onboarding@resend.dev>',
      to: recipients,
      subject,
      html,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error sending notification:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
