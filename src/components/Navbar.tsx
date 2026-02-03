import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Code2, LogOut, Shield, User, FolderOpen, Gift, Menu, X, ShoppingBag, Coins, Store, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { NotificationBell } from '@/components/NotificationBell';

export function Navbar() {
  const { user, isAdmin, sellerProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (user) {
      fetchCoinBalance();
    }
  }, [user]);

  const fetchCoinBalance = async () => {
    const { data } = await supabase
      .from('user_coins')
      .select('balance')
      .eq('user_id', user?.id)
      .single();
    
    if (data) {
      setCoinBalance(data.balance);
    } else {
      setCoinBalance(0);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navLinks = [
    { to: '/', label: 'Trang chủ' },
    { to: '/accounts', label: 'Mua Acc', icon: User },
    { to: '/posts', label: 'Bài viết', icon: FileText },
    { to: '/my-orders', label: 'Đơn hàng', icon: ShoppingBag, requireAuth: true },
    { to: '/categories', label: 'Danh mục', icon: FolderOpen },
    { to: '/free', label: 'Miễn phí', icon: Gift },
    { to: '/contact', label: 'Liên hệ' },
  ];

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'glass-strong border-b border-primary/10 shadow-[0_5px_30px_-10px_hsl(280_85%_65%/0.2)]' 
        : 'glass border-b border-border/50'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex h-14 md:h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <Code2 className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="absolute inset-0 bg-primary/30 blur-xl group-hover:bg-primary/50 transition-colors duration-300" />
            </div>
            <span className="text-lg md:text-xl font-bold text-gradient">Bonz Shop</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks
              .filter(link => !link.requireAuth || user)
              .map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="relative text-sm text-muted-foreground hover:text-foreground transition-all duration-300 flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-secondary/50 group"
              >
                {link.icon && <link.icon className="h-4 w-4 text-primary/70 group-hover:text-primary transition-colors" />}
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />
                
                {/* Coin Balance */}
                <Link to="/buy-coins">
                  <Button variant="outline" size="sm" className="gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50 group">
                    <Coins className="h-4 w-4 text-warning group-hover:animate-pulse" />
                    <span className="font-semibold">{coinBalance !== null ? `${coinBalance} xu` : '...'}</span>
                    <Sparkles className="h-3 w-3 text-primary/50" />
                  </Button>
                </Link>
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm" className="gap-2 border-warning/30 hover:bg-warning/10 hover:border-warning/50">
                      <Shield className="h-4 w-4 text-warning" />
                      Admin
                    </Button>
                  </Link>
                )}
                {sellerProfile && (
                  <Link to="/seller-accounts">
                    <Button variant="outline" size="sm" className="gap-2 border-success/30 hover:bg-success/10 hover:border-success/50">
                      <Store className="h-4 w-4 text-success" />
                      Upload
                    </Button>
                  </Link>
                )}
                <Link
                  to="/user-profile"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors group"
                  title="Quản lý hồ sơ"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="hidden lg:inline max-w-[120px] truncate">{user.email?.split('@')[0]}</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="hover:bg-destructive/10 hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="gradient" size="sm" className="px-6">
                  Đăng nhập
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            {user && <NotificationBell />}
            <button
              className="p-2 -mr-2 rounded-lg hover:bg-secondary/50 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-1">
              {navLinks
                .filter(link => !link.requireAuth || user)
                .map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.icon ? (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                      <link.icon className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <div className="w-8 h-8" />
                  )}
                  <span className="font-medium">{link.label}</span>
                </Link>
              ))}

              {user ? (
                <>
                  {/* Mobile Coin Balance */}
                  <Link
                    to="/buy-coins"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mt-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                      <Coins className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <span className="font-semibold">{coinBalance !== null ? `${coinBalance} xu` : 'Đang tải...'}</span>
                      <p className="text-xs text-muted-foreground">Nhấn để nạp thêm</p>
                    </div>
                  </Link>
                  
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-warning" />
                      </div>
                      <span className="font-medium">Quản trị Admin</span>
                    </Link>
                  )}
                  {sellerProfile && (
                    <Link
                      to="/seller-accounts"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                        <Store className="h-4 w-4 text-success" />
                      </div>
                      <span className="font-medium">Upload sản phẩm</span>
                    </Link>
                  )}
                  <Link
                    to="/user-profile"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium">Hồ sơ của tôi</span>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{user.email}</p>
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 text-destructive transition-colors mt-2"
                  >
                    <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <span className="font-medium">Đăng xuất</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="mt-4"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button variant="gradient" className="w-full h-12">
                    Đăng nhập
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
