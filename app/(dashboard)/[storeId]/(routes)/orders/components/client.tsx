"use client";

import { useState } from "react";

// Local Imports
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { OrderColumn, columns } from "./columns";

interface OrderClientProps {
  data: OrderColumn[]
}

// Client component that loads all our Orders
const OrderClient: React.FC<OrderClientProps> = ({
  data
}) => {
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredData = data.filter((item) => {
    if (statusFilter === "paid") return item.isPaid;
    if (statusFilter === "unpaid") return !item.isPaid;
    return true;
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading
          title={`Orders (${filteredData.length})`}
          description="Manage orders for your store"
        />
        <div className="flex items-center gap-x-2">
          <p className="text-sm font-medium">Payment Status:</p>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <DataTable columns={columns} data={filteredData} searchKey={"products"} />
    </>
  )
}

export default OrderClient;