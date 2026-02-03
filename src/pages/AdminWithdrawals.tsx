import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Banknote, User } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { verifyAdminApi } from '@/hooks/useAdminApi';

interface WithdrawalRequest {
  id: string;
  seller_id: string;
  amount: number;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_qr_url: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  seller?: {
    display_name: string;
  };
}

export default function AdminWithdrawals() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Verify admin status
  useEffect(() => {
    const verifyAdmin = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      const isAdmin = await verifyAdminApi();
      if (!isAdmin) {
        toast.error('Không có quyền truy cập');
        navigate('/');
        return;
      }

      setIsVerifiedAdmin(true);
    };

    if (!authLoading) {
      verifyAdmin();
    }
  }, [user, authLoading, navigate]);

  // Fetch withdrawal requests
  useEffect(() => {
    if (!isVerifiedAdmin) return;

    const fetchRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('withdrawal_requests')
          .select(`
            *,
            seller:sellers(display_name)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRequests(data || []);
      } catch (err) {
        console.error('Error fetching withdrawal requests:', err);
        toast.error('Không thể tải danh sách yêu cầu rút tiền');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [isVerifiedAdmin]);

  const handleProcess = async (approve: boolean) => {
    if (!selectedRequest || !user) return;

    setIsProcessing(true);
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('withdrawal_requests')
        .update({
          status: approve ? 'approved' : 'rejected',
          admin_note: adminNote || null,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // If approved, deduct from seller's balance
      if (approve) {
        const { data: sellerCoins } = await supabase
          .from('seller_coins')
          .select('id, balance')
          .eq('seller_id', selectedRequest.seller_id)
          .single();

        if (sellerCoins) {
          const newBalance = Math.max(0, sellerCoins.balance - selectedRequest.amount);
          await supabase
            .from('seller_coins')
            .update({ balance: newBalance })
            .eq('id', sellerCoins.id);
        }
      }

      toast.success(approve ? 'Đã duyệt yêu cầu rút tiền' : 'Đã từ chối yêu cầu rút tiền');
      
      // Refresh list
      setRequests(prev => prev.map(r => 
        r.id === selectedRequest.id 
          ? { ...r, status: approve ? 'approved' : 'rejected', admin_note: adminNote || null }
          : r
      ));
      
      setShowProcessDialog(false);
      setSelectedRequest(null);
      setAdminNote('');
    } catch (err) {
      console.error('Error processing withdrawal:', err);
      toast.error('Không thể xử lý yêu cầu');
    } finally {
      setIsProcessing(false);
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
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Chờ xử lý</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Đã duyệt</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Từ chối</Badge>;
      default:
        return null;
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

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
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Yêu cầu rút tiền</h1>
            <p className="text-sm text-muted-foreground">Quản lý yêu cầu rút tiền từ seller</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-500 mb-1">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Chờ xử lý</span>
            </div>
            <p className="text-2xl font-bold">{pendingRequests.length}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Banknote className="h-5 w-5" />
              <span className="text-sm font-medium">Tổng chờ duyệt</span>
            </div>
            <p className="text-2xl font-bold">
              {formatPrice(pendingRequests.reduce((sum, r) => sum + r.amount, 0))}
            </p>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="space-y-6">
          {pendingRequests.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Yêu cầu chờ xử lý ({pendingRequests.length})
              </h2>
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="glass rounded-xl p-4 border border-yellow-500/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.seller?.display_name || 'Seller'}</span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="text-sm space-y-1 text-muted-foreground">
                          <p>Ngân hàng: <span className="text-foreground">{request.bank_name}</span></p>
                          <p>Chủ TK: <span className="text-foreground">{request.bank_account_name}</span></p>
                          <p>Số TK: <span className="text-foreground font-mono">{request.bank_account_number}</span></p>
                          <p>Ngày yêu cầu: {new Date(request.created_at).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-2xl font-bold text-primary">{formatPrice(request.amount)}</p>
                        {request.bank_qr_url && (
                          <a href={request.bank_qr_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                            Xem QR
                          </a>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowProcessDialog(true);
                          }}
                        >
                          Xử lý
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processed Requests */}
          {processedRequests.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Đã xử lý ({processedRequests.length})</h2>
              <div className="space-y-3">
                {processedRequests.map((request) => (
                  <div key={request.id} className={`glass rounded-xl p-4 ${request.status === 'rejected' ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{request.seller?.display_name || 'Seller'}</span>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.bank_name} - {request.bank_account_number}
                        </p>
                        {request.admin_note && (
                          <p className="text-xs text-muted-foreground mt-1">Ghi chú: {request.admin_note}</p>
                        )}
                      </div>
                      <p className="font-bold">{formatPrice(request.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {requests.length === 0 && (
            <div className="text-center py-12">
              <Banknote className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Chưa có yêu cầu rút tiền</h3>
              <p className="text-muted-foreground">Khi seller gửi yêu cầu rút tiền, sẽ hiển thị ở đây</p>
            </div>
          )}
        </div>
      </div>

      {/* Process Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xử lý yêu cầu rút tiền</DialogTitle>
            <DialogDescription>
              Số tiền: {formatPrice(selectedRequest?.amount || 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Seller:</span> {selectedRequest?.seller?.display_name}</p>
              <p><span className="text-muted-foreground">Ngân hàng:</span> {selectedRequest?.bank_name}</p>
              <p><span className="text-muted-foreground">Chủ TK:</span> {selectedRequest?.bank_account_name}</p>
              <p><span className="text-muted-foreground">Số TK:</span> {selectedRequest?.bank_account_number}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ghi chú (tùy chọn)</label>
              <Textarea
                placeholder="Ghi chú cho seller..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleProcess(false)}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Từ chối
            </Button>
            <Button
              onClick={() => handleProcess(true)}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Duyệt & Đã chuyển tiền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
