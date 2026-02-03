import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clock, CheckCircle, XCircle, Eye, EyeOff, Copy, ShoppingBag, Bell, Download, Package, User } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPurchasedCredentials } from '@/hooks/useAdminApi';

interface Order {
  id: string;
  account_id: string | null;
  product_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  amount: number;
  created_at: string;
  accounts?: {
    title: string;
    category: string;
    image_url: string | null;
  } | null;
  products?: {
    title: string;
    category: string;
    image_url: string | null;
    download_url: string | null;
  } | null;
}

interface AccountCredentials {
  title: string;
  account_username: string;
  account_password: string;
  account_email: string | null;
  account_phone: string | null;
}

export default function MyOrders() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingCredentials, setViewingCredentials] = useState<AccountCredentials | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          account_id,
          product_id,
          status,
          amount,
          created_at,
          accounts (
            title,
            category,
            image_url
          ),
          products (
            title,
            category,
            image_url,
            download_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as unknown as Order[]) || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Không thể tải đơn hàng');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, fetchOrders]);

  // Realtime subscription for order updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Order updated:', payload);
          const newStatus = payload.new.status;
          
          if (newStatus === 'approved') {
            toast.success('🎉 Đơn hàng đã được duyệt!', {
              description: 'Bạn có thể xem thông tin tài khoản ngay bây giờ',
            });
          } else if (newStatus === 'rejected') {
            toast.error('Đơn hàng bị từ chối', {
              description: 'Vui lòng liên hệ admin nếu cần hỗ trợ',
            });
          }
          
          setHasNewUpdates(true);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders]);

  const handleViewCredentials = async (orderId: string) => {
    setLoadingCredentials(orderId);
    try {
      const credentials = await getPurchasedCredentials(orderId);
      setViewingCredentials(credentials);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast.error('Không thể tải thông tin tài khoản');
    } finally {
      setLoadingCredentials(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Chờ xác nhận</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Đã duyệt</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Từ chối</Badge>;
      default:
        return null;
    }
  };

  // Helper to get order item info (works for both account and product orders)
  const getOrderItem = (order: Order) => {
    if (order.product_id && order.products) {
      return {
        type: 'product' as const,
        title: order.products.title,
        category: order.products.category,
        image_url: order.products.image_url,
        download_url: order.products.download_url
      };
    }
    if (order.account_id && order.accounts) {
      return {
        type: 'account' as const,
        title: order.accounts.title,
        category: order.accounts.category,
        image_url: order.accounts.image_url,
        download_url: null
      };
    }
    return null;
  };

  const getOrderTypeBadge = (order: Order) => {
    if (order.product_id) {
      return <Badge variant="outline" className="gap-1 text-xs"><Package className="h-3 w-3" /> Source Code</Badge>;
    }
    return <Badge variant="outline" className="gap-1 text-xs"><User className="h-3 w-3" /> Tài khoản</Badge>;
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const approvedOrders = orders.filter(o => o.status === 'approved');
  const rejectedOrders = orders.filter(o => o.status === 'rejected');

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-primary" />
              Đơn hàng của tôi
            </h1>
            <p className="text-muted-foreground mt-1">
              Theo dõi trạng thái và xem thông tin tài khoản đã mua
            </p>
          </div>
          
          {hasNewUpdates && (
            <Button 
              onClick={() => {
                fetchOrders();
                setHasNewUpdates(false);
              }} 
              variant="outline" 
              className="gap-2"
            >
              <Bell className="h-4 w-4 animate-pulse text-primary" />
              Có cập nhật mới
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-yellow-500 mb-1">
              <Clock className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold">{pendingOrders.length}</p>
            <p className="text-xs text-muted-foreground">Chờ duyệt</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-green-500 mb-1">
              <CheckCircle className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold">{approvedOrders.length}</p>
            <p className="text-xs text-muted-foreground">Đã duyệt</p>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-destructive mb-1">
              <XCircle className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold">{rejectedOrders.length}</p>
            <p className="text-xs text-muted-foreground">Từ chối</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Chưa có đơn hàng</h3>
            <p className="text-muted-foreground mb-6">
              Bạn chưa mua tài khoản nào. Khám phá ngay!
            </p>
            <Button onClick={() => navigate('/accounts')}>
              Mua tài khoản ngay
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Orders */}
            {pendingOrders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Đang chờ xác nhận ({pendingOrders.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingOrders.map((order) => {
                    const item = getOrderItem(order);
                    return (
                      <div key={order.id} className="glass rounded-xl p-4 border-l-4 border-yellow-500">
                        <div className="flex items-start gap-4">
                          {item?.image_url && (
                            <img 
                              src={item.image_url} 
                              alt={item.title}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <p className="font-medium truncate">{item?.title}</p>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {getOrderTypeBadge(order)}
                              <Badge variant="outline">{item?.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.created_at).toLocaleString('vi-VN')}
                            </p>
                            <p className="text-xl font-bold text-primary mt-2">
                              {formatPrice(order.amount)}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-3 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Admin đang xác nhận thanh toán...
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Approved Orders */}
            {approvedOrders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Đã duyệt ({approvedOrders.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {approvedOrders.map((order) => {
                    const item = getOrderItem(order);
                    const isProduct = order.product_id !== null;
                    return (
                      <div key={order.id} className="glass rounded-xl p-4 border-l-4 border-green-500">
                        <div className="flex items-start gap-4">
                          {item?.image_url && (
                            <img 
                              src={item.image_url} 
                              alt={item.title}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <p className="font-medium truncate">{item?.title}</p>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {getOrderTypeBadge(order)}
                              <Badge variant="outline">{item?.category}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.created_at).toLocaleString('vi-VN')}
                            </p>
                            <p className="text-xl font-bold text-primary mt-2">
                              {formatPrice(order.amount)}
                            </p>
                          </div>
                        </div>
                        {isProduct ? (
                          item?.download_url ? (
                            <Button 
                              className="w-full mt-4 gap-2"
                              onClick={() => window.open(item.download_url!, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                              Tải xuống Source Code
                            </Button>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-4 text-center">
                              Admin sẽ gửi source code qua email
                            </p>
                          )
                        ) : (
                          <Button 
                            className="w-full mt-4 gap-2"
                            onClick={() => handleViewCredentials(order.id)}
                            disabled={loadingCredentials === order.id}
                          >
                            {loadingCredentials === order.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                            Xem thông tin tài khoản
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rejected Orders */}
            {rejectedOrders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Đã từ chối ({rejectedOrders.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {rejectedOrders.map((order) => {
                    const item = getOrderItem(order);
                    return (
                      <div key={order.id} className="glass rounded-xl p-4 border-l-4 border-destructive opacity-60">
                        <div className="flex items-start gap-4">
                          {item?.image_url && (
                            <img 
                              src={item.image_url} 
                              alt={item.title}
                              className="w-16 h-16 rounded-lg object-cover grayscale"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <p className="font-medium truncate">{item?.title}</p>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {getOrderTypeBadge(order)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.created_at).toLocaleString('vi-VN')}
                            </p>
                            <p className="text-xl font-bold text-muted-foreground mt-2">
                              {formatPrice(order.amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Credentials Dialog */}
      <Dialog open={!!viewingCredentials} onOpenChange={() => setViewingCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thông tin tài khoản</DialogTitle>
            <DialogDescription>
              {viewingCredentials?.title}
            </DialogDescription>
          </DialogHeader>

          {viewingCredentials && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Tên đăng nhập</p>
                    <p className="font-mono font-medium">{viewingCredentials.account_username}</p>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => copyToClipboard(viewingCredentials.account_username, 'tên đăng nhập')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Mật khẩu</p>
                    <p className="font-mono font-medium">
                      {showPassword ? viewingCredentials.account_password : '••••••••'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => copyToClipboard(viewingCredentials.account_password, 'mật khẩu')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {viewingCredentials.account_email && (
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-mono text-sm">{viewingCredentials.account_email}</p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => copyToClipboard(viewingCredentials.account_email!, 'email')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {viewingCredentials.account_phone && (
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Số điện thoại</p>
                      <p className="font-mono">{viewingCredentials.account_phone}</p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => copyToClipboard(viewingCredentials.account_phone!, 'SĐT')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Vui lòng đổi mật khẩu ngay sau khi đăng nhập để bảo vệ tài khoản của bạn.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}