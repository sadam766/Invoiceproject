
'use client';
import { useState } from 'react';
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

    const handleAdd = () => {
      setEditingCustomer(undefined);
      setIsDialogOpen(true);
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
    };

    const handleDelete = (customerName: string) => {
        setCustomers(customers.filter((c) => c.name !== customerName));
    };

    const handleSave = (customer: Customer) => {
      if (editingCustomer && editingCustomer.name === customer.name) {
        // Editing existing customer
        setCustomers(customers.map((c) => c.name === customer.name ? customer : c));
      } else if (editingCustomer) {
        // Editing existing customer but with new name (treat as delete old and add new)
        const filteredCustomers = customers.filter(c => c.name !== editingCustomer.name);
        setCustomers([...filteredCustomers, customer]);
      } else {
        // Adding new customer
        setCustomers([...customers, customer]);
      }
      setIsDialogOpen(false);
      setEditingCustomer(undefined);
    };

    const handleDialogClose = () => {
      setIsDialogOpen(false);
      setEditingCustomer(undefined);
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
                        <Input type="search" placeholder="Search Customer" className="pl-8" />
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline"><Upload className="mr-2 h-4 w-4"/> Import</Button>
                       <Button variant="outline"><Download className="mr-2 h-4 w-4"/> Export</Button>
                       <AddCustomerDialog
                         isOpen={isDialogOpen}
                         onOpenChange={handleDialogClose}
                         onSave={handleSave}
                         customerData={editingCustomer}
                         onAddClick={handleAdd}
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
                            {customers.map((customer) => (
                                <TableRow key={customer.name}>
                                    <TableCell className="font-medium">{customer.name}</TableCell>
                                    <TableCell>{customer.address}</TableCell>
                                    <TableCell>{customer.spdAddress}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEdit(customer)}>Edit</Button>
                                            <DeleteConfirmationDialog onConfirm={() => handleDelete(customer.name)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {customers.length} of {customers.length} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }
  
