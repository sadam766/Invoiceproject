'use client';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  LayoutDashboard,
  Eye,
  FileText,
  Package,
  ShoppingCart,
  Users,
  BarChart,
  Settings,
  Calendar,
  ChevronDown,
  Bell,
  Search,
  UserCog,
  ShieldAlert,
  LogOut,
  BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import React, { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '../components/theme-toggle';
import { cn } from '@/lib/utils';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, query, collection, where } from 'firebase/firestore';
import type { UserProfile, Invoice, SalesListItem } from '@/app/lib/data';
import { parseISO, isBefore, startOfToday } from 'date-fns';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
  const userRole = isSuperAdmin ? 'Leader' : (userProfile?.role === 'admin' ? 'Admin' : 'Staf');
  const isAdmin = isSuperAdmin || userProfile?.role === 'admin';
  const isPending = !isSuperAdmin && userProfile?.status === 'pending';

  // Alerts Monitoring for Bell
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'invoices'));
  }, [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesQuery);

  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'sales'));
  }, [firestore]);
  const { data: allSales } = useCollection<SalesListItem>(salesQuery);

  const pendingUsersQuery = useMemoFirebase(() => {
      if (!firestore || !isSuperAdmin) return null;
      return query(collection(firestore, 'users'), where('status', '==', 'pending'));
  }, [firestore, isSuperAdmin]);
  const { data: pendingUsers } = useCollection<UserProfile>(pendingUsersQuery);

  const overdueInvoices = useMemo(() => {
    if (!allInvoices) return [];
    const today = startOfToday();
    return allInvoices.filter(inv => {
        if (inv.status === 'paid' || !inv.dueDate) return false;
        return isBefore(parseISO(inv.dueDate), today);
    });
  }, [allInvoices]);

  const emptyPoValue = useMemo(() => {
    if (!allSales) return [];
    return allSales.filter(s => s.amount <= 0);
  }, [allSales]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
           <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
           <p className="text-sm text-muted-foreground">Memuat Profil Dakota...</p>
        </div>
      </div>
    );
  }

  if (isPending) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto">
                    <ShieldAlert className="h-10 w-10 text-yellow-600 dark:text-yellow-50" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Menunggu Persetujuan</h1>
                    <p className="text-muted-foreground">
                        Halo <strong>{userProfile?.displayName}</strong>. Akun Anda berhasil dibuat namun saat ini berstatus <strong>Pending</strong>.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Mohon hubungi Leader (fa@gmail.com) untuk mengaktifkan akses Anda ke sistem.
                    </p>
                </div>
                <div className="pt-4">
                    <Button variant="outline" className="w-full" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" /> Keluar dari Sistem
                    </Button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="group-data-[collapsible=icon]:p-0">
          <div className="flex items-center gap-2 px-2 py-4 group-data-[collapsible=icon]:justify-center transition-all duration-200 overflow-hidden">
            <Avatar className="w-10 h-10 border-2 border-primary shrink-0">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-primary text-white font-bold">
                {userProfile?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
              <span className="font-bold text-sm truncate flex items-center gap-1">
                {userProfile?.displayName || user?.displayName || 'Admin Dakota'}
                {isSuperAdmin && <BadgeCheck className="h-3 w-3 text-blue-600" />}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                 {userRole}
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === '/dashboard'} 
                tooltip="Menampilkan ringkasan data statistik invoice, status pembayaran, dan grafik monitoring secara keseluruhan."
              >
                <Link href="/dashboard"><LayoutDashboard /> <span>Dashboard</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === '/dashboard/monitoring'} 
                tooltip="Memantau aktivitas log sistem dan status antrean data transaksi secara real-time."
              >
                <Link href="/dashboard/monitoring"><Eye /> <span>Monitoring</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <Collapsible asChild defaultOpen={pathname.startsWith('/dashboard/invoices')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Manajemen penagihan dokumen.">
                      <FileText /> <span>Invoices</span>
                      <div className="grow" />
                      <ChevronDown className={cn('h-4 w-4 transition-transform', 'group-data-[state=open]/collapsible:rotate-180')} />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={pathname === '/dashboard/invoices'}
                        tooltip="Daftar seluruh invoice (Draft, Final, Cancel) untuk pengecekan dan cetak ulang."
                      >
                        <Link href="/dashboard/invoices">Invoice List</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={pathname.startsWith('/dashboard/invoices/add')}
                        tooltip="Membuat draf invoice baru (Akses terbuka otomatis setelah registrasi nomor di Invoice Number)."
                      >
                        <Link href="/dashboard/invoices/number">Add Invoice</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={pathname === '/dashboard/invoices/number'}
                        tooltip="Wajib diisi pertama kali untuk mendaftarkan dan mengunci nomor urut invoice sebelum penagihan."
                      >
                        <Link href="/dashboard/invoices/number">Invoice Number</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                     <SidebarMenuSubItem>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={pathname === '/dashboard/invoices/virtual-account'}
                        tooltip="Manajemen akun pembayaran Virtual Account pelanggan."
                      >
                        <Link href="/dashboard/invoices/virtual-account">Virtual Account List</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                     <SidebarMenuSubItem>
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={pathname === '/dashboard/invoices/spd'}
                        tooltip="Sinkronisasi data pengiriman barang dengan invoice terkait."
                      >
                        <Link href="/dashboard/invoices/spd">SPD</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    {isAdmin && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton 
                            asChild 
                            isActive={pathname === '/dashboard/invoices/tax'}
                            tooltip="Mengelola nomor seri faktur pajak dan data perpajakan terkait invoice."
                          >
                            <Link href="/dashboard/invoices/tax">Tax Invoices</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname.startsWith('/dashboard/products')} 
                tooltip="Mengelola master data barang, jasa, kode produk, dan pengaturan harga satuan."
              >
                <Link href="/dashboard/products"><Package /> <span>Products</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === '/dashboard/sales-orders'} 
                tooltip="Manajemen dokumen pesanan pelanggan yang menjadi dasar pembuatan tagihan/invoice."
              >
                <Link href="/dashboard/sales-orders"><ShoppingCart /> <span>Sales Orders</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname.startsWith('/dashboard/customers')} 
                tooltip="Database profil pelanggan, alamat kirim, dan informasi detail kontak penagihan."
              >
                <Link href="/dashboard/customers"><Users /> <span>Customers</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

             <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={pathname.startsWith('/dashboard/sales')} 
                  tooltip="Laporan rekapitulasi seluruh transaksi penjualan yang telah dilakukan."
                >
                    <Link href="/dashboard/sales"><ShoppingCart /> <span>Sales List</span></Link>
                </SidebarMenuButton>
            </SidebarMenuItem>

            {isSuperAdmin && (
               <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === '/dashboard/users'} 
                    tooltip="Mengatur hak akses pengguna (Admin, Leader, Staff) dan keamanan akun."
                  >
                      <Link href="/dashboard/users"><UserCog /> <span>User Management</span></Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )}

             <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === '/dashboard/calendar'} 
                tooltip="Menampilkan jadwal jatuh tempo penagihan dan pengingat aktivitas harian."
              >
                <Link href="/dashboard/calendar"><Calendar /> <span>Calendar</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                {isAdmin && (
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                          asChild 
                          isActive={pathname === '/dashboard/settings'} 
                          tooltip="Konfigurasi profil perusahaan, nomor rekening/VA, logo, dan tanda tangan digital."
                        >
                            <Link href="/dashboard/settings"><Settings /> <span>Pengaturan</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )}
            </SidebarMenu>
            <Button variant="ghost" className="w-full justify-start mt-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4 shrink-0" />
                <span className="grow text-left group-data-[collapsible=icon]:hidden">Keluar</span>
            </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6 sticky top-0 z-30 transition-all duration-300">
            <SidebarTrigger className="-ml-1" />
            <div className="w-full flex-1">
               <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="search" placeholder="Cari data Dakota..." className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3" />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <ThemeToggle />
                
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="h-5 w-5" />
                            {(overdueInvoices.length > 0 || emptyPoValue.length > 0 || (isSuperAdmin && pendingUsers && pendingUsers.length > 0)) && (
                                <span className="absolute top-2 right-2.5 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                        <div className="p-4 border-b bg-muted/50"><h3 className="font-bold text-sm">Notifikasi Dakota</h3></div>
                        <div className="max-h-[350px] overflow-y-auto">
                            <div className="p-2 space-y-2">
                                {overdueInvoices.map(inv => (
                                    <div key={inv.id} className="p-3 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors cursor-pointer" onClick={() => router.push('/dashboard/invoices')}>
                                        <p className="text-sm font-bold text-red-700">Invoice Overdue!</p>
                                        <p className="text-xs text-red-600 mt-1">{inv.id} - {inv.customer}</p>
                                    </div>
                                ))}
                                {emptyPoValue.map(po => (
                                    <div key={po.poNumber} className="p-3 rounded-lg border border-yellow-100 bg-yellow-50/50 hover:bg-yellow-50 transition-colors cursor-pointer" onClick={() => router.push('/dashboard/sales')}>
                                        <p className="text-sm font-bold text-yellow-700">Amount PO Kosong</p>
                                        <p className="text-xs text-yellow-600 mt-1">PO: {po.poNumber} belum ada nilainya.</p>
                                    </div>
                                ))}
                                {isSuperAdmin && pendingUsers && pendingUsers.map(u => (
                                    <div key={u.uid} className="p-3 rounded-lg border bg-blue-50/50 hover:bg-blue-100/50 cursor-pointer transition-colors" onClick={() => router.push('/dashboard/users')}>
                                        <p className="text-sm font-semibold">User Baru Mendaftar</p>
                                        <p className="text-xs text-muted-foreground mt-1"><strong>{u.displayName || u.email}</strong></p>
                                        <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase mt-2"><UserCog className="h-3 w-3" /> Klik untuk aktivasi</div>
                                    </div>
                                ))}
                                {overdueInvoices.length === 0 && emptyPoValue.length === 0 && (!isSuperAdmin || (pendingUsers && pendingUsers.length === 0)) && (
                                    <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                        <Bell className="h-8 w-8 opacity-20" /><p>Tidak ada pemberitahuan baru.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full border-2 border-muted hover:border-primary transition-all">
                        <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.photoURL || ""} alt={userProfile?.displayName || "User"} />
                        <AvatarFallback>{userProfile?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold leading-none flex items-center gap-1">
                          {userProfile?.displayName || user?.displayName || "Leader Dakota"}
                          {isSuperAdmin && <BadgeCheck className="h-3 w-3 text-blue-600" />}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                        <div className="flex gap-1 mt-1">
                            <Badge variant="secondary" className="text-[10px] py-0">{userRole}</Badge>
                        </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link href="/dashboard/settings">Pengaturan Profil</Link></DropdownMenuItem>
                    {isSuperAdmin && <DropdownMenuItem asChild><Link href="/dashboard/users">User Management</Link></DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600"><LogOut className="mr-2 h-4 w-4" /> Keluar</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
