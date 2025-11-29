"use client";

import { useState } from "react";

const MOCK_NFTS = [
    {
        id: "8928308281fffff",
        location: "Paris, France",
        date: "2024-11-15",
        price: "50 XRP",
        color: "text-green-400",
        badgeColor: "bg-purple-900 text-purple-200"
    },
    {
        id: "8928308280fffff",
        location: "New York, USA",
        date: "2024-10-22",
        price: "75 XRP",
        color: "text-green-400",
        badgeColor: "bg-purple-900 text-purple-200"
    },
    {
        id: "8928308283fffff",
        location: "Tokyo, Japan",
        date: "2024-09-10",
        price: "60 XRP",
        color: "text-green-400",
        badgeColor: "bg-purple-900 text-purple-200"
    },
    {
        id: "8928308284fffff",
        location: "London, UK",
        date: "2024-11-01",
        price: "55 XRP",
        color: "text-green-400",
        badgeColor: "bg-purple-900 text-purple-200"
    }
];

export function DashboardPanel() {
    const [activeTab, setActiveTab] = useState("ma terre");

    return (
        <div className="w-full h-full bg-black/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col">
            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-900/50 p-1 rounded-lg mb-6">
                {["ma terre", "collaboration", "acheter une zone"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${activeTab === tab
                            ? "bg-cyan-400 text-black shadow-lg shadow-cyan-400/20"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {activeTab === "ma terre" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-400 text-xs font-semibold tracking-wider uppercase">
                                MES NFT TUILES
                            </h3>
                            <span className="bg-cyan-900/30 text-cyan-400 text-xs font-bold px-2 py-1 rounded-full">
                                {MOCK_NFTS.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {MOCK_NFTS.map((nft) => (
                                <div
                                    key={nft.id}
                                    className="group bg-gray-900/40 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-all duration-200 hover:bg-gray-900/60"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-cyan-900/20 flex items-center justify-center text-cyan-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 className="text-white font-medium text-sm">{nft.location}</h4>
                                                <p className="text-gray-500 text-xs font-mono">{nft.id}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${nft.badgeColor}`}>
                                            NFT
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
                                        <div className="flex items-center text-gray-500 text-xs">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            Acheté le {nft.date}
                                        </div>
                                        <span className={`text-xs font-bold ${nft.color} bg-green-900/20 px-2 py-1 rounded`}>
                                            {nft.price}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "collaboration" && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <p>Prochainement...</p>
                    </div>
                )}

                {activeTab === "acheter une zone" && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <p>Sélectionnez une zone sur la carte</p>
                    </div>
                )}
            </div>
        </div>
    );
}
