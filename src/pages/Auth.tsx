import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Mail, Lock, User, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import OtpVerification from '@/components/OtpVerification';
import ForgotPassword from '@/components/ForgotPassword';

// Ký tự không được phép
const specialCharRegex = /[<>{}[\]\\\/`~!#$%^&*()+|=;:'",?]/;

// Key lưu trữ trong localStorage
const VIOLATION_KEY = 'security_violations';
const BLOCKED_KEY = 'user_blocked';

// Lấy thông tin vi phạm từ localStorage
const getViolationCount = (): number => {
  try {
    return parseInt(localStorage.getItem(VIOLATION_KEY) || '0', 10);
  } catch {
    return 0;
  }
};

// Lưu số lần vi phạm
const setViolationCount = (count: number) => {
  try {
    localStorage.setItem(VIOLATION_KEY, count.toString());
  } catch {
    // Ignore
  }
};

// Kiểm tra người dùng đã bị block chưa
const isUserBlocked = (): boolean => {
  try {
    return localStorage.getItem(BLOCKED_KEY) === 'true';
  } catch {
    return false;
  }
};

// Block người dùng vĩnh viễn
const blockUser = () => {
  try {
    localStorage.setItem(BLOCKED_KEY, 'true');
    // Lưu thêm thông tin thiết bị
    const deviceInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      blockedAt: new Date().toISOString(),
    };
    localStorage.setItem('blocked_device_info', JSON.stringify(deviceInfo));
  } catch {
    // Ignore
  }
};

const authSchema = z.object({
  email: z.string()
    .trim()
    .email({ message: 'Email không hợp lệ' })
    .max(255, { message: 'Email quá dài' })
    .refine((val) => !specialCharRegex.test(val.replace(/@/g, '').replace(/\./g, '')), {
      message: 'special_char_violation',
    }),
  password: z.string()
    .min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    .max(100, { message: 'Mật khẩu quá dài' }),
  displayName: z.string()
    .trim()
    .max(50, { message: 'Tên hiển thị quá dài' })
    .refine((val) => !val || !specialCharRegex.test(val), {
      message: 'special_char_violation',
    })
    .optional(),
});

type AuthView = 'login' | 'signup' | 'otp' | 'forgot-password';

export default function Auth() {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isBlocked, setIsBlocked] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<{ email: string; password: string; displayName: string } | null>(null);

  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Kiểm tra block khi load trang
  useEffect(() => {
    if (isUserBlocked()) {
      setIsBlocked(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Xử lý cảnh báo leo thang
  const handleSpecialCharViolation = useCallback(() => {
    const currentCount = getViolationCount();
    const newCount = currentCount + 1;
    setViolationCount(newCount);

    if (newCount >= 3) {
      // Block vĩnh viễn
      blockUser();
      setIsBlocked(true);
      toast({
        title: '🚫 TÀI KHOẢN ĐÃ BỊ KHÓA VĨNH VIỄN',
        description: 'Bạn đã vi phạm quá nhiều lần. Thiết bị của bạn đã bị ghi nhận và cấm sử dụng web.',
        variant: 'destructive',
        duration: 999999,
      });
      return 'Tài khoản đã bị khóa vĩnh viễn!';
    } else if (newCount === 2) {
      toast({
        title: '⚠️ CẢNH BÁO LẦN CUỐI',
        description: 'Vui lòng đéo nhập ký tự lạ vô web! Lần sau sẽ bị cấm vĩnh viễn!',
        variant: 'destructive',
        duration: 10000,
      });
      return 'Vui lòng đéo nhập ký tự lạ vô web! (Cảnh báo lần 2/3)';
    } else {
      toast({
        title: '❌ Ký tự không hợp lệ',
        description: 'Vui lòng không nhập ký tự lạ! Đây là cảnh báo lần 1.',
        variant: 'destructive',
        duration: 5000,
      });
      return 'Vui lòng không nhập ký tự lạ! (Cảnh báo lần 1/3)';
    }
  }, [toast]);

  const validate = () => {
    if (isBlocked) return false;

    try {
      authSchema.parse({ email, password, displayName: view === 'signup' ? displayName : undefined });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        let hasSpecialCharViolation = false;

        err.errors.forEach((e) => {
          if (e.path[0]) {
            if (e.message === 'special_char_violation') {
              hasSpecialCharViolation = true;
              newErrors[e.path[0] as string] = handleSpecialCharViolation();
            } else {
              newErrors[e.path[0] as string] = e.message;
            }
          }
        });

        setErrors(newErrors);
      }
      return false;
    }
  };

  // Kiểm tra ký tự realtime khi người dùng nhập
  const checkSpecialChars = useCallback((value: string, field: string) => {
    if (isBlocked) return;
    
    // Loại bỏ @ và . cho email trước khi kiểm tra
    const cleanValue = field === 'email' ? value.replace(/@/g, '').replace(/\./g, '') : value;
    
    if (specialCharRegex.test(cleanValue)) {
      const message = handleSpecialCharViolation();
      setErrors(prev => ({ ...prev, [field]: message }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [isBlocked, handleSpecialCharViolation]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    checkSpecialChars(value, 'email');
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayName(value);
    checkSpecialChars(value, 'displayName');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBlocked) {
      toast({
        title: '🚫 TRUY CẬP BỊ TỪ CHỐI',
        description: 'Thiết bị của bạn đã bị cấm sử dụng web này vĩnh viễn.',
        variant: 'destructive',
      });
      return;
    }

    if (!validate()) return;

    setIsLoading(true);

    try {
      if (view === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Đăng nhập thất bại',
            description: error.message === 'Invalid login credentials' 
              ? 'Email hoặc mật khẩu không đúng' 
              : error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Đăng nhập thành công',
            description: 'Chào mừng bạn trở lại!',
          });
          navigate('/');
        }
      } else if (view === 'signup') {
        // Save pending signup data and show OTP verification
        setPendingSignup({ email, password, displayName });
        setView('otp');
        toast({
          title: '📧 Xác thực email',
          description: 'Vui lòng xác thực email trước khi hoàn tất đăng ký.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification success
  const handleOtpVerified = async () => {
    if (!pendingSignup) return;
    
    setIsLoading(true);
    try {
      const { error } = await signUp(pendingSignup.email, pendingSignup.password, pendingSignup.displayName);
      if (error) {
        toast({
          title: 'Đăng ký thất bại',
          description: error.message.includes('already registered')
            ? 'Email này đã được đăng ký'
            : error.message,
          variant: 'destructive',
        });
        setView('signup');
        setPendingSignup(null);
      } else {
        toast({
          title: '🎉 Đăng ký thành công',
          description: 'Tài khoản của bạn đã được tạo và xác thực!',
        });
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back from OTP
  const handleOtpBack = () => {
    setView('signup');
    setPendingSignup(null);
  };

  // Handle forgot password success
  const handleForgotPasswordSuccess = () => {
    setView('login');
    toast({
      title: '✅ Thành công',
      description: 'Vui lòng đăng nhập với mật khẩu mới.',
    });
  };

  // Màn hình blocked
  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="fixed inset-0 bg-destructive/10" />
        <div className="relative w-full max-w-md animate-fade-in text-center">
          <div className="glass rounded-2xl p-8 shadow-elevated border-2 border-destructive/50">
            <ShieldAlert className="h-20 w-20 text-destructive mx-auto mb-6 animate-pulse" />
            <h1 className="text-2xl font-bold text-destructive mb-4">
              🚫 TRUY CẬP BỊ TỪ CHỐI
            </h1>
            <p className="text-muted-foreground mb-4">
              Thiết bị của bạn đã bị ghi nhận và cấm sử dụng web này vĩnh viễn do vi phạm quy định nhiều lần.
            </p>
            <div className="bg-destructive/10 rounded-lg p-4 text-sm text-destructive/80">
              <p>Mã lỗi: DEVICE_PERMANENTLY_BLOCKED</p>
              <p>Thời gian: {new Date().toLocaleString('vi-VN')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // OTP Verification screen
  if (view === 'otp' && pendingSignup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="flex justify-center mb-6 md:mb-8">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative">
                <Code2 className="h-10 w-10 md:h-12 md:w-12 text-primary animate-pulse-glow" />
                <div className="absolute inset-0 bg-primary/20 blur-xl" />
              </div>
              <span className="text-2xl md:text-3xl font-bold text-gradient">Bonz Shop</span>
            </div>
          </div>

          {/* OTP Form */}
          <div className="glass rounded-2xl p-6 md:p-8 shadow-elevated mx-2 md:mx-0">
            <OtpVerification 
              email={pendingSignup.email}
              onVerified={handleOtpVerified}
              onBack={handleOtpBack}
            />
          </div>
        </div>
      </div>
    );
  }

  // Forgot Password screen
  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="flex justify-center mb-6 md:mb-8">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative">
                <Code2 className="h-10 w-10 md:h-12 md:w-12 text-primary animate-pulse-glow" />
                <div className="absolute inset-0 bg-primary/20 blur-xl" />
              </div>
              <span className="text-2xl md:text-3xl font-bold text-gradient">Bonz Shop</span>
            </div>
          </div>

          {/* Forgot Password Form */}
          <div className="glass rounded-2xl p-6 md:p-8 shadow-elevated mx-2 md:mx-0">
            <ForgotPassword 
              onBack={() => setView('login')}
              onSuccess={handleForgotPasswordSuccess}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-6 md:mb-8">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="relative">
              <Code2 className="h-10 w-10 md:h-12 md:w-12 text-primary animate-pulse-glow" />
              <div className="absolute inset-0 bg-primary/20 blur-xl" />
            </div>
            <span className="text-2xl md:text-3xl font-bold text-gradient">Bonz Shop</span>
          </div>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-6 md:p-8 shadow-elevated mx-2 md:mx-0">
          <h2 className="text-xl md:text-2xl font-bold text-center mb-2">
            {view === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </h2>
          <p className="text-muted-foreground text-center text-sm md:text-base mb-6 md:mb-8">
            {view === 'login' ? 'Chào mừng bạn trở lại!' : 'Tạo tài khoản mới'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            {view === 'signup' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Tên hiển thị</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Nhập tên của bạn"
                    value={displayName}
                    onChange={handleDisplayNameChange}
                    className="pl-10 h-11 md:h-10 text-base md:text-sm"
                    autoComplete="name"
                    disabled={isBlocked}
                  />
                </div>
                {errors.displayName && (
                  <p className="text-xs md:text-sm text-destructive">{errors.displayName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  className="pl-10 h-11 md:h-10 text-base md:text-sm"
                  required
                  autoComplete="email"
                  disabled={isBlocked}
                />
              </div>
              {errors.email && (
                <p className="text-xs md:text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground">Mật khẩu</label>
                {view === 'login' && (
                  <button
                    type="button"
                    onClick={() => setView('forgot-password')}
                    className="text-xs text-primary hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 md:h-10 text-base md:text-sm"
                  required
                  autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                  disabled={isBlocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4 md:h-5 md:w-5" /> : <Eye className="h-4 w-4 md:h-5 md:w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs md:text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 md:h-11 text-base md:text-sm"
              variant="gradient"
              size="lg"
              disabled={isLoading || isBlocked}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : view === 'login' ? (
                'Đăng nhập'
              ) : (
                'Đăng ký'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setView(view === 'login' ? 'signup' : 'login');
                setErrors({});
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors py-2"
              disabled={isBlocked}
            >
              {view === 'login' ? (
                <>
                  Chưa có tài khoản?{' '}
                  <span className="font-medium text-primary">Đăng ký ngay</span>
                </>
              ) : (
                <>
                  Đã có tài khoản?{' '}
                  <span className="font-medium text-primary">Đăng nhập</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
