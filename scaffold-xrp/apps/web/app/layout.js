"use client";

import "./globals.css";
import { WalletProvider } from "../components/providers/WalletProvider";
import { cn } from "../lib/utils";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased selection:bg-accent selection:text-accent-foreground">
        <WalletProvider>
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
