"use client";

import { Category, Color } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ProductFiltersProps {
    categories: Category[];
    colors: Color[];
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
    categories,
    colors,
}) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const categoryId = searchParams.get("categoryId");
    const colorId = searchParams.get("colorId");
    const isArchived = searchParams.get("isArchived");

    const onChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());

        if (value === "all") {
            params.delete(key);
        } else {
            params.set(key, value);
        }

        const query = params.toString();
        const url = `${window.location.pathname}${query ? `?${query}` : ''}`;

        router.push(url);
    };

    const onReset = () => {
        router.push(window.location.pathname);
    };

    return (
        <div className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Archive Status</span>
                <Select
                    value={isArchived || "all"}
                    onValueChange={(value) => onChange("isArchived", value)}
                >
                    <SelectTrigger className="w-[150px] h-9">
                        <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="true">Archived Only</SelectItem>
                        <SelectItem value="false">Active Only</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Category</span>
                <Select
                    value={categoryId || "all"}
                    onValueChange={(value) => onChange("categoryId", value)}
                >
                    <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Color</span>
                <Select
                    value={colorId || "all"}
                    onValueChange={(value) => onChange("colorId", value)}
                >
                    <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="All Colors" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Colors</SelectItem>
                        {colors.map((color) => (
                            <SelectItem key={color.id} value={color.id}>
                                <div className="flex items-center gap-2">
                                    {color.name}
                                    <div
                                        className="h-3 w-3 rounded-full border"
                                        style={{ backgroundColor: color.value }}
                                    />
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-end h-[52px]">
                <Button
                    variant="ghost"
                    onClick={onReset}
                    size="sm"
                    className="text-xs h-9 hover:bg-neutral-100"
                >
                    Reset
                </Button>
            </div>
        </div>
    );
};
