import { useState, useEffect } from 'react';
import { Mail, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OtpVerificationProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

export default function OtpVerification({ email, onVerified, onBack }: OtpVerificationProps) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
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

  // Send OTP on mount
  useEffect(() => {
    sendOtp();
  }, []);

  const sendOtp = async () => {
    if (countdown > 0) return;
    
    setIsSending(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email, action: 'send' }
      });

      // Handle FunctionsHttpError - parse the response body for error message
      if (error) {
        let errorMessage = 'Không thể gửi mã OTP. Vui lòng thử lại.';
        if (error.context?.json) {
          try {
            const errorData = await error.context.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Fall through to default error handling
          }
        }
        setError(errorMessage);
        toast({
          title: 'Lỗi',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      if (data?.error) {
        setError(data.error);
        toast({
          title: 'Lỗi',
          description: data.error,
          variant: 'destructive',
        });
      } else {
        setCountdown(60); // 60 seconds cooldown
        toast({
          title: '📧 Đã gửi mã OTP',
          description: 'Vui lòng kiểm tra hộp thư của bạn (kể cả thư mục spam)',
        });
      }
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setError('Không thể gửi mã OTP. Vui lòng thử lại.');
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi mã OTP. Vui lòng thử lại.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
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

      // Handle FunctionsHttpError - parse the response body for error message
      if (error) {
        let errorMessage = 'Không thể xác thực. Vui lòng thử lại.';
        if (error.context?.json) {
          try {
            const errorData = await error.context.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Fall through to default error handling
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
        toast({
          title: '✅ Xác thực thành công',
          description: 'Email của bạn đã được xác minh!',
        });
        onVerified();
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setError('Không thể xác thực. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-2">Xác thực Email</h2>
        <p className="text-muted-foreground text-sm md:text-base">
          Chúng tôi đã gửi mã xác thực đến
        </p>
        <p className="text-primary font-medium mt-1">{email}</p>
      </div>

      {/* OTP Input */}
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

      {/* Verify Button */}
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

      {/* Resend */}
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Không nhận được mã?
        </p>
        
        {/* Spam folder notice */}
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm">
          <p className="text-warning font-medium mb-1">📧 Lưu ý quan trọng:</p>
          <p className="text-muted-foreground">
            Nếu không thấy mã trong hộp thư đến, vui lòng kiểm tra thư mục <strong className="text-foreground">Spam</strong> hoặc <strong className="text-foreground">Thư rác</strong>
          </p>
        </div>
        
        <Button
          variant="ghost"
          onClick={sendOtp}
          disabled={countdown > 0 || isSending}
          className="text-primary"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Đang gửi...
            </>
          ) : countdown > 0 ? (
            <>Gửi lại sau {countdown}s</>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Gửi lại mã
            </>
          )}
        </Button>
      </div>

      {/* Back */}
      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← Quay lại đăng ký
        </button>
      </div>
    </div>
  );
}
