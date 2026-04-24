'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Shield, BadgeCheck } from 'lucide-react';
import type { UserProfile } from '@/app/lib/data';

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
    }
  }, [userProfile]);

  const handleUpdateProfile = async () => {
    if (!firestore || !user) return;
    try {
      const docRef = doc(firestore, 'users', user.uid);
      await updateDoc(docRef, { displayName });
      toast({ title: "Profil Diperbarui", description: "Nama Anda berhasil diperbarui di sistem." });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Update", description: "Terjadi kesalahan saat memperbarui profil." });
    }
  };

  if (isLoading) return <div className="p-8">Memuat pengaturan...</div>;

  const isSuperAdmin = userProfile?.email === 'fa@gmail.com';

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengaturan Profil</h1>
          <p className="text-muted-foreground">Kelola identitas dan keamanan akun Anda.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Identitas Pengguna</CardTitle>
            <CardDescription>Informasi ini akan muncul pada setiap dokumen yang Anda buat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-4 border-muted">
                <AvatarImage src={user?.photoURL || ''} />
                <AvatarFallback className="text-2xl bg-primary text-white">
                  {userProfile?.displayName?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  {userProfile?.displayName}
                  {isSuperAdmin && <BadgeCheck className="h-5 w-5 text-blue-600 fill-blue-100" />}
                </h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {userProfile?.email}
                </p>
                <div className="flex gap-2 mt-2">
                   <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground uppercase">
                    {isSuperAdmin ? 'Leader / Admin' : userProfile?.role}
                   </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2 opacity-60">
                <Label htmlFor="email">Alamat Email (Permanen)</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="email" value={userProfile?.email} disabled className="pl-8 bg-muted" />
                </div>
              </div>
              <Button onClick={handleUpdateProfile} className="w-full md:w-fit">Simpan Perubahan</Button>
            </div>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Shield className="h-5 w-5" /> Keamanan Leader
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800">
                Akun Anda memiliki akses tertinggi dalam sistem. Pastikan untuk selalu logout setelah menggunakan perangkat publik.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
