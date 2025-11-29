"use client";

import { useWallet } from "./providers/WalletProvider";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

export function AccountInfo() {
  const { isConnected, accountInfo } = useWallet();

  if (!isConnected || !accountInfo) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Account Info</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Address</span>
          <span className="text-white font-mono text-xs">{accountInfo.address}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Network</span>
          <span className="text-white">{accountInfo.network}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Wallet</span>
          <span className="text-white">{accountInfo.walletName}</span>
        </div>
      </div>
    </div>
  );
}
