"use client";

import { useState } from "react";
import { useWallet } from "./providers/WalletProvider";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export function TransactionForm() {
  const { walletManager, isConnected, addEvent, showStatus } = useWallet();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!walletManager || !walletManager.account) {
      showStatus("Please connect a wallet first", "error");
      return;
    }

    try {
      setIsLoading(true);
      setResult(null);

      const transaction = {
        TransactionType: "Payment",
        Account: walletManager.account.address,
        Destination: destination,
        Amount: amount,
      };

      const txResult = await walletManager.signAndSubmit(transaction);

      setResult({
        success: true,
        hash: txResult.hash || "Pending",
        id: txResult.id,
      });

      showStatus("Transaction submitted successfully!", "success");
      addEvent("Transaction Submitted", txResult);

      // Clear form
      setDestination("");
      setAmount("");
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
      });
      showStatus(`Transaction failed: ${error.message}`, "error");
      addEvent("Transaction Failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Send Transaction</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-2">Destination Address</label>
          <Input
            type="text"
            placeholder="rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="bg-transparent border-white/20 text-white placeholder:text-gray-600 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-2">Amount (drops)</label>
          <Input
            type="number"
            placeholder="1000000"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-transparent border-white/20 text-white placeholder:text-gray-600 text-sm"
            required
          />
          <small className="text-xs text-gray-600 mt-1 block">1 XRP = 1,000,000 drops</small>
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-white text-black hover:bg-gray-200 h-10"
        >
          {isLoading ? "Signing & Submitting..." : "Sign & Submit Transaction"}
        </Button>
      </form>

      {result && (
        <div className={`mt-4 p-3 rounded border text-sm ${result.success
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
          {result.success ? (
            <>
              <div className="font-semibold mb-1">Transaction Submitted</div>
              <div className="text-xs opacity-80">Hash: {result.hash}</div>
              {result.id && <div className="text-xs opacity-80">ID: {result.id}</div>}
            </>
          ) : (
            <>
              <div className="font-semibold mb-1">Transaction Failed</div>
              <div className="text-xs opacity-80">{result.error}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
