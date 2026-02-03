import { Code2, Download, Tag, Store, Sparkles, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Seller {
  id: string;
  display_name: string;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  coin_price?: number | null;
  is_free: boolean;
  category: string;
  image_url: string | null;
  tech_stack: string[] | null;
  download_url: string | null;
  seller?: Seller | null;
}

interface ProductCardProps {
  product: Product;
  onPurchase?: (product: Product) => void;
  onBuyWithCoin?: (product: Product) => void;
}

export function ProductCard({ product, onPurchase, onBuyWithCoin }: ProductCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const coinPrice = Math.ceil(product.price / 1000);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_50px_hsl(280_85%_65%/0.2)] card-hover">
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-primary/10 via-accent/10 to-secondary">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="relative">
              <Code2 className="h-20 w-20 text-primary/30" />
              <div className="absolute inset-0 bg-primary/10 blur-2xl" />
            </div>
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
        
        {/* Price badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          {product.is_free ? (
            <Badge className="badge-free font-bold shadow-lg">
              <Sparkles className="h-3 w-3 mr-1" />
              FREE
            </Badge>
          ) : (
            <>
              <Badge className="badge-premium font-bold shadow-lg">
                {formatPrice(product.price)}
              </Badge>
              <Badge variant="secondary" className="font-semibold bg-card/80 backdrop-blur-sm">
                <Coins className="h-3 w-3 mr-1 text-warning" />
                {coinPrice} xu
              </Badge>
            </>
          )}
        </div>

        {/* New badge for recent products */}
        {new Date().getTime() - new Date(product.id).getTime() < 7 * 24 * 60 * 60 * 1000 && (
          <div className="absolute top-3 left-3">
            <Badge className="badge-new font-bold">NEW</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Tag className="h-3 w-3 text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {product.category}
            </span>
          </div>
          {product.seller && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 rounded-full px-2 py-1">
              <Store className="h-3 w-3" />
              <span className="truncate max-w-[70px]">{product.seller.display_name}</span>
            </div>
          )}
        </div>

        <h3 className="mb-2 text-lg font-bold text-foreground line-clamp-1 group-hover:text-gradient transition-all duration-300">
          {product.title}
        </h3>

        <p className="mb-4 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {product.description || 'Không có mô tả'}
        </p>

        {/* Tech stack */}
        {product.tech_stack && product.tech_stack.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {product.tech_stack.slice(0, 3).map((tech) => (
              <span
                key={tech}
                className="rounded-lg bg-gradient-to-r from-secondary to-muted px-2.5 py-1 font-mono text-xs text-muted-foreground border border-border/50"
              >
                {tech}
              </span>
            ))}
            {product.tech_stack.length > 3 && (
              <span className="rounded-lg bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground">
                +{product.tech_stack.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Action button */}
        {product.is_free && product.download_url ? (
          <Button
            className="w-full gap-2 h-11"
            variant="glow"
            onClick={() => window.open(product.download_url!, '_blank')}
          >
            <Download className="h-4 w-4" />
            Tải miễn phí
          </Button>
        ) : (
          <Button
            className="w-full gap-2 h-11"
            variant={product.is_free ? 'glow' : 'gradient'}
            onClick={() => onPurchase?.(product)}
          >
            {product.is_free ? (
              <>
                <Download className="h-4 w-4" />
                Tải miễn phí
              </>
            ) : (
              <>
                <Coins className="h-4 w-4" />
                Mua ngay - {coinPrice} xu
              </>
            )}
          </Button>
        )}
      </div>

      {/* Glow effect on hover */}
      <div className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/15 via-accent/5 to-transparent" />
      </div>
    </div>
  );
}
