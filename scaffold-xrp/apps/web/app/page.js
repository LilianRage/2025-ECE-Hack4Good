"use client";

import { useState } from "react";
import { Header } from "../components/Header";
import { EarthGlobe } from "../components/EarthGlobe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { MapPin, Calendar, Coins, Users, AlertTriangle, Flame, ArrowLeft, ShoppingCart } from "lucide-react";

// Fake data for purchased tiles
const myTiles = [
  { id: "8928308281fffff", location: "Paris, France", purchaseDate: "2024-11-15", price: "50 XRP", coords: "48.8566°N, 2.3522°E", description: "Zone premium au cœur de Paris, incluant la Tour Eiffel et le Louvre." },
  { id: "8928308280fffff", location: "New York, USA", purchaseDate: "2024-10-22", price: "75 XRP", coords: "40.7128°N, 74.0060°W", description: "Manhattan Downtown, zone commerciale stratégique avec Times Square." },
  { id: "8928308283fffff", location: "Tokyo, Japan", purchaseDate: "2024-09-10", price: "60 XRP", coords: "35.6762°N, 139.6503°E", description: "District de Shibuya, carrefour technologique et culturel majeur." },
  { id: "8928308284fffff", location: "London, UK", purchaseDate: "2024-11-01", price: "55 XRP", coords: "51.5074°N, 0.1278°W", description: "City de Londres, zone financière historique incluant Big Ben." },
];

// Fake data for collaborative zones
const collaborativeZones = [
  {
    id: 1,
    name: "Ouragan en Floride",
    location: "Floride, USA",
    type: "Catastrophe naturelle",
    status: "active",
    contributors: 142,
    description: "Suivi en temps réel de l'ouragan Milton. Documentation des dégâts, coordination des secours et cartographie des zones affectées.",
    funding: "12,450 XRP",
    lastUpdate: "Il y a 2h"
  },
  {
    id: 2,
    name: "Conflit au Sahara",
    location: "Sahara",
    type: "Conflit",
    status: "active",
    contributors: 89,
    description: "Documentation des mouvements de population et des zones de conflit. Cartographie humanitaire pour l'aide internationale.",
    funding: "8,920 XRP",
    lastUpdate: "Il y a 5h"
  },
];

// Fake data for available zones to buy
const availableZones = [
  { id: "zone1", location: "Berlin, Allemagne", price: "45 XRP", size: "Premium", description: "Centre historique avec monuments culturels" },
  { id: "zone2", location: "Sydney, Australie", price: "80 XRP", size: "Elite", description: "Zone côtière incluant l'Opéra de Sydney" },
  { id: "zone3", location: "Dubai, UAE", price: "95 XRP", size: "Elite", description: "District commercial avec Burj Khalifa" },
];

export default function Home() {
  const [selectedTile, setSelectedTile] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />

      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full">
          {/* Left Column: Globe */}
          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-2xl aspect-square">
              <div className="absolute inset-0 bg-gradient-radial from-primary/30 via-primary/10 to-transparent blur-3xl"></div>
              <EarthGlobe />
            </div>
          </div>

          {/* Right Column: Tabs Menu */}
          <div className="flex items-center">
            <Card className="w-full bg-black/40 border-white/20 backdrop-blur-sm">
              <Tabs defaultValue="ma-terre" className="w-full">
                <TabsList className="w-full bg-white/5 p-1 m-6 mb-0">
                  <TabsTrigger value="ma-terre" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-black">
                    ma terre
                  </TabsTrigger>
                  <TabsTrigger value="collaboration" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-black">
                    collaboration
                  </TabsTrigger>
                  <TabsTrigger value="acheter" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-black">
                    acheter une zone
                  </TabsTrigger>
                </TabsList>

                {/* Ma Terre Tab */}
                <TabsContent value="ma-terre" className="m-6 space-y-3">
                  {!selectedTile ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs text-gray-500 uppercase tracking-wider">Mes NFT Tuiles</h3>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{myTiles.length}</Badge>
                      </div>

                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {myTiles.map((tile) => (
                          <div
                            key={tile.id}
                            onClick={() => setSelectedTile(tile)}
                            className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer group"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  <MapPin className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <div className="text-white font-medium text-sm mb-1 group-hover:text-primary transition-colors">{tile.location}</div>
                                  <div className="text-xs text-gray-500 font-mono">{tile.id}</div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">NFT</Badge>
                                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">{tile.price}</Badge>
                              </div>
                            </div>
                            <div className="text-xs text-gray-600 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Acheté le {tile.purchaseDate}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Tile Details View */
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        className="text-gray-400 hover:text-white p-0 h-auto"
                        onClick={() => setSelectedTile(null)}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour
                      </Button>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-5 h-5 text-primary" />
                          <h3 className="text-xl font-semibold text-white">{selectedTile.location}</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">NFT Tuile H3 - Détails de propriété</p>
                        <div className="flex gap-2 mb-6">
                          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">NFT</Badge>
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/20">{selectedTile.price}</Badge>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-gray-500 mb-2">ID H3</div>
                            <div className="text-sm font-mono bg-white/5 p-3 rounded border border-white/10">{selectedTile.id}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Coordonnées</div>
                            <div className="text-sm text-gray-300">{selectedTile.coords}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Date d'acquisition</div>
                            <div className="text-sm text-gray-300 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {selectedTile.purchaseDate}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Description</div>
                            <div className="text-sm text-gray-300">{selectedTile.description}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Collaboration Tab */}
                <TabsContent value="collaboration" className="m-6 space-y-3">
                  {!selectedZone ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs text-gray-500 uppercase tracking-wider">Événements actifs</h3>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{collaborativeZones.length}</Badge>
                      </div>

                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {collaborativeZones.map((zone) => (
                          <div
                            key={zone.id}
                            onClick={() => setSelectedZone(zone)}
                            className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer group"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`p-2 rounded-lg ${zone.type === "Catastrophe naturelle" ? "bg-orange-500/10" : "bg-red-500/10"}`}>
                                  {zone.type === "Catastrophe naturelle" ? (
                                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                                  ) : (
                                    <Flame className="w-4 h-4 text-red-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="text-white font-medium text-sm mb-1 group-hover:text-primary transition-colors">{zone.name}</div>
                                  <div className="text-xs text-gray-500">{zone.location}</div>
                                </div>
                              </div>
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">{zone.status}</Badge>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                              <span className="text-xs text-gray-600 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {zone.contributors} contributeurs
                              </span>
                              <span className="text-xs text-gray-500">{zone.lastUpdate}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Zone Details View */
                    <div className="space-y-4">
                      <Button
                        variant="ghost"
                        className="text-gray-400 hover:text-white p-0 h-auto"
                        onClick={() => setSelectedZone(null)}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour
                      </Button>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {selectedZone.type === "Catastrophe naturelle" ? (
                            <AlertTriangle className="w-5 h-5 text-orange-400" />
                          ) : (
                            <Flame className="w-5 h-5 text-red-400" />
                          )}
                          <h3 className="text-xl font-semibold text-white">{selectedZone.name}</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">Zone collaborative - {selectedZone.type}</p>
                        <div className="flex gap-2 mb-6">
                          <Badge className="bg-red-500/10 text-red-400 border-red-500/20">{selectedZone.status}</Badge>
                          <Badge variant="outline">{selectedZone.type}</Badge>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Localisation</div>
                            <div className="text-sm text-gray-300 flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              {selectedZone.location}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Description</div>
                            <div className="text-sm text-gray-300">{selectedZone.description}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-500 mb-2">Contributeurs</div>
                              <div className="text-sm text-gray-300 flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                {selectedZone.contributors}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-2">Financement</div>
                              <div className="text-sm text-gray-300 flex items-center gap-2">
                                <Coins className="w-4 h-4 text-green-400" />
                                {selectedZone.funding}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Dernière mise à jour</div>
                            <div className="text-sm text-gray-400">{selectedZone.lastUpdate}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Acheter une Zone Tab */}
                <TabsContent value="acheter" className="m-6 space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs text-gray-500 uppercase tracking-wider">Zones disponibles</h3>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{availableZones.length}</Badge>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {availableZones.map((zone) => (
                      <div
                        key={zone.id}
                        className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                              <ShoppingCart className="w-4 h-4 text-green-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-medium text-sm mb-1">{zone.location}</div>
                              <div className="text-xs text-gray-500">{zone.description}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge className={zone.size === "Elite" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}>
                              {zone.size}
                            </Badge>
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20">{zone.price}</Badge>
                          </div>
                        </div>
                        <Button className="w-full bg-primary hover:bg-primary/90 text-black font-medium">
                          Acheter cette zone
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-6">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>aXes. • 2025</p>
        </div>
      </footer>
    </div>
  );
}