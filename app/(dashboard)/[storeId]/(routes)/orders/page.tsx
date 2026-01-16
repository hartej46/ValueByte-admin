// Global Imports
import React from 'react';
import prismadb from '@/lib/prismadb';
import { format } from 'date-fns';

// Local Imports
import OrderClient from './components/client';
import { OrderColumn } from './components/columns';
import { priceFormatter } from '@/lib/utils';

const OrdersPage = async ({
  params
}: {
  params: { storeId: string }
}) => {

  // Fetch all orders specific to the active store
  const orders = await prismadb.order.findMany({
    where: {
      storeId: params.storeId
    },
    include: {
      orderItems: {
        include: {
          product: true
        }
      },
      customerAddress: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Format each Order into a OrderColumn
  const formattedOrders: OrderColumn[] = orders.map((item) => {
    // If flat fields are empty, fallback to linked customerAddress
    const addressData = {
      fullName: item.fullName || item.customerAddress?.fullName || "",
      mobile: item.mobile || item.customerAddress?.mobile || "",
      houseFlat: item.houseFlat || item.customerAddress?.houseFlat || "",
      locality: item.locality || item.customerAddress?.locality || "",
      areaStreet: item.areaStreet || item.customerAddress?.areaStreet || "",
      landmark: item.landmark || item.customerAddress?.landmark || "",
      city: item.city || item.customerAddress?.city || "",
    };

    return {
      id: item.id,
      fullName: addressData.fullName,
      mobile: addressData.mobile,
      address: [
        addressData.houseFlat,
        addressData.locality,
        addressData.areaStreet,
        addressData.landmark,
        addressData.city
      ].filter(Boolean).join(', '),
      products: item.orderItems.map((orderItem) => `${orderItem.product.name} (${orderItem.quantity})`).join(', '),
      totalPrice: priceFormatter.format(item.orderItems.reduce((total, item) => {
        return total + Number(item.product.price) * (item.quantity)
      }, 0)),
      isPaid: item.isPaid,
      createdAt: format(item.createdAt, "MMMM do, yyyy")
    }
  });

  return (
    <div className='flex-col'>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <OrderClient data={formattedOrders} />
      </div>
    </div>
  );
}

export default OrdersPage;