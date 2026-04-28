'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, TrendingUp } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885l.027.027A7.21 7.21 0 1 0 10.5 15.292a7.21 7.21 0 0 0 5.045-2.03.62.62 0 0 1 .832.868 8.42 8.42 0 0 1-6.19 2.535 8.42 8.42 0 0 1-8.23-7.443A8.42 8.42 0 0 1 10.5 4.5c2.59 0 4.922 1.12 6.55 2.94l-.027-.027z" />
      <path d="M20 10h-5V5" />
    </svg>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Pattern: Non-blocking auth call
    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        // Navigation is handled by the useEffect above
      })
      .catch((error: any) => {
        let message = 'Email atau password salah. Silakan coba lagi.';
        if (error.code === 'auth/invalid-credential') {
          message = 'Kredensial tidak valid. Periksa kembali email dan password Anda.';
        }
        toast({
          variant: 'destructive',
          title: 'Login Gagal',
          description: message,
        });
        setIsLoading(false);
      });
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Google Gagal',
        description:
          'Tidak dapat login dengan Google. Silakan coba lagi nanti.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isUserLoading || (!isUserLoading && user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
           <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-black uppercase italic tracking-tighter">Dakota Hub</span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Welcome back !</h1>
            <p className="text-balance text-muted-foreground font-medium">
              Enter to get unlimited access to data & information.
            </p>
          </div>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@perusahaan.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-2 relative">
              <div className="flex items-center">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password</Label>
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-muted-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember-me" />
                <Label
                  htmlFor="remember-me"
                  className="text-xs font-bold uppercase text-slate-500 cursor-pointer"
                >
                  Remember me
                </Label>
              </div>
              <Link href="#" className="text-xs font-bold text-primary hover:underline uppercase tracking-tighter">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-lg shadow-primary/20" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Secure Log In'}
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
              <span className="bg-background px-4 text-muted-foreground">
                Or identity provider
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full h-12 font-bold"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
          <div className="mt-4 text-center text-sm font-medium">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-black text-primary hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src="https://picsum.photos/seed/login/1200/1800"
          alt="Image"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          data-ai-hint="geometric abstract"
        />
      </div>
    </div>
  );
}
