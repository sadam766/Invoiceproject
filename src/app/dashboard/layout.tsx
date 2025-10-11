
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
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '../components/theme-toggle';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [openMenus, setOpenMenus] = useState({
    invoices: pathname.startsWith('/dashboard/invoices'),
    products: pathname.startsWith('/dashboard/products'),
  });

  const toggleMenu = (menu: keyof typeof openMenus) => {
    setOpenMenus((prev) => ({ ...prev, [menu]: !prev[menu] }));
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8 bg-primary flex items-center justify-center">
              <span className="font-bold text-primary-foreground">A</span>
            </Avatar>
            <span className="font-semibold text-lg">Dakota</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/dashboard" passHref>
                <SidebarMenuButton isActive={pathname === '/dashboard'}>
                  <LayoutDashboard />
                  Dashboard
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/dashboard/monitoring" passHref>
                <SidebarMenuButton isActive={pathname === '/dashboard/monitoring'}>
                  <Eye />
                  Monitoring
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => toggleMenu('invoices')}>
                <FileText />
                Invoices
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${
                    openMenus.invoices ? 'rotate-180' : ''
                  }`}
                />
              </SidebarMenuButton>
              {openMenus.invoices && (
                <SidebarMenuSub>
                  <Link href="/dashboard/invoices" passHref>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices'}>
                      <a>Invoice List</a>
                    </SidebarMenuSubButton>
                  </Link>
                  <Link href="/dashboard/invoices/add" passHref>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/add'}>
                      <a>Add Invoice</a>
                    </SidebarMenuSubButton>
                  </Link>
                  <Link href="/dashboard/invoices/number" passHref>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/number'}>
                      <a>Invoice Number</a>
                    </SidebarMenuSubButton>
                  </Link>
                   <Link href="/dashboard/invoices/spd" passHref>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/spd'}>
                        <a>SPD</a>
                    </SidebarMenuSubButton>
                  </Link>
                  <Link href="/dashboard/invoices/tax" passHref>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/tax'}>
                      <a>Tax Invoices</a>
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => toggleMenu('products')}>
                <Package />
                Products
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${
                    openMenus.products ? 'rotate-180' : ''
                  }`}
                />
              </SidebarMenuButton>
              {openMenus.products && (
                <SidebarMenuSub>
                  <Link href="/dashboard/products" passHref>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/products'}>
                      <a>List Product</a>
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/dashboard/sales-orders" passHref>
                <SidebarMenuButton isActive={pathname === '/dashboard/sales-orders'}>
                  <ShoppingCart />
                  SalesOrders
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/dashboard/customers" passHref>
                <SidebarMenuButton isActive={pathname === '/dashboard/customers'}>
                  <Users />
                  Customers
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/dashboard/sales" passHref>
                    <SidebarMenuButton isActive={pathname === '/dashboard/sales'}>
                        <ShoppingCart />
                        Sales
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/dashboard/sales-management" passHref>
                    <SidebarMenuButton isActive={pathname === '/dashboard/sales-management'}>
                        <BarChart />
                        Sales Management
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton>
                <Calendar />
                Calendar
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
            <Button variant="ghost" className="w-full justify-start">
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
                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="@shadcn" />
                        <AvatarFallback>SN</AvatarFallback>
                        </Avatar>
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">shadcn</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            m@example.com
                        </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Log out</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
        {children}
        </SidebarInset>
    </SidebarProvider>
  );
}
