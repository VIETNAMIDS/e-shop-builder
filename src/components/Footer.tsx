import { Code2, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <Code2 className="h-6 w-6 text-primary" />
              <span>CodeShop</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Nền tảng mua bán source code, template và UI kit chất lượng cao.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Sản phẩm</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/products?category=template" className="hover:text-primary">Templates</Link></li>
              <li><Link to="/products?category=ui-kit" className="hover:text-primary">UI Kits</Link></li>
              <li><Link to="/products?category=boilerplate" className="hover:text-primary">Boilerplates</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Hỗ trợ</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary">Hướng dẫn mua hàng</a></li>
              <li><a href="#" className="hover:text-primary">Chính sách hoàn tiền</a></li>
              <li><a href="#" className="hover:text-primary">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Liên hệ</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                support@codeshop.vn
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                0123 456 789
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} CodeShop. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
