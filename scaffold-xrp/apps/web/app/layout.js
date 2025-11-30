"use client";

import "./globals.css";
import { WalletProvider } from "../components/providers/WalletProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-black">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
