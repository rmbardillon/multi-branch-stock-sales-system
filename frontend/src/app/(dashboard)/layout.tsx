"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Package,
  Warehouse,
  ShoppingCart,
  ArrowLeftRight,
  FileText,
  Users,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { useAuthContext, type Role } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["Admin", "Branch_Manager", "Sales_Staff"],
  },
  {
    label: "Branches",
    href: "/branches",
    icon: GitBranch,
    roles: ["Admin"],
  },
  {
    label: "Stock Items",
    href: "/stock-items",
    icon: Package,
    roles: ["Admin", "Branch_Manager"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Warehouse,
    roles: ["Admin", "Branch_Manager", "Sales_Staff"],
  },
  {
    label: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    roles: ["Admin", "Branch_Manager", "Sales_Staff"],
  },
  {
    label: "Transfers",
    href: "/transfers",
    icon: ArrowLeftRight,
    roles: ["Admin", "Branch_Manager"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
    roles: ["Admin", "Branch_Manager"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    roles: ["Admin"],
  },
  {
    label: "Audit Trail",
    href: "/audit",
    icon: ClipboardList,
    roles: ["Admin"],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading } = useAuthContext();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r bg-muted/30 md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <h1 className="text-lg font-semibold">Stock & Sales</h1>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {filteredNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <div className="mb-2 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{user.username}</div>
            <div className="text-xs">{user.role.replace("_", " ")}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b px-4 md:hidden">
          <h1 className="text-lg font-semibold">Stock & Sales</h1>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
