"use client";

import { WalletConnector } from "./WalletConnector";
import { useWalletManager } from "../hooks/useWalletManager";
import { useWallet } from "./providers/WalletProvider";

export function Header() {
  useWalletManager();
  const { statusMessage } = useWallet();

  return (
    <header className="bg-transparent border-none py-6 absolute top-0 left-0 w-full z-50 pointer-events-none">
      <div className="container mx-auto px-12">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-white font-bold text-3xl tracking-tight">
              a<span className="text-[#60d5f5]">X</span>es.
            </span>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-6">
            <span className="text-gray-400 text-sm font-medium hidden md:block bg-black/50 px-3 py-1 rounded-lg backdrop-blur-sm border border-white/10">
              r34o...Pgne
            </span>
            <WalletConnector />
          </div>
        </div>
      </div>
    </header>
  );
}
