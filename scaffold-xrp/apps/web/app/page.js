"use client";

import { useState, useRef } from "react";
import { Header } from "../components/Header";
import { EarthGlobe } from "../components/EarthGlobe";
import { DashboardPanel } from "../components/DashboardPanel";

export default function Home() {
  const [selectedTile, setSelectedTile] = useState(null);
  const [isConflictZone, setIsConflictZone] = useState(false);
  const earthGlobeRef = useRef(null);

  const handleTileSelected = (tileId, isConflict) => {
    setSelectedTile(tileId);
    setIsConflictZone(isConflict);
  };

  const handleRefreshTiles = (tileId) => {
    if (earthGlobeRef.current) {
      earthGlobeRef.current.refreshTiles(tileId);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Background: Earth Viewer */}
      <div className="absolute inset-0 z-0">
        <EarthGlobe
          ref={earthGlobeRef}
          onTileSelected={handleTileSelected}
        />
      </div>

      {/* Overlay: Header */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <Header />
      </div>

      {/* Overlay: Dashboard Panel */}
      <div className="absolute top-24 right-12 bottom-4 w-[400px] z-50">
        <DashboardPanel
          selectedTile={selectedTile}
          isConflictZone={isConflictZone}
          onRefreshTiles={handleRefreshTiles}
        />
      </div>
    </div>
  );
}