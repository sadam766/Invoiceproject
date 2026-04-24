
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
  Globe,
  Bell,
  PanelLeft,
  Search,
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
import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '../components/theme-toggle';
import { cn } from '@/lib/utils';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';

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

  // Fetch user profile to get the role
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

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
           <p className="text-sm text-muted-foreground">Memuat Profil...</p>
        </div>
      </div>
    );
  }

  const userRole = userProfile?.role || 'staff';
  const isAdmin = userRole === 'admin';

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8 bg-primary flex items-center justify-center">
              <span className="font-bold text-primary-foreground">
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-none">Dakota</span>
              <span className="text-[10px] text-muted-foreground uppercase mt-1">{userRole}</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {/* Menu Dashboard hanya untuk Admin atau bisa untuk semua tapi data di dalamnya dibatasi */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/dashboard'}
              >
                <Link href="/dashboard">
                  <LayoutDashboard />
                  Dashboard
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/dashboard/monitoring'}
              >
                <Link href="/dashboard/monitoring">
                  <Eye />
                  Monitoring
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <Collapsible asChild defaultOpen={pathname.startsWith('/dashboard/invoices')}>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <FileText />
                      Invoices
                      <div className="grow" />
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          'group-data-[state=open]:rotate-180'
                        )}
                      />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices'}>
                        <Link href="/dashboard/invoices">
                          Invoice List
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname.startsWith('/dashboard/invoices/add')}>
                        <Link href="/dashboard/invoices/add">
                         Add Invoice
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/number'}>
                        <Link href="/dashboard/invoices/number">
                          Invoice Number
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                     <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/spd'}>
                        <Link href="/dashboard/invoices/spd">
                            SPD
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/tax'}>
                        <Link href="/dashboard/invoices/tax">
                          Tax Invoices
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/products')}>
                <Link href="/dashboard/products">
                  <Package />
                  Products
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard/sales-orders'}>
                <Link href="/dashboard/sales-orders">
                  <ShoppingCart />
                  SalesOrders
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/customers')}>
                <Link href="/dashboard/customers">
                  <Users />
                  Customers
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Menu Sales List bisa dilihat semua */}
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/sales')}>
                    <Link href="/dashboard/sales">
                        <ShoppingCart />
                        Sales List
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Menu Sales Management HANYA untuk Admin */}
            {isAdmin && (
               <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/dashboard/sales-management'}>
                      <Link href="/dashboard/sales-management">
                          <BarChart />
                          Sales Management
                      </Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )}

             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/dashboard/calendar'}>
                <Link href="/dashboard/calendar">
                  <Calendar />
                  Calendar
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <Button variant="ghost" className="w-full justify-start" onClick={() => router.refresh()}>
                <PanelLeft className="mr-2 h-4 w-4" />
                <span className="grow">Collapse</span>
                <span>&#8984;B</span>
            </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6 sticky top-0 z-30">
            <SidebarTrigger className="md:hidden" />
            <div className="w-full flex-1">
               <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search..."
                    className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                  />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon">
                    <Globe className="h-5 w-5" />
                </Button>
                <ThemeToggle />
                <Button variant="ghost" size="icon">
                    <LayoutDashboard className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon">
                    <Bell className="h-5 w-5" />
                </Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                        <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.photoURL || "https://i.pravatar.cc/150?u=a042581f4e29026704d"} alt={user?.displayName || "User"} />
                        <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.displayName || "Pengguna"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user?.email || "Tidak ada email"}
                        </p>
                        <Badge variant="secondary" className="w-fit text-[10px] mt-1">{userRole}</Badge>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>Log out</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        {children}
        </SidebarInset>
    </SidebarProvider>
  );
}
