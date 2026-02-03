import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CartItem, Product } from '@/types';
import { toast } from 'sonner';

interface CartItemWithProduct extends CartItem {
  products: Product;
}

export function useCart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: async (): Promise<CartItem[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      return (data as CartItemWithProduct[])?.map(item => ({
        ...item,
        product: item.products
      })) || [];
    },
    enabled: !!user
  });

  const addToCart = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Bạn cần đăng nhập để thêm vào giỏ hàng');

      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + 1 })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({ user_id: user.id, product_id: productId, quantity: 1 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Đã thêm vào giỏ hàng!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const removeFromCart = useMutation({
    mutationFn: async (cartItemId: string) => {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Đã xóa khỏi giỏ hàng');
    }
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    }
  });

  const cartTotal = cartQuery.data?.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * item.quantity;
  }, 0) || 0;

  const cartCount = cartQuery.data?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return {
    cart: cartQuery.data || [],
    isLoading: cartQuery.isLoading,
    addToCart,
    removeFromCart,
    clearCart,
    cartTotal,
    cartCount
  };
}
