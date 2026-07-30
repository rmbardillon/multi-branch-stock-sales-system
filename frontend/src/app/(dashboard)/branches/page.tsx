"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import {
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeactivateBranch,
  type Branch,
} from "@/hooks/use-branches";
import { BranchesTable } from "@/components/data-table/branches-table";
import { BranchForm } from "@/components/forms/branch-form";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BranchFormValues } from "@/lib/validators";

export default function BranchesPage() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === "Admin";

  const { data: branches = [], isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deactivateBranch = useDeactivateBranch();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deactivatingBranch, setDeactivatingBranch] = useState<Branch | null>(
    null
  );

  function handleCreateClick() {
    setEditingBranch(null);
    setFormOpen(true);
  }

  function handleEdit(branch: Branch) {
    setEditingBranch(branch);
    setFormOpen(true);
  }

  function handleDeactivate(branch: Branch) {
    setDeactivatingBranch(branch);
  }

  async function handleFormSubmit(data: BranchFormValues) {
    if (editingBranch) {
      await updateBranch.mutateAsync({ id: editingBranch.id, data });
    } else {
      await createBranch.mutateAsync(data);
    }
    setFormOpen(false);
    setEditingBranch(null);
  }

  async function handleConfirmDeactivate() {
    if (deactivatingBranch) {
      await deactivateBranch.mutateAsync(deactivatingBranch.id);
      setDeactivatingBranch(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-muted-foreground">Loading branches...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Branches</h2>
          <p className="text-muted-foreground">
            Manage your business locations
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            Create Branch
          </Button>
        )}
      </div>

      <BranchesTable
        data={branches}
        isAdmin={isAdmin}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
      />

      <BranchForm
        open={formOpen}
        onOpenChange={setFormOpen}
        branch={editingBranch}
        onSubmit={handleFormSubmit}
        isSubmitting={createBranch.isPending || updateBranch.isPending}
      />

      <AlertDialog
        open={!!deactivatingBranch}
        onOpenChange={(open) => {
          if (!open) setDeactivatingBranch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <span className="font-semibold">
                {deactivatingBranch?.name}
              </span>
              ? This will prevent new sales and stock transfers to this branch.
              All historical data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivateBranch.isPending ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
