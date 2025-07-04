import ThreeSceneWrapper from "@/components/ThreeSceneWrapper";

export const metadata = {
  title: "Physical Cubes | Interactive 3D Physics Playground",
  description:
    "Experiment with 3D physics in this interactive playground. Drag, throw and watch cubes interact with realistic physics powered by Three.js and Cannon.js",
  keywords: [
    "3D physics",
    "Three.js",
    "Cannon.js",
    "interactive",
    "physics simulation",
    "web 3D",
  ],
};

export default function Home() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <ThreeSceneWrapper />
    </div>
  );
}
