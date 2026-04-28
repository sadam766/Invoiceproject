'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, TrendingUp } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

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

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        await updateProfile(userCredential.user, { displayName: name });
        
        const userDocRef = doc(firestore, 'users', userCredential.user.uid);
        const isLeader = email.toLowerCase() === 'fa@gmail.com';

        await setDoc(userDocRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: name,
          role: isLeader ? 'admin' : 'staff',
          status: isLeader ? 'active' : 'pending'
        });
        
        toast({
            title: isLeader ? "Pendaftaran Leader Berhasil" : "Pendaftaran Berhasil",
            description: isLeader 
              ? "Akun Leader Utama telah aktif. Selamat datang di Dakota Hub."
              : "Akun Anda telah dibuat. Tunggu persetujuan Admin untuk aktivasi dashboard.",
        });
        
        // Navigation will be handled by useEffect
      })
      .catch((error: any) => {
        let message = 'Terjadi kesalahan saat pendaftaran.';
        if (error.code === 'auth/email-already-in-use') {
          message = 'Alamat email sudah terdaftar. Silakan login atau gunakan email lain.';
        } else if (error.code === 'auth/weak-password') {
          message = 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
        }
        toast({
          variant: 'destructive',
          title: 'Registrasi Gagal',
          description: message,
        });
        setIsLoading(false);
      });
  };
  
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      
      const userDocRef = doc(firestore, 'users', googleUser.uid);
      const isLeader = googleUser.email?.toLowerCase() === 'fa@gmail.com';

      await setDoc(userDocRef, {
        uid: googleUser.uid,
        email: googleUser.email,
        displayName: googleUser.displayName,
        role: isLeader ? 'admin' : 'staff',
        status: isLeader ? 'active' : 'pending'
      }, { merge: true });

      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Google Gagal',
        description: 'Tidak dapat login dengan Google. Silakan coba lagi.',
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
           <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Processing Request...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="hidden bg-muted lg:block">
        <Image
          src="https://picsum.photos/seed/register/1200/1800"
          alt="Image"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          data-ai-hint="office building modern"
        />
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-xl font-black uppercase italic tracking-tighter">Dakota Hub</span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Create Account</h1>
            <p className="text-balance text-muted-foreground font-medium">
              Daftarkan akun operasional Anda untuk akses penuh ke sistem Dakota.
            </p>
          </div>
          <form onSubmit={handleRegister} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nama Lengkap</Label>
              <Input
                id="name"
                type="text"
                placeholder="Nama sesuai identitas"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
              />
            </div>
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
                placeholder="Min. 6 karakter"
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
            <Button type="submit" className="w-full h-12 font-black uppercase tracking-widest shadow-lg shadow-primary/20 mt-2" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Complete Registration'}
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
              <span className="bg-background px-4 text-muted-foreground">
                Or quick sign up
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
            Register with Google
          </Button>
          <div className="mt-4 text-center text-sm font-medium">
            Already have an account?{' '}
            <Link href="/login" className="font-black text-primary hover:underline">
              Log in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
