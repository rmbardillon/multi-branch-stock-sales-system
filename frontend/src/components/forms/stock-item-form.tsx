"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useCreateStockItem,
  useUpdateStockItem,
  type StockItem,
} from "@/hooks/use-stock-items";

const stockItemFormSchema = z.object({
  sku: z
    .string()
    .min(1, "SKU is required")
    .max(30, "SKU must be 30 characters or less"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .or(z.literal("")),
  category: z.string().min(1, "Category is required"),
  unit_price: z
    .number({ invalid_type_error: "Unit price must be a number" })
    .min(0.01, "Unit price must be at least 0.01")
    .max(999999999.99, "Unit price must be less than 999,999,999.99"),
  low_stock_threshold: z
    .number({ invalid_type_error: "Threshold must be a number" })
    .int("Threshold must be a whole number")
    .min(0, "Threshold must be 0 or greater"),
});

type StockItemFormValues = z.infer<typeof stockItemFormSchema>;

interface StockItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockItem?: StockItem | null;
}

export function StockItemFormDialog({
  open,
  onOpenChange,
  stockItem,
}: StockItemFormDialogProps) {
  const isEditing = !!stockItem;
  const createMutation = useCreateStockItem();
  const updateMutation = useUpdateStockItem();

  const form = useForm<StockItemFormValues>({
    resolver: zodResolver(stockItemFormSchema),
    defaultValues: {
      sku: stockItem?.sku ?? "",
      name: stockItem?.name ?? "",
      description: stockItem?.description ?? "",
      category: stockItem?.category ?? "",
      unit_price: stockItem?.unit_price ?? 0,
      low_stock_threshold: stockItem?.low_stock_threshold ?? 0,
    },
  });

  // Reset form values when stockItem changes (e.g., opening edit dialog)
  React.useEffect(() => {
    if (open) {
      form.reset({
        sku: stockItem?.sku ?? "",
        name: stockItem?.name ?? "",
        description: stockItem?.description ?? "",
        category: stockItem?.category ?? "",
        unit_price: stockItem?.unit_price ?? 0,
        low_stock_threshold: stockItem?.low_stock_threshold ?? 0,
      });
    }
  }, [stockItem, open, form]);

  const onSubmit = async (values: StockItemFormValues) => {
    try {
      if (isEditing && stockItem) {
        await updateMutation.mutateAsync({
          id: stockItem.id,
          data: values,
        });
      } else {
        await createMutation.mutateAsync(values);
      }
      form.reset();
      onOpenChange(false);
    } catch {
      // Error is handled by mutation state — displayed inline via ApiClientError
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Stock Item" : "Create Stock Item"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the stock item details below."
              : "Fill in the details to create a new stock item."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PROD-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Product description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electronics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="low_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Threshold</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {(createMutation.error || updateMutation.error) && (
              <p className="text-sm font-medium text-destructive">
                {createMutation.error?.message ||
                  updateMutation.error?.message ||
                  "An error occurred"}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : isEditing
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
