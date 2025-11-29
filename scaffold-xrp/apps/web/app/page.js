"use client";

import { Header } from "../components/Header";
import { EarthGlobe } from "../components/EarthGlobe";
import { DashboardPanel } from "../components/DashboardPanel";

export default function Home() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Background: Earth Viewer */}
      <div className="absolute inset-0 z-0">
        <EarthGlobe />
      </div>

      {/* Overlay: Header */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <Header />
      </div>

      {/* Overlay: Dashboard Panel */}
      <div className="absolute top-24 right-12 bottom-4 w-[400px] z-50">
        <DashboardPanel />
      </div>
    </div>
  );
}