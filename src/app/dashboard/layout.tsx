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
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
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
  Settings,
  Bell,
  Search,
  UserCog,
  LogOut,
  Plus,
  TrendingUp,
  CreditCard,
  Layers,
  History,
  Clock,
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
import React, { useEffect, useMemo, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '../components/theme-toggle';
import { cn } from '@/lib/utils';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, query, collection, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import type { UserProfile, Invoice, Customer, ProductListItem, SalesListItem, SalesOrder, AppNotification } from '@/app/lib/data';
import { startOfToday, isBefore, parseISO } from 'date-fns';
import { TOOLTIP_CONTENT } from '../lib/tooltip-content';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// --- SHARED DATA CONTEXT FOR INSTANT NAVIGATION ---
interface DashboardDataContextType {
    invoices: Invoice[] | null;
    customers: Customer[] | null;
    products: ProductListItem[] | null;
    sales: SalesListItem[] | null;
    salesOrders: SalesOrder[] | null;
    isLoading: boolean;
}

const DashboardDataContext = createContext<DashboardDataContextType>({
    invoices: null,
    customers: null,
    products: null,
    sales: null,
    salesOrders: null,
    isLoading: true
});

export const useDashboardData = () => useContext(DashboardDataContext);

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

  // --- GLOBAL REAL-TIME LISTENERS (PRE-FETCHING) ---
  const invoicesQuery = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'invoices'))), [firestore]);
  const { data: allInvoices, isLoading: invLoading } = useCollection<Invoice>(invoicesQuery);

  const customersQuery = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'customers'))), [firestore]);
  const { data: allCustomers, isLoading: custLoading } = useCollection<Customer>(customersQuery);

  const productsQuery = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'products'))), [firestore]);
  const { data: allProducts, isLoading: prodLoading } = useCollection<ProductListItem>(productsQuery);

  const salesQuery = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'sales'))), [firestore]);
  const { data: allSales, isLoading: salesLoading } = useCollection<SalesListItem>(salesQuery);

  const soQuery = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'salesOrders'))), [firestore]);
  const { data: allSalesOrders, isLoading: soLoading } = useCollection<SalesOrder>(soQuery);

  // NOTIFICATIONS LISTENER (SYNCHRONIZED WITH RULES)
  const notifQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    
    // Penanganan Khusus Super Admin (fa@gmail.com)
    // Jika Super Admin, tampilkan seluruh notifikasi global. Jika user biasa, filter wajib berdasarkan recipientId.
    if (user.email === 'fa@gmail.com') {
      return query(
        collection(firestore, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
    } else {
      return query(
        collection(firestore, 'notifications'),
        where('recipientId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
    }
  }, [firestore, user]);
  const { data: notifications } = useCollection<AppNotification>(notifQuery);

  const unreadNotifCount = useMemo(() => {
    return notifications?.filter(n => n.status === 'unread').length || 0;
  }, [notifications]);

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!firestore) return;
    // Mark as read
    await updateDoc(doc(firestore, 'notifications', notif.id), { status: 'read' });
    // Navigate to invoice
    router.push(`/dashboard/invoices`);
  };

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const isSuperAdmin = user?.email?.toLowerCase() === 'fa@gmail.com' || userProfile?.email?.toLowerCase() === 'fa@gmail.com';
  const userRole = isSuperAdmin ? 'Leader' : (userProfile?.role === 'admin' ? 'Admin' : 'Staf');

  const overdueCount = useMemo(() => {
    if (!allInvoices) return 0;
    const today = startOfToday();
    return allInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate && isBefore(parseISO(inv.dueDate), today)).length;
  }, [allInvoices]);

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

  const contextValue = useMemo(() => ({
    invoices: allInvoices,
    customers: allCustomers,
    products: allProducts,
    sales: allSales,
    salesOrders: allSalesOrders,
    isLoading: invLoading && custLoading && prodLoading && salesLoading && soLoading
  }), [allInvoices, allCustomers, allProducts, allSales, allSalesOrders, invLoading, custLoading, prodLoading, salesLoading, soLoading]);

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
           <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
           <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Dakota Hub Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardDataContext.Provider value={contextValue}>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="glass-sidebar">
          <SidebarHeader className="p-6 mb-4">
            <div className="flex items-center gap-3 transition-all duration-300">
              <div className="bg-primary rounded-xl p-2.5 shadow-lg shadow-primary/20">
                  <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="font-black text-xl tracking-tighter text-white uppercase italic">Dakota Hub</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Intelligence v2.0</span>
              </div>
            </div>

            <div className="mt-8 group-data-[collapsible=icon]:hidden">
               <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-primary transition-colors" />
                  <Input 
                      placeholder="Quick Search..." 
                      className="h-9 w-full bg-slate-800/50 border-none text-xs rounded-full pl-9 pr-12 focus-visible:ring-1 focus-visible:ring-primary/50 text-slate-200"
                  />
               </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 px-2">Core Access</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard'} className="hover:bg-slate-800/50 rounded-xl py-5 transition-smooth" tooltip={TOOLTIP_CONTENT.nav_dashboard}>
                    <Link href="/dashboard" className="flex items-center gap-3">
                      <LayoutDashboard className={cn("h-4.5 w-4.5", pathname === '/dashboard' ? "text-white" : "text-slate-400")} />
                      <span className="font-bold text-sm">Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard/monitoring'} className="hover:bg-slate-800/50 rounded-xl py-5 transition-smooth" tooltip={TOOLTIP_CONTENT.nav_monitoring}>
                    <Link href="/dashboard/monitoring" className="flex items-center gap-3">
                      <Eye className={cn("h-4.5 w-4.5", pathname === '/dashboard/monitoring' ? "text-white" : "text-slate-400")} />
                      <span className="font-bold text-sm">Monitor Billing</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup className="mt-6">
              <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 px-2">Commercial Pipeline</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/sales-orders')} className="hover:bg-slate-800/50 rounded-xl py-5 transition-smooth" tooltip={TOOLTIP_CONTENT.nav_so}>
                    <Link href="/dashboard/sales-orders" className="flex items-center gap-3">
                      <ShoppingCart className={cn("h-4.5 w-4.5", pathname.startsWith('/dashboard/sales-orders') ? "text-white" : "text-slate-400")} />
                      <span className="font-bold text-sm">Sales Orders (SO)</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/invoices')} className="hover:bg-slate-800/50 rounded-xl py-5 transition-smooth" tooltip={TOOLTIP_CONTENT.nav_billing}>
                      <Link href="/dashboard/invoices" className="flex items-center gap-3">
                          <FileText className={cn("h-4.5 w-4.5", pathname.startsWith('/dashboard/invoices') ? "text-white" : "text-slate-400")} />
                          <span className="font-bold text-sm">Billing Docs</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard/sales-management'} className="hover:bg-slate-800/50 rounded-xl py-5 transition-smooth" tooltip={TOOLTIP_CONTENT.nav_ar}>
                      <Link href="/dashboard/sales-management" className="flex items-center gap-3">
                          <History className={cn("h-4.5 w-4.5", pathname === '/dashboard/sales-management' ? "text-white" : "text-slate-400")} />
                          <span className="font-bold text-sm">Buku Piutang (AR)</span>
                      </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup className="mt-6">
              <SidebarGroupLabel className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 px-2">Data Master</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/customers')} className="hover:bg-slate-800/50 rounded-xl py-5 transition-smooth" tooltip={TOOLTIP_CONTENT.nav_customers}>
                    <Link href="/dashboard/customers" className="flex items-center gap-3">
                      <Users className={cn("h-4.5 w-4.5", pathname.startsWith('/dashboard/customers') ? "text-white" : "text-slate-400")} />
                      <span className="font-bold text-sm">Customers</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/products')} className="hover:bg-slate-800/50 rounded-xl py-5 transition-smooth" tooltip={TOOLTIP_CONTENT.nav_catalog}>
                    <Link href="/dashboard/products" className="flex items-center gap-3">
                      <Package className={cn("h-4.5 w-4.5", pathname.startsWith('/dashboard/products') ? "text-white" : "text-slate-400")} />
                      <span className="font-bold text-sm">Material Catalog</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-slate-800/50">
              <div className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-2xl mb-4 border border-slate-800/50">
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                      <AvatarImage src={user?.photoURL || ""} />
                      <AvatarFallback className="bg-primary text-white font-black text-xs">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                      <span className="text-[8px] font-black uppercase text-primary leading-none mb-1 tracking-widest">{userRole} AUTH</span>
                      <span className="text-xs font-bold text-white truncate">{userProfile?.displayName || user?.email}</span>
                  </div>
              </div>
              <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl px-3 h-10 group-data-[collapsible=icon]:justify-center transition-smooth">
                  <LogOut className="h-4.5 w-4.5 mr-3 shrink-0" />
                  <span className="font-black text-[10px] uppercase tracking-widest group-data-[collapsible=icon]:hidden">Secure Exit</span>
              </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="bg-background">
          <header className="flex h-16 items-center gap-6 floating-topbar px-6 sticky top-0 z-40 transition-smooth">
              <SidebarTrigger className="text-slate-400 hover:text-primary transition-smooth" />
              
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 group-data-[collapsible=icon]:hidden">
                  <Layers className="h-3.5 w-3.5" />
                  <Link href="/dashboard/invoices" className="hover:text-primary transition-colors">Dakota Hub</Link>
                  <span className="mx-1 opacity-20">/</span>
                  <span className="text-slate-900 capitalize">{pathname.split('/').pop()?.replace('-', ' ')}</span>
              </div>

              <div className="flex items-center gap-4 ml-auto">
                  <ThemeToggle />
                  
                  {/* NOTIFICATION BELL */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-smooth">
                          <Bell className="h-5 w-5" />
                          {unreadNotifCount > 0 && (
                              <span className="absolute top-2 right-2 flex h-4 w-4">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[8px] font-black text-white items-center justify-center">
                                    {unreadNotifCount}
                                  </span>
                              </span>
                          )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80 p-2 rounded-2xl shadow-premium border-none ring-1 ring-slate-100" align="end">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest font-black text-slate-400 p-2 flex justify-between">
                          System Notifications
                          {unreadNotifCount > 0 && <Badge variant="secondary" className="bg-rose-50 text-rose-600 border-none text-[8px] h-4">New Action</Badge>}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-1" />
                        {notifications?.length === 0 ? (
                          <div className="p-8 text-center opacity-30">
                            <Clock className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Inbox is Empty</p>
                          </div>
                        ) : (
                          <div className="max-h-96 overflow-y-auto space-y-1">
                            {notifications?.map((n) => (
                              <DropdownMenuItem 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)}
                                className={cn(
                                  "p-3 rounded-xl cursor-pointer flex flex-col items-start gap-1 transition-colors",
                                  n.status === 'unread' ? "bg-indigo-50/50" : "hover:bg-slate-50"
                                )}
                              >
                                <div className="flex justify-between w-full">
                                  <span className="text-[10px] font-black text-indigo-700 uppercase">{n.title}</span>
                                  <span className="text-[8px] font-bold text-slate-400">{n.createdAt?.split('T')[0]}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-700 leading-tight">{n.message}</p>
                              </DropdownMenuItem>
                            ))}
                          </div>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="h-8 w-px bg-slate-100 mx-2" />

                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="relative h-10 w-10 rounded-2xl border-2 border-slate-50 p-0 hover:border-primary transition-all overflow-hidden shadow-sm">
                              <Avatar className="h-full w-full">
                                  <AvatarImage src={user?.photoURL || ""} />
                                  <AvatarFallback className="bg-slate-50 text-primary font-black">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64 p-2 rounded-2xl shadow-premium border-none ring-1 ring-slate-100" align="end">
                          <div className="p-4 mb-2 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[9px] font-black uppercase text-primary mb-1 leading-none tracking-widest">{userRole} IDENTIFIED</p>
                              <p className="text-sm font-black text-slate-900 truncate leading-none mt-2">{userProfile?.displayName || user?.email}</p>
                          </div>
                          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="rounded-xl py-3"><Settings className="mr-3 h-4 w-4" /> Account Center</DropdownMenuItem>
                          {isSuperAdmin && <DropdownMenuItem onClick={() => router.push('/dashboard/users')} className="rounded-xl py-3"><UserCog className="mr-3 h-4 w-4" /> Management Console</DropdownMenuItem>}
                          <DropdownMenuSeparator className="my-2" />
                          <DropdownMenuItem onClick={handleLogout} className="text-rose-600 rounded-xl py-3 focus:bg-rose-50 focus:text-rose-600"><LogOut className="mr-3 h-4 w-4" /> Secure Exit</DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
              </div>
          </header>

          <div className="flex-1 p-6 md:p-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DashboardDataContext.Provider>
  );
}