import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { ProductCard } from '@/components/ProductCard';
import { Gift, Sparkles, Download, CheckCircle, Clock, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Seller {
  id: string;
  display_name: string;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  is_free: boolean;
  image_url: string | null;
  tech_stack: string[] | null;
  category: string;
  download_url: string | null;
  seller?: Seller | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export default function Free() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from('products')
          .select(`
            *,
            seller:sellers_public(id, display_name, avatar_url)
          `)
          .eq('is_free', true)
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name')
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(search.toLowerCase()) ||
      product.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const freeCount = products.length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Kho miễn phí chọn lọc</span>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Thư viện <span className="text-gradient">FREE SOURCE</span>
                <br />cho cộng đồng developer Việt
              </h1>
              <p className="text-muted-foreground text-lg mb-6">
                Thoải mái tải về các landing page, dashboard, bot nhỏ và snippet hay ho.
                Mọi thứ đều được đóng gói để bạn học hỏi hoặc làm nền tảng cho dự án mới.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="gradient" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>
                  Khám phá ngay
                </Button>
                <Link to="/">
                  <Button variant="outline">Quay lại Marketplace</Button>
                </Link>
              </div>
            </div>
            
            <div className="glass p-6 rounded-2xl border border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">Số dự án miễn phí hiện có</span>
              </div>
              <div className="text-6xl font-bold text-gradient mb-2">{freeCount}<span className="text-2xl">+ source</span></div>
              <p className="text-muted-foreground">Và chúng tôi vẫn đang bổ sung thêm mỗi tuần.</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="glass p-6 rounded-xl border border-border/50">
            <Download className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-bold text-lg mb-2">TẢI XUỐNG TỨC THÌ</h3>
            <p className="text-sm text-muted-foreground">
              Không chờ phê duyệt, nhấp là nhận source code để nghiên cứu ngay.
            </p>
          </div>
          <div className="glass p-6 rounded-xl border border-border/50">
            <CheckCircle className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-bold text-lg mb-2">CHẤT LƯỢNG ĐƯỢC KIỂM DUYỆT</h3>
            <p className="text-sm text-muted-foreground">
              Toàn bộ source miễn phí đều được Bonz Shop chạy thử và chọn lọc kỹ.
            </p>
          </div>
          <div className="glass p-6 rounded-xl border border-border/50">
            <Clock className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-bold text-lg mb-2">CẬP NHẬT MỖI TUẦN</h3>
            <p className="text-sm text-muted-foreground">
              Thêm các dự án UI, bot và tool mới liên tục để bạn khám phá.
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8" id="products">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Tìm landing page, dashboard, bot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'Tất cả lĩnh vực'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSelectedCategory(null)}>
                Tất cả lĩnh vực
              </DropdownMenuItem>
              {categories.map((category) => (
                <DropdownMenuItem 
                  key={category.id} 
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Không tìm thấy sản phẩm miễn phí nào</p>
          </div>
        )}
      </main>
    </div>
  );
}
