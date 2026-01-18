// Global Imports
import React from 'react';
import prismadb from '@/lib/prismadb';
import { format } from 'date-fns';
import { priceFormatter } from '@/lib/utils';

// Local Imports
import ProductClient from './components/client';
import { ProductColumn } from './components/columns';

const ProductsPage = async ({
  params,
  searchParams
}: {
  params: { storeId: string },
  searchParams: {
    categoryId?: string;
    colorId?: string;
    isArchived?: string;
  }
}) => {

  // Fetch all products specific to the active store with filters applied
  const products = await prismadb.product.findMany({
    where: {
      storeId: params.storeId,
      categoryId: searchParams.categoryId,
      colorId: searchParams.colorId,
      isArchived: searchParams.isArchived === 'true' ? true : (searchParams.isArchived === 'false' ? false : undefined)
    },
    include: {
      category: true,
      color: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const categories = await prismadb.category.findMany({
    where: {
      storeId: params.storeId,
    }
  });

  const colors = await prismadb.color.findMany({
    where: {
      storeId: params.storeId,
    }
  });

  // Format each product into a ProductColumn
  const formattedProducts: ProductColumn[] = products.map((item) => ({
    id: item.id,
    name: item.name,
    isArchived: item.isArchived,
    isFeatured: item.isFeatured,
    price: priceFormatter.format(item.price.toNumber()),
    category: item.category.name,
    color: item.color.value,
    createdAt: format(item.createdAt, "MMMM do, yyyy"),
  }));

  return (
    <div className='flex-col'>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <ProductClient
          data={formattedProducts}
          categories={categories}
          colors={colors}
        />
      </div>
    </div>
  );
}

export default ProductsPage;