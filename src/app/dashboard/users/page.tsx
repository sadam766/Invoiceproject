
'use client';
import { useState, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
  import { collection, doc, updateDoc, query } from 'firebase/firestore';
  import { type UserProfile } from '@/app/lib/data';
  import { useToast } from '@/hooks/use-toast';
  import { UserCog, ShieldCheck, ShieldAlert, UserX, UserCheck, UserPlus, Star } from 'lucide-react';
  import { cn } from '@/lib/utils';
  
  export default function UserManagementPage() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();

    // Check if current user is admin
    const currentUserProfileRef = useMemoFirebase(() => {
        if (!firestore || !currentUser) return null;
        return doc(firestore, 'users', currentUser.uid);
    }, [firestore, currentUser]);
    const { data: currentUserProfile } = useDoc<UserProfile>(currentUserProfileRef);
    
    // fa@gmail.com always admin
    const isSuperAdmin = currentUserProfile?.email === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';

    const usersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allUsers, isLoading } = useCollection<UserProfile>(usersCollection);

    const handleRoleChange = async (targetUserId: string, targetEmail: string, newRole: 'admin' | 'staff') => {
        if (!firestore || !isAdmin) return;
        
        // Proteksi fa@gmail.com
        if (targetEmail === 'fa@gmail.com' && !isSuperAdmin) {
            toast({ variant: "destructive", title: "Akses Ditolak", description: "Anda tidak bisa mengubah role Leader Utama." });
            return;
        }

        const userRef = doc(firestore, 'users', targetUserId);
        try {
            await updateDoc(userRef, { role: newRole });
            toast({ title: "Role Berhasil Diubah", description: `User ${targetEmail} sekarang memiliki akses ${newRole}.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal Mengubah Role", description: "Terjadi kesalahan saat memproses." });
        }
    };

    const handleStatusChange = async (targetUserId: string, targetEmail: string, newStatus: 'active' | 'suspended' | 'pending') => {
        if (!firestore || !isAdmin) return;
        
        // Jangan suspend diri sendiri
        if (targetUserId === currentUser?.uid) {
            toast({ variant: "destructive", title: "Aksi Dibatalkan", description: "Anda tidak bisa menonaktifkan akun sendiri." });
            return;
        }

        // Proteksi fa@gmail.com
        if (targetEmail === 'fa@gmail.com') {
            toast({ variant: "destructive", title: "Aksi Dibatalkan", description: "Akun Leader Utama tidak dapat dinonaktifkan." });
            return;
        }

        const userRef = doc(firestore, 'users', targetUserId);
        try {
            await updateDoc(userRef, { status: newStatus });
            const message = newStatus === 'active' ? "Akun Diaktifkan" : (newStatus === 'suspended' ? "Akun Dinonaktifkan" : "Akun di-set Pending");
            toast({ 
                title: message,
                description: `Status user ${targetEmail} telah diperbarui.` 
            });
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal Mengubah Status", description: "Terjadi kesalahan saat memproses." });
        }
    };

    if (!isAdmin && !isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <Card className="max-w-md w-full text-center p-8 space-y-4">
                    <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
                    <h2 className="text-xl font-bold">Akses Terbatas</h2>
                    <p className="text-muted-foreground text-sm">Maaf, halaman ini hanya dapat diakses oleh Administrator Sistem.</p>
                </Card>
            </div>
        );
    }

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Manajemen User</h1>
                <p className="text-muted-foreground">
                    Kelola hak akses, status approval, dan keamanan akun karyawan.
                </p>
            </div>
            {isSuperAdmin && (
                <Badge className="bg-red-600 px-3 py-1 animate-pulse">SUPER ADMIN MODE</Badge>
            )}
        </div>
        
        <Card>
            <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Daftar Karyawan Terdaftar
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="w-full overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>KARYAWAN</TableHead>
                                <TableHead>ROLE AKSES</TableHead>
                                <TableHead>STATUS AKUN</TableHead>
                                <TableHead className="text-right">TINDAKAN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8">Memuat data user...</TableCell></TableRow>}
                            {allUsers?.map((u) => {
                                const isSelf = u.uid === currentUser?.uid;
                                const isTargetSuperAdmin = u.email === 'fa@gmail.com';
                                
                                return (
                                    <TableRow key={u.uid} className={cn(
                                        u.status === 'pending' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : '',
                                        isTargetSuperAdmin ? 'border-l-4 border-l-red-500' : ''
                                    )}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className={isTargetSuperAdmin ? 'bg-red-600 text-white' : ''}>
                                                        {u.displayName?.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold">{u.displayName}</span>
                                                        {isSelf && <Badge variant="outline" className="text-[8px] h-4">SAYA</Badge>}
                                                        {isTargetSuperAdmin && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[8px] h-4"><Star className="h-2 w-2 mr-1" /> LEADER</Badge>}
                                                        {u.status === 'pending' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-[8px] h-4">NEW</Badge>}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{u.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {u.role === 'admin' || isTargetSuperAdmin ? <ShieldCheck className="h-4 w-4 text-primary" /> : <ShieldAlert className="h-4 w-4 text-muted-foreground" />}
                                                <Select 
                                                    value={isTargetSuperAdmin ? 'admin' : (u.role || 'staff')} 
                                                    onValueChange={(val) => handleRoleChange(u.uid, u.email, val as 'admin' | 'staff')}
                                                    disabled={isTargetSuperAdmin || isSelf || u.status === 'pending'}
                                                >
                                                    <SelectTrigger className="w-32 h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="staff">Staff</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant={u.status === 'suspended' ? 'destructive' : (u.status === 'pending' ? 'outline' : 'outline')} 
                                                className={cn(
                                                    u.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : '',
                                                    u.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : ''
                                                )}
                                            >
                                                {u.status === 'suspended' ? 'Non-Aktif (Suspend)' : (u.status === 'pending' ? 'Pending Approval' : 'Aktif')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {u.status === 'pending' && (
                                                    <Button 
                                                        variant="default" 
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700 h-8"
                                                        onClick={() => handleStatusChange(u.uid, u.email, 'active')}
                                                    >
                                                        <UserPlus className="mr-2 h-4 w-4" /> Setujui & Aktifkan
                                                    </Button>
                                                )}
                                                
                                                {!isSelf && !isTargetSuperAdmin && u.status !== 'pending' && (
                                                    <Button 
                                                        variant={u.status === 'suspended' ? 'outline' : 'destructive'} 
                                                        size="sm"
                                                        className="h-8"
                                                        onClick={() => handleStatusChange(u.uid, u.email, u.status === 'suspended' ? 'active' : 'suspended')}
                                                    >
                                                        {u.status === 'suspended' ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
                                                        {u.status === 'suspended' ? 'Aktifkan Akun' : 'Suspend'}
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
