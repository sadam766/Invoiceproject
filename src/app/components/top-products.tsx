
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Product } from '@/app/lib/data';

export default function TopProducts({ products }: { products: Product[] }) {
  return (
    <div className="space-y-6">
      {products.map((product) => (
        <div key={product.name} className="flex items-center">
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              {product.quantity} sales
            </p>
          </div>
          <div className="ml-auto font-medium">
            Rp {product.sales.toLocaleString('id-ID')}
          </div>
        </div>
      ))}
    </div>
  );
}
