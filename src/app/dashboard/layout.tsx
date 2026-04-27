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
  SidebarGroup,
  SidebarGroupLabel,
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
  Plus,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Layers,
  History,
  AlertTriangle,
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

  // Alerts for Bell
  const invoicesQuery = useMemoFirebase(() => (!firestore ? null : query(collection(firestore, 'invoices'))), [firestore]);
  const { data: allInvoices } = useCollection<Invoice>(invoicesQuery);

  const overdueCount = useMemo(() => {
    if (!allInvoices) return 0;
    const today = startOfToday();
    return allInvoices.filter(inv => inv.status !== 'paid' && inv.dueDate && isBefore(parseISO(inv.dueDate), today)).length;
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

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
           <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
           <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Authenticating Dakota...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="glass-sidebar">
        <SidebarHeader className="p-4 mb-2">
          <div className="flex items-center gap-3 transition-all duration-300">
            <div className="bg-indigo-600 rounded-xl p-2 shadow-lg shadow-indigo-900/20">
                <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
              <span className="font-black text-lg tracking-tighter text-white uppercase italic">Dakota Hub</span>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Intelligence v2.0</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-2">Main Core</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/dashboard'} className="hover:bg-slate-800 transition-smooth rounded-xl">
                  <Link href="/dashboard" className="flex items-center gap-3 py-6">
                    <LayoutDashboard className={cn("h-5 w-5", pathname === '/dashboard' ? "text-indigo-400" : "text-slate-400")} />
                    <span className="font-bold text-sm">Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/dashboard/monitoring'} className="hover:bg-slate-800 transition-smooth rounded-xl">
                  <Link href="/dashboard/monitoring" className="flex items-center gap-3 py-6">
                    <Eye className={cn("h-5 w-5", pathname === '/dashboard/monitoring' ? "text-amber-400" : "text-slate-400")} />
                    <span className="font-bold text-sm">Real-time Monitor</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-2">Commercial Pipeline</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/sales-orders')} className="hover:bg-slate-800 rounded-xl">
                  <Link href="/dashboard/sales-orders" className="flex items-center gap-3 py-6">
                    <ShoppingCart className={cn("h-5 w-5", pathname.startsWith('/dashboard/sales-orders') ? "text-blue-400" : "text-slate-400")} />
                    <span className="font-bold text-sm">Active Orders (SO)</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/invoices')} className="hover:bg-slate-800 rounded-xl">
                    <Link href="/dashboard/invoices" className="flex items-center gap-3 py-6">
                        <FileText className={cn("h-5 w-5", pathname.startsWith('/dashboard/invoices') ? "text-emerald-400" : "text-slate-400")} />
                        <span className="font-bold text-sm">Billing Docs</span>
                    </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/dashboard/sales-management'} className="hover:bg-slate-800 rounded-xl">
                    <Link href="/dashboard/sales-management" className="flex items-center gap-3 py-6">
                        <History className={cn("h-5 w-5", pathname === '/dashboard/sales-management' ? "text-rose-400" : "text-slate-400")} />
                        <span className="font-bold text-sm">Buku Piutang (AR)</span>
                    </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-2">Data Master</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/customers')} className="hover:bg-slate-800 rounded-xl">
                  <Link href="/dashboard/customers" className="flex items-center gap-3 py-6">
                    <Users className={cn("h-5 w-5", pathname.startsWith('/dashboard/customers') ? "text-indigo-400" : "text-slate-400")} />
                    <span className="font-bold text-sm">Legal Customers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/products')} className="hover:bg-slate-800 rounded-xl">
                  <Link href="/dashboard/products" className="flex items-center gap-3 py-6">
                    <Package className={cn("h-5 w-5", pathname.startsWith('/dashboard/products') ? "text-amber-400" : "text-slate-400")} />
                    <span className="font-bold text-sm">Material Catalog</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 p-2 bg-slate-900 rounded-2xl mb-4">
                <Avatar className="h-10 w-10 border-2 border-indigo-500/50">
                    <AvatarImage src={user?.photoURL || ""} />
                    <AvatarFallback className="bg-indigo-600 text-white font-black">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                    <span className="text-[10px] font-black uppercase text-indigo-400 leading-none mb-1">{userRole}</span>
                    <span className="text-xs font-bold text-white truncate">{userProfile?.displayName || user?.email}</span>
                </div>
            </div>
            <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl px-2 h-11 group-data-[collapsible=icon]:justify-center">
                <LogOut className="h-5 w-5 mr-3 shrink-0" />
                <span className="font-black text-xs uppercase tracking-widest group-data-[collapsible=icon]:hidden">Sign Out</span>
            </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-slate-50/50">
        <header className="flex h-16 items-center gap-6 border-b bg-white/80 backdrop-blur-md px-6 sticky top-0 z-40 shadow-sm transition-all duration-300">
            <SidebarTrigger className="text-slate-400 hover:text-indigo-600" />
            
            <div className="flex-1 max-w-xl">
               <div className="relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <Input 
                    type="search" 
                    placeholder="Quick search documents, PO, or customer..." 
                    className="w-full h-10 bg-slate-50 border-none focus-visible:ring-2 focus-visible:ring-indigo-100 rounded-2xl pl-10 font-medium text-sm transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded border bg-white text-[10px] font-mono text-slate-400">CTRL</kbd>
                      <kbd className="px-1.5 py-0.5 rounded border bg-white text-[10px] font-mono text-slate-400">K</kbd>
                  </div>
                </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                <ThemeToggle />
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 h-10 px-6 rounded-2xl gap-2 font-black uppercase text-[10px] tracking-widest text-white transition-smooth active:scale-95">
                            <Plus className="h-4 w-4" /> Quick Add
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-premium border-none ring-1 ring-slate-100">
                        <DropdownMenuItem onClick={() => router.push('/dashboard/sales-orders')} className="rounded-xl py-3 cursor-pointer"><ShoppingCart className="mr-3 h-4 w-4 text-blue-500" /> Buat SO Baru</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/dashboard/sales')} className="rounded-xl py-3 cursor-pointer"><Layers className="mr-3 h-4 w-4 text-indigo-500" /> Daftarkan PO</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/dashboard/customers')} className="rounded-xl py-3 cursor-pointer"><Users className="mr-3 h-4 w-4 text-emerald-500" /> Tambah Customer</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100">
                    <Bell className="h-5 w-5" />
                    {overdueCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                        </span>
                    )}
                </Button>

                <div className="h-8 w-px bg-slate-200 mx-2" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-2xl border-2 border-slate-100 p-0 hover:border-indigo-400 transition-all overflow-hidden shadow-sm">
                            <Avatar className="h-full w-full">
                                <AvatarImage src={user?.photoURL || ""} />
                                <AvatarFallback className="bg-slate-50 text-indigo-600 font-black">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 p-2 rounded-2xl shadow-premium border-none ring-1 ring-slate-100" align="end">
                        <div className="p-4 mb-2 bg-slate-50 rounded-xl">
                            <p className="text-[10px] font-black uppercase text-indigo-600 mb-1 leading-none tracking-widest">{userRole} AUTHENTICATED</p>
                            <p className="text-sm font-black text-slate-900 truncate leading-none mt-2">{userProfile?.displayName || user?.email}</p>
                        </div>
                        <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="rounded-xl py-3"><Settings className="mr-3 h-4 w-4" /> Account Settings</DropdownMenuItem>
                        {isSuperAdmin && <DropdownMenuItem onClick={() => router.push('/dashboard/users')} className="rounded-xl py-3"><UserCog className="mr-3 h-4 w-4" /> Admin Console</DropdownMenuItem>}
                        <DropdownMenuSeparator className="my-2" />
                        <DropdownMenuItem onClick={handleLogout} className="text-rose-600 rounded-xl py-3 focus:bg-rose-50 focus:text-rose-600"><LogOut className="mr-3 h-4 w-4" /> Sign Out</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>

        <div className="flex-1 p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
