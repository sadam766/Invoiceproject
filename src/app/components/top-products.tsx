import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Product } from '@/app/lib/data';

export default function TopProducts({ products }: { products: Product[] }) {
  return (
    <div className="space-y-6">
      {products.map((product) => (
        <div key={product.name} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={product.image.imageUrl}
              alt={product.name}
              data-ai-hint={product.image.imageHint}
            />
            <AvatarFallback>{product.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              {product.quantity} sold
            </p>
          </div>
          <div className="ml-auto font-medium">
            +${product.sales.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
