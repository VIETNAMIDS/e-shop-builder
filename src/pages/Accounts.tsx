import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, ShoppingCart, Search, Filter, Loader2, QrCode, CheckCircle, Clock, XCircle, Eye, EyeOff, Copy } from "lucide-react";
import { getPurchasedCredentials } from "@/hooks/useAdminApi";

interface Seller {
  id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface Account {
  id: string;
  title: string;
  description: string | null;
  account_username: string;
  price: number;
  category: string;
  image_url: string | null;
  is_sold: boolean;
  is_free: boolean;
  created_at: string;
  seller_id: string | null;
  sellers?: Seller | null;
}

interface Order {
  id: string;
  account_id: string;
  status: 'pending' | 'approved' | 'rejected';
  amount: number;
  created_at: string;
  accounts?: {
    title: string;
  };
}

interface AccountCredentials {
  title: string;
  account_username: string;
  account_password: string;
  account_email: string | null;
  account_phone: string | null;
}

// Default bank info (fallback if seller has no bank info)
const DEFAULT_BANK_ACCOUNT = "0762694589";
const DEFAULT_BANK_NAME = "MB BANK";

const Accounts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showSold, setShowSold] = useState(false);
  
  // Payment modal
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'vnd' | 'coin'>('vnd');
  const [userCoinBalance, setUserCoinBalance] = useState(0);
  
  // User orders
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  
  // Credentials viewing
  const [viewingCredentials, setViewingCredentials] = useState<AccountCredentials | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      // Marketplace listing: query accounts table with RLS (anyone can view unsold accounts)
      // Only select public fields - password/email/phone are not exposed
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          id, title, description, account_username, price, category, image_url, is_sold, is_free, created_at, seller_id,
          sellers ( id, display_name, avatar_url )
        `)
        .eq('is_sold', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      const accountsData = (data || []).map((account: any) => ({
        ...account,
        sellers: account.sellers || null,
        is_free: account.is_free || false,
      }));

      setAccounts(accountsData as Account[]);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Không thể tải danh sách tài khoản. Vui lòng thử lại sau.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("name");
      
      if (error) throw error;
      setCategories(data?.map(c => c.name) || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  const fetchUserOrders = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          account_id,
          status,
          amount,
          created_at,
          accounts (
            title
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserOrders((data as unknown as Order[]) || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, [user]);

  const fetchUserCoinBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('user_coins')
        .select('balance')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching coin balance:', error);
      } else if (data) {
        setUserCoinBalance(data.balance);
      } else {
        setUserCoinBalance(0);
      }
    } catch (err) {
      console.error('Error fetching coin balance:', err);
      setUserCoinBalance(0);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  useEffect(() => {
    if (user) {
      fetchUserOrders();
      fetchUserCoinBalance();
    }
  }, [user, fetchUserOrders]);

  const [showCoinConfirm, setShowCoinConfirm] = useState(false);
  const [pendingCoinAccount, setPendingCoinAccount] = useState<Account | null>(null);
  const [pendingCoinRequired, setPendingCoinRequired] = useState<number | null>(null);
  const [submittingCoin, setSubmittingCoin] = useState(false);

  const performBuyWithCoin = async (account: Account, requiredCoin: number) => {
    setSubmittingCoin(true);
    try {
      const { error: coinError } = await supabase
        .from('user_coins')
        .update({
          balance: userCoinBalance - requiredCoin,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user?.id);

      if (coinError) throw coinError;

      const { data: orderData, error } = await supabase
        .from("orders")
        .insert({
          account_id: account.id,
          user_id: user?.id,
          amount: requiredCoin,
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      setUserCoinBalance(prev => prev - requiredCoin);
      toast.success(`Mua thành công! Đã trừ ${requiredCoin} xu.`);
      fetchUserOrders();
      // Redirect to orders page
      navigate('/my-orders');
    } catch (err) {
      console.error("Error buying account with coin:", err);
      toast.error("Không thể mua bằng xu, vui lòng thử lại");
    } finally {
      setSubmittingCoin(false);
      setShowCoinConfirm(false);
      setPendingCoinAccount(null);
      setPendingCoinRequired(null);
    }
  };

  // Function to get credentials securely via edge function
  const handleViewCredentials = async (orderId: string) => {
    setLoadingCredentials(orderId);
    try {
      const credentials = await getPurchasedCredentials(orderId);
      setViewingCredentials(credentials);
    } catch (error) {
      console.error("Error fetching credentials:", error);
      toast.error("Không thể tải thông tin tài khoản");
    } finally {
      setLoadingCredentials(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const generateQRUrl = (amount: number, accountTitle: string, bankAccount: string, bankCode: string = 'MB') => {
    // VietQR format
    const content = `Mua ${accountTitle}`.slice(0, 25);
    return `https://img.vietqr.io/image/${bankCode}-${bankAccount}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(content)}`;
  };

  // Payment uses platform default bank info (seller banking is not public)
  const getSellerBankInfo = (_account: Account) => {
    return {
      bankName: DEFAULT_BANK_NAME,
      bankAccountNumber: DEFAULT_BANK_ACCOUNT,
      bankAccountName: 'Bonz Shop',
      sellerName: 'Bonz Shop',
    };
  };

  const handleBuy = (account: Account) => {
    // Direct coin-only purchase flow
    handleBuyWithCoin(account);
  };

  // Handle claiming free accounts
  const handleClaimFreeAccount = async (account: Account) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để nhận tài khoản");
      navigate("/auth");
      return;
    }

    if (account.is_sold) {
      toast.error("Tài khoản đã được lấy");
      return;
    }

    try {
      // Mark account as sold to this user
      const { error } = await supabase
        .from('accounts')
        .update({
          is_sold: true,
          sold_to: user.id,
          sold_at: new Date().toISOString()
        })
        .eq('id', account.id)
        .eq('is_free', true)
        .eq('is_sold', false);

      if (error) throw error;

      // Create order for free account
      await supabase
        .from("orders")
        .insert({
          account_id: account.id,
          user_id: user.id,
          amount: 0,
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        });

      toast.success("Nhận tài khoản miễn phí thành công!");
      fetchAccounts();
      fetchUserOrders();
      navigate('/my-orders');
    } catch (error) {
      console.error("Error claiming free account:", error);
      toast.error("Không thể nhận tài khoản miễn phí");
    }
  };

  const handleBuyWithCoin = async (account: Account) => {
    // Show confirmation modal for coin purchase
    if (!user) {
      toast.error("Vui lòng đăng nhập để mua tài khoản");
      navigate("/auth");
      return;
    }

    if (account.is_sold) {
      toast.error("Tài khoản đã được bán");
      return;
    }

    // Calculate coin required: price / 1000
    const requiredCoin = Math.ceil(account.price / 1000);
    setPendingCoinAccount(account);
    setPendingCoinRequired(requiredCoin);
    setShowCoinConfirm(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedAccount || !user) return;

    setSubmittingPayment(true);

    try {
      // Always use coin payment
      const coinPrice = Math.ceil(selectedAccount.price / 1000);
      
      if (userCoinBalance < coinPrice) {
        toast.error(`Không đủ xu! Cần ${coinPrice} xu, bạn chỉ có ${userCoinBalance} xu.`);
        setSubmittingPayment(false);
        return;
      }

      // Deduct coins from user balance
      const { error: coinError } = await supabase
        .from('user_coins')
        .update({
          balance: userCoinBalance - coinPrice,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (coinError) throw coinError;

      // Create order for coin purchase (auto-approved)
      const { data: orderData, error } = await supabase
        .from("orders")
        .insert({
          account_id: selectedAccount.id,
          user_id: user.id,
          amount: coinPrice,
          status: 'approved', // Auto-approved for coin purchases
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Mark account as sold
      await supabase
        .from('accounts')
        .update({
          is_sold: true,
          sold_to: user.id,
          sold_at: new Date().toISOString()
        })
        .eq('id', selectedAccount.id);

      // Update local balance
      setUserCoinBalance(prev => prev - coinPrice);

      toast.success(`Mua thành công! Đã trừ ${coinPrice} xu. Tài khoản đã sẵn sàng sử dụng.`);

      setShowPaymentModal(false);
      setSelectedAccount(null);
      fetchUserOrders();
      navigate('/my-orders');
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Không thể tạo đơn hàng");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Chờ xác nhận</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Đã duyệt</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Từ chối</Badge>;
      default:
        return null;
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = account.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesCategory = selectedCategory === "all" || account.category === selectedCategory;
    const matchesSoldStatus = showSold || !account.is_sold;

    return matchesSearch && matchesCategory && matchesSoldStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Mua Tài Khoản
            </h1>
            <p className="text-muted-foreground">
              Tìm và mua các tài khoản chất lượng với giá tốt nhất
            </p>
          </div>
          
          {user && (
            <Button 
              variant="outline" 
              onClick={() => setShowOrdersModal(true)}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Đơn hàng ({userOrders.filter(o => o.status === 'pending').length})
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm tài khoản..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Danh mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả danh mục</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showSold ? "default" : "outline"}
            onClick={() => setShowSold(!showSold)}
            className="whitespace-nowrap"
          >
            {showSold ? "Ẩn đã bán" : "Hiện đã bán"}
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredAccounts.length === 0 && (
          <div className="text-center py-20">
            <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Không tìm thấy tài khoản
            </h3>
            <p className="text-muted-foreground">
              Thử thay đổi bộ lọc hoặc tìm kiếm khác
            </p>
          </div>
        )}

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAccounts.map((account) => (
            <Card 
              key={account.id} 
              className={`group hover:shadow-lg transition-all duration-300 ${
                account.is_sold ? "opacity-60" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">
                    {account.title}
                  </CardTitle>
                  {account.is_sold && (
                    <Badge variant="destructive" className="ml-2 shrink-0">
                      Đã bán
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary" className="w-fit">
                  {account.category}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-3">
                {account.image_url && (
                  <img 
                    src={account.image_url} 
                    alt={account.title}
                    className="w-full h-32 object-cover rounded-md"
                  />
                )}

                {account.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {account.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{account.account_username}</span>
                </div>

                {account.sellers && (
                  <div className="text-xs text-muted-foreground">
                    Người bán: <span className="font-medium text-foreground">{account.sellers.display_name}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  {account.is_free ? (
                    <div className="text-2xl font-bold text-green-500">
                      Miễn phí
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-primary">
                        {formatPrice(account.price)}
                      </div>
                      <div className="text-sm font-bold text-orange-600">
                        {Math.ceil(account.price / 1000)} xu
                      </div>
                    </>
                  )}
                </div>
              </CardContent>

              <CardFooter>
                <div className="flex gap-2 w-full">
                  {account.is_free ? (
                    <Button 
                      className="flex-1" 
                      disabled={account.is_sold}
                      onClick={() => handleClaimFreeAccount(account)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {account.is_sold ? "Đã bán" : "Nhận miễn phí"}
                    </Button>
                  ) : (
                    <Button 
                      className="flex-1" 
                      disabled={account.is_sold}
                      onClick={() => handleBuy(account)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {account.is_sold ? "Đã bán" : `Mua ${Math.ceil(account.price / 1000)} xu`}
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Thanh toán
            </DialogTitle>
            <DialogDescription>
              Chọn phương thức thanh toán phù hợp với bạn
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && (() => {
            const coinPrice = Math.ceil(selectedAccount.price / 1000);

            return (
              <div className="space-y-4">
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Tài khoản:</p>
                  <p className="font-medium">{selectedAccount.title}</p>
                  {selectedAccount.sellers && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Người bán: <span className="font-medium text-foreground">{selectedAccount.sellers.display_name}</span>
                    </p>
                  )}
                  <p className="text-2xl font-bold text-primary mt-2">
                    {coinPrice} xu
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Số dư: {userCoinBalance} xu
                  </p>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                  <div className="text-green-600 dark:text-green-400 text-sm">
                    💰 Thanh toán bằng xu - Mua ngay không cần chờ duyệt!
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tài khoản sẽ được kích hoạt ngay lập tức sau khi thanh toán.
                  </p>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPaymentModal(false)}
              className="w-full sm:w-auto"
            >
              Hủy
            </Button>
            <Button 
              onClick={handleConfirmPayment}
              disabled={submittingPayment}
              className="w-full sm:w-auto"
            >
              {submittingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mua bằng xu
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coin confirmation dialog */}
      <Dialog open={showCoinConfirm} onOpenChange={setShowCoinConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận mua bằng xu</DialogTitle>
            <DialogDescription>Kiểm tra số dư và xác nhận thanh toán bằng xu</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Tài khoản:</p>
              <p className="font-medium">{pendingCoinAccount?.title}</p>
            </div>

            <div className="flex justify-between px-2">
              <div className="text-sm text-muted-foreground">Số xu cần:</div>
              <div className="font-medium">{pendingCoinRequired ?? '-' } xu</div>
            </div>
            <div className="flex justify-between px-2">
              <div className="text-sm text-muted-foreground">Số dư hiện tại:</div>
              <div className="font-medium">{userCoinBalance} xu</div>
            </div>
            <div className="flex justify-between px-2">
              <div className="text-sm text-muted-foreground">Số dư sau khi mua:</div>
              <div className="font-medium">{(userCoinBalance - (pendingCoinRequired ?? 0))} xu</div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCoinConfirm(false)} className="w-full sm:w-auto">Hủy</Button>
            {pendingCoinRequired !== null && userCoinBalance < pendingCoinRequired ? (
              <Button
                variant="default"
                onClick={() => {
                  setShowCoinConfirm(false);
                  navigate('/buy-coins');
                }}
                className="w-full sm:w-auto"
              >
                Nạp xu
              </Button>
            ) : (
              <Button
                onClick={() => pendingCoinAccount && pendingCoinRequired !== null && performBuyWithCoin(pendingCoinAccount, pendingCoinRequired)}
                disabled={submittingCoin}
                className="w-full sm:w-auto"
              >
                {submittingCoin ? 'Đang xử lý...' : 'Xác nhận mua bằng xu'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orders Modal */}
      <Dialog open={showOrdersModal} onOpenChange={setShowOrdersModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đơn hàng của tôi</DialogTitle>
            <DialogDescription>
              Theo dõi trạng thái đơn hàng và xem thông tin tài khoản đã mua
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {userOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Bạn chưa có đơn hàng nào
              </div>
            ) : (
              userOrders.map((order) => (
                <div key={order.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{order.accounts?.title || 'Tài khoản'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <p className="text-lg font-bold text-primary">
                    {formatPrice(order.amount)}
                  </p>

                  {/* Show button to view credentials if approved */}
                  {order.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
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

                  {order.status === 'pending' && (
                    <p className="text-sm text-muted-foreground">
                      ⏳ Đang chờ Admin xác nhận thanh toán...
                    </p>
                  )}

                  {order.status === 'rejected' && (
                    <p className="text-sm text-red-500">
                      ❌ Đơn hàng bị từ chối. Vui lòng liên hệ Admin.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials Modal - Secure view */}
      <Dialog open={!!viewingCredentials} onOpenChange={() => { setViewingCredentials(null); setShowPassword(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Thông tin tài khoản
            </DialogTitle>
            <DialogDescription>
              Thông tin đăng nhập của tài khoản bạn đã mua
            </DialogDescription>
          </DialogHeader>

          {viewingCredentials && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <code className="bg-secondary px-2 py-1 rounded font-mono">{viewingCredentials.account_username}</code>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(viewingCredentials.account_username, 'username')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mật khẩu:</span>
                  <div className="flex items-center gap-2">
                    <code className="bg-secondary px-2 py-1 rounded font-mono">
                      {showPassword ? viewingCredentials.account_password : '••••••••'}
                    </code>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(viewingCredentials.account_password, 'mật khẩu')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {viewingCredentials.account_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-secondary px-2 py-1 rounded font-mono text-sm">{viewingCredentials.account_email}</code>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(viewingCredentials.account_email!, 'email')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {viewingCredentials.account_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">SĐT:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-secondary px-2 py-1 rounded font-mono">{viewingCredentials.account_phone}</code>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(viewingCredentials.account_phone!, 'SĐT')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Vui lòng đổi mật khẩu sau khi đăng nhập để bảo vệ tài khoản của bạn.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => { setViewingCredentials(null); setShowPassword(false); }}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accounts;
