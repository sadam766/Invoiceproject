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
  CreditCard,
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
import type { UserProfile } from '@/app/lib/data';

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
  const userRole = isSuperAdmin ? 'admin' : (userProfile?.role || 'staff');
  const isAdmin = userRole === 'admin';
  const isPending = !isSuperAdmin && userProfile?.status === 'pending';

  const pendingUsersQuery = useMemoFirebase(() => {
      if (!firestore || !isAdmin) return null;
      return query(collection(firestore, 'users'), where('status', '==', 'pending'));
  }, [firestore, isAdmin]);
  const { data: pendingUsers } = useCollection<UserProfile>(pendingUsersQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (userProfile?.status === 'suspended' && !isSuperAdmin) {
        signOut(auth).then(() => router.push('/login'));
    }
  }, [userProfile, auth, router, isSuperAdmin]);

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
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-4">
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
                 {isSuperAdmin ? 'Leader / Admin' : userRole}
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip="Dashboard">
                <Link href="/dashboard"><LayoutDashboard /> <span>Dashboard</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard/monitoring'} tooltip="Monitoring">
                <Link href="/dashboard/monitoring"><Eye /> <span>Monitoring</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <Collapsible asChild defaultOpen={pathname.startsWith('/dashboard/invoices')} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Invoices">
                      <FileText /> <span>Invoices</span>
                      <div className="grow" />
                      <ChevronDown className={cn('h-4 w-4 transition-transform', 'group-data-[state=open]/collapsible:rotate-180')} />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices'}>
                        <Link href="/dashboard/invoices">Invoice List</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname.startsWith('/dashboard/invoices/add')}>
                        <Link href="/dashboard/invoices/add">Add Invoice</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/number'}>
                        <Link href="/dashboard/invoices/number">Invoice Number</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                     <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/virtual-account'}>
                        <Link href="/dashboard/invoices/virtual-account">Virtual Account List</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                     <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/spd'}>
                        <Link href="/dashboard/invoices/spd">SPD</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/tax'}>
                        <Link href="/dashboard/invoices/tax">Tax Invoices</Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/products')} tooltip="Products">
                <Link href="/dashboard/products"><Package /> <span>Products</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard/sales-orders'} tooltip="Sales Orders">
                <Link href="/dashboard/sales-orders"><ShoppingCart /> <span>SalesOrders</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/customers')} tooltip="Customers">
                <Link href="/dashboard/customers"><Users /> <span>Customers</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/sales')} tooltip="Sales List">
                    <Link href="/dashboard/sales"><ShoppingCart /> <span>Sales List</span></Link>
                </SidebarMenuButton>
            </SidebarMenuItem>

            {isAdmin && (
               <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard/sales-management'} tooltip="Sales Management">
                      <Link href="/dashboard/sales-management"><BarChart /> <span>Sales Management</span></Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {isAdmin && (
               <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard/users'} tooltip="User Management">
                      <Link href="/dashboard/users"><UserCog /> <span>User Management</span></Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )}

             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard/calendar'} tooltip="Calendar">
                <Link href="/dashboard/calendar"><Calendar /> <span>Calendar</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/dashboard/settings'} tooltip="Pengaturan">
                        <Link href="/dashboard/settings"><Settings /> <span>Pengaturan</span></Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
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
                            {isAdmin && pendingUsers && pendingUsers.length > 0 && (
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
                            {isAdmin && pendingUsers && pendingUsers.length > 0 ? (
                                <div className="p-2 space-y-2">
                                    {pendingUsers.map(u => (
                                        <div key={u.uid} className="p-3 rounded-lg border bg-yellow-50/50 hover:bg-yellow-100/50 cursor-pointer transition-colors" onClick={() => router.push('/dashboard/users')}>
                                            <p className="text-sm font-semibold">User Baru Mendaftar</p>
                                            <p className="text-xs text-muted-foreground mt-1"><strong>{u.displayName || u.email}</strong></p>
                                            <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase mt-2"><UserCog className="h-3 w-3" /> Klik untuk aktivasi</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                                    <Bell className="h-8 w-8 opacity-20" /><p>Tidak ada pemberitahuan baru.</p>
                                </div>
                            )}
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
                            <Badge variant="secondary" className="text-[10px] py-0">{isSuperAdmin ? 'Leader' : userRole}</Badge>
                        </div>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link href="/dashboard/settings">Pengaturan Profil</Link></DropdownMenuItem>
                    {isAdmin && <DropdownMenuItem asChild><Link href="/dashboard/users">User Management</Link></DropdownMenuItem>}
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
