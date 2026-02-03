import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Coins, Upload, Loader2, History, Clock, CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CoinPurchase {
  id: string;
  amount: number;
  status: string;
  receipt_url: string;
  admin_note: string | null;
  created_at: string;
}

export default function BuyCoins() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [purchases, setPurchases] = useState<CoinPurchase[]>([]);
  const [amount, setAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  
  const generateBankQr = (bankAccount: string, amountVnd?: number, bankName: string = '') => {
    const bankCode = bankName.toUpperCase().includes('MB') ? 'MB' : 'MB';
    const content = `Nạp xu`.slice(0, 25);
    if (amountVnd && amountVnd > 0) {
      return `https://img.vietqr.io/image/${bankCode}-${bankAccount}-compact2.png?amount=${amountVnd}&addInfo=${encodeURIComponent(content)}`;
    }
    return `https://img.vietqr.io/image/${bankCode}-${bankAccount}-compact2.png`;
  };
  
  // Admin bank info - random select one admin for display
  const [adminBankInfo, setAdminBankInfo] = useState<{
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_qr_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch user balance
      const { data: coins } = await supabase
        .from('user_coins')
        .select('balance')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (coins) {
        setBalance(coins.balance);
      }

      // Fetch purchase history
      const { data: purchaseHistory } = await supabase
        .from('coin_purchases')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (purchaseHistory) {
        setPurchases(purchaseHistory);
      }

      // Fetch admin bank info via edge function (bypasses RLS)
      const { data: bankData, error: bankError } = await supabase.functions.invoke('get-admin-bank-info');
      
      if (bankError) {
        console.error('Error fetching bank info:', bankError);
      } else if (bankData?.bankInfo) {
        setAdminBankInfo(bankData.bankInfo);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Vui lòng chọn file hình ảnh');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File quá lớn. Tối đa 5MB');
        return;
      }
      setReceiptFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const coinAmount = parseInt(amount);
    if (isNaN(coinAmount) || coinAmount < 10 || coinAmount > 3000) {
      toast.error('Số xu phải từ 10 đến 3,000');
      return;
    }

    if (!receiptFile) {
      toast.error('Vui lòng upload bill chuyển khoản');
      return;
    }

    setSubmitting(true);
    try {
      // Upload receipt
      setUploading(true);
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const uploadResult = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      // supabase storage returns either { data, error } or throws; handle both shapes
      const uploadError = (uploadResult as any).error ?? null;
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      setUploading(false);

      // Create purchase request
      const { error: insertError } = await supabase
        .from('coin_purchases')
        .insert({
          user_id: user?.id,
          amount: coinAmount,
          receipt_url: urlData.publicUrl,
          status: 'pending'
        });

      if (insertError) throw insertError;

      toast.success('Đã gửi yêu cầu mua xu! Chờ admin xác nhận.');
      setAmount('');
      setReceiptFile(null);
      setPreviewUrl(null);
      fetchData();
    } catch (error: any) {
      console.error('Error during BuyCoins.handleSubmit:', error);
      // Show detailed message when available to help debugging
      const message = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      toast.error(message ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Chờ duyệt</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Đã duyệt</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Từ chối</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Coins className="h-5 w-5" />
              <span className="font-semibold">Số dư: {balance} xu</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Mua Xu</h1>
            <p className="text-muted-foreground">Nạp xu để mua tài khoản trên Bonz Shop</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Buy Form */}
            <Card className="glass border-border/50">
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  Nạp xu
                </CardTitle>
                <CardDescription>
                  Mua từ 10 đến 3,000,000 xu (1 xu = 1,000 VNĐ)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {adminBankInfo ? (
                  <>
                    {/* Bank Info */}
                    <div className="p-4 rounded-lg bg-secondary/50 mb-6 text-center">
                      {/* Show big QR first */}
                      <div className="mx-auto mb-4">
                        <img
                          src={
                            adminBankInfo.bank_qr_url ||
                            generateBankQr(
                              adminBankInfo.bank_account_number,
                              amount ? parseInt(amount) * 1000 : undefined,
                              adminBankInfo.bank_name
                            )
                          }
                          alt="Bank QR"
                          className="w-56 h-56 object-contain mx-auto rounded-lg border"
                        />
                      </div>
                      <h4 className="font-semibold mb-2">Thông tin chuyển khoản</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Ngân hàng:</span> <span className="font-medium">{adminBankInfo.bank_name}</span></p>
                        <p><span className="text-muted-foreground">Chủ TK:</span> <span className="font-medium">{adminBankInfo.bank_account_name}</span></p>
                        <p><span className="text-muted-foreground">Số TK:</span> <span className="font-medium font-mono">{adminBankInfo.bank_account_number}</span></p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Nội dung CK: <span className="font-mono text-primary">{user?.email}</span>
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Số xu muốn mua (10-3000)</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            10,20,30,50,100,200,500,1000,2000,3000
                          ].map((p) => (
                            <Button
                              key={p}
                              type="button"
                              variant={selectedPack === p ? 'default' : 'outline'}
                              size="sm"
                              className="px-3"
                              onClick={() => { setSelectedPack(p); setAmount(String(p)); }}
                            >
                              {p} xu
                            </Button>
                          ))}
                          <Input
                            id="amount"
                            type="number"
                            min="10"
                            max="3000"
                            placeholder="Gõ số xu tùy ý"
                            value={amount}
                            onChange={(e) => { setAmount(e.target.value); setSelectedPack(null); }}
                            className="w-full mt-2"
                            required
                          />
                        </div>
                        {amount && parseInt(amount) >= 10 && (
                          <p className="text-sm text-muted-foreground">
                            = {(parseInt(amount) * 1000).toLocaleString('vi-VN')} VNĐ
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="receipt">Bill chuyển khoản *</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                          <input
                            id="receipt"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <label htmlFor="receipt" className="cursor-pointer block">
                            {previewUrl ? (
                              <div className="space-y-2">
                                <img 
                                  src={previewUrl} 
                                  alt="Preview" 
                                  className="max-h-40 mx-auto rounded-lg"
                                />
                                <p className="text-sm text-muted-foreground">Click để đổi ảnh</p>
                              </div>
                            ) : (
                              <div className="py-4">
                                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  Click để chọn ảnh bill
                                </p>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        variant="gradient"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {uploading ? 'Đang upload...' : 'Đang gửi...'}
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Gửi yêu cầu nạp xu
                          </>
                        )}
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Chưa có thông tin thanh toán.</p>
                    <p className="text-sm">Vui lòng liên hệ admin.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Purchase History */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Lịch sử nạp xu
                </CardTitle>
              </CardHeader>
              <CardContent>
                {purchases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Chưa có lịch sử nạp xu</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {purchases.map((purchase) => (
                      <div 
                        key={purchase.id} 
                        className="p-3 rounded-lg bg-secondary/30 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-primary">{purchase.amount} xu</span>
                          {getStatusBadge(purchase.status)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(purchase.created_at).toLocaleString('vi-VN')}
                        </div>
                        {purchase.admin_note && (
                          <p className="text-xs mt-2 p-2 bg-background/50 rounded">
                            Ghi chú: {purchase.admin_note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
