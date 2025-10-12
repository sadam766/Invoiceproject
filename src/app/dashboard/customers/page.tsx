
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
  import { type Customer } from '@/app/lib/data';
  import { Search, Upload, Download, Plus } from 'lucide-react';
  import { AddCustomerDialog } from './_components/add-customer-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
  import { collection, doc } from 'firebase/firestore';
  import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
  import { Skeleton } from '@/components/ui/skeleton';
  
  export default function CustomerListPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();

    const customersCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'customers');
    }, [firestore, user]);

    const { data: customers, isLoading: isCustomersLoading } = useCollection<Customer>(customersCollection);
    const isLoading = isUserLoading || isCustomersLoading;

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

    const handleDelete = (customerId: string) => {
        if (!firestore) return;
        const customerDocRef = doc(firestore, 'customers', customerId);
        deleteDocumentNonBlocking(customerDocRef);
    };

    const handleSave = (customer: Omit<Customer, 'id'>) => {
        if (!firestore) return;
    
        if (editingCustomer) {
          // Editing existing customer
          const customerDocRef = doc(firestore, 'customers', editingCustomer.id!);
          updateDocumentNonBlocking(customerDocRef, customer);
        } else {
          // Adding new customer
          addDocumentNonBlocking(collection(firestore, 'customers'), customer);
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
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                customers?.map((customer) => (
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
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-sm text-muted-foreground mt-4">
                    Showing 1 to {customers?.length || 0} of {customers?.length || 0} entries
                </div>
            </CardContent>
        </Card>
      </main>
    );
  }

    