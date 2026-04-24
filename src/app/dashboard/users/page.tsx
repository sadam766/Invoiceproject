'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, query } from 'firebase/firestore';
import { type UserProfile } from '@/app/lib/data';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldAlert, UserX, UserCheck, UserPlus, Star, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
  
export default function UserManagementPage() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();

    // Leader Check
    const currentUserProfileRef = useMemoFirebase(() => {
        if (!firestore || !currentUser) return null;
        return doc(firestore, 'users', currentUser.uid);
    }, [firestore, currentUser]);
    const { data: currentUserProfile } = useDoc<UserProfile>(currentUserProfileRef);
    
    const isSuperAdmin = currentUserProfile?.email === 'fa@gmail.com';
    const isAdmin = isSuperAdmin || currentUserProfile?.role === 'admin';

    const usersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allUsers, isLoading } = useCollection<UserProfile>(usersCollection);

    const handleRoleChange = async (targetUserId: string, targetEmail: string, newRole: 'admin' | 'staff') => {
        if (!firestore || !isAdmin) return;
        if (targetEmail === 'fa@gmail.com' && !isSuperAdmin) {
            toast({ variant: "destructive", title: "Akses Ditolak", description: "Otoritas Leader Utama tidak dapat diubah." });
            return;
        }
        try {
            await updateDoc(doc(firestore, 'users', targetUserId), { role: newRole });
            toast({ title: "Role Diperbarui", description: `${targetEmail} sekarang adalah ${newRole}.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui role." });
        }
    };

    const handleStatusChange = async (targetUserId: string, targetEmail: string, newStatus: 'active' | 'suspended' | 'pending') => {
        if (!firestore || !isAdmin) return;
        if (targetUserId === currentUser?.uid || targetEmail === 'fa@gmail.com') {
            toast({ variant: "destructive", title: "Dibatalkan", description: "Proteksi Leader/Diri Sendiri aktif." });
            return;
        }
        try {
            await updateDoc(doc(firestore, 'users', targetUserId), { status: newStatus });
            toast({ title: "Status Diperbarui", description: `Akun ${targetEmail} sekarang ${newStatus}.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui status." });
        }
    };

    if (!isAdmin && !isLoading) return <div className="p-8 text-center"><ShieldAlert className="h-12 w-12 mx-auto" /><h2>Akses Terbatas</h2></div>;

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Manajemen User</h1>
                <p className="text-muted-foreground">Kelola persetujuan pendaftaran dan hak akses karyawan.</p>
            </div>
            {isSuperAdmin && <Badge className="bg-red-600 px-3 py-1 animate-pulse">SUPER ADMIN MODE</Badge>}
        </div>
        
        <Card>
            <CardHeader className="border-b bg-muted/20"><CardTitle className="text-lg">Karyawan Terdaftar</CardTitle></CardHeader>
            <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>KARYAWAN</TableHead>
                            <TableHead>HAK AKSES</TableHead>
                            <TableHead>STATUS</TableHead>
                            <TableHead className="text-right">TINDAKAN</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8">Memuat...</TableCell></TableRow>}
                        {allUsers?.map((u) => {
                            const isSelf = u.uid === currentUser?.uid;
                            const isTargetLeader = u.email === 'fa@gmail.com';
                            return (
                                <TableRow key={u.uid} className={cn(u.status === 'pending' ? 'bg-yellow-50/50' : '', isTargetLeader ? 'border-l-4 border-l-blue-600' : '')}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8"><AvatarFallback className={isTargetLeader ? 'bg-blue-600 text-white' : ''}>{u.displayName?.charAt(0)}</AvatarFallback></Avatar>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2"><span className="font-bold">{u.displayName}</span>{isTargetLeader && <BadgeCheck className="h-3 w-3 text-blue-600" />}</div>
                                                <span className="text-xs text-muted-foreground">{u.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select value={isTargetLeader ? 'admin' : (u.role || 'staff')} onValueChange={(val) => handleRoleChange(u.uid, u.email, val as any)} disabled={isTargetLeader || isSelf || u.status === 'pending'}>
                                            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className={cn(u.status === 'active' ? 'bg-green-100 text-green-800' : (u.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'))}>{u.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        {u.status === 'pending' ? (
                                            <Button size="sm" className="bg-green-600 h-8" onClick={() => handleStatusChange(u.uid, u.email, 'active')}><UserPlus className="mr-2 h-4 w-4" /> Aktifkan</Button>
                                        ) : !isSelf && !isTargetLeader && (
                                            <Button variant={u.status === 'suspended' ? 'outline' : 'destructive'} size="sm" className="h-8" onClick={() => handleStatusChange(u.uid, u.email, u.status === 'suspended' ? 'active' : 'suspended')}>
                                                {u.status === 'suspended' ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>
    );
  }
