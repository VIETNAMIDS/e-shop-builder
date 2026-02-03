import { Link } from 'react-router-dom';
import { ShoppingCart, Eye } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Product } from '@/types';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface ProductCardProps {
  product: Product;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price);
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAddToCart = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    addToCart.mutate(product.id);
  };

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
      <div className="relative overflow-hidden">
        <AspectRatio ratio={16 / 10}>
          <img
            src={product.image_url || '/placeholder.svg'}
            alt={product.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        </AspectRatio>
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="capitalize">
            {product.category}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-1">{product.title}</h3>
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
          {product.description}
        </p>
        
        {product.tech_stack && product.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {product.tech_stack.slice(0, 3).map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
            {product.tech_stack.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{product.tech_stack.length - 3}
              </Badge>
            )}
          </div>
        )}

        <p className="text-xl font-bold text-primary">
          {formatPrice(product.price)}
        </p>
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2">
        <Button 
          variant="outline" 
          className="flex-1"
          asChild
        >
          <Link to={`/products/${product.id}`}>
            <Eye className="h-4 w-4 mr-2" />
            Chi tiết
          </Link>
        </Button>
        <Button 
          className="flex-1"
          onClick={handleAddToCart}
          disabled={addToCart.isPending}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Mua
        </Button>
      </CardFooter>
    </Card>
  );
}
