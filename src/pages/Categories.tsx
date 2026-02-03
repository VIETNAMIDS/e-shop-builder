import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Code, Bot, Globe, Gamepad2, Wrench, Package } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  product_count?: number;
}

const iconMap: Record<string, React.ReactNode> = {
  code: <Code className="w-6 h-6 text-primary" />,
  bot: <Bot className="w-6 h-6 text-primary" />,
  globe: <Globe className="w-6 h-6 text-primary" />,
  gamepad: <Gamepad2 className="w-6 h-6 text-primary" />,
  tool: <Wrench className="w-6 h-6 text-primary" />,
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Fetch categories
      const { data: categoriesData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (catError) throw catError;

      // Fetch product counts for each category
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('category');

      if (prodError) throw prodError;

      // Count products per category
      const countMap: Record<string, number> = {};
      products?.forEach(p => {
        countMap[p.category] = (countMap[p.category] || 0) + 1;
      });

      const categoriesWithCount = categoriesData?.map(cat => ({
        ...cat,
        product_count: countMap[cat.name] || 0
      })) || [];

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categoryName: string) => {
    navigate(`/?category=${encodeURIComponent(categoryName)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Danh mục</h1>
          <p className="text-muted-foreground">
            Khám phá các danh mục sản phẩm được cập nhật từ hệ thống
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div
                key={category.id}
                onClick={() => handleCategoryClick(category.name)}
                className="group p-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:bg-card transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    {iconMap[category.icon || 'code'] || <Package className="w-6 h-6 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {category.description || 'Không có mô tả'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {category.product_count} sản phẩm
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
