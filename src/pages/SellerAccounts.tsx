import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Loader2, User, Eye, EyeOff, CheckCircle, XCircle, Gift } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { adminAccountsApi } from '@/hooks/useAdminApi';

interface Account {
  id: string;
  title: string;
  description: string | null;
  account_username: string;
  account_password: string;
  account_email: string | null;
  account_phone: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_sold: boolean;
  seller_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function SellerAccounts() {
  const { user, sellerProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    account_username: '',
    account_password: '',
    account_email: '',
    account_phone: '',
    price: '',
    is_product: false,
    is_free: false,
    category: '',
    image_url: '',
    tech_stack: '',
    download_url: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!sellerProfile) {
      navigate('/user-profile');
      return;
    }

    fetchAccounts();
    fetchCategories();
  }, [user, sellerProfile, navigate]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
      if (data && data.length > 0 && !formData.category) {
        setFormData(prev => ({ ...prev, category: data[0].name }));
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchAccounts = async () => {
    if (!sellerProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, title, description, account_username, account_password, account_email, account_phone, price, category, image_url, is_sold, seller_id')
        .eq('seller_id', sellerProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách tài khoản',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      account_username: '',
      account_password: '',
      account_email: '',
      account_phone: '',
      price: '',
      is_product: false,
      is_free: false,
      category: categories[0]?.name || '',
      image_url: '',
      tech_stack: '',
      download_url: '',
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  const handleEdit = async (account: Account) => {
    try {
      // Get full details including sensitive info via secure API
      const details = await adminAccountsApi.getDetails(account.id);
      setEditingAccount(details);
      setFormData({
        title: details.title,
        description: details.description || '',
        account_username: details.account_username,
        account_password: details.account_password,
        account_email: details.account_email || '',
        account_phone: details.account_phone || '',
        price: details.price.toString(),
        category: details.category,
        image_url: details.image_url || '',
        is_product: false,
        is_free: false,
        tech_stack: '',
        download_url: '',
      });
      setShowForm(true);
    } catch (err) {
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thông tin tài khoản',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // If in product mode -> create/update product (seller can create products)
      if ((formData as any).is_product) {
        const productData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          price: formData.is_free ? 0 : parseFloat(formData.price) || 0,
          is_free: !!formData.is_free,
          category: formData.category,
          image_url: formData.image_url.trim() || null,
          tech_stack: formData.tech_stack
            ? formData.tech_stack.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
          download_url: (formData as any).download_url?.trim() || null,
          seller_id: sellerProfile?.id,
          created_by: user?.id ?? null,
        };

        try {
          const { error } = await supabase.from('products').insert(productData);
          if (error) throw error;
          toast({ title: 'Thêm sản phẩm thành công!' });
        } catch (err) {
          console.error('Unexpected error creating product as seller:', err);
          const detail =
            err && typeof err === 'object'
              ? (err as any).message || (err as any).error || JSON.stringify(err)
              : String(err);
          toast({
            title: 'Lỗi khi xử lý sản phẩm',
            description: detail,
            variant: 'destructive',
          });
          return;
        }
      } else {
        const accountData = {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          account_username: formData.account_username.trim(),
          account_password: formData.account_password,
          account_email: formData.account_email.trim() || undefined,
          account_phone: formData.account_phone.trim() || undefined,
          price: formData.is_free ? 0 : (parseFloat(formData.price) || 0),
          is_free: formData.is_free,
          category: formData.category,
          image_url: formData.image_url.trim() || undefined,
          seller_id: sellerProfile?.id,
          created_by: user?.id,
        };

        try {
          if (editingAccount) {
            const { error } = await supabase
              .from('accounts')
              .update(accountData)
              .eq('id', editingAccount.id);

            if (error) {
              throw error;
            }
            toast({ title: 'Cập nhật thành công!' });
          } else {
            const { data, error } = await supabase
              .from('accounts')
              .insert(accountData)
              .select('id')
              .single();

            if (error) {
              throw error;
            }
            toast({ title: 'Upload tài khoản thành công!' });
          }
        } catch (err) {
          console.error('Supabase error creating/updating account as seller:', err);
          const detail =
            err && typeof err === 'object'
              ? (err as any).message || (err as any).error || JSON.stringify(err)
              : String(err);
          toast({
            title: 'Lỗi khi xử lý tài khoản',
            description: detail,
            variant: 'destructive',
          });
          return;
        }
      }

      resetForm();
      fetchAccounts();
    } catch (err: unknown) {
      let message = 'Lỗi không xác định';
      if (err && typeof err === 'object') {
        // supabase returns plain objects, try to extract useful info
        message = (err as any).message || (err as any).error || JSON.stringify(err);
      } else if (typeof err === 'string') {
        message = err;
      } else if (err instanceof Error) {
        message = err.message;
      }

      console.error('Submit error:', err);
      toast({
        title: 'Lỗi',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;

    try {
      await adminAccountsApi.delete(id);
      toast({ title: 'Đã xóa tài khoản' });
      fetchAccounts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      toast({
        title: 'Lỗi khi xóa',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleMarkSold = async (id: string, isSold: boolean) => {
    try {
      await adminAccountsApi.markAsSold(id, isSold);
      toast({ title: isSold ? 'Đã đánh dấu đã bán' : 'Đã hủy trạng thái bán' });
      fetchAccounts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      toast({
        title: 'Lỗi',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const maskPassword = (password: string) => {
    return '•'.repeat(Math.min(password.length, 12));
  };

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
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/user-profile')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Quản lý sản phẩm</h1>
              <p className="text-sm text-muted-foreground">Upload và quản lý tài khoản / sản phẩm của bạn</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFormData(prev => ({ ...prev, is_product: false }));
                setEditingAccount(null);
                setShowForm(true);
              }}
            >
              Upload tài khoản
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => {
                setFormData(prev => ({ ...prev, is_product: true }));
                setEditingAccount(null);
                setShowForm(true);
              }}
            >
              Thêm Premium (Upload sản phẩm)
            </Button>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="glass rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  {editingAccount ? 'Chỉnh sửa tài khoản' : 'Upload tài khoản mới'}
                </h2>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tiêu đề *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Tên sản phẩm hoặc tiêu đề tài khoản"
                    required
                    className="h-12"
                  />
                </div>

                {/* If product mode (Premium upload) show product fields, else show account fields */}
                {formData.is_product ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Link tải xuống *</label>
                      <Input
                        value={formData.download_url}
                        onChange={(e) => setFormData({ ...formData, download_url: e.target.value })}
                        placeholder="https://drive.google.com/..."
                        required
                        className="h-12"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Giá (VNĐ)</label>
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="100000"
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Danh mục</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="flex h-12 w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground focus:ring-2 focus:ring-primary"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <input
                        type="checkbox"
                        id="is_free"
                        checked={formData.is_free}
                        onChange={(e) =>
                          setFormData({ ...formData, is_free: e.target.checked, price: e.target.checked ? '0' : formData.price })
                        }
                        className="h-5 w-5 rounded border-border bg-secondary text-primary focus:ring-primary"
                      />
                      <label htmlFor="is_free" className="text-sm font-medium flex items-center gap-2">
                        <Gift className="h-4 w-4 text-green-500" />
                        Miễn phí
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Tech Stack</label>
                      <Input
                        value={formData.tech_stack}
                        onChange={(e) => setFormData({ ...formData, tech_stack: e.target.value })}
                        placeholder="React, Tailwind..."
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">URL Hình ảnh</label>
                      <Input
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://..."
                        className="h-12"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tên đăng nhập *</label>
                        <Input
                          value={formData.account_username}
                          onChange={(e) => setFormData({ ...formData, account_username: e.target.value })}
                          placeholder="username"
                          required
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Mật khẩu *</label>
                        <Input
                          value={formData.account_password}
                          onChange={(e) => setFormData({ ...formData, account_password: e.target.value })}
                          placeholder="••••••••"
                          required
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Email TK</label>
                        <Input
                          type="email"
                          value={formData.account_email}
                          onChange={(e) => setFormData({ ...formData, account_email: e.target.value })}
                          placeholder="email@example.com"
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">SĐT TK</label>
                        <Input
                          value={formData.account_phone}
                          onChange={(e) => setFormData({ ...formData, account_phone: e.target.value })}
                          placeholder="0123456789"
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <input
                        type="checkbox"
                        id="is_free_account"
                        checked={formData.is_free}
                        onChange={(e) =>
                          setFormData({ ...formData, is_free: e.target.checked, price: e.target.checked ? '0' : formData.price })
                        }
                        className="h-5 w-5 rounded border-border bg-secondary text-primary focus:ring-primary"
                      />
                      <label htmlFor="is_free_account" className="text-sm font-medium flex items-center gap-2">
                        <Gift className="h-4 w-4 text-green-500" />
                        Miễn phí (cho tặng)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Giá (VNĐ) {!formData.is_free && '*'}</label>
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="100000"
                          required={!formData.is_free}
                          disabled={formData.is_free}
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Danh mục</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="flex h-12 w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground focus:ring-2 focus:ring-primary"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">URL Hình ảnh</label>
                      <Input
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://..."
                        className="h-12"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1 h-12">
                    Hủy
                  </Button>
                  <Button type="submit" variant="gradient" className="flex-1 h-12" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-2" />
                        {editingAccount ? 'Cập nhật' : formData.is_product ? 'Thêm sản phẩm' : 'Upload'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Accounts List */}
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Chưa có sản phẩm nào</h3>
              <p className="mb-4">Hãy upload tài khoản đầu tiên của bạn</p>
              <Button onClick={() => setShowForm(true)} variant="gradient">
                <Plus className="h-4 w-4 mr-2" />
                Upload tài khoản đầu tiên
              </Button>
            </div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className={`glass rounded-xl p-4 ${account.is_sold ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {account.image_url ? (
                    <img
                      src={account.image_url}
                      alt={account.title}
                      className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{account.title}</p>
                      {account.is_sold && (
                        <Badge variant="destructive" className="text-xs">ĐÃ BÁN</Badge>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">TK:</span>
                        <code className="bg-secondary px-2 py-0.5 rounded text-xs">{account.account_username}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">MK:</span>
                        <code className="bg-secondary px-2 py-0.5 rounded text-xs font-mono">
                          {visiblePasswords.has(account.id) ? account.account_password : maskPassword(account.account_password)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePasswordVisibility(account.id)}
                        >
                          {visiblePasswords.has(account.id) ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      {account.account_email && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="text-xs truncate">{account.account_email}</span>
                        </div>
                      )}
                      {account.account_phone && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">SĐT:</span>
                          <span className="text-xs">{account.account_phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{account.category}</Badge>
                      <span className="text-sm text-primary font-bold">{formatPrice(account.price)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button
                      variant={account.is_sold ? "outline" : "default"}
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => handleMarkSold(account.id, !account.is_sold)}
                    >
                      {account.is_sold ? (
                        <>
                          <XCircle className="h-3 w-3" />
                          Hủy bán
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          Đã bán
                        </>
                      )}
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(account)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
