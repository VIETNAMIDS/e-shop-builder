import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Zap, Shield, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/skeleton';

export default function Index() {
  const { data: products, isLoading } = useProducts();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary">
              <Code2 className="h-4 w-4" />
              Nền tảng bán code #1 Việt Nam
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Mua source code{' '}
              <span className="text-primary">chất lượng cao</span>{' '}
              chỉ trong vài phút
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Templates, UI Kits, Boilerplates được phát triển bởi các developer chuyên nghiệp. 
              Tiết kiệm thời gian, tập trung vào business của bạn.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" asChild>
                <Link to="/products">
                  Khám phá sản phẩm
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Đăng ký ngay</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-background border">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Tải ngay lập tức</h3>
              <p className="text-muted-foreground text-sm">
                Sau khi thanh toán, bạn có thể tải source code ngay lập tức về máy.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-background border">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Chất lượng đảm bảo</h3>
              <p className="text-muted-foreground text-sm">
                Code được review kỹ lưỡng, documentation đầy đủ, support tận tình.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-background border">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Update miễn phí</h3>
              <p className="text-muted-foreground text-sm">
                Mua một lần, nhận update miễn phí trọn đời cho sản phẩm.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-16">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Sản phẩm nổi bật</h2>
              <p className="text-muted-foreground mt-1">Những template được yêu thích nhất</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/products">
                Xem tất cả
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-[16/10] w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products?.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">Bắt đầu xây dựng dự án của bạn ngay hôm nay</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Tiết kiệm hàng trăm giờ phát triển với source code chất lượng cao của chúng tôi.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/products">
              Khám phá ngay
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
