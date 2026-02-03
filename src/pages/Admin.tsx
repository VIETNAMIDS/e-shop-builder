import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit, Save, X, Loader2, Users, FolderOpen, Gift, User, ShoppingCart, Store, Coins, Package, Upload, FileText } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { adminProductsApi, verifyAdminApi } from '@/hooks/useAdminApi';

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  is_free: boolean;
  category: string;
  image_url: string | null;
  tech_stack: string[] | null;
  download_url: string | null;
  seller_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Seller {
  id: string;
  display_name: string;
  bank_name: string | null;
  bank_account_number: string | null;
}

// Super admin email - can see all products
const SUPER_ADMIN_EMAIL = 'adminvip@gmail.com';

export default function Admin() {
  const { user, isLoading: authLoading, needsSellerSetup, sellerProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [quickMode, setQuickMode] = useState(true);
  const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
  const [currentSellerId, setCurrentSellerId] = useState<string | null>(null);
  
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    is_free: true,
    category: '',
    image_url: '',
    tech_stack: '',
    download_url: '',
    seller_id: '',
  });

  // Verify admin status via backend - SECURE
  useEffect(() => {
    const verifyAdmin = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      const isAdmin = await verifyAdminApi();
      if (!isAdmin) {
        toast({
          title: 'Không có quyền truy cập',
          description: 'Bạn không có quyền admin',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Check if admin needs to complete seller profile
      if (needsSellerSetup) {
        navigate('/seller-setup');
        return;
      }

      setIsVerifiedAdmin(true);
    };

    if (!authLoading) {
      verifyAdmin();
    }
  }, [user, authLoading, needsSellerSetup, navigate, toast]);

  useEffect(() => {
    if (isVerifiedAdmin && user) {
      fetchCurrentSeller();
      fetchProducts();
      fetchCategories();
      fetchSellers();
    }
  }, [isVerifiedAdmin, user]);

  const fetchCurrentSeller = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setCurrentSellerId(data.id);
      }
    } catch (err) {
      console.error('Error fetching current seller:', err);
    }
  };

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select('id, display_name, bank_name, bank_account_number')
        .eq('is_profile_complete', true)
        .order('display_name');

      if (error) throw error;
      setSellers(data || []);
    } catch (err) {
      console.error('Error fetching sellers:', err);
    }
  };

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

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      // Non-super admins only see their own products
      if (!isSuperAdmin && currentSellerId) {
        query = query.eq('seller_id', currentSellerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch when currentSellerId changes (for filtering)
  useEffect(() => {
    if (isVerifiedAdmin && currentSellerId !== null) {
      fetchProducts();
    }
  }, [currentSellerId, isSuperAdmin]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      is_free: true,
      category: categories[0]?.name || '',
      image_url: '',
      tech_stack: '',
      download_url: '',
      seller_id: '',
    });
    setEditingProduct(null);
    setShowForm(false);
    setQuickMode(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setQuickMode(false);
    setFormData({
      title: product.title,
      description: product.description || '',
      price: product.price.toString(),
      is_free: product.is_free,
      category: product.category,
      image_url: product.image_url || '',
      tech_stack: product.tech_stack?.join(', ') || '',
      download_url: product.download_url || '',
      seller_id: product.seller_id || '',
    });
    setShowForm(true);
  };

  // Use backend API for all mutations - SECURE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Validate seller selection for Premium products
      if (!formData.is_free && !formData.seller_id) {
        toast({
          title: 'Lỗi',
          description: 'Vui lòng chọn người đăng cho sản phẩm Premium',
          variant: 'destructive',
        });
        setIsSaving(false);
        return;
      }

      const productData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        price: formData.is_free ? '0' : formData.price,
        is_free: formData.is_free,
        category: formData.category,
        image_url: formData.image_url.trim() || undefined,
        tech_stack: formData.tech_stack
          ? formData.tech_stack.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        download_url: formData.download_url.trim() || undefined,
        seller_id: formData.is_free ? undefined : formData.seller_id || undefined,
      };

      if (editingProduct) {
        await adminProductsApi.update(editingProduct.id, productData);
        toast({ title: 'Cập nhật thành công!' });
      } else {
        await adminProductsApi.create(productData);
        toast({ title: 'Thêm sản phẩm thành công!' });
      }

      resetForm();
      fetchProducts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      toast({
        title: 'Lỗi',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Use backend API for delete - SECURE
  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;

    try {
      await adminProductsApi.delete(id);
      toast({ title: 'Đã xóa sản phẩm' });
      fetchProducts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      toast({
        title: 'Lỗi khi xóa',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

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
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Quản lý sản phẩm</h1>
              <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>

          {/* Action buttons - Stacked on mobile */}
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Link to="/admin/categories" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <FolderOpen className="h-4 w-4" />
                Danh mục
              </Button>
            </Link>
            <Link to="/admin/users" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                Người dùng
              </Button>
            </Link>
            <Link to="/admin/accounts" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <User className="h-4 w-4" />
                Up Acc
              </Button>
            </Link>
            <Link to="/admin/posts" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                Bài viết
              </Button>
            </Link>
            <Link to="/admin/orders" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <ShoppingCart className="h-4 w-4" />
                Đơn hàng
              </Button>
            </Link>
            <Link to="/admin/coin-purchases" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <Coins className="h-4 w-4" />
                Nạp xu
              </Button>
            </Link>
            <Link to="/admin/withdrawals" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <Coins className="h-4 w-4" />
                Rút tiền
              </Button>
            </Link>
            <Link to="/seller-profile" className="contents">
              <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                <Store className="h-4 w-4" />
                Hồ sơ
              </Button>
            </Link>
            {sellerProfile && (
              <>
                <Link to="/seller-accounts" className="contents">
                  <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                    <Upload className="h-4 w-4" />
                    Sản phẩm
                  </Button>
                </Link>
                <Link to="/seller-orders" className="contents">
                  <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm">
                    <Package className="h-4 w-4" />
                    Đơn hàng
                  </Button>
                </Link>
              </>
            )}
            <Button
              variant="gradient"
              size="sm"
              className="col-span-2 sm:col-span-1 gap-2"
              onClick={() => {
                setQuickMode(true);
                setFormData(prev => ({ ...prev, is_free: true }));
                setShowForm(true);
              }}
            >
              <Gift className="h-4 w-4" />
              Thêm FREE
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="col-span-2 sm:col-span-1 gap-2"
              onClick={() => {
                setQuickMode(false);
                setFormData(prev => ({ ...prev, is_free: false }));
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Thêm Premium
            </Button>
          </div>
        </div>

        {/* Form Modal - Mobile Optimized */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="glass rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  {formData.is_free && <Gift className="h-5 w-5 text-green-500" />}
                  {editingProduct ? 'Chỉnh sửa' : formData.is_free ? 'Thêm sản phẩm FREE' : 'Thêm sản phẩm'}
                </h2>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tên sản phẩm */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tên sản phẩm *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="VD: Landing Page Template"
                    required
                    className="h-12"
                  />
                </div>

                {/* Link tải - Quan trọng nhất cho sản phẩm free */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Link tải xuống</label>
                  <Input
                    value={formData.download_url}
                    onChange={(e) => setFormData({ ...formData, download_url: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="h-12"
                  />
                </div>

                {/* Danh mục */}
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

                {/* Chế độ nâng cao */}
                {!quickMode && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Mô tả</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Mô tả ngắn..."
                        rows={2}
                        className="flex w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>

                    {!formData.is_free && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Người đăng (Seller) *</label>
                          <select
                            value={formData.seller_id}
                            onChange={(e) => setFormData({ ...formData, seller_id: e.target.value })}
                            className="flex h-12 w-full rounded-lg border border-border bg-secondary px-4 py-2 text-foreground focus:ring-2 focus:ring-primary"
                            required
                          >
                            <option value="">-- Chọn người đăng --</option>
                            {sellers.map((seller) => (
                              <option key={seller.id} value={seller.id}>
                                {seller.display_name} - {seller.bank_name || 'Chưa có NH'} ({seller.bank_account_number || 'N/A'})
                              </option>
                            ))}
                          </select>

                          {/* Hiển thị TK ngân hàng sau khi chọn */}
                          {formData.seller_id ? (() => {
                            const selected = sellers.find((s) => s.id === formData.seller_id);
                            if (!selected) return null;
                            return (
                              <div className="mt-2 grid gap-2">
                                <div className="grid gap-1">
                                  <span className="text-xs text-muted-foreground">Ngân hàng</span>
                                  <Input value={selected.bank_name || ''} readOnly className="h-11" />
                                </div>
                                <div className="grid gap-1">
                                  <span className="text-xs text-muted-foreground">Số tài khoản</span>
                                  <Input value={selected.bank_account_number || ''} readOnly className="h-11" />
                                </div>
                              </div>
                            );
                          })() : null}

                          {sellers.length === 0 && (
                            <p className="text-xs text-destructive">Chưa có seller nào hoàn tất hồ sơ. Vui lòng cập nhật hồ sơ trước.</p>
                          )}
                        </div>

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
                      </>
                    )}

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
                )}

                {quickMode && !editingProduct && (
                  <button
                    type="button"
                    onClick={() => setQuickMode(false)}
                    className="text-sm text-primary hover:underline"
                  >
                    + Thêm mô tả, hình ảnh, tech stack...
                  </button>
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
                        {editingProduct ? 'Cập nhật' : 'Thêm'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Products List - Mobile Cards */}
        <div className="space-y-3">
          {products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Chưa có sản phẩm nào
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="glass rounded-xl p-4 flex items-center gap-3"
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="h-14 w-14 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Gift className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                    {product.is_free ? (
                      <Badge className="badge-free text-xs">FREE</Badge>
                    ) : (
                      <span className="text-xs text-primary font-mono">{formatPrice(product.price)}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleEdit(product)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
