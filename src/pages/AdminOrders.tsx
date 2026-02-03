import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Clock, User, CreditCard, Bell } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { adminOrdersApi, verifyAdminApi } from '@/hooks/useAdminApi';

interface SellerInfo {
  id: string;
  display_name: string;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
}

interface Order {
  id: string;
  account_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  amount: number;
  created_at: string;
  buyer_name?: string | null;
  seller_name?: string | null;
  seller_bank?: SellerInfo | null;
  accounts?: {
    id: string;
    title: string;
    account_username: string;
  };
}

export default function AdminOrders() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  useEffect(() => {
    const verifyAdmin = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      const isAdmin = await verifyAdminApi();
      if (!isAdmin) {
        toast.error('Bạn không có quyền admin');
        navigate('/');
        return;
      }

      setIsVerifiedAdmin(true);
    };

    if (!authLoading) {
      verifyAdmin();
    }
  }, [user, authLoading, navigate]);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await adminOrdersApi.list();
      setOrders((data as Order[]) || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVerifiedAdmin) {
      fetchOrders();
    }
  }, [isVerifiedAdmin, fetchOrders]);

  // Realtime subscription for new orders
  useEffect(() => {
    if (!isVerifiedAdmin) return;

    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('New order received:', payload);
          setNewOrdersCount(prev => prev + 1);
          toast.success('Có đơn hàng mới!', {
            description: 'Nhấn để tải lại danh sách',
            action: {
              label: 'Tải lại',
              onClick: () => {
                fetchOrders();
                setNewOrdersCount(0);
              }
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        () => {
          // Refresh on any update
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isVerifiedAdmin, fetchOrders]);

  const handleApprove = async (order: Order) => {
    if (!confirm('Xác nhận đơn hàng này đã thanh toán?')) return;
    
    setProcessingId(order.id);
    
    try {
      await adminOrdersApi.approve(order.id);
      toast.success('Đã duyệt đơn hàng!');
      fetchOrders();
    } catch (err: unknown) {
      console.error('Error approving order:', err);
      const message = err instanceof Error ? err.message : 'Không thể duyệt đơn hàng';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (orderId: string) => {
    if (!confirm('Từ chối đơn hàng này?')) return;
    
    setProcessingId(orderId);
    
    try {
      await adminOrdersApi.reject(orderId);
      toast.success('Đã từ chối đơn hàng');
      fetchOrders();
    } catch (err: unknown) {
      console.error('Error rejecting order:', err);
      const message = err instanceof Error ? err.message : 'Không thể từ chối đơn hàng';
      toast.error(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefresh = () => {
    fetchOrders();
    setNewOrdersCount(0);
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

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const processedOrders = orders.filter(o => o.status !== 'pending');

  if (authLoading || isLoading || !isVerifiedAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Quản lý Đơn hàng</h1>
              <p className="text-sm text-muted-foreground">
                Xác nhận thanh toán và duyệt đơn hàng
              </p>
            </div>
          </div>
          
          {newOrdersCount > 0 && (
            <Button onClick={handleRefresh} variant="outline" className="gap-2">
              <Bell className="h-4 w-4 animate-pulse text-primary" />
              {newOrdersCount} đơn mới
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-500 mb-1">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Chờ duyệt</span>
            </div>
            <p className="text-2xl font-bold">{pendingOrders.length}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-500 mb-1">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Đã duyệt</span>
            </div>
            <p className="text-2xl font-bold">{orders.filter(o => o.status === 'approved').length}</p>
          </div>
          <div className="glass rounded-xl p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-primary mb-1">
              <CreditCard className="h-5 w-5" />
              <span className="text-sm font-medium">Tổng thu</span>
            </div>
            <p className="text-2xl font-bold">
              {formatPrice(orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.amount, 0))}
            </p>
          </div>
        </div>

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Đơn hàng chờ duyệt ({pendingOrders.length})
            </h2>
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div key={order.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-medium">{order.accounts?.title || 'Tài khoản'}</p>
                        {getStatusBadge(order.status)}
                      </div>
                      
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Người mua: {order.buyer_name || order.user_id.slice(0, 8)}
                        </p>
                        <p>TK: {order.accounts?.account_username}</p>
                        <p>Ngày đặt: {new Date(order.created_at).toLocaleString('vi-VN')}</p>
                        {order.seller_bank && (
                          <div className="mt-2 p-2 bg-secondary/50 rounded text-xs">
                            <p className="font-medium text-foreground mb-1">Thanh toán vào:</p>
                            <p>Ngân hàng: {order.seller_bank.bank_name}</p>
                            <p>Chủ TK: {order.seller_bank.bank_account_name}</p>
                            <p>Số TK: {order.seller_bank.bank_account_number}</p>
                          </div>
                        )}
                      </div>

                      <p className="text-xl font-bold text-primary mt-2">
                        {formatPrice(order.amount)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="gap-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(order)}
                        disabled={processingId === order.id}
                      >
                        {processingId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => handleReject(order.id)}
                        disabled={processingId === order.id}
                      >
                        <XCircle className="h-4 w-4" />
                        Từ chối
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processed Orders */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Lịch sử đơn hàng</h2>
          {processedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có đơn hàng đã xử lý
            </div>
          ) : (
            <div className="space-y-3">
              {processedOrders.map((order) => (
                <div key={order.id} className="glass rounded-xl p-4 opacity-75">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-medium">{order.accounts?.title || 'Tài khoản'}</p>
                        {getStatusBadge(order.status)}
                      </div>

                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Người mua: {order.buyer_name || order.user_id.slice(0, 8)}
                        </p>
                        <p>TK: {order.accounts?.account_username}</p>
                        <p>Ngày đặt: {new Date(order.created_at).toLocaleString('vi-VN')}</p>
                      </div>

                      <p className="text-xl font-bold text-primary mt-2">
                        {formatPrice(order.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
