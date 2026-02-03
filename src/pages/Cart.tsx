import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Layout } from '@/components/Layout';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price);
}

export default function Cart() {
  const { cart, isLoading, removeFromCart, clearCart, cartTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Giỏ hàng của bạn</h1>
          <p className="text-muted-foreground mb-6">
            Bạn cần đăng nhập để xem giỏ hàng
          </p>
          <Button asChild>
            <Link to="/auth">Đăng nhập</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      // Create orders for each item
      for (const item of cart) {
        const { error } = await supabase
          .from('orders')
          .insert({
            user_id: user.id,
            product_id: item.product_id,
            total_amount: item.product?.price || 0,
            status: 'completed',
            payment_method: 'demo'
          });
        
        if (error) throw error;
      }

      await clearCart.mutateAsync();
      toast.success('Đặt hàng thành công!');
      navigate('/orders');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi đặt hàng');
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-8">Giỏ hàng</h1>

        {isLoading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Đang tải...</p>
          </div>
        ) : cart.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Giỏ hàng trống</h2>
            <p className="text-muted-foreground mb-6">
              Bạn chưa có sản phẩm nào trong giỏ hàng
            </p>
            <Button asChild>
              <Link to="/products">Khám phá sản phẩm</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-16 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={item.product?.image_url || '/placeholder.svg'}
                          alt={item.product?.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{item.product?.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Số lượng: {item.quantity}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-semibold text-primary">
                          {formatPrice(item.product?.price || 0)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart.mutate(item.id)}
                          disabled={removeFromCart.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-24">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Tóm tắt đơn hàng</h2>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tạm tính</span>
                      <span>{formatPrice(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Giảm giá</span>
                      <span>0₫</span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex justify-between font-semibold text-lg mb-6">
                    <span>Tổng cộng</span>
                    <span className="text-primary">{formatPrice(cartTotal)}</span>
                  </div>

                  <Button className="w-full" size="lg" onClick={handleCheckout}>
                    Thanh toán
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Bằng việc đặt hàng, bạn đồng ý với điều khoản sử dụng
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
