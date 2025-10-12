
'use client';
import { useState, useMemo } from 'react';
import {
    Card,
    CardContent,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import { customerListData, type Customer } from '@/app/lib/data';
  import { Search, Upload, Download, Plus } from 'lucide-react';
  import { AddCustomerDialog } from './_components/add-customer-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  
  export default function CustomerListPage() {
    const [customers, setCustomers] = useState(customerListData);
    const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCustomers = useMemo(() => {
        if (!searchQuery) {
          return customers;
        }
        return customers.filter((customer) =>
          Object.values(customer).some((value) =>
            String(value).toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
      }, [customers, searchQuery]);

    const handleAddClick = () => {
      setEditingCustomer(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
    };

    const handleDelete = (customerId: string) => {
        setCustomers(customers.filter((c) => c.id !== customerId));
    };

    const handleSave = (customer: Omit<Customer, 'id'>) => {
        if (editingCustomer) {
          // Editing existing customer
          setCustomers(customers.map((c) => c.id === editingCustomer.id ? { ...customer, id: c.id } : c));
        } else {
          // Adding new customer
          const newCustomer = { ...customer, id: (Math.random() + 1).toString(36).substring(7) };
          setCustomers([...customers, newCustomer]);
        }
        setIsDialogOpen(false);
        setEditingCustomer(undefined);
      };

    const handleDialogStateChange = (open: boolean) => {
      setIsDialogOpen(open);
      if (!open) {
        setEditingCustomer(undefined);
      }
    }
    
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer List</h1>
          <p className="text-muted-foreground">
            Manage your customer base.
          </p>
        </div>
        
        <Card>
            <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                    <div className="relative w-1/3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search" 
                            placeholder="Search Customer" 
                            className="pl-8" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline"><Upload className="mr-2 h-4 w-4"/> Import</Button>
                       <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export</Button>
                       <AddCustomerDialog
                         isOpen={isDialogOpen}
                         onOpenChange={handleDialogStateChange}
                         onSave={handleSave}
                         customerData={editingCustomer}
                         onAddClick={handleAddClick}
                       />
                    </div>
                </div>

                <div className="w-full overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>CUSTOMER</TableHead>
                                <TableHead>ALAMAT</TableHead>
                                <TableHead>ALAMAT SPD</TableHead>
                                <TableHead>TINDAKAN</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers?.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.name}</TableCell>
                                    <TableCell>{customer.address}</TableCell>
                                    <TableCell>{customer.spdAddress}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(customer)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(customer.id!)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {filteredCustomers?.length || 0} of {customers?.length || 0} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
