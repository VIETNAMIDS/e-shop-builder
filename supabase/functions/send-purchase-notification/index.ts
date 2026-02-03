import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurchaseNotificationRequest {
  userEmail: string;
  userName: string;
  productTitle: string;
  productType: 'account' | 'product';
  amount: number;
  orderId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, productTitle, productType, amount, orderId }: PurchaseNotificationRequest = await req.json();

    console.log('Sending purchase notification to:', userEmail);

    const formatPrice = (price: number) => {
      return `${price.toLocaleString('vi-VN')} xu`;
    };

    const productTypeName = productType === 'account' ? 'Tài khoản' : 'Sản phẩm';

    const emailResponse = await resend.emails.send({
      from: 'Bonz Shop <onboarding@resend.dev>',
      to: [userEmail],
      subject: '🎉 Mua hàng thành công - Bonz Shop',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0f;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #1a1a2e 0%, #0f0f1a 100%); border-radius: 20px; border: 1px solid rgba(168, 85, 247, 0.2); overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%); padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">🎉 Mua hàng thành công!</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 20px 0;">
                        Xin chào <strong style="color: #a855f7;">${userName || 'bạn'}</strong>,
                      </p>
                      
                      <p style="color: #94a3b8; font-size: 16px; margin: 0 0 30px 0;">
                        Cảm ơn bạn đã mua hàng tại <strong style="color: #ec4899;">Bonz Shop</strong>! Đơn hàng của bạn đã được xử lý thành công.
                      </p>
                      
                      <!-- Order Details Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; margin-bottom: 30px;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="color: #a855f7; margin: 0 0 20px 0; font-size: 18px;">📦 Chi tiết đơn hàng</h3>
                            
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="color: #94a3b8; padding: 8px 0;">Mã đơn hàng:</td>
                                <td style="color: #e2e8f0; padding: 8px 0; text-align: right; font-family: monospace;">${orderId.slice(0, 8)}...</td>
                              </tr>
                              <tr>
                                <td style="color: #94a3b8; padding: 8px 0;">Loại:</td>
                                <td style="color: #e2e8f0; padding: 8px 0; text-align: right;">${productTypeName}</td>
                              </tr>
                              <tr>
                                <td style="color: #94a3b8; padding: 8px 0;">Tên sản phẩm:</td>
                                <td style="color: #ec4899; padding: 8px 0; text-align: right; font-weight: bold;">${productTitle}</td>
                              </tr>
                              <tr>
                                <td style="color: #94a3b8; padding: 8px 0; border-top: 1px solid rgba(168, 85, 247, 0.2); padding-top: 15px;">Số tiền:</td>
                                <td style="color: #22c55e; padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; border-top: 1px solid rgba(168, 85, 247, 0.2); padding-top: 15px;">${formatPrice(amount)}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <a href="https://bonzshop.lovable.app/my-orders" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 10px; font-weight: bold; font-size: 16px;">
                              Xem đơn hàng của tôi →
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Notice -->
                      <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 15px; margin-top: 20px;">
                        <p style="color: #fbbf24; margin: 0; font-size: 14px;">
                          ⚠️ <strong>Lưu ý:</strong> Nếu bạn mua tài khoản, vui lòng đổi mật khẩu ngay sau khi đăng nhập để bảo vệ tài khoản của bạn.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background: rgba(0, 0, 0, 0.3); padding: 25px 30px; text-align: center; border-top: 1px solid rgba(168, 85, 247, 0.2);">
                      <p style="color: #64748b; margin: 0 0 10px 0; font-size: 14px;">
                        Cần hỗ trợ? Liên hệ với chúng tôi qua trang <a href="https://bonzshop.lovable.app/contact" style="color: #a855f7; text-decoration: none;">Liên hệ</a>
                      </p>
                      <p style="color: #475569; margin: 0; font-size: 12px;">
                        © 2024 Bonz Shop. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log('Purchase notification email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error sending purchase notification:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
