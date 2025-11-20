
'use client';
import { useState, useMemo, useRef } from 'react';
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
  import type { Customer } from '@/app/lib/data';
  import { Search, Upload, Download } from 'lucide-react';
  import { AddCustomerDialog } from './_components/add-customer-dialog';
  import { DeleteConfirmationDialog } from '@/app/components/delete-confirmation-dialog';
  import { useToast } from '@/hooks/use-toast';
  import { exportToExcel, generateExcelTemplate, importFromExcel } from '@/lib/utils';
  import { useFirestore, useUser, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
  import { collection, doc, setDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';

  export default function CustomerListPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const customersCollection = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'customers'), where('ownerId', '==', user.uid));
    }, [firestore, user]);

    const { data: customers, isLoading } = useCollection<Customer>(customersCollection);

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
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
        if (!firestore) return;
        const docRef = doc(firestore, 'customers', customerId);
        deleteDoc(docRef)
            .then(() => {
                toast({ title: 'Customer deleted' });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    };

    const handleSave = (customer: Omit<Customer, 'id' | 'ownerId'> & { id?: string }) => {
        if (!firestore || !user) return;
        
        const isNewCustomer = !customer.id && !editingCustomer?.id;
        let customerId = customer.id || editingCustomer?.id;
        if (isNewCustomer) {
            customerId = doc(collection(firestore, 'customers')).id;
        }

        if (!customerId) {
            console.error("Customer ID is missing.");
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not save customer due to missing ID.'
            });
            return;
        }


        const docRef = doc(firestore, 'customers', customerId);
        const dataToSave = { ...customer, id: customerId, ownerId: user.uid };
        
        setDoc(docRef, dataToSave, { merge: !isNewCustomer })
            .then(() => {
                toast({
                    title: editingCustomer ? 'Customer Updated' : 'Customer Added',
                    description: `Customer ${customer.name} has been saved.`,
                });
                setIsDialogOpen(false);
                setEditingCustomer(undefined);
            })
            .catch(async (serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: isNewCustomer ? 'create' : 'update',
                    requestResourceData: dataToSave,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
      };

    const handleDialogStateChange = (open: boolean) => {
      setIsDialogOpen(open);
      if (!open) {
        setEditingCustomer(undefined);
      }
    }

    const handleDownloadTemplate = () => {
        const headers = ['name', 'address', 'spdAddress'];
        generateExcelTemplate(headers, 'customer_template');
        toast({ title: "Template Downloaded", description: "Customer template has been downloaded." });
    };

    const handleExport = () => {
        if (customers) {
            exportToExcel(customers, 'customers');
            toast({ title: "Export Successful", description: "Customer data has been exported to Excel." });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && firestore && user) {
            try {
                const data = await importFromExcel(file) as Omit<Customer, 'id' | 'ownerId'>[];
                const batch = writeBatch(firestore);
    
                data.forEach(customerData => {
                    const newDocRef = doc(collection(firestore, 'customers'));
                    const fullData = { ...customerData, id: newDocRef.id, ownerId: user.uid };
                    batch.set(newDocRef, fullData);
                });
    
                await batch.commit();
                
                toast({
                    title: "Import Successful",
                    description: `${data.length} customers imported successfully.`,
                });
            } catch (error) {
                 const permissionError = new FirestorePermissionError({
                    path: 'customers', // Path for batch write can be generalized
                    operation: 'create', // Assuming import is a create operation
                    requestResourceData: 'Batch customer import',
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({
                    variant: "destructive",
                    title: "Import Error",
                    description: "Failed to import customers. Please check the file format and permissions.",
                });
            }
        }
    };
    
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
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                       <Button variant="outline" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4"/> Import</Button>
                       <Button variant="outline" onClick={handleDownloadTemplate}><Download className="mr-2 h-4 w-4"/> Download Template</Button>
                       <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
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
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">Loading customers...</TableCell>
                                </TableRow>
                            )}
                            {!isLoading && filteredCustomers?.map((customer) => (
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

    