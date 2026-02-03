import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Coins, Loader2, CheckCircle, XCircle, Clock, 
  ArrowLeft, Eye, Search, User, ExternalLink 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CoinPurchase {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  receipt_url: string;
  admin_note: string | null;
  created_at: string;
}

export default function AdminCoinPurchases() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<CoinPurchase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPurchase, setSelectedPurchase] = useState<CoinPurchase | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchPurchases();
  }, [user, isAdmin]);

  const fetchPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('coin_purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Không thể tải danh sách');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPurchase) return;
    
    setProcessing(true);
    try {
      // Update purchase status
      const { error: updateError } = await supabase
        .from('coin_purchases')
        .update({
          status: 'approved',
          admin_note: adminNote || null,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedPurchase.id);

      if (updateError) throw updateError;

      // Check if user has coins record
      const { data: existingCoins } = await supabase
        .from('user_coins')
        .select('id, balance')
        .eq('user_id', selectedPurchase.user_id)
        .single();

      if (existingCoins) {
        // Update balance
        const { error: coinError } = await supabase
          .from('user_coins')
          .update({ balance: existingCoins.balance + selectedPurchase.amount })
          .eq('id', existingCoins.id);

        if (coinError) throw coinError;
      } else {
        // Create new coins record
        const { error: insertError } = await supabase
          .from('user_coins')
          .insert({
            user_id: selectedPurchase.user_id,
            balance: selectedPurchase.amount
          });

        if (insertError) throw insertError;
      }

      toast.success(`Đã duyệt +${selectedPurchase.amount} xu`);
      setSelectedPurchase(null);
      setAdminNote('');
      fetchPurchases();
    } catch (error: any) {
      console.error('Error approving:', error);
      toast.error('Không thể duyệt yêu cầu');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPurchase) return;
    
    if (!adminNote.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('coin_purchases')
        .update({
          status: 'rejected',
          admin_note: adminNote,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', selectedPurchase.id);

      if (error) throw error;

      toast.success('Đã từ chối yêu cầu');
      setSelectedPurchase(null);
      setAdminNote('');
      fetchPurchases();
    } catch (error: any) {
      console.error('Error rejecting:', error);
      toast.error('Không thể từ chối yêu cầu');
    } finally {
      setProcessing(false);
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

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = purchases.filter(p => p.status === 'pending').length;

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
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coins className="h-6 w-6 text-primary" />
              Quản lý nạp xu
              {pendingCount > 0 && (
                <Badge variant="destructive">{pendingCount} chờ duyệt</Badge>
              )}
            </h1>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass border-border/50 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo User ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  Tất cả
                </Button>
                <Button
                  variant={filterStatus === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('pending')}
                >
                  Chờ duyệt
                </Button>
                <Button
                  variant={filterStatus === 'approved' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('approved')}
                >
                  Đã duyệt
                </Button>
                <Button
                  variant={filterStatus === 'rejected' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('rejected')}
                >
                  Từ chối
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchases List */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle>Danh sách yêu cầu ({filteredPurchases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Không có yêu cầu nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPurchases.map((purchase) => (
                  <div 
                    key={purchase.id}
                    className="p-4 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-mono text-muted-foreground">
                            {purchase.user_id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-primary">{purchase.amount} xu</span>
                          {getStatusBadge(purchase.status)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(purchase.created_at).toLocaleString('vi-VN')}
                        </div>
                        {purchase.admin_note && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ghi chú: {purchase.admin_note}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewImage(purchase.receipt_url)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Xem bill
                        </Button>
                        {purchase.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedPurchase(purchase)}
                          >
                            Xử lý
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Process Dialog */}
      <Dialog open={!!selectedPurchase} onOpenChange={() => setSelectedPurchase(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xử lý yêu cầu nạp xu</DialogTitle>
          </DialogHeader>
          
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="text-sm text-muted-foreground mb-2">Số xu yêu cầu:</p>
                <p className="text-2xl font-bold text-primary">{selectedPurchase.amount} xu</p>
                <p className="text-xs text-muted-foreground mt-1">
                  = {(selectedPurchase.amount * 1000).toLocaleString('vi-VN')} VNĐ
                </p>
              </div>

              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPreviewImage(selectedPurchase.receipt_url)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Xem bill chuyển khoản
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNote">Ghi chú (bắt buộc khi từ chối)</Label>
                <Textarea
                  id="adminNote"
                  placeholder="Nhập ghi chú..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Từ chối
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Duyệt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bill chuyển khoản</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative">
              <img 
                src={previewImage} 
                alt="Receipt" 
                className="w-full rounded-lg"
              />
              <a 
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-2 right-2"
              >
                <Button variant="secondary" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Mở tab mới
                </Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
