import React, { useEffect, useRef, useState, useCallback } from 'react';

import * as Cesium from 'cesium';
import * as h3 from 'h3-js';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { fetchTiles, lockTile, confirmTile } from '../services/api';

const GlobeViewer = () => {
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const [selectedH3Index, setSelectedH3Index] = useState(null);
    const [lockedTiles, setLockedTiles] = useState(new Map()); // Map<h3Index, tileData>
    const [isLocking, setIsLocking] = useState(false);

    // Date States
    // Date States
    // Default to current local time for filter (YYYY-MM-DDTHH:mm)
    const [filterDate, setFilterDate] = useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    // Default to current time for purchase
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 16));

    // Fetch tiles function
    const loadTiles = useCallback(async () => {
        // For now, we fetch a large area or all. 
        // In a real app with millions of tiles, we'd use the camera bbox.
        // Here we just fetch everything for simplicity as we don't have many locked tiles yet.
        const bbox = {
            minLon: -180,
            minLat: -90,
            maxLon: 180,
            maxLat: 90
        };

        // Convert local filterDate to UTC ISO string for API
        let utcFilterDate = null;
        if (filterDate) {
            const localDate = new Date(filterDate);
            utcFilterDate = localDate.toISOString();
        }

        const tiles = await fetchTiles(bbox, utcFilterDate);
        const newLockedTiles = new Map();
        tiles.forEach(tile => {
            newLockedTiles.set(tile._id, tile);
        });
        setLockedTiles(newLockedTiles);
    }, [filterDate]);

    useEffect(() => {
        loadTiles();
    }, [loadTiles]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize Cesium Viewer
        const viewer = new Cesium.Viewer(containerRef.current, {
            animation: false,
            baseLayerPicker: false,
            fullscreenButton: false,
            vrButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: true, // Keep true to avoid "undefined" errors, hide manually
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            creditContainer: document.createElement('div'), // Hide credits or move them
            contextOptions: {
                webgl: {
                    alpha: true,
                }
            }
        });
        viewerRef.current = viewer;

        // Theme: Deep Space / Futuristic (Black Background)
        viewer.scene.skyBox.show = false;
        viewer.scene.sun.show = false;
        viewer.scene.moon.show = false;
        viewer.scene.skyAtmosphere.show = false;
        viewer.scene.backgroundColor = Cesium.Color.BLACK;

        // Manually hide selection indicator
        if (viewer.selectionIndicator) {
            // We hide the container or the element
            const indicator = viewer.selectionIndicator.viewModel.selectionIndicatorElement;
            if (indicator) {
                indicator.style.display = 'none';
            }
        }

        // --- H3 Integration ---

        // Generate global hexagons at Resolution 3 (approx 41,162 cells)
        const res0Cells = h3.getRes0Cells();
        const allHexagons = res0Cells.flatMap(res0 => h3.cellToChildren(res0, 3));

        // Create instances for the Primitive API
        const instances = [];
        const outlineInstances = [];

        // --- CONFLICT ZONE DEMO ---
        // Target Tile: 835962fffffffff (Africa)
        const targetHex = '835962fffffffff';
        const [targetLat, targetLon] = h3.cellToLatLng(targetHex); // Returns [lat, lon]

        // Calculate Conflict Zone Tiles (k-ring 4)
        const conflictZoneHexes = h3.gridDisk(targetHex, 4);
        const conflictZoneSet = new Set(conflictZoneHexes);

        // Fly to the target
        // Fly to the target with an offset to center it in the visible area (left of the menu)
        // We shift the camera target to the RIGHT (East) so the Earth appears to the LEFT
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(targetLon + 25, targetLat, 12000000),
        });

        // Add Label (Keep label, remove polygon overlay)
        viewer.entities.add({
            id: 'conflict-zone-label',
            position: Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 100000), // Above the zone
            label: {
                text: 'ZONE DE CONFLIT\nMISSION COMMUNAUTAIRE',
                font: 'bold 16px Inter, sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 4,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -20),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10000000)
            }
        });
        // --------------------------

        // Fog of War Colors
        const baseColor = Cesium.Color.BLACK.withAlpha(0.85); // Obscured (Fog)
        const lockedColor = Cesium.Color.RED.withAlpha(0.5); // Locked
        const ownedColor = Cesium.Color.WHITE.withAlpha(0.01); // Nearly transparent for picking
        const outlineColor = Cesium.Color.WHITE.withAlpha(0.1); // Faint outline
        const conflictOutlineColor = Cesium.Color.RED.withAlpha(0.8); // Red outline for conflict zone

        // Clear previous entities (important for re-renders)
        viewer.entities.removeAll();

        allHexagons.forEach((h3Index) => {
            // Skip pentagons
            if (h3.isPentagon(h3Index)) return;

            const boundary = h3.cellToBoundary(h3Index);

            // Filter 1: Check for IDL crossing
            let crossesIDL = false;
            for (let i = 0; i < boundary.length; i++) {
                const lon = boundary[i][1];
                const nextLon = boundary[(i + 1) % boundary.length][1];
                if (Math.abs(lon - nextLon) > 180) {
                    crossesIDL = true;
                    break;
                }
            }
            if (crossesIDL) return;

            // Filter 2: Remove duplicate points
            const uniquePositions = [];
            const seen = new Set();

            boundary.forEach(([lat, lon]) => {
                const key = `${lat},${lon}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniquePositions.push(lon, lat); // Cesium expects [lon, lat]
                }
            });

            // Filter 3: Ensure at least 3 points
            if (uniquePositions.length < 6) return;

            const polygonHierarchy = new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray(uniquePositions)
            );

            // Determine color based on status
            const tileData = lockedTiles.get(h3Index);

            // SPECIAL CASE: Owned Tile with Image -> Render as Entity
            if (tileData && tileData.status === 'OWNED' && tileData.metadata && tileData.metadata.imageUrl) {
                viewer.entities.add({
                    id: h3Index, // Important for picking
                    polygon: {
                        hierarchy: polygonHierarchy,
                        material: new Cesium.ImageMaterialProperty({
                            image: tileData.metadata.imageUrl,
                            transparent: false
                        }),
                        height: 0,
                        outline: true,
                        outlineColor: conflictZoneSet.has(h3Index) ? conflictOutlineColor : outlineColor
                    }
                });
                return; // Skip adding to primitive batch
            }

            // Standard Primitive Rendering (Fog / Locked / Transparent)
            let color = baseColor; // Default: Obscured

            if (tileData) {
                if (tileData.status === 'OWNED') {
                    color = ownedColor; // Reveal Map (Transparent/Invisible)
                } else if (tileData.status === 'LOCKED') {
                    color = lockedColor; // Locked
                }
            }

            // Fill Instance
            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonGeometry({
                    polygonHierarchy: polygonHierarchy,
                    height: 0,
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
                },
                id: h3Index,
            }));

            // Outline Instance
            // Check if in conflict zone
            const isConflictZone = conflictZoneSet.has(h3Index);

            outlineInstances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonOutlineGeometry({
                    polygonHierarchy: polygonHierarchy,
                    height: 0,
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(isConflictZone ? conflictOutlineColor : outlineColor),
                },
            }));
        });

        // Add Fill Primitive
        const primitive = new Cesium.Primitive({
            geometryInstances: instances,
            appearance: new Cesium.PerInstanceColorAppearance({
                flat: true,
                translucent: true,
            }),
            asynchronous: false,
        });
        viewer.scene.primitives.add(primitive);

        // Add Outline Primitive
        const outlinePrimitive = new Cesium.Primitive({
            geometryInstances: outlineInstances,
            appearance: new Cesium.PerInstanceColorAppearance({
                flat: true,
                translucent: true,
            }),
            asynchronous: false,
        });
        viewer.scene.primitives.add(outlinePrimitive);



        // --- Interaction (Picking) ---
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((movement) => {
            const pickedObject = viewer.scene.pick(movement.position);
            if (Cesium.defined(pickedObject) && typeof pickedObject.id === 'string') {
                console.log('Clicked H3 Hexagon ID:', pickedObject.id);
                setSelectedH3Index(pickedObject.id);

                // Send message to parent
                window.parent.postMessage({
                    type: 'TILE_SELECTED',
                    h3Index: pickedObject.id
                }, '*');
            } else {
                setSelectedH3Index(null);
                window.parent.postMessage({
                    type: 'TILE_SELECTED',
                    h3Index: null
                }, '*');
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Listen for Refresh Tiles
        const handleRefresh = (event) => {
            if (event.data && event.data.type === 'REFRESH_TILES') {
                console.log("Refreshing tiles...");
                loadTiles();
            }
            if (event.data && event.data.type === 'PURCHASE_SUCCESS') {
                const h3Index = event.data.h3Index;
                console.log("Animating purchase success for:", h3Index);

                const viewer = viewerRef.current;
                if (!viewer) return;

                // Create a pulsing effect
                const boundary = h3.cellToBoundary(h3Index);
                const positions = [];
                boundary.forEach(([lat, lon]) => positions.push(lon, lat));

                const entity = viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy(
                            Cesium.Cartesian3.fromDegreesArray(positions)
                        ),
                        material: new Cesium.ColorMaterialProperty(
                            new Cesium.CallbackProperty((time) => {
                                const alpha = (Math.sin(time.secondsOfDay * 5) + 1) / 2 * 0.6 + 0.2;
                                return Cesium.Color.CYAN.withAlpha(alpha);
                            }, false)
                        ),
                        height: 500,
                        outline: true,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2
                    }
                });

                // Remove after 3 seconds
                setTimeout(() => {
                    if (viewer && !viewer.isDestroyed()) {
                        viewer.entities.remove(entity);
                    }
                }, 3000);

                // Also reload tiles to show new status
                loadTiles();
            }
        };
        window.addEventListener('message', handleRefresh);

        // Cleanup
        return () => {
            handler.destroy();
            viewer.destroy();
            window.removeEventListener('message', handleRefresh);
        };
    }, [lockedTiles, loadTiles]); // Re-render when lockedTiles changes

    // Highlight Selected Tile
    const highlightPrimitiveRef = useRef(null);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // Remove previous highlight
        if (highlightPrimitiveRef.current) {
            viewer.scene.primitives.remove(highlightPrimitiveRef.current);
            highlightPrimitiveRef.current = null;
        }

        if (selectedH3Index) {
            const boundary = h3.cellToBoundary(selectedH3Index);
            const positions = [];
            boundary.forEach(([lat, lon]) => {
                positions.push(lon, lat);
            });

            const geometry = new Cesium.PolygonOutlineGeometry({
                polygonHierarchy: new Cesium.PolygonHierarchy(
                    Cesium.Cartesian3.fromDegreesArray(positions)
                ),
                height: 100, // Slightly raised to avoid z-fighting
                extrudedHeight: 100,
            });

            const instance = new Cesium.GeometryInstance({
                geometry: geometry,
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN),
                },
                id: 'highlight-outline',
            });

            const primitive = new Cesium.Primitive({
                geometryInstances: instance,
                appearance: new Cesium.PerInstanceColorAppearance({
                    flat: true,
                    renderState: {
                        lineWidth: Math.min(4.0, viewer.scene.maximumAliasedLineWidth),
                    },
                }),
                asynchronous: false,
            });

            viewer.scene.primitives.add(primitive);
            highlightPrimitiveRef.current = primitive;
        }
    }, [selectedH3Index]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', margin: 0, padding: 0, overflow: 'hidden' }}
            />

            {/* Global Date Filter */}
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                padding: '15px',
                background: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontFamily: 'Inter, sans-serif',
                zIndex: 1000,
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', opacity: 0.8 }}>
                    Filter by Game Time (Hour)
                </label>
                <input
                    type="datetime-local"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #555',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        outline: 'none',
                        fontFamily: 'inherit'
                    }}
                />
            </div>
        </div>
    );
};

export default GlobeViewer;

