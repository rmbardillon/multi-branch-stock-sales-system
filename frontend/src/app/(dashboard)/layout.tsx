"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GitBranch,
  Package,
  Warehouse,
  ShoppingCart,
  ScanBarcode,
  ArrowLeftRight,
  FileText,
  Users,
  ClipboardList,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeft,
  UserCircle,
} from "lucide-react";
import { useAuthContext, type Role } from "@/providers/auth-provider";
import { useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
  group: string;
}

const navItems: NavItem[] = [
  // Overview
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["Admin", "Branch_Manager", "Sales_Staff"],
    group: "Overview",
  },
  // Commerce
  {
    label: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    roles: ["Admin", "Branch_Manager", "Sales_Staff"],
    group: "Commerce",
  },
  {
    label: "POS",
    href: "/pos",
    icon: ScanBarcode,
    roles: ["Admin", "Branch_Manager", "Sales_Staff"],
    group: "Commerce",
  },
  // Operations
  {
    label: "Inventory",
    href: "/inventory",
    icon: Warehouse,
    roles: ["Admin", "Branch_Manager", "Sales_Staff"],
    group: "Operations",
  },
  {
    label: "Stock Items",
    href: "/stock-items",
    icon: Package,
    roles: ["Admin", "Branch_Manager"],
    group: "Operations",
  },
  {
    label: "Transfers",
    href: "/transfers",
    icon: ArrowLeftRight,
    roles: ["Admin", "Branch_Manager"],
    group: "Operations",
  },
  // Management
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
    roles: ["Admin", "Branch_Manager"],
    group: "Management",
  },
  {
    label: "Branches",
    href: "/branches",
    icon: GitBranch,
    roles: ["Admin"],
    group: "Management",
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    roles: ["Admin"],
    group: "Management",
  },
  {
    label: "Audit Trail",
    href: "/audit",
    icon: ClipboardList,
    roles: ["Admin"],
    group: "Management",
  },
];

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-1/2 before:h-5 before:-translate-y-1/2 before:w-[3px] before:rounded-r-full before:bg-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function GroupedNav({
  items,
  pathname,
  collapsed,
  onItemClick,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onItemClick?: () => void;
}) {
  // Group items by group
  const groups: { name: string; items: NavItem[] }[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!seen.has(item.group)) {
      seen.add(item.group);
      groups.push({ name: item.group, items: [] });
    }
    groups.find((g) => g.name === item.group)!.items.push(item);
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.name}>
          {!collapsed && (
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.name}
            </p>
          )}
          {collapsed && <div className="my-2 border-t" />}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  collapsed={collapsed}
                  onClick={onItemClick}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuthContext();
  const { mutate: handleLogout, isPending: isLoggingOut } = useLogout();
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden flex-shrink-0 border-r bg-muted/30 md:flex md:flex-col transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center border-b px-3">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 font-semibold transition-colors hover:text-primary",
              collapsed && "justify-center"
            )}
          >
            <Package className="h-5 w-5 shrink-0 text-primary" />
            {!collapsed && <span className="text-lg">Stock & Sales</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          <GroupedNav
            items={filteredNavItems}
            pathname={pathname}
            collapsed={collapsed}
          />
        </nav>

        {/* User section */}
        <div className="border-t p-3">
          {!collapsed ? (
            <>
              <div className="mb-3 flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
                <UserCircle className="h-8 w-8 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {user.username}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user.role.replace("_", " ")}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <ThemeToggle />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleLogout()}
                  disabled={isLoggingOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div title={`${user.username} (${user.role.replace("_", " ")})`}>
                <UserCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <ThemeToggle collapsed />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleLogout()}
                disabled={isLoggingOut}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full", collapsed && "px-0")}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="mr-2 h-4 w-4" />
                Collapse
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-left">
              <Package className="h-5 w-5 text-primary" />
              Stock & Sales
            </SheetTitle>
            <SheetDescription className="sr-only">
              Main navigation menu
            </SheetDescription>
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto p-2">
            <GroupedNav
              items={filteredNavItems}
              pathname={pathname}
              onItemClick={() => setMobileOpen(false)}
            />
          </nav>
          <div className="border-t p-3">
            <div className="mb-3 flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
              <UserCircle className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {user.username}
                </div>
                <div className="text-xs text-muted-foreground">
                  {user.role.replace("_", " ")}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  handleLogout();
                  setMobileOpen(false);
                }}
                disabled={isLoggingOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="h-5 w-5 text-primary" />
            <span>Stock & Sales</span>
          </Link>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
