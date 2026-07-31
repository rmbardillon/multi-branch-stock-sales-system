"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuditRecord } from "@/hooks/use-audit";

interface AuditTableProps {
  data: AuditRecord[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function formatActionType(actionType: string): string {
  return actionType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getActionBadgeVariant(
  actionType: string
): "default" | "secondary" | "destructive" | "outline" {
  if (actionType.includes("created") || actionType.includes("confirmed")) {
    return "default";
  }
  if (actionType.includes("failed") || actionType.includes("deactivated")) {
    return "destructive";
  }
  if (actionType.includes("updated") || actionType.includes("adjustment")) {
    return "secondary";
  }
  return "outline";
}

export function AuditTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
}: AuditTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const totalPages = Math.ceil(total / pageSize);

  const columns: ColumnDef<AuditRecord>[] = [
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Timestamp
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue<string>("created_at"));
        return (
          <span className="text-sm tabular-nums">
            {date.toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: "user_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.user_name || row.original.user_id.slice(0, 8) + "..."}
        </span>
      ),
    },
    {
      accessorKey: "branch_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Branch
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.branch_name || (row.original.branch_id ? row.original.branch_id.slice(0, 8) + "..." : "—")}
        </span>
      ),
    },
    {
      accessorKey: "action_type",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Action Type
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const actionType = row.getValue<string>("action_type");
        return (
          <Badge variant={getActionBadgeVariant(actionType)}>
            {formatActionType(actionType)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-sm max-w-[400px] block">
          {row.getValue<string>("description")}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
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
                <TableRow key={row.id}>
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
                  No audit records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Server-side pagination controls */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing {total > 0 ? (page - 1) * pageSize + 1 : 0}-
          {Math.min(page * pageSize, total)} of {total} records
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
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
