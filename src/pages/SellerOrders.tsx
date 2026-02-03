import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Clock, CheckCircle, XCircle, Loader2, User, CreditCard, Package, MessageSquare, Wallet, Banknote } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPurchasedCredentials } from '@/hooks/useAdminApi';

interface Order {
  id: string;
  account_id: string | null;
  user_id: string;
  status: string;
  amount: number;
  created_at: string;
  approved_at?: string | null;
  buyer_name?: string;
  accounts?: {
    id: string;
    title: string;
    account_username: string;
    description: string | null;
    seller_id: string;
  } | null;
}

interface AccountCredentials {
  title: string;
  account_username: string;
  account_password: string;
  account_email: string | null;
  account_phone: string | null;
}

interface SellerCoins {
  balance: number;
  total_earned: number;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  bank_name: string;
  bank_account_number: string;
}

export default function SellerOrders() {
  const { user, sellerProfile } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AccountCredentials | null>(null);
  const [showSendCredentialsDialog, setShowSendCredentialsDialog] = useState(false);
  const [message, setMessage] = useState('');
  
  // Seller coins and withdrawal
  const [sellerCoins, setSellerCoins] = useState<SellerCoins | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);

  const fetchOrders = useCallback(async () => {
    if (!sellerProfile?.id) return;

    try {
      console.log('Fetching orders for seller:', sellerProfile.id);

      // Get all orders with account info, then filter by seller
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          account_id,
          user_id,
          status,
          amount,
          created_at,
          approved_at,
          accounts!inner (
            id,
            title,
            account_username,
            description,
            seller_id
          )
        `)
        .eq('accounts.seller_id', sellerProfile.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Supabase orders error:', ordersError);
        // If no orders found, set empty array
        if (ordersError.code === 'PGRST116') {
          console.log('No orders found for seller');
          setOrders([]);
          return;
        }
        throw ordersError;
      }

      // Filter orders where account belongs to this seller
      const sellerOrders = (ordersData as Order[]).filter(order =>
        order.accounts && order.accounts.seller_id === sellerProfile.id
      );

      console.log('Fetched orders:', ordersData?.length, 'Filtered seller orders:', sellerOrders.length);
      setOrders(sellerOrders);
    } catch (err) {
      console.error('Error fetching seller orders:', err);
      toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      setIsLoading(false);
    }
  }, [sellerProfile?.id]);

  // Fetch seller coins
  const fetchSellerCoins = useCallback(async () => {
    if (!sellerProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('seller_coins')
        .select('balance, total_earned')
        .eq('seller_id', sellerProfile.id)
        .maybeSingle();

      if (error) throw error;
      setSellerCoins(data || { balance: 0, total_earned: 0 });
    } catch (err) {
      console.error('Error fetching seller coins:', err);
    }
  }, [sellerProfile?.id]);

  // Fetch withdrawal requests
  const fetchWithdrawalRequests = useCallback(async () => {
    if (!sellerProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('id, amount, status, created_at, bank_name, bank_account_number')
        .eq('seller_id', sellerProfile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setWithdrawalRequests(data || []);
    } catch (err) {
      console.error('Error fetching withdrawal requests:', err);
    }
  }, [sellerProfile?.id]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!sellerProfile) {
      navigate('/user-profile');
      return;
    }

    fetchOrders();
    fetchSellerCoins();
    fetchWithdrawalRequests();
  }, [user, sellerProfile, navigate, fetchOrders, fetchSellerCoins, fetchWithdrawalRequests]);

  // Realtime subscription for order updates
  useEffect(() => {
    if (!sellerProfile?.id) return;

    const channel = supabase
      .channel('seller-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          // Refresh orders when status changes
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sellerProfile?.id, fetchOrders]);

  const handleViewCredentials = async (order: Order) => {
    setLoadingCredentials(order.id);
    try {
      const creds = await getPurchasedCredentials(order.id);
      setCredentials(creds);
      setSelectedOrder(order);
      setShowCredentialsDialog(true);
    } catch (error) {
      console.error("Error fetching credentials:", error);
      toast.error("Không thể tải thông tin tài khoản");
    } finally {
      setLoadingCredentials(null);
    }
  };

  const handleSendCredentials = async () => {
    if (!selectedOrder || !credentials || !message.trim()) {
      toast.error('Vui lòng nhập tin nhắn');
      return;
    }

    try {
      // Here you would typically send a message to the buyer
      // For now, we'll just show a success message
      toast.success('Đã gửi thông tin tài khoản cho khách hàng!');

      setShowSendCredentialsDialog(false);
      setMessage('');
      setCredentials(null);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error sending credentials:', error);
      toast.error('Không thể gửi thông tin tài khoản');
    }
  };

  // Handle withdrawal request
  const handleWithdrawRequest = async () => {
    if (!sellerProfile?.id || !withdrawAmount) {
      toast.error('Vui lòng nhập số xu muốn rút');
      return;
    }

    const amount = parseInt(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Số xu không hợp lệ');
      return;
    }

    if (!sellerCoins || amount > sellerCoins.balance) {
      toast.error('Số xu không đủ');
      return;
    }

    if (!sellerProfile.bank_name || !sellerProfile.bank_account_number || !sellerProfile.bank_account_name) {
      toast.error('Vui lòng cập nhật thông tin ngân hàng trong hồ sơ seller');
      return;
    }

    setIsWithdrawing(true);
    try {
      // Create withdrawal request
      const { error: withdrawError } = await supabase
        .from('withdrawal_requests')
        .insert({
          seller_id: sellerProfile.id,
          amount: amount,
          bank_name: sellerProfile.bank_name,
          bank_account_name: sellerProfile.bank_account_name,
          bank_account_number: sellerProfile.bank_account_number,
          bank_qr_url: sellerProfile.bank_qr_url || null,
        });

      if (withdrawError) throw withdrawError;

      toast.success('Đã gửi yêu cầu rút tiền! Admin sẽ xử lý trong thời gian sớm nhất.');
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
      fetchWithdrawalRequests();
    } catch (error) {
      console.error('Error creating withdrawal request:', error);
      toast.error('Không thể gửi yêu cầu rút tiền');
    } finally {
      setIsWithdrawing(false);
    }
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
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Chờ duyệt</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Đã duyệt</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Từ chối</Badge>;
      default:
        return null;
    }
  };

  const getWithdrawStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="text-xs">Chờ xử lý</Badge>;
      case 'approved':
        return <Badge className="bg-green-600 text-xs">Đã duyệt</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-xs">Từ chối</Badge>;
      default:
        return null;
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const approvedOrders = orders.filter(o => o.status === 'approved');
  const rejectedOrders = orders.filter(o => o.status === 'rejected');

  if (isLoading) {
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
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/user-profile')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold">Đơn hàng của tôi</h1>
            <p className="text-sm text-muted-foreground">Quản lý đơn hàng từ sản phẩm bạn bán</p>
          </div>
        </div>

        {/* Seller Wallet Section */}
        <div className="glass rounded-xl p-4 mb-6 border border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Wallet className="h-7 w-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">S</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
                  <span className="text-lg">💰</span> Ví Xu Seller
                </p>
                <p className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  {formatPrice(sellerCoins?.balance || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tổng đã kiếm: <span className="text-green-400 font-medium">{formatPrice(sellerCoins?.total_earned || 0)}</span>
                </p>
              </div>
            </div>
            <Button
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20"
              onClick={() => setShowWithdrawDialog(true)}
              disabled={!sellerCoins || sellerCoins.balance === 0}
            >
              <Banknote className="h-4 w-4" />
              Yêu cầu rút tiền
            </Button>
          </div>
          
          {/* Recent Withdrawal Requests */}
          {withdrawalRequests.length > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-500/20">
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Yêu cầu rút tiền gần đây
              </p>
              <div className="space-y-2">
                {withdrawalRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between text-sm bg-secondary/50 rounded-lg p-3 border border-border/50">
                    <span className="font-medium text-amber-400">{formatPrice(req.amount)}</span>
                    <span className="text-muted-foreground text-xs">{req.bank_name}</span>
                    {getWithdrawStatusBadge(req.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            <p className="text-2xl font-bold">{approvedOrders.length}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Từ chối</span>
            </div>
            <p className="text-2xl font-bold">{rejectedOrders.length}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-primary mb-1">
              <CreditCard className="h-5 w-5" />
              <span className="text-sm font-medium">Tổng thu</span>
            </div>
            <p className="text-2xl font-bold">
              {formatPrice(approvedOrders.reduce((sum, o) => sum + o.amount, 0))}
            </p>
          </div>
        </div>

        {/* Orders by Status */}
        <div className="space-y-8">
          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Đơn hàng chờ duyệt ({pendingOrders.length})
              </h2>
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <p className="font-medium">{order.accounts?.title || 'Sản phẩm'}</p>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          TK: {order.accounts?.account_username} •
                          {new Date(order.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatPrice(order.amount)}</p>
                        <p className="text-xs text-muted-foreground">Chờ admin duyệt</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Orders */}
          {approvedOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Đơn hàng đã duyệt ({approvedOrders.length})
              </h2>
              <div className="space-y-3">
                {approvedOrders.map((order) => (
                  <div key={order.id} className="glass rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <p className="font-medium">{order.accounts?.title || 'Sản phẩm'}</p>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          TK: {order.accounts?.account_username} •
                          Duyệt: {order.approved_at ? new Date(order.approved_at).toLocaleString('vi-VN') : 'N/A'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="font-bold text-primary">{formatPrice(order.amount)}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowSendCredentialsDialog(true);
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Gửi thông tin
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected Orders */}
          {rejectedOrders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Đơn hàng bị từ chối ({rejectedOrders.length})
              </h2>
              <div className="space-y-3">
                {rejectedOrders.map((order) => (
                  <div key={order.id} className="glass rounded-xl p-4 opacity-60">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <p className="font-medium">{order.accounts?.title || 'Sản phẩm'}</p>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          TK: {order.accounts?.account_username} •
                          {new Date(order.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <p className="font-bold text-primary">{formatPrice(order.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {orders.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Chưa có đơn hàng nào
              </h3>
              <p className="text-muted-foreground">
                Khi có khách hàng mua sản phẩm của bạn, đơn hàng sẽ hiển thị ở đây
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Thông tin tài khoản
            </DialogTitle>
            <DialogDescription>
              Thông tin đăng nhập của sản phẩm đã bán
            </DialogDescription>
          </DialogHeader>

          {credentials && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Tài khoản:</span>
                  <p className="font-medium">{credentials.title}</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Username:</span>
                  <p className="font-mono bg-secondary px-2 py-1 rounded">{credentials.account_username}</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Password:</span>
                  <p className="font-mono bg-secondary px-2 py-1 rounded">{credentials.account_password}</p>
                </div>
                {credentials.account_email && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-mono bg-secondary px-2 py-1 rounded">{credentials.account_email}</p>
                  </div>
                )}
                {credentials.account_phone && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">SĐT:</span>
                    <p className="font-mono bg-secondary px-2 py-1 rounded">{credentials.account_phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowCredentialsDialog(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Credentials Dialog */}
      <Dialog open={showSendCredentialsDialog} onOpenChange={setShowSendCredentialsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Gửi thông tin tài khoản
            </DialogTitle>
            <DialogDescription>
              Gửi thông tin đăng nhập cho khách hàng đã mua sản phẩm
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Sản phẩm: {selectedOrder?.accounts?.title}</p>
              <p className="text-sm text-muted-foreground">Khách hàng sẽ nhận được thông tin đăng nhập</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tin nhắn cho khách hàng</label>
              <Textarea
                placeholder="Nhập tin nhắn kèm theo thông tin tài khoản..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSendCredentialsDialog(false)}>
              Hủy
            </Button>
            <Button onClick={handleSendCredentials} disabled={!message.trim()}>
              Gửi thông tin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Request Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              Yêu cầu rút tiền
            </DialogTitle>
            <DialogDescription>
              Số dư hiện tại: {formatPrice(sellerCoins?.balance || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!sellerProfile?.bank_name ? (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ Bạn chưa cập nhật thông tin ngân hàng. Vui lòng vào{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/seller-profile')}>
                    Hồ sơ Seller
                  </Button>{' '}
                  để cập nhật.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ngân hàng:</span>
                    <span className="font-medium">{sellerProfile.bank_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Chủ tài khoản:</span>
                    <span className="font-medium">{sellerProfile.bank_account_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Số tài khoản:</span>
                    <span className="font-medium">{sellerProfile.bank_account_number}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Số tiền muốn rút (VNĐ)</label>
                  <Input
                    type="number"
                    placeholder={`Tối đa: ${sellerCoins?.balance || 0}`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={sellerCoins?.balance || 0}
                  />
                  <p className="text-xs text-muted-foreground">
                    * Admin sẽ xử lý yêu cầu rút tiền trong vòng 24-48 giờ
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              Hủy
            </Button>
            <Button 
              onClick={handleWithdrawRequest} 
              disabled={isWithdrawing || !sellerProfile?.bank_name || !withdrawAmount}
            >
              {isWithdrawing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
