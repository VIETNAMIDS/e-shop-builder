import { useState, useEffect } from 'react';
import { Mail, Loader2, KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ForgotPasswordProps {
  onBack: () => void;
  onSuccess: () => void;
}

type Step = 'email' | 'otp' | 'new-password';

export default function ForgotPassword({ onBack, onSuccess }: ForgotPasswordProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendOtp = async () => {
    if (!email) {
      setError('Vui lòng nhập email');
      return;
    }

    if (countdown > 0) return;

    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email, action: 'send' }
      });

      if (error) {
        let errorMessage = 'Không thể gửi mã OTP. Vui lòng thử lại.';
        if (error.context?.json) {
          try {
            const errorData = await error.context.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Fall through
          }
        }
        setError(errorMessage);
        return;
      }

      if (data?.error) {
        setError(data.error);
      } else {
        setCountdown(60);
        setStep('otp');
        toast({
          title: '📧 Đã gửi mã OTP',
          description: 'Vui lòng kiểm tra hộp thư của bạn',
        });
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      setError('Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 số');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email, action: 'verify', otp }
      });

      if (error) {
        let errorMessage = 'Không thể xác thực. Vui lòng thử lại.';
        if (error.context?.json) {
          try {
            const errorData = await error.context.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Fall through
          }
        }
        setError(errorMessage);
        setOtp('');
        return;
      }

      if (data?.error) {
        setError(data.error);
        setOtp('');
      } else if (data?.verified) {
        setStep('new-password');
        toast({
          title: '✅ Xác thực thành công',
          description: 'Vui lòng nhập mật khẩu mới',
        });
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError('Không thể xác thực. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { email, newPassword }
      });

      if (error) {
        let errorMessage = 'Không thể đổi mật khẩu. Vui lòng thử lại.';
        if (error.context?.json) {
          try {
            const errorData = await error.context.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Fall through
          }
        }
        setError(errorMessage);
        return;
      }

      if (data?.error) {
        setError(data.error);
      } else if (data?.success) {
        toast({
          title: '🎉 Đổi mật khẩu thành công',
          description: 'Bạn có thể đăng nhập với mật khẩu mới',
        });
        onSuccess();
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <KeyRound className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-2">Quên mật khẩu</h2>
        <p className="text-muted-foreground text-sm md:text-base">
          Nhập email để nhận mã xác thực
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              className="pl-10 h-11 md:h-10"
              disabled={isLoading}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          onClick={sendOtp}
          className="w-full h-12"
          variant="gradient"
          disabled={!email || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Đang gửi...
            </>
          ) : (
            'Gửi mã xác thực'
          )}
        </Button>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại đăng nhập
        </button>
      </div>
    </div>
  );

  const renderOtpStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-2">Xác thực Email</h2>
        <p className="text-muted-foreground text-sm md:text-base">
          Nhập mã 6 số đã gửi đến
        </p>
        <p className="text-primary font-medium mt-1">{email}</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <InputOTP 
          maxLength={6} 
          value={otp} 
          onChange={(value) => {
            setOtp(value);
            setError('');
          }}
          disabled={isLoading}
        >
          <InputOTPGroup className="gap-2 md:gap-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot 
                key={index} 
                index={index} 
                className="w-10 h-12 md:w-12 md:h-14 text-lg md:text-xl font-bold border-2 border-border/50 rounded-lg bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </div>

      <Button
        onClick={verifyOtp}
        className="w-full h-12"
        variant="gradient"
        disabled={otp.length !== 6 || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Đang xác thực...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Xác thực
          </>
        )}
      </Button>

      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">Không nhận được mã?</p>
        <Button
          variant="ghost"
          onClick={sendOtp}
          disabled={countdown > 0 || isLoading}
          className="text-primary"
        >
          {countdown > 0 ? (
            <>Gửi lại sau {countdown}s</>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Gửi lại mã
            </>
          )}
        </Button>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setStep('email')}
          className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Đổi email
        </button>
      </div>
    </div>
  );

  const renderNewPasswordStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <KeyRound className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-2">Đặt mật khẩu mới</h2>
        <p className="text-muted-foreground text-sm md:text-base">
          Nhập mật khẩu mới cho tài khoản
        </p>
        <p className="text-primary font-medium mt-1">{email}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Mật khẩu mới</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError('');
              }}
              className="pl-10 pr-10 h-11 md:h-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Xác nhận mật khẩu</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError('');
              }}
              className="pl-10 h-11 md:h-10"
              disabled={isLoading}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          onClick={resetPassword}
          className="w-full h-12"
          variant="gradient"
          disabled={!newPassword || !confirmPassword || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Đang xử lý...
            </>
          ) : (
            'Đổi mật khẩu'
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {step === 'email' && renderEmailStep()}
      {step === 'otp' && renderOtpStep()}
      {step === 'new-password' && renderNewPasswordStep()}
    </>
  );
}
