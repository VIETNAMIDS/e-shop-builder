import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { 
  Store, Building2, CreditCard, User, Phone, Loader2, 
  ArrowLeft, Edit2, Save, X, CheckCircle, AlertCircle 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SellerData {
  id: string;
  user_id: string;
  display_name: string;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_profile_complete: boolean;
  created_at: string;
}

export default function SellerProfile() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sellerData, setSellerData] = useState<SellerData | null>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    phone: '',
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      if (!isAdmin) {
        navigate('/');
        return;
      }
      fetchSellerProfile();
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchSellerProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No seller profile exists, redirect to setup
          navigate('/seller-setup');
          return;
        }
        throw error;
      }

      setSellerData(data);
      setFormData({
        display_name: data.display_name || '',
        bank_name: data.bank_name || '',
        bank_account_name: data.bank_account_name || '',
        bank_account_number: data.bank_account_number || '',
        phone: data.phone || '',
      });
    } catch (error) {
      console.error('Error fetching seller profile:', error);
      toast.error('Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      toast.error('Vui lòng nhập tên hiển thị');
      return;
    }

    if (!formData.bank_name.trim() || !formData.bank_account_name.trim() || !formData.bank_account_number.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin ngân hàng');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sellers')
        .update({
          display_name: formData.display_name.trim(),
          bank_name: formData.bank_name.trim(),
          bank_account_name: formData.bank_account_name.trim(),
          bank_account_number: formData.bank_account_number.trim(),
          phone: formData.phone.trim() || null,
          is_profile_complete: true,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Đã cập nhật hồ sơ!');
      setEditing(false);
      fetchSellerProfile();
    } catch (error: any) {
      console.error('Error updating seller profile:', error);
      toast.error('Không thể cập nhật hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (sellerData) {
      setFormData({
        display_name: sellerData.display_name || '',
        bank_name: sellerData.bank_name || '',
        bank_account_name: sellerData.bank_account_name || '',
        bank_account_number: sellerData.bank_account_number || '',
        phone: sellerData.phone || '',
      });
    }
    setEditing(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold">Hồ sơ người bán</h1>
            <p className="text-sm text-muted-foreground">Quản lý thông tin shop của bạn</p>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </Button>
          )}
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Profile Status Card */}
          <Card className="glass border-border/50 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Store className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{sellerData?.display_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Tham gia từ {new Date(sellerData?.created_at || '').toLocaleDateString('vi-VN')}
                  </p>
                </div>
                {sellerData?.is_profile_complete ? (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Đã xác thực
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Chưa hoàn tất
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profile Details */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Thông tin cơ bản
              </CardTitle>
              <CardDescription>
                Thông tin này sẽ được hiển thị cho người mua
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Tên hiển thị *</Label>
                    <Input
                      id="display_name"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="Tên shop của bạn"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="0912345678"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tên hiển thị</p>
                      <p className="font-medium">{sellerData?.display_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Số điện thoại</p>
                      <p className="font-medium">{sellerData?.phone || 'Chưa cập nhật'}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card className="glass border-border/50 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Thông tin thanh toán
              </CardTitle>
              <CardDescription>
                Thông tin ngân hàng để nhận tiền khi có đơn hàng
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Tên ngân hàng *</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="VD: MB Bank, Vietcombank..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_name">Tên chủ tài khoản *</Label>
                    <Input
                      id="bank_account_name"
                      value={formData.bank_account_name}
                      onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                      placeholder="NGUYEN VAN A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Số tài khoản *</Label>
                    <Input
                      id="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Ngân hàng</p>
                      <p className="font-medium">{sellerData?.bank_name || 'Chưa cập nhật'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Chủ tài khoản</p>
                      <p className="font-medium">{sellerData?.bank_account_name || 'Chưa cập nhật'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Số tài khoản</p>
                      <p className="font-medium font-mono">{sellerData?.bank_account_number || 'Chưa cập nhật'}</p>
                    </div>
                  </div>
                </>
              )}

              {editing && (
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Hủy
                  </Button>
                  <Button variant="gradient" className="flex-1" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Lưu thay đổi
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
