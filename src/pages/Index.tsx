import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Code2, Search, Filter, Sparkles, ShoppingCart, QrCode, CheckCircle, Loader2, Clock, XCircle, Download, TrendingUp, Users, Package, Star, ArrowRight, Zap, Shield, Rocket } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Seller {
  id: string;
  display_name: string;
  avatar_url?: string | null;
}

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
  seller?: Seller | null;
}

interface Category {
  id: string;
  name: string;
}

interface Stats {
  totalProducts: number;
  totalUsers: number;
  totalOrders: number;
}

const filters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'free', label: 'Miễn phí' },
  { id: 'premium', label: 'Premium' },
];

const features = [
  {
    icon: Zap,
    title: 'Nhanh chóng',
    description: 'Mua và nhận sản phẩm ngay lập tức'
  },
  {
    icon: Shield,
    title: 'An toàn',
    description: 'Bảo mật thông tin tuyệt đối'
  },
  {
    icon: Rocket,
    title: 'Chất lượng',
    description: 'Source code được kiểm duyệt kỹ'
  }
];

export default function Index() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalUsers: 0, totalOrders: 0 });

  // Payment modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'vnd' | 'coin'>('vnd');
  const [userCoinBalance, setUserCoinBalance] = useState(0);
  const [showCoinConfirm, setShowCoinConfirm] = useState(false);
  const [pendingCoinProduct, setPendingCoinProduct] = useState<Product | null>(null);
  const [pendingCoinRequired, setPendingCoinRequired] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchCategories();
      fetchUserCoinBalance();
      fetchStats();
    }
  }, [user]);

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory, selectedFilter]);

  const fetchStats = async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'approved')
      ]);
      
      setStats({
        totalProducts: productsRes.count || 0,
        totalUsers: 1000, // Placeholder
        totalOrders: ordersRes.count || 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
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
    } catch (err) {
      console.error('Error fetching categories:', err);
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

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          seller:sellers_public(id, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const productsData = (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        is_free: p.is_free,
        category: p.category,
        image_url: p.image_url,
        tech_stack: p.tech_stack,
        download_url: p.download_url,
        seller: p.seller,
      }));
      setProducts(productsData);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterProducts = () => {
    let result = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (selectedFilter === 'free') {
      result = result.filter((p) => p.is_free);
    } else if (selectedFilter === 'premium') {
      result = result.filter((p) => !p.is_free);
    }

    setFilteredProducts(result);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const handlePurchase = async (product: Product) => {
    if (product.is_free && product.download_url) {
      window.open(product.download_url, '_blank');
      toast.success(`Đang tải "${product.title}"`);
      return;
    }

    if (product.is_free) {
      toast.info('Sản phẩm miễn phí nhưng chưa có link tải');
      return;
    }

    const requiredCoin = Math.ceil(product.price / 1000);
    await handleBuyProductWithCoin({ ...product });
  };

  const handleBuyProductWithCoin = async (product: Product) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để mua bằng xu');
      navigate('/auth');
      return;
    }

    const requiredCoin = Math.ceil(product.price / 1000);
    setPendingCoinProduct(product);
    setPendingCoinRequired(requiredCoin);
    setShowCoinConfirm(true);
  };

  const performBuyProductWithCoin = async (product: Product, requiredCoin: number) => {
    setSubmittingPayment(true);
    try {
      const { error: coinError } = await supabase
        .from('user_coins')
        .update({
          balance: userCoinBalance - requiredCoin,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (coinError) throw coinError;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          product_id: product.id,
          amount: requiredCoin,
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .select()
        .single();

      if (orderError) throw orderError;

      setUserCoinBalance(prev => prev - requiredCoin);
      toast.success('Mua thành công bằng xu! Vui lòng vào Đơn hàng để tải xuống.');
      navigate('/my-orders');
    } catch (err) {
      console.error('Error buying with coin:', err);
      toast.error('Không thể mua bằng xu, vui lòng thử lại');
    } finally {
      setSubmittingPayment(false);
      setShowCoinConfirm(false);
      setPendingCoinProduct(null);
      setPendingCoinRequired(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative">
          <Code2 className="h-16 w-16 text-primary animate-pulse-glow" />
          <div className="absolute inset-0 bg-primary/20 blur-2xl" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section - New Design */}
      <section className="relative overflow-hidden py-16 md:py-24 px-4 hero-pattern">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[10%] w-72 h-72 bg-primary/20 rounded-full blur-[120px] animate-float" />
          <div className="absolute top-40 right-[15%] w-96 h-96 bg-accent/15 rounded-full blur-[100px] animate-float-reverse" />
          <div className="absolute bottom-20 left-[30%] w-80 h-80 bg-[hsl(20,90%,55%)]/10 rounded-full blur-[100px] animate-float" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 grid-pattern opacity-50" />

        <div className="container mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 px-5 py-2.5 mb-8 animate-fade-in backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                #1 Marketplace Source Code Việt Nam
              </span>
              <Star className="h-4 w-4 text-accent" />
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in leading-tight" style={{ animationDelay: '100ms' }}>
              Khám phá{' '}
              <span className="text-gradient animate-gradient bg-[length:200%_200%]">
                Source Code
              </span>
              <br />
              <span className="text-foreground/90">Chất lượng cao</span>
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-muted-foreground mb-10 animate-fade-in max-w-2xl mx-auto" style={{ animationDelay: '200ms' }}>
              Hàng nghìn source code từ web app, mobile đến game.
              Tiết kiệm thời gian với code sẵn sàng sử dụng.
            </p>

            {/* Search */}
            <div className="relative max-w-2xl mx-auto animate-fade-in mb-12" style={{ animationDelay: '300ms' }}>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-xl" />
              <div className="relative glass-strong rounded-2xl p-2">
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Tìm kiếm source code, templates, plugins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-14 h-14 text-base rounded-xl bg-background/50 border-0 focus:ring-2 focus:ring-primary/50"
                  />
                  <Button 
                    variant="gradient" 
                    size="lg" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
                  >
                    Tìm kiếm
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '400ms' }}>
              <div className="stats-card rounded-xl p-4 md:p-6 transition-all duration-300">
                <Package className="h-6 w-6 md:h-8 md:w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-foreground">{stats.totalProducts}+</div>
                <div className="text-xs md:text-sm text-muted-foreground">Sản phẩm</div>
              </div>
              <div className="stats-card rounded-xl p-4 md:p-6 transition-all duration-300">
                <Users className="h-6 w-6 md:h-8 md:w-8 text-accent mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-foreground">{stats.totalUsers}+</div>
                <div className="text-xs md:text-sm text-muted-foreground">Người dùng</div>
              </div>
              <div className="stats-card rounded-xl p-4 md:p-6 transition-all duration-300">
                <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-[hsl(20,90%,55%)] mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-foreground">{stats.totalOrders}+</div>
                <div className="text-xs md:text-sm text-muted-foreground">Đơn hàng</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 px-4 border-y border-border/50">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="flex items-center gap-4 p-4 rounded-xl glass hover:border-primary/30 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-12 md:py-16 px-4">
        <div className="container mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Sản phẩm <span className="text-gradient">nổi bật</span>
              </h2>
              <p className="text-muted-foreground">Khám phá các source code chất lượng cao</p>
            </div>
            <Link to="/categories" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
              Xem tất cả
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'gradient' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchParams({});
                }}
                className="rounded-full"
              >
                Tất cả
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.name ? 'gradient' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setSearchParams({ category: cat.name });
                  }}
                  className="rounded-full"
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Price filters */}
            <div className="flex gap-2 sm:ml-auto">
              <Filter className="h-5 w-5 text-muted-foreground self-center" />
              {filters.map((filter) => (
                <Button
                  key={filter.id}
                  variant={selectedFilter === filter.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedFilter(filter.id)}
                  className="rounded-full"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-[380px] rounded-2xl animate-shimmer" />
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ProductCard product={product} onPurchase={handlePurchase} onBuyWithCoin={handleBuyProductWithCoin} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Code2 className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                Không tìm thấy sản phẩm
              </h3>
              <p className="text-muted-foreground mb-6">
                Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc
              </p>
              <Button variant="outline" onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedFilter('all');
              }}>
                Xóa bộ lọc
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
        <div className="absolute inset-0 grid-pattern opacity-30" />
        
        <div className="container mx-auto relative">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Bạn là <span className="text-gradient">Developer</span>?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Trở thành seller và bắt đầu kiếm tiền từ source code của bạn ngay hôm nay!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="gradient" size="xl" onClick={() => navigate('/seller-setup')} className="btn-glow">
                Trở thành Seller
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button variant="outline" size="xl" onClick={() => navigate('/contact')}>
                Liên hệ hỗ trợ
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Code2 className="h-6 w-6 text-primary" />
              <span className="font-bold text-gradient">Bonz Shop</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Bonz Shop. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Coin Confirm Modal */}
      <Dialog open={showCoinConfirm} onOpenChange={setShowCoinConfirm}>
        <DialogContent className="glass-strong border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-xl">Xác nhận mua bằng xu</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn mua sản phẩm này?
            </DialogDescription>
          </DialogHeader>
          
          {pendingCoinProduct && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-card border border-border/50">
                <p className="font-semibold text-foreground mb-2">{pendingCoinProduct.title}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Giá:</span>
                  <span className="font-bold text-primary">{pendingCoinRequired} xu</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Số dư hiện tại:</span>
                  <span className="font-medium">{userCoinBalance} xu</span>
                </div>
                {userCoinBalance < (pendingCoinRequired || 0) && (
                  <p className="text-destructive text-sm mt-2">⚠️ Bạn không đủ xu để mua sản phẩm này</p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCoinConfirm(false)}>
              Hủy
            </Button>
            <Button
              variant="gradient"
              onClick={() => {
                if (pendingCoinProduct && pendingCoinRequired) {
                  performBuyProductWithCoin(pendingCoinProduct, pendingCoinRequired);
                }
              }}
              disabled={submittingPayment || userCoinBalance < (pendingCoinRequired || 0)}
            >
              {submittingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Xác nhận mua
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
