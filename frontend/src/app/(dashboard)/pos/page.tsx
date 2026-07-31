"use client";

import React, { useState, useRef, useCallback } from "react";
import { ScanBarcode, Trash2, CheckCircle, XCircle, AlertCircle, Printer } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useBranches } from "@/hooks/use-branches";
import { useInventory } from "@/hooks/use-inventory";
import { useCreateSale } from "@/hooks/use-sales";
import { fetchStockItemBySku, type StockItem } from "@/hooks/use-stock-items";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PosLineItem {
  stock_item_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
}

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastIdCounter = 0;

export default function PosPage() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === "Admin";

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const branchId = isAdmin ? selectedBranchId : user?.assignedBranchId;

  const { data: branches } = useBranches({ status: "Active" });

  const [lineItems, setLineItems] = useState<PosLineItem[]>([]);
  const [skuInput, setSkuInput] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [completedItems, setCompletedItems] = useState<PosLineItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const createSale = useCreateSale();
  const { data: inventoryData } = useInventory(branchId);

  // Toast helper
  const showToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Get available quantity for an item
  const getAvailable = useCallback(
    (stockItemId: string): number => {
      if (!inventoryData) return 0;
      const level = inventoryData.find((sl) => sl.stock_item_id === stockItemId);
      return level?.quantity ?? 0;
    },
    [inventoryData]
  );

  // Core lookup logic — shared by scanner and manual input
  const handleSkuLookup = useCallback(
    async (sku: string) => {
      const trimmed = sku.trim().toUpperCase();
      if (!trimmed) return;

      setIsLookingUp(true);
      try {
        const item = await fetchStockItemBySku(trimmed);

        if (!item) {
          showToast(`Item not found: ${trimmed}`, "error");
          return;
        }

        // If already in cart, increment quantity
        setLineItems((prev) => {
          const existing = prev.find((li) => li.stock_item_id === item.id);
          if (existing) {
            showToast(`${item.name} — qty +1`, "success");
            return prev.map((li) =>
              li.stock_item_id === item.id
                ? { ...li, quantity: li.quantity + 1 }
                : li
            );
          }

          showToast(`Added: ${item.name}`, "success");
          return [
            ...prev,
            {
              stock_item_id: item.id,
              sku: item.sku,
              name: item.name,
              quantity: 1,
              unit_price: Number(item.unit_price),
            },
          ];
        });
      } catch {
        showToast("Lookup failed. Please try again.", "error");
      } finally {
        setIsLookingUp(false);
        setSkuInput("");
        // Refocus input
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [showToast]
  );

  // Barcode scanner handler (fires when scanner detected outside of input)
  useBarcodeScanner(handleSkuLookup, { enabled: true });

  // Manual input submit (Enter key in the SKU field)
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSkuLookup(skuInput);
    }
  };

  // Keyboard shortcuts
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // F2 — focus SKU input
      if (e.key === "F2") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // F12 — complete sale
      if (e.key === "F12" && lineItems.length > 0) {
        e.preventDefault();
        handleCompleteSale();
      }
      // Escape — clear input
      if (e.key === "Escape") {
        setSkuInput("");
        inputRef.current?.focus();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineItems.length]
  );

  React.useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // Auto-focus on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleQuantityChange(stockItemId: string, quantity: number) {
    if (quantity < 1) {
      handleRemoveItem(stockItemId);
      return;
    }
    setLineItems((prev) =>
      prev.map((li) =>
        li.stock_item_id === stockItemId ? { ...li, quantity } : li
      )
    );
  }

  function handleRemoveItem(stockItemId: string) {
    setLineItems((prev) => prev.filter((li) => li.stock_item_id !== stockItemId));
  }

  function handleClearAll() {
    setLineItems([]);
    setSkuInput("");
    inputRef.current?.focus();
  }

  async function handleCompleteSale() {
    if (!branchId || lineItems.length === 0) return;

    try {
      const result = await createSale.mutateAsync({
        branch_id: branchId,
        line_items: lineItems.map((li) => ({
          stock_item_id: li.stock_item_id,
          quantity: li.quantity,
          unit_price: li.unit_price,
        })),
      });
      setCompletedItems([...lineItems]);
      setSuccessRef(result.reference_number);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        showToast((err as { message: string }).message, "error");
      } else {
        showToast("Failed to complete sale.", "error");
      }
    }
  }

  function handleSuccessClose() {
    setSuccessRef(null);
    setCompletedItems([]);
    setLineItems([]);
    setSkuInput("");
    inputRef.current?.focus();
  }

  function handlePrintReceipt() {
    const receiptTotal = completedItems.reduce(
      (sum, li) => sum + li.quantity * li.unit_price,
      0
    );
    const now = new Date();

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt - ${successRef}</title>
          <style>
            body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 16px; }
            .header h1 { font-size: 16px; margin: 0; }
            .header p { margin: 4px 0; color: #666; }
            .divider { border-top: 1px dashed #333; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; padding: 4px 0; border-bottom: 1px solid #333; }
            td { padding: 4px 0; }
            .qty { width: 30px; text-align: center; }
            .price { text-align: right; }
            .total-row { font-weight: bold; font-size: 14px; }
            .footer { text-align: center; margin-top: 16px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Stock & Sales</h1>
            <p>SALES RECEIPT</p>
            <p>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
          </div>
          <div class="divider"></div>
          <p><strong>Ref:</strong> ${successRef}</p>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="qty">Qty</th>
                <th class="price">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${completedItems
                .map(
                  (li) => `
                <tr>
                  <td>${li.name}<br><small>${li.sku}</small></td>
                  <td class="qty">${li.quantity}</td>
                  <td class="price">$${(li.quantity * li.unit_price).toFixed(2)}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
          <div class="divider"></div>
          <table>
            <tr class="total-row">
              <td>TOTAL</td>
              <td class="price">$${receiptTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Items</td>
              <td class="price">${completedItems.reduce((s, li) => s + li.quantity, 0)}</td>
            </tr>
          </table>
          <div class="divider"></div>
          <div class="footer">
            <p>Thank you for your purchase!</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  const itemCount = lineItems.reduce((sum, li) => sum + li.quantity, 0);

  if (!branchId) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ScanBarcode className="mx-auto h-12 w-12 mb-4 opacity-50" />
          {isAdmin ? (
            <>
              <p className="text-lg font-medium mb-4">Select a branch to start</p>
              <Select
                value={selectedBranchId}
                onValueChange={(value) => {
                  setSelectedBranchId(value);
                  setLineItems([]);
                }}
              >
                <SelectTrigger className="w-[250px] mx-auto">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">POS not available</p>
              <p className="text-sm">You must be assigned to a branch to use the POS.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Header with scanner input */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Scan barcode or type SKU..."
            value={skuInput}
            onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
            onKeyDown={handleInputKeyDown}
            className="pl-11 text-lg h-12 font-mono"
            disabled={isLookingUp}
            autoComplete="off"
          />
        </div>

        {isAdmin && branches && (
          <Select
            value={selectedBranchId}
            onValueChange={(value) => {
              setSelectedBranchId(value);
              setLineItems([]);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="text-sm text-muted-foreground hidden sm:block">
          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">F2</span> Focus
          {" · "}
          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">F12</span> Complete
          {" · "}
          <span className="font-mono bg-muted px-1.5 py-0.5 rounded">Esc</span> Clear
        </div>
      </div>

      {/* Main content: table + summary */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Line items table */}
        <div className="flex-1 overflow-auto rounded-md border">
          {lineItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <ScanBarcode className="h-16 w-16 opacity-20 mb-4" />
              <p className="text-lg">Ready to scan</p>
              <p className="text-sm">Scan a barcode or type a SKU to begin</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-[100px] text-center">Qty</TableHead>
                  <TableHead className="w-[80px] text-right">Avail.</TableHead>
                  <TableHead className="w-[100px] text-right">Price</TableHead>
                  <TableHead className="w-[110px] text-right">Subtotal</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li) => {
                  const available = getAvailable(li.stock_item_id);
                  const exceeds = li.quantity > available;
                  return (
                    <TableRow key={li.stock_item_id}>
                      <TableCell className="font-mono text-sm">
                        {li.sku}
                      </TableCell>
                      <TableCell className="font-medium">{li.name}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          value={li.quantity}
                          onChange={(e) =>
                            handleQuantityChange(
                              li.stock_item_id,
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className={`w-16 text-center mx-auto ${exceeds ? "border-destructive" : ""}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={exceeds ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {available}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${li.unit_price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ${(li.quantity * li.unit_price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(li.stock_item_id)}
                          tabIndex={-1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Summary panel */}
        <div className="w-64 flex flex-col gap-4 shrink-0">
          <div className="rounded-md border p-4 space-y-3 flex-1">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Summary
            </h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{itemCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lines</span>
              <span className="font-medium">{lineItems.length}</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold tabular-nums">
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-14 text-lg"
            onClick={handleCompleteSale}
            disabled={lineItems.length === 0 || createSale.isPending}
          >
            {createSale.isPending ? "Processing..." : "Complete Sale"}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleClearAll}
            disabled={lineItems.length === 0}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium shadow-lg animate-in slide-in-from-right-5 ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : toast.type === "error"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-yellow-500 text-white"
            }`}
          >
            {toast.type === "success" && <CheckCircle className="h-4 w-4" />}
            {toast.type === "error" && <XCircle className="h-4 w-4" />}
            {toast.type === "warning" && <AlertCircle className="h-4 w-4" />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Success dialog */}
      <Dialog open={!!successRef} onOpenChange={() => handleSuccessClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Sale Complete
            </DialogTitle>
            <DialogDescription>
              Transaction processed successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">Reference Number</p>
            <p className="mt-1 text-2xl font-mono font-bold">{successRef}</p>
          </div>

          {/* Receipt summary */}
          {completedItems.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-center w-12">Qty</th>
                    <th className="p-2 text-right w-20">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {completedItems.map((li) => (
                    <tr key={li.stock_item_id} className="border-b last:border-0">
                      <td className="p-2">
                        <div className="font-medium">{li.name}</div>
                        <div className="text-xs text-muted-foreground">{li.sku}</div>
                      </td>
                      <td className="p-2 text-center">{li.quantity}</td>
                      <td className="p-2 text-right tabular-nums">
                        ${(li.quantity * li.unit_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center px-1">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold tabular-nums">
              ${completedItems.reduce((s, li) => s + li.quantity * li.unit_price, 0).toFixed(2)}
            </span>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handlePrintReceipt} className="flex-1">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
            <Button onClick={handleSuccessClose} className="flex-1">
              Next Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
