"use client";

import { WalletConnector } from "./WalletConnector";
import { useWalletManager } from "../hooks/useWalletManager";
import { useWallet } from "./providers/WalletProvider";

export function Header() {
  useWalletManager();
  const { statusMessage } = useWallet();

  return (
    <header className="w-full bg-transparent">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-3xl font-bold">
              a<span className="text-primary">X</span>es.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {statusMessage && (
              <div
                className={`text - sm px - 3 py - 1 rounded - lg border ${statusMessage.type === "success"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : statusMessage.type === "error"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : statusMessage.type === "warning"
                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  } `}
              >
                {statusMessage.message}
              </div>
            )}
            <WalletConnector />
          </div>
        </div>
      </div>
    </header>
  );
}
