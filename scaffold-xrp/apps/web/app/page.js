"use client";

import { Header } from "../components/Header";
import { AccountInfo } from "../components/AccountInfo";
import { TransactionForm } from "../components/TransactionForm";
import { EarthGlobe } from "../components/EarthGlobe";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Scaffold-XRP</h1>
          <p className="text-gray-600">
            A starter kit for building dApps on XRPL
          </p>
        </div>

        <div className="mb-8">
          <EarthGlobe />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <AccountInfo />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TransactionForm />
        </div>

      </main>

      <footer className="border-t border-gray-200 mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600">
          <p>Built with Scaffold-XRP 🚀</p>
        </div>
      </footer>
    </div>
  );
}