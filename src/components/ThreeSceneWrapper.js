"use client";

import dynamic from "next/dynamic";

// Dynamic import with no SSR for Three.js component
const ThreeScene = dynamic(() => import("@/components/ThreeScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center">
      Loading Three.js scene...
    </div>
  ),
});

export default function ThreeSceneWrapper() {
  return <ThreeScene />;
}
