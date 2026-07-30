"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userSchema, createUserSchema, type UserFormValues } from "@/lib/validators";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches, type Branch } from "@/hooks/use-branches";
import type { User } from "@/hooks/use-users";

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSubmit: (data: UserFormValues) => void;
  isSubmitting?: boolean;
}

export function UserForm({
  open,
  onOpenChange,
  user,
  onSubmit,
  isSubmitting = false,
}: UserFormProps) {
  const isEditing = !!user;
  const { data: branches = [] } = useBranches({ status: "Active" });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEditing ? userSchema : createUserSchema),
    defaultValues: {
      username: user?.username ?? "",
      password: "",
      role: user?.role ?? "Sales_Staff",
      assigned_branch_id: user?.assigned_branch_id ?? null,
      is_active: user?.is_active ?? true,
    },
  });

  const watchedRole = form.watch("role");
  const requiresBranch = watchedRole === "Branch_Manager" || watchedRole === "Sales_Staff";

  // Reset form when user changes or dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        username: user?.username ?? "",
        password: "",
        role: user?.role ?? "Sales_Staff",
        assigned_branch_id: user?.assigned_branch_id ?? null,
        is_active: user?.is_active ?? true,
      });
    }
  }, [open, user, form]);

  // Clear branch assignment when role changes to Admin
  React.useEffect(() => {
    if (watchedRole === "Admin") {
      form.setValue("assigned_branch_id", null);
    }
  }, [watchedRole, form]);

  function handleSubmit(data: UserFormValues) {
    onSubmit(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit User" : "Create User"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the user details below."
              : "Fill in the details to create a new user."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter username"
                      maxLength={50}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter password"
                        maxLength={128}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Branch_Manager">Branch Manager</SelectItem>
                      <SelectItem value="Sales_Staff">Sales Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {requiresBranch && (
              <FormField
                control={form.control}
                name="assigned_branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Branch</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value ?? undefined}
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {branches.map((branch: Branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    ? "Update User"
                    : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
