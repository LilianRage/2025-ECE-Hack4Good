"use client";

export function EarthGlobe() {
    return (
        <div className="h-full w-full relative">
            <iframe
                src="http://localhost:5173"
                className="w-full h-full border-none"
                title="Earth Metaverse"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    );
}
