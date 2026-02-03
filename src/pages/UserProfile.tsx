import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import {
  User, Mail, Lock, Store, Coins, Loader2,
  ArrowLeft, Edit2, Save, X, CheckCircle, AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserProfileData {
  display_name: string;
  email: string;
}

export default function UserProfile() {
  const { user, isAdmin, sellerProfile, refreshSellerProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userCoinBalance, setUserCoinBalance] = useState(0);
  const [showSellerRegistration, setShowSellerRegistration] = useState(false);
  const [registeringSeller, setRegisteringSeller] = useState(false);

  const [formData, setFormData] = useState({
    display_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUserCoinBalance();
    } else {
      navigate('/auth');
    }
  }, [user, navigate]);

  const fetchUserProfile = async () => {
    try {
      // Get user metadata and profile data
      const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
      const email = user?.email || '';

      setFormData({
        display_name: displayName,
        email: email,
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCoinBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('user_coins')
        .select('balance')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
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

  const handleSaveProfile = async () => {
    const trimmedDisplayName = formData.display_name.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedDisplayName) {
      toast.error('Vui lòng nhập tên hiển thị');
      return;
    }

    if (!trimmedEmail) {
      toast.error('Vui lòng nhập email hợp lệ');
      return;
    }

    setSaving(true);
    try {
      const updatePayload: {
        email?: string;
        password?: string;
        data: Record<string, string>;
      } = {
        data: { display_name: trimmedDisplayName }
      };

      if (trimmedEmail !== user?.email) {
        updatePayload.email = trimmedEmail;
      }

      // Update basic profile info (name/email)
      const { error } = await supabase.auth.updateUser(updatePayload);
      if (error) throw error;

      // If changing password
      if (formData.new_password) {
        if (formData.new_password !== formData.confirm_password) {
          toast.error('Mật khẩu xác nhận không khớp');
          setSaving(false);
          return;
        }

        if (formData.new_password.length < 6) {
          toast.error('Mật khẩu phải có ít nhất 6 ký tự');
          setSaving(false);
          return;
        }

        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.new_password
        });

        if (passwordError) throw passwordError;
      }

      toast.success(updatePayload.email ? 'Đã cập nhật hồ sơ! Vui lòng kiểm tra email để xác nhận thay đổi.' : 'Đã cập nhật hồ sơ!');
      setEditing(false);
      setFormData(prev => ({
        ...prev,
        display_name: trimmedDisplayName,
        email: trimmedEmail,
        current_password: '',
        new_password: '',
        confirm_password: '',
      }));
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Không thể cập nhật hồ sơ');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    fetchUserProfile(); // Reset form data
    setEditing(false);
  };

  const handleSellerRegistration = async () => {
    const SELLER_REGISTRATION_COST = 10;

    if (userCoinBalance < SELLER_REGISTRATION_COST) {
      toast.error(`Không đủ xu! Bạn cần ${SELLER_REGISTRATION_COST} xu để đăng ký seller.`);
      navigate('/buy-coins');
      return;
    }

    setRegisteringSeller(true);
    try {
      // Check if seller profile already exists
      const { data: existingSeller, error: checkError } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingSeller) {
        toast.error('Bạn đã đăng ký làm seller rồi!');
        setShowSellerRegistration(false);
        return;
      }

      // Check if user has enough coins
      const { data: userCoins, error: coinsError } = await supabase
        .from('user_coins')
        .select('balance')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (coinsError) {
        console.error('Error checking user coins:', coinsError);
        throw new Error('Không thể kiểm tra số dư xu');
      }

      if (!userCoins) {
        toast.error('Tài khoản chưa có số dư xu. Vui lòng nạp xu trước.');
        navigate('/buy-coins');
        return;
      }

      if (userCoins.balance < SELLER_REGISTRATION_COST) {
        toast.error(`Không đủ xu! Bạn cần ${SELLER_REGISTRATION_COST} xu để đăng ký seller.`);
        navigate('/buy-coins');
        return;
      }

      // Create seller profile first - try with minimal required fields
      const sellerData = {
        user_id: user?.id,
        display_name: formData.display_name || user?.email?.split('@')[0] || 'Seller',
      };

      console.log('Creating seller profile with data:', sellerData);

      const { error: sellerError } = await supabase
        .from('sellers')
        .insert(sellerData);

      if (sellerError) {
        console.error('Error creating seller profile:', sellerError);
        toast.error(`Lỗi tạo hồ sơ seller: ${sellerError.message}`);
        throw sellerError;
      }

      // Then deduct coins from user balance
      const { error: coinError } = await supabase
        .from('user_coins')
        .update({
          balance: userCoins.balance - SELLER_REGISTRATION_COST,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user?.id);

      if (coinError) throw coinError;

      // Update local balance
      setUserCoinBalance(prev => prev - SELLER_REGISTRATION_COST);

      toast.success(`Đăng ký seller thành công! Đã trừ ${SELLER_REGISTRATION_COST} xu.`);
      setShowSellerRegistration(false);

      // Refresh auth context to update seller status
      await refreshSellerProfile();

      // Redirect to seller setup
      navigate('/seller-setup');
    } catch (error: any) {
      console.error('Error registering seller:', error);
      toast.error('Không thể đăng ký seller. Vui lòng thử lại.');
    } finally {
      setRegisteringSeller(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isSeller = !!sellerProfile;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold">Hồ sơ của tôi</h1>
            <p className="text-sm text-muted-foreground">Quản lý thông tin cá nhân và tài khoản</p>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </Button>
          )}
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Status Card */}
          <Card className="glass border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{formData.display_name || 'Người dùng'}</h2>
                  <p className="text-sm text-muted-foreground">{formData.email}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {isAdmin && (
                    <Badge className="bg-red-500/20 text-red-500 border-red-500/50">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {isSeller && (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                      <Store className="h-3 w-3 mr-1" />
                      Seller
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-sm">
                    <Coins className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">{userCoinBalance} xu</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="glass border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Thông tin cá nhân
              </CardTitle>
              <CardDescription>
                Thông tin cơ bản của tài khoản
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
                      placeholder="Nhập tên hiển thị"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email đăng nhập *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Nhập email của bạn"
                    />
                    <p className="text-xs text-muted-foreground">
                      Hệ thống sẽ gửi email xác nhận khi bạn thay đổi địa chỉ đăng nhập.
                    </p>
                  </div>
                  <div className="border-t border-border pt-4">
                    <h4 className="font-medium mb-3">Đổi mật khẩu (tùy chọn)</h4>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="new_password">Mật khẩu mới</Label>
                        <Input
                          id="new_password"
                          type="password"
                          value={formData.new_password}
                          onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                          placeholder="Nhập mật khẩu mới"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm_password">Xác nhận mật khẩu mới</Label>
                        <Input
                          id="confirm_password"
                          type="password"
                          value={formData.confirm_password}
                          onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                          placeholder="Nhập lại mật khẩu mới"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tên hiển thị</p>
                      <p className="font-medium">{formData.display_name || 'Chưa cập nhật'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{formData.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Mật khẩu</p>
                      <p className="font-medium">••••••••</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Seller Registration */}
          {isSeller ? (
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Store className="h-5 w-5" />
                  Bạn đã đăng ký Seller
                </CardTitle>
                <CardDescription>
                  Bạn có thể truy cập khu vực Seller để đăng bài và quản lý sản phẩm.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex flex-col gap-2">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Chúc mừng! Tài khoản của bạn đã trở thành Seller. Tiếp tục đăng tải sản phẩm để kiếm thêm thu nhập.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => navigate('/seller-accounts')}
                  >
                    <Store className="h-4 w-4 mr-2" />
                    Đi đến khu vực đăng sản phẩm
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            !isAdmin && (
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-primary" />
                    Trở thành Seller
                  </CardTitle>
                  <CardDescription>
                    Đăng ký làm người bán để có thể đăng tải sản phẩm trên Bonz Shop
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Coins className="h-6 w-6 text-orange-500" />
                      <div>
                        <p className="font-medium text-orange-600">Phí đăng ký: 10 xu</p>
                        <p className="text-sm text-muted-foreground">Một lần duy nhất</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Quyền lợi khi trở thành Seller:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                      <li>• Đăng bán tài khoản game/dịch vụ</li>
                      <li>• Quản lý sản phẩm của mình</li>
                      <li>• Nhận thanh toán trực tiếp</li>
                      <li>• Không thấy sản phẩm của seller khác</li>
                    </ul>
                    <Button
                      onClick={() => setShowSellerRegistration(true)}
                      className="w-full"
                      variant="gradient"
                    >
                      <Store className="h-4 w-4 mr-2" />
                      Đăng ký làm Seller
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* Edit Actions */}
          {editing && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Hủy
              </Button>
              <Button variant="gradient" className="flex-1" onClick={handleSaveProfile} disabled={saving}>
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
        </div>
      </div>

      {/* Seller Registration Confirmation Dialog */}
      <Dialog open={showSellerRegistration} onOpenChange={setShowSellerRegistration}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Xác nhận đăng ký Seller
            </DialogTitle>
            <DialogDescription>
              Bạn muốn trở thành Seller với chi phí 10 xu?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <div className="flex justify-between px-2 mb-2">
                <div className="text-sm text-muted-foreground">Phí đăng ký:</div>
                <div className="font-medium">10 xu</div>
              </div>
              <div className="flex justify-between px-2 mb-2">
                <div className="text-sm text-muted-foreground">Số dư hiện tại:</div>
                <div className="font-medium">{userCoinBalance} xu</div>
              </div>
              <div className="flex justify-between px-2">
                <div className="text-sm text-muted-foreground">Số dư sau đăng ký:</div>
                <div className="font-medium">{userCoinBalance - 10} xu</div>
              </div>
            </div>

            {userCoinBalance < 10 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Bạn không đủ xu để đăng ký seller. Vui lòng nạp thêm xu.
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-600">
              Sau khi đăng ký, bạn sẽ được chuyển đến trang thiết lập hồ sơ seller.
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSellerRegistration(false)} className="w-full sm:w-auto">
              Hủy
            </Button>
            {userCoinBalance >= 10 ? (
              <Button
                onClick={handleSellerRegistration}
                disabled={registeringSeller}
                className="w-full sm:w-auto"
              >
                {registeringSeller ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Xác nhận đăng ký
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setShowSellerRegistration(false);
                  navigate('/buy-coins');
                }}
                className="w-full sm:w-auto"
              >
                <Coins className="h-4 w-4 mr-2" />
                Nạp xu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
