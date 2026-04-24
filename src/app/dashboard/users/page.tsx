
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
  import { UserCog, ShieldCheck, ShieldAlert, UserX, UserCheck, UserPlus } from 'lucide-react';
  
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
    const isAdmin = currentUserProfile?.role === 'admin';

    const usersCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore]);
    const { data: allUsers, isLoading } = useCollection<UserProfile>(usersCollection);

    const handleRoleChange = async (targetUserId: string, newRole: 'admin' | 'staff') => {
        if (!firestore || !isAdmin) return;
        const userRef = doc(firestore, 'users', targetUserId);
        try {
            await updateDoc(userRef, { role: newRole });
            toast({ title: "Role Berhasil Diubah", description: `User sekarang memiliki akses ${newRole}.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal Mengubah Role", description: "Periksa izin akses Anda." });
        }
    };

    const handleStatusChange = async (targetUserId: string, newStatus: 'active' | 'suspended' | 'pending') => {
        if (!firestore || !isAdmin) return;
        // Jangan suspend diri sendiri
        if (targetUserId === currentUser?.uid) {
            toast({ variant: "destructive", title: "Aksi Dibatalkan", description: "Anda tidak bisa menonaktifkan akun sendiri." });
            return;
        }

        const userRef = doc(firestore, 'users', targetUserId);
        try {
            await updateDoc(userRef, { status: newStatus });
            const message = newStatus === 'active' ? "Akun Diaktifkan" : (newStatus === 'suspended' ? "Akun Dinonaktifkan" : "Akun di-set Pending");
            toast({ 
                title: message,
                description: `Status user telah diperbarui.` 
            });
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal Mengubah Status", description: "Terjadi kesalahan saat memproses." });
        }
    };

    if (!isAdmin && !isLoading) {
        return <div className="p-8 text-center font-bold">Akses Ditolak. Halaman ini hanya untuk Administrator.</div>;
    }

    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen User</h1>
          <p className="text-muted-foreground">
            Kelola hak akses, status approval, dan keamanan akun karyawan.
          </p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Daftar Karyawan Terdaftar</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="w-full overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama / Email</TableHead>
                                <TableHead>Role Akses</TableHead>
                                <TableHead>Status Akun</TableHead>
                                <TableHead className="text-right">Tindakan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={4} className="text-center">Memuat data user...</TableCell></TableRow>}
                            {allUsers?.map((u) => (
                                <TableRow key={u.uid} className={u.status === 'pending' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{u.displayName}</span>
                                                {u.status === 'pending' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-[10px]">NEW</Badge>}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{u.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {u.role === 'admin' ? <ShieldCheck className="h-4 w-4 text-primary" /> : <ShieldAlert className="h-4 w-4 text-muted-foreground" />}
                                            <Select 
                                                value={u.role || 'staff'} 
                                                onValueChange={(val) => handleRoleChange(u.uid, val as 'admin' | 'staff')}
                                                disabled={u.uid === currentUser?.uid || u.status === 'pending'}
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
                                            {u.status === 'suspended' ? 'Non-Aktif' : (u.status === 'pending' ? 'Pending Approval' : 'Aktif')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {u.status === 'pending' && (
                                                <Button 
                                                    variant="default" 
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => handleStatusChange(u.uid, 'active')}
                                                >
                                                    <UserPlus className="mr-2 h-4 w-4" /> Setujui & Aktifkan
                                                </Button>
                                            )}
                                            
                                            {u.uid !== currentUser?.uid && u.status !== 'pending' && (
                                                <Button 
                                                    variant={u.status === 'suspended' ? 'outline' : 'destructive'} 
                                                    size="sm"
                                                    onClick={() => handleStatusChange(u.uid, u.status === 'suspended' ? 'active' : 'suspended')}
                                                >
                                                    {u.status === 'suspended' ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
                                                    {u.status === 'suspended' ? 'Aktifkan' : 'Suspend'}
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
