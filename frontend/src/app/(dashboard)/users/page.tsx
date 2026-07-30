"use client";

import React, { useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { useAuthContext } from "@/providers/auth-provider";
import { useBranches } from "@/hooks/use-branches";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useAssignRole,
  type User,
} from "@/hooks/use-users";
import { UsersTable } from "@/components/data-table/users-table";
import { UserForm } from "@/components/forms/user-form";
import { Button } from "@/components/ui/button";
import type { UserFormValues } from "@/lib/validators";

export default function UsersPage() {
  const { user: currentUser } = useAuthContext();
  const isAdmin = currentUser?.role === "Admin";

  const { data: users = [], isLoading } = useUsers();
  const { data: branches = [] } = useBranches();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const assignRole = useAssignRole();

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isRoleAssignment, setIsRoleAssignment] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You do not have permission to access user management. Only administrators can manage users.
        </p>
      </div>
    );
  }

  function handleCreateClick() {
    setEditingUser(null);
    setIsRoleAssignment(false);
    setFormOpen(true);
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    setIsRoleAssignment(false);
    setFormOpen(true);
  }

  function handleAssignRole(user: User) {
    setEditingUser(user);
    setIsRoleAssignment(true);
    setFormOpen(true);
  }

  async function handleFormSubmit(data: UserFormValues) {
    if (isRoleAssignment && editingUser) {
      await assignRole.mutateAsync({
        id: editingUser.id,
        data: {
          role: data.role,
          assigned_branch_id: data.assigned_branch_id ?? null,
        },
      });
    } else if (editingUser) {
      const updateData: Record<string, unknown> = {};
      if (data.username !== editingUser.username) updateData.username = data.username;
      if (data.password) updateData.password = data.password;
      if (data.role !== editingUser.role) updateData.role = data.role;
      if (data.assigned_branch_id !== editingUser.assigned_branch_id) {
        updateData.assigned_branch_id = data.assigned_branch_id ?? null;
      }
      if (data.is_active !== editingUser.is_active) updateData.is_active = data.is_active;

      await updateUser.mutateAsync({ id: editingUser.id, data: updateData });
    } else {
      await createUser.mutateAsync({
        username: data.username,
        password: data.password ?? "",
        role: data.role,
        assigned_branch_id: data.assigned_branch_id ?? null,
      });
    }
    setFormOpen(false);
    setEditingUser(null);
    setIsRoleAssignment(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and branch assignments
          </p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <UsersTable
        data={users}
        branches={branches}
        onEdit={handleEdit}
        onAssignRole={handleAssignRole}
      />

      <UserForm
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSubmit={handleFormSubmit}
        isSubmitting={
          createUser.isPending || updateUser.isPending || assignRole.isPending
        }
      />
    </div>
  );
}
