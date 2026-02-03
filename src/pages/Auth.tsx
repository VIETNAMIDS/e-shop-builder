import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Code2, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const authSchema = z.object({
  email: z.string().trim().email({ message: 'Email không hợp lệ' }).max(255),
  password: z.string().min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' }).max(100),
});

type AuthFormValues = z.infer<typeof authSchema>;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const onSubmit = async (values: AuthFormValues) => {
    setIsLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(values.email, values.password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email hoặc mật khẩu không đúng');
          } else if (error.message.includes('Email not confirmed')) {
            toast.error('Vui lòng xác nhận email trước khi đăng nhập');
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success('Đăng nhập thành công!');
        navigate('/');
      } else {
        const { error } = await signUp(values.email, values.password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Email này đã được đăng ký');
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 font-bold text-2xl mb-4">
            <Code2 className="h-8 w-8 text-primary" />
            <span>CodeShop</span>
          </Link>
          <CardTitle>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</CardTitle>
          <CardDescription>
            {isLogin
              ? 'Đăng nhập để mua và tải source code'
              : 'Tạo tài khoản để bắt đầu mua sắm'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mật khẩu</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? 'Đăng nhập' : 'Đăng ký'}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            </span>{' '}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Đăng ký' : 'Đăng nhập'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
