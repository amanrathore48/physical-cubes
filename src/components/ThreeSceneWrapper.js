"use client";

import dynamic from "next/dynamic";

// Dynamic import with no SSR for Three.js component
const ThreeScene = dynamic(() => import("@/components/ThreeScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="text-center">
        <div className="inline-block mb-8">
          <div className="relative w-16 h-16 animate-spin">
            <div className="absolute w-16 h-16 rounded-lg border-4 border-dashed border-blue-500"></div>
            <div className="absolute w-8 h-8 top-4 left-4 bg-blue-300 rounded transform rotate-45"></div>
          </div>
        </div>
        <h2 className="text-xl font-bold text-white">Loading Physics Engine</h2>
        <p className="text-blue-300 text-sm mt-2">
          Preparing your interactive experience...
        </p>
      </div>
    </div>
  ),
});

export default function ThreeSceneWrapper() {
  return <ThreeScene />;
}
