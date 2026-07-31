"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import {
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeactivateBranch,
  useReactivateBranch,
  useDeleteBranch,
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
  const reactivateBranch = useReactivateBranch();
  const deleteBranch = useDeleteBranch();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deactivatingBranch, setDeactivatingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  function handleReactivate(branch: Branch) {
    reactivateBranch.mutate(branch.id);
  }

  function handleDelete(branch: Branch) {
    setDeleteError(null);
    setDeletingBranch(branch);
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

  async function handleConfirmDelete() {
    if (deletingBranch) {
      try {
        await deleteBranch.mutateAsync(deletingBranch.id);
        setDeletingBranch(null);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err) {
          setDeleteError((err as { message: string }).message);
        } else {
          setDeleteError("Failed to delete branch.");
        }
      }
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
        onReactivate={handleReactivate}
        onDelete={handleDelete}
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
      <AlertDialog
        open={!!deletingBranch}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingBranch(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">{deletingBranch?.name}</span>.
              This action cannot be undone. If this branch has any sales or
              transfers, deletion will be blocked — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBranch.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
