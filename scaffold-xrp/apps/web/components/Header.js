"use client";

import { CustomWalletConnect } from "./CustomWalletConnect";
import { useWalletManager } from "../hooks/useWalletManager";
import { useWallet } from "./providers/WalletProvider";

export function Header() {
  useWalletManager();
  const { statusMessage } = useWallet();

  return (
    <header className="bg-transparent border-none pt-4 pb-2 absolute top-0 left-0 w-full z-50 pointer-events-none">
      <div className="w-full px-16">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Logo */}
          <div className="flex flex-col items-center">
            <span className="text-white font-bold text-7xl tracking-tight leading-none">
              a<span className="text-[#60d5f5]">X</span>es.
            </span>
            <span className="text-gray-300 text-xs tracking-widest mt-1 ml-1 uppercase opacity-80">
              Decentralized Earth Observation System
            </span>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-6">

            <CustomWalletConnect />
          </div>
        </div>
      </div>
    </header>
  );
}
