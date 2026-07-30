import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { Toaster } from "sonner";
import { NetworkBanner } from "@/components/layout/network-banner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Multi-Branch Stock & Sales Management",
  description: "Stock monitoring and sales management system for multi-branch businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <NetworkBanner />
            {children}
            <Toaster richColors closeButton position="top-right" />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
