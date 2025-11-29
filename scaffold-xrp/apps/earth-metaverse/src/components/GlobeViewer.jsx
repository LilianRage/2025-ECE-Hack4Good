import React, { useEffect, useRef, useState } from 'react';

import * as Cesium from 'cesium';
import * as h3 from 'h3-js';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const GlobeViewer = () => {
    const containerRef = useRef(null);
    const [selectedH3Index, setSelectedH3Index] = useState(null);

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
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            creditContainer: document.createElement('div'), // Hide credits or move them
        });

        // --- H3 Integration ---

        // Generate global hexagons at Resolution 3 (approx 41,162 cells)
        const res0Cells = h3.getRes0Cells();
        const allHexagons = res0Cells.flatMap(res0 => h3.cellToChildren(res0, 3));

        // Create instances for the Primitive API
        const instances = [];
        const outlineInstances = [];

        const baseColor = Cesium.Color.GRAY.withAlpha(0.1);
        const outlineColor = Cesium.Color.WHITE.withAlpha(0.3);

        allHexagons.forEach((h3Index) => {
            // Skip pentagons
            if (h3.isPentagon(h3Index)) return;

            const boundary = h3.cellToBoundary(h3Index);
            // boundary is array of [lat, lon]

            // Filter 1: Check for IDL crossing
            // If any two consecutive points have a longitude difference > 180, skip it.
            // Unwrapping is tricky and can lead to huge bounding boxes if not done perfectly.
            // For stability, we just drop these few tiles.
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
            if (uniquePositions.length < 6) return; // 3 points * 2 coords

            const polygonHierarchy = new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray(uniquePositions)
            );

            // Fill Instance
            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonGeometry({
                    polygonHierarchy: polygonHierarchy,
                    height: 0,
                    // Use RHUMB_LINE or GEODESIC? Default is GEODESIC.
                    // For small hexagons, it doesn't matter much, but GEODESIC is better for globe.
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(baseColor),
                },
                id: h3Index,
            }));

            // Outline Instance
            outlineInstances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonOutlineGeometry({
                    polygonHierarchy: polygonHierarchy,
                    height: 0,
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(outlineColor),
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

        // Fly to a global view
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000),
        });

        // --- Interaction (Picking) ---
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((movement) => {
            const pickedObject = viewer.scene.pick(movement.position);
            if (Cesium.defined(pickedObject) && typeof pickedObject.id === 'string') {
                console.log('Clicked H3 Hexagon ID:', pickedObject.id);
                setSelectedH3Index(pickedObject.id);
            } else {
                setSelectedH3Index(null);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Cleanup
        return () => {
            handler.destroy();
            viewer.destroy();
        };
    }, []);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', margin: 0, padding: 0, overflow: 'hidden' }}
            />
            {selectedH3Index && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    padding: '10px 20px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    borderRadius: '8px',
                    pointerEvents: 'none',
                    backdropFilter: 'blur(5px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    zIndex: 1000,
                }}>
                    Selected Hexagon: <strong>{selectedH3Index}</strong>
                </div>
            )}
        </div>
    );
};

export default GlobeViewer;
