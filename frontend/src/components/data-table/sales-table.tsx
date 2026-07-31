"use client";

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SaleTransaction } from "@/hooks/use-sales";
import { formatCurrency } from "@/lib/currency";

interface SalesTableProps {
  data: SaleTransaction[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function SalesTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
}: SalesTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [selectedSale, setSelectedSale] = React.useState<SaleTransaction | null>(null);

  const pageCount = Math.ceil(total / pageSize);

  const columns: ColumnDef<SaleTransaction>[] = React.useMemo(
    () => [
      {
        accessorKey: "reference_number",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Reference
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.getValue("reference_number")}
          </span>
        ),
      },
      {
        accessorKey: "transaction_date",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = new Date(row.getValue("transaction_date"));
          return date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        },
      },
      {
        accessorKey: "total_amount",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Total Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const amount = parseFloat(row.getValue("total_amount"));
          return (
            <span className="font-medium tabular-nums">
              {formatCurrency(amount)}
            </span>
          );
        },
      },
      {
        accessorKey: "line_items",
        header: "Items",
        cell: ({ row }) => {
          const lineItems = row.original.line_items;
          return (
            <Badge variant="secondary">
              {lineItems ? lineItems.length : 0}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSale(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    manualPagination: true,
    pageCount,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedSale(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No sales transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing {total > 0 ? (page - 1) * pageSize + 1 : 0}-
          {Math.min(page * pageSize, total)} of {total} transactions
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>
              {selectedSale && (
                <span className="font-mono">{selectedSale.reference_number}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              {/* Sale metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p className="font-medium">
                    {new Date(selectedSale.transaction_date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total</span>
                  <p className="font-medium text-lg tabular-nums">
                    {formatCurrency(Number(selectedSale.total_amount))}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-16 text-center">Qty</TableHead>
                      <TableHead className="w-24 text-right">Price</TableHead>
                      <TableHead className="w-24 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.line_items && selectedSale.line_items.length > 0 ? (
                      selectedSale.line_items.map((li) => (
                        <TableRow key={li.id}>
                          <TableCell>
                            <div className="font-medium">
                              {li.stock_item_name || "Unknown Item"}
                            </div>
                            {li.stock_item_sku && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {li.stock_item_sku}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">
                            {li.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ${Number(li.unit_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            ${Number(li.line_total).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No line items available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Total summary */}
              {selectedSale.line_items && selectedSale.line_items.length > 0 && (
                <div className="flex justify-between items-center px-2 pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    {selectedSale.line_items.reduce((s, li) => s + li.quantity, 0)} items total
                  </span>
                  <span className="font-bold text-lg tabular-nums">
                    {formatCurrency(Number(selectedSale.total_amount))}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
