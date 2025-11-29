"use client";

export function EarthGlobe() {
    return (
        <div className="h-[600px] w-full relative overflow-hidden rounded-xl border border-gray-200 shadow-lg bg-black">
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
