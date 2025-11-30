import React, { useEffect, useRef, useState, useCallback } from 'react';

import * as Cesium from 'cesium';
import * as h3 from 'h3-js';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { fetchTiles, lockTile, confirmTile } from '../services/api';
import { DateTimePicker } from './DateTimePicker';

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



    // Refs for state access inside callbacks
    const selectedH3IndexRef = useRef(selectedH3Index);
    const tilesPrimitivesRef = useRef([]); // Track tile primitives for cleanup

    // Sync ref with state
    useEffect(() => {
        selectedH3IndexRef.current = selectedH3Index;
    }, [selectedH3Index]);

    // Idle Animation Constants
    const lastInteractionTime = useRef(Date.now());
    const IDLE_TIMEOUT = 3000;
    const TARGET_HEIGHT = 20000000;
    const ROTATION_SPEED = 0.0005;

    const resetIdleTimer = useCallback(() => {
        lastInteractionTime.current = Date.now();
    }, []);

    // 1. Viewer Initialization Effect (Runs ONCE)
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
            selectionIndicator: true,
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            creditContainer: document.createElement('div'),
            contextOptions: {
                webgl: {
                    alpha: true,
                }
            }
        });
        viewerRef.current = viewer;

        // Theme
        viewer.scene.skyBox.show = false;
        viewer.scene.sun.show = false;
        viewer.scene.moon.show = false;
        viewer.scene.skyAtmosphere.show = false;
        viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;

        if (viewer.selectionIndicator) {
            const indicator = viewer.selectionIndicator.viewModel.selectionIndicatorElement;
            if (indicator) indicator.style.display = 'none';
        }

        // Interaction Handler
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((movement) => {
            resetIdleTimer();
            const pickedObject = viewer.scene.pick(movement.position);
            if (Cesium.defined(pickedObject) && typeof pickedObject.id === 'string') {
                console.log('Clicked H3 Hexagon ID:', pickedObject.id);
                setSelectedH3Index(pickedObject.id);
                window.parent.postMessage({ type: 'TILE_SELECTED', h3Index: pickedObject.id }, '*');
            } else {
                setSelectedH3Index(null);
                window.parent.postMessage({ type: 'TILE_SELECTED', h3Index: null }, '*');
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Idle Reset Listeners
        [
            Cesium.ScreenSpaceEventType.MOUSE_MOVE,
            Cesium.ScreenSpaceEventType.WHEEL,
            Cesium.ScreenSpaceEventType.PINCH_START,
            Cesium.ScreenSpaceEventType.PINCH_MOVE
        ].forEach(type => handler.setInputAction(resetIdleTimer, type));

        // Idle Animation Loop
        const onTick = (clock) => {
            if (viewer.isDestroyed()) return;

            // Use Ref for current selection state to avoid stale closure
            if (!selectedH3IndexRef.current && Date.now() - lastInteractionTime.current > IDLE_TIMEOUT) {
                const cameraHeight = viewer.camera.positionCartographic.height;
                if (cameraHeight < TARGET_HEIGHT) {
                    const moveAmount = Math.max(10000, (TARGET_HEIGHT - cameraHeight) * 0.05);
                    viewer.camera.moveBackward(moveAmount);
                }
                viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, ROTATION_SPEED);
            }
        };
        viewer.clock.onTick.addEventListener(onTick);

        // Message Listener
        const handleRefresh = (event) => {
            if (event.data?.type === 'REFRESH_TILES') loadTiles();
            if (event.data?.type === 'PURCHASE_SUCCESS') {
                const h3Index = event.data.h3Index;
                if (!viewer || viewer.isDestroyed()) return;

                const boundary = h3.cellToBoundary(h3Index);
                const positions = [];
                boundary.forEach(([lat, lon]) => positions.push(lon, lat));

                const entity = viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(positions)),
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

                setTimeout(() => {
                    if (viewer && !viewer.isDestroyed()) viewer.entities.remove(entity);
                }, 3000);
                loadTiles();
            }
        };
        window.addEventListener('message', handleRefresh);

        // Cleanup
        return () => {
            if (viewer && !viewer.isDestroyed()) {
                handler.destroy();
                viewer.clock.onTick.removeEventListener(onTick);
                viewer.destroy();
            }
            window.removeEventListener('message', handleRefresh);
        };
    }, []); // Empty dependency array: Runs once on mount

    // 2. Tiles Rendering Effect (Runs when lockedTiles changes)
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;

        // Cleanup old primitives
        tilesPrimitivesRef.current.forEach(p => viewer.scene.primitives.remove(p));
        tilesPrimitivesRef.current = [];
        viewer.entities.removeAll(); // Clear entities (labels, images)

        // Re-add Conflict Zone Label
        const targetHex = '835962fffffffff';
        const [targetLat, targetLon] = h3.cellToLatLng(targetHex);
        const conflictZoneHexes = h3.gridDisk(targetHex, 4);
        const conflictZoneSet = new Set(conflictZoneHexes);

        viewer.entities.add({
            id: 'conflict-zone-label',
            position: Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 100000),
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

        // Generate Primitives
        const res0Cells = h3.getRes0Cells();
        const allHexagons = res0Cells.flatMap(res0 => h3.cellToChildren(res0, 3));
        const instances = [];
        const outlineInstances = [];

        const baseColor = Cesium.Color.BLACK.withAlpha(0.85);
        const lockedColor = Cesium.Color.RED.withAlpha(0.5);
        const ownedColor = Cesium.Color.WHITE.withAlpha(0.01);
        const outlineColor = Cesium.Color.WHITE.withAlpha(0.1);
        const conflictOutlineColor = Cesium.Color.RED.withAlpha(0.8);

        allHexagons.forEach((h3Index) => {
            if (h3.isPentagon(h3Index)) return;
            const boundary = h3.cellToBoundary(h3Index);

            // IDL Check
            let crossesIDL = false;
            for (let i = 0; i < boundary.length; i++) {
                if (Math.abs(boundary[i][1] - boundary[(i + 1) % boundary.length][1]) > 180) {
                    crossesIDL = true;
                    break;
                }
            }
            if (crossesIDL) return;

            const uniquePositions = [];
            const seen = new Set();
            boundary.forEach(([lat, lon]) => {
                const key = `${lat},${lon}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniquePositions.push(lon, lat);
                }
            });
            if (uniquePositions.length < 6) return;

            const polygonHierarchy = new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(uniquePositions));
            const tileData = lockedTiles.get(h3Index);

            // Image Entity Case
            if (tileData?.status === 'OWNED' && tileData.metadata?.imageUrl) {
                viewer.entities.add({
                    id: h3Index,
                    polygon: {
                        hierarchy: polygonHierarchy,
                        material: new Cesium.ImageMaterialProperty({ image: tileData.metadata.imageUrl, transparent: false }),
                        height: 0,
                        outline: true,
                        outlineColor: conflictZoneSet.has(h3Index) ? conflictOutlineColor : outlineColor
                    }
                });
                return;
            }

            let color = baseColor;
            if (tileData?.status === 'OWNED') color = ownedColor;
            else if (tileData?.status === 'LOCKED') color = lockedColor;

            instances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonGeometry({ polygonHierarchy, height: 0 }),
                attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
                id: h3Index,
            }));

            outlineInstances.push(new Cesium.GeometryInstance({
                geometry: new Cesium.PolygonOutlineGeometry({ polygonHierarchy, height: 0 }),
                attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(conflictZoneSet.has(h3Index) ? conflictOutlineColor : outlineColor) },
            }));
        });

        if (instances.length > 0) {
            const primitive = new Cesium.Primitive({
                geometryInstances: instances,
                appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                asynchronous: false,
            });
            viewer.scene.primitives.add(primitive);
            tilesPrimitivesRef.current.push(primitive);
        }

        if (outlineInstances.length > 0) {
            const outlinePrimitive = new Cesium.Primitive({
                geometryInstances: outlineInstances,
                appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                asynchronous: false,
            });
            viewer.scene.primitives.add(outlinePrimitive);
            tilesPrimitivesRef.current.push(outlinePrimitive);
        }

    }, [lockedTiles]); // Only re-run when tiles change

    // 3. Selection & Highlight Effect
    const highlightPrimitiveRef = useRef(null);

    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;

        resetIdleTimer();

        // Highlight Logic
        if (highlightPrimitiveRef.current) {
            viewer.scene.primitives.remove(highlightPrimitiveRef.current);
            highlightPrimitiveRef.current = null;
        }

        if (selectedH3Index) {
            // Zoom to Tile Logic
            const [lat, lon] = h3.cellToLatLng(selectedH3Index);
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, 5000000), // Zoom to 5000km
                duration: 1.5,
                easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
            });

            // Draw Highlight
            const boundary = h3.cellToBoundary(selectedH3Index);
            const positions = [];
            boundary.forEach(([lat, lon]) => positions.push(lon, lat));

            const geometry = new Cesium.PolygonOutlineGeometry({
                polygonHierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(positions)),
                height: 100,
                extrudedHeight: 100,
            });

            const instance = new Cesium.GeometryInstance({
                geometry: geometry,
                attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN) },
                id: 'highlight-outline',
            });

            const primitive = new Cesium.Primitive({
                geometryInstances: instance,
                appearance: new Cesium.PerInstanceColorAppearance({
                    flat: true,
                    renderState: { lineWidth: Math.min(4.0, viewer.scene.maximumAliasedLineWidth) },
                }),
                asynchronous: false,
            });

            viewer.scene.primitives.add(primitive);
            highlightPrimitiveRef.current = primitive;
        }
    }, [selectedH3Index, resetIdleTimer]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', margin: 0, padding: 0, overflow: 'hidden' }}
            />

            {/* Date Time Picker at bottom left */}
            <DateTimePicker
                value={filterDate}
                onChange={(newDate) => setFilterDate(newDate)}
            />
        </div>
    );
};

export default GlobeViewer;

