
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
import { ShieldAlert, UserX, UserCheck, UserPlus, BadgeCheck, MailPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
  
export default function UserManagementPage() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();

    // Leader Check: Hardcoded override for fa@gmail.com
    const currentUserProfileRef = useMemoFirebase(() => {
        if (!firestore || !currentUser) return null;
        return doc(firestore, 'users', currentUser.uid);
    }, [firestore, currentUser]);
    const { data: currentUserProfile } = useDoc<UserProfile>(currentUserProfileRef);
    
    const isSuperAdmin = currentUser?.email?.toLowerCase() === 'fa@gmail.com' || currentUserProfile?.email?.toLowerCase() === 'fa@gmail.com';

    const usersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allUsers, isLoading } = useCollection<UserProfile>(usersCollection);

    const handleRoleChange = async (targetUserId: string, targetEmail: string, newRole: 'admin' | 'staff') => {
        if (!firestore || !isSuperAdmin) return;
        if (targetEmail.toLowerCase() === 'fa@gmail.com') {
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
        if (!firestore || !isSuperAdmin) return;
        if (targetUserId === currentUser?.uid || targetEmail.toLowerCase() === 'fa@gmail.com') {
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

    if (!isSuperAdmin && !isLoading) return (
        <div className="p-8 text-center flex flex-col items-center gap-4">
            <ShieldAlert className="h-12 w-12 text-destructive" />
            <div>
                <h2 className="text-xl font-bold">Akses Terbatas</h2>
                <p className="text-muted-foreground">Halaman ini hanya dapat diakses oleh Leader Utama (fa@gmail.com).</p>
            </div>
        </div>
    );

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">User Management (Leader Only)</h1>
                <p className="text-muted-foreground">Kelola hak akses karyawan dan aktifkan akun pendaftar baru.</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="h-9">
                    <MailPlus className="mr-2 h-4 w-4" /> Invite Staff
                </Button>
                <Badge className="bg-red-600 px-3 py-1 animate-pulse">Otoritas Leader Aktif</Badge>
            </div>
        </div>
        
        <Card>
            <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg">Daftar Pengguna Sistem</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>KARYAWAN</TableHead>
                            <TableHead>HAK AKSES (ROLE)</TableHead>
                            <TableHead>STATUS AKUN</TableHead>
                            <TableHead className="text-right">AKSI KONTROL</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8">Memuat data user...</TableCell></TableRow>}
                        {!isLoading && allUsers?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8">Belum ada user yang mendaftar.</TableCell></TableRow>}
                        {allUsers?.map((u) => {
                            const isSelf = u.uid === currentUser?.uid;
                            const isTargetLeader = u.email?.toLowerCase() === 'fa@gmail.com';
                            return (
                                <TableRow key={u.uid} className={cn(u.status === 'pending' ? 'bg-yellow-50/50' : '', isTargetLeader ? 'border-l-4 border-l-blue-600' : '')}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border">
                                                <AvatarFallback className={isTargetLeader ? 'bg-blue-600 text-white font-bold' : 'font-bold'}>
                                                    {u.displayName?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm">{u.displayName || 'No Name'}</span>
                                                    {isTargetLeader && <BadgeCheck className="h-3 w-3 text-blue-600" />}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">{u.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select 
                                            value={isTargetLeader ? 'admin' : (u.role || 'staff')} 
                                            onValueChange={(val) => handleRoleChange(u.uid, u.email, val as any)} 
                                            disabled={isTargetLeader || isSelf}
                                        >
                                            <SelectTrigger className="w-32 h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="staff">Staf Biasa</SelectItem>
                                                <SelectItem value="admin">Administrator</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] uppercase font-bold",
                                            u.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 
                                            (u.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200')
                                        )}>
                                            {u.status || 'pending'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {u.status === 'pending' ? (
                                                <Button size="sm" className="bg-green-600 h-8 hover:bg-green-700 text-xs" onClick={() => handleStatusChange(u.uid, u.email, 'active')}>
                                                    <UserPlus className="mr-2 h-3 w-3" /> Aktifkan User
                                                </Button>
                                            ) : !isSelf && !isTargetLeader && (
                                                <Button variant={u.status === 'suspended' ? 'outline' : 'destructive'} size="sm" className="h-8 text-xs" onClick={() => handleStatusChange(u.uid, u.email, u.status === 'suspended' ? 'active' : 'suspended')}>
                                                    {u.status === 'suspended' ? <UserCheck className="h-3 w-3 mr-2" /> : <UserX className="h-3 w-3 mr-2" />}
                                                    {u.status === 'suspended' ? 'Restore' : 'Freeze'}
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Activity Hub Mini - Visible only to Leader */}
        <Card className="border-dashed">
            <CardHeader><CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2"><Eye className="h-4 w-4" /> Activity Monitor</CardTitle></CardHeader>
            <CardContent>
                <div className="text-[10px] text-muted-foreground italic py-4 text-center">
                    Fitur Activity Log (Audit Trail) sedang dalam tahap sinkronisasi data...
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
