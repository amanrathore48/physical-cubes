"use client";

import { useEffect, useRef } from "react";
import * as CANNON from "cannon-es";
import * as THREE from "three";
import {
  createScene,
  setupCamera,
  createRenderer,
  setupLighting,
  createPhysicsWorld,
  createFloor,
  createCube,
  setupRaycaster,
  createClickMarker,
  createMovementPlane,
  createJointBody,
  getHitPoint,
  moveMovementPlane,
  addJointConstraint,
  moveJoint,
  removeJointConstraint,
  disposeResources,
} from "../utils/threeHelpers";

/**
 * ThreeScene component - renders a draggable physics cube using cannon.js constraints
 */
export default function ThreeScene() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Early return if container not ready
    if (!containerRef.current) return;

    // Scene objects
    let camera, scene, renderer, raycaster;
    let clickMarker, movementPlane;
    let world, jointBody, jointConstraint;

    // State tracking
    let isDragging = false;

    // Animation frame tracking
    let animationFrameId = null;

    // Collections for physics objects
    const physicsObjects = [];
    const meshes = [];

    // Initialize the scene, physics and start animation
    initScene();
    initPhysics();
    startAnimation();

    /**
     * Initialize the Three.js scene
     */
    function initScene() {
      console.log("Starting scene initialization");

      // Create scene with gray background for better object visibility
      scene = createScene();
      scene.background = new THREE.Color(0x333333);

      // Setup camera
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera = setupCamera(width, height);

      // Adjust camera position to better see all objects
      camera.position.set(0, 15, 25);
      camera.lookAt(0, 5, 0);

      // Create renderer with better settings
      renderer = createRenderer(width, height);
      renderer.setClearColor(0x87ceeb); // Sky blue background for better visibility
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Performance optimization
      renderer.outputColorSpace = THREE.SRGBColorSpace; // Modern color space

      // Add renderer to DOM and ensure it fills container
      containerRef.current.innerHTML = ""; // Clear any existing content first
      containerRef.current.appendChild(renderer.domElement);

      // Ensure renderer fills container completely
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      // Force an initial resize to ensure correct dimensions
      renderer.setSize(width, height);

      // Add enhanced lighting for better visibility
      const lights = setupLighting(scene);
      console.log("Lighting setup complete", lights);

      // Make directional light stronger and reposition
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
      directionalLight.position.set(10, 20, 15);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);

      // Add additional lights for better visibility
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Brighter ambient
      scene.add(ambientLight);

      // Add a helpful grid to visualize the ground plane - make it larger
      const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x888888);
      scene.add(gridHelper);

      // Setup raycaster
      raycaster = setupRaycaster();

      // Create click marker for visual feedback
      clickMarker = createClickMarker(scene);

      // Create movement plane for dragging
      movementPlane = createMovementPlane(scene);

      // Event listeners
      window.addEventListener("resize", handleResize);
      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);

      // Log that scene was initialized (for debugging)
      console.log("Three.js scene initialized");
    }

    /**
     * Handle window resizing
     */
    function handleResize() {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    }

    // Remove duplicate resize handler

    /**
     * Initialize physics world and objects
     */
    function initPhysics() {
      console.log("Starting physics initialization");

      // Create physics world with visible debugging
      world = createPhysicsWorld();

      // Create a visible floor higher up
      const floor = createFloor(scene, world, 50, 50, 0); // Set floor at y=0 for visibility
      console.log("Floor created:", floor);

      // Add a visual debug floor with color - make it larger and more colorful
      const debugFloorGeo = new THREE.PlaneGeometry(40, 40);
      const debugFloorMat = new THREE.MeshStandardMaterial({
        color: 0x55aa55, // Brighter green
        metalness: 0.1,
        roughness: 0.7,
        side: THREE.DoubleSide, // Visible from both sides
      });
      const debugFloor = new THREE.Mesh(debugFloorGeo, debugFloorMat);
      debugFloor.rotation.x = -Math.PI / 2;
      debugFloor.position.y = 0.01; // Slightly above the physics floor
      debugFloor.receiveShadow = true;
      scene.add(debugFloor);
      console.log("Debug floor added");

      // Create even larger cubes with brighter colors
      const cubeSize = 3; // Even larger cubes for visibility
      const cubePositions = [
        new THREE.Vector3(0, 10, 0), // Center
        new THREE.Vector3(-5, 15, -3), // Left
        new THREE.Vector3(5, 20, 2), // Right
        new THREE.Vector3(0, 25, -2), // Top
      ];

      // Bright, high-contrast colors
      const cubeColors = [0xff0000, 0x00aaff, 0x00ff00, 0xffaa00];

      cubePositions.forEach((position, index) => {
        console.log(`Creating cube ${index} at position:`, position);

        // Create cube with specified size
        const cube = createCube(
          scene,
          world,
          position,
          cubeColors[index],
          cubeSize
        );
        physicsObjects.push(cube);
        meshes.push(cube.mesh);

        // Wake up bodies to ensure they start moving
        cube.body.wakeUp();

        // Apply stronger initial impulse to make them move visibly
        const randomImpulse = new CANNON.Vec3(
          (Math.random() - 0.5) * 10,
          5, // Add upward force
          (Math.random() - 0.5) * 10
        );
        cube.body.applyImpulse(randomImpulse, cube.body.position);

        // Log cube creation for debugging
        console.log(`Cube ${index} created with body:`, cube.body.id);
      });

      // Create joint body for constraints
      jointBody = createJointBody(world);

      // Log physics objects for debugging
      console.log(`Created ${physicsObjects.length} physics objects`);
    }

    /**
     * Handle pointer down events - check for cube hits and start dragging
     */
    function handlePointerDown(event) {
      // Try to find which cube was clicked
      let selectedCube = null;
      let hitPoint = null;

      // Test each cube for intersection
      for (const object of physicsObjects) {
        hitPoint = getHitPoint(
          event.clientX,
          event.clientY,
          object.mesh,
          camera,
          raycaster
        );

        if (hitPoint) {
          selectedCube = object;
          break;
        }
      }

      // If nothing was hit, return early
      if (!selectedCube || !hitPoint) return;

      // Show and position the click marker
      clickMarker.visible = true;
      clickMarker.position.copy(hitPoint);

      // Position movement plane for dragging
      moveMovementPlane(movementPlane, hitPoint, camera);

      // Add constraint between joint body and cube
      jointConstraint = addJointConstraint(
        hitPoint,
        selectedCube.body,
        jointBody,
        world
      );

      // Set dragging state
      isDragging = true;
    }

    /**
     * Handle pointer move events - update dragging if active
     */
    function handlePointerMove(event) {
      if (!isDragging) return;

      // Get intersection with movement plane
      const hitPoint = getHitPoint(
        event.clientX,
        event.clientY,
        movementPlane,
        camera,
        raycaster
      );

      if (hitPoint) {
        // Update marker and constraint positions
        clickMarker.position.copy(hitPoint);
        moveJoint(hitPoint, jointBody, jointConstraint);
      }
    }

    /**
     * Handle pointer up events - end dragging
     */
    function handlePointerUp() {
      if (!isDragging) return;

      // Hide marker and remove constraint
      clickMarker.visible = false;
      removeJointConstraint(world, jointConstraint);
      jointConstraint = null;

      // End drag state
      isDragging = false;
    }

    // Returns an hit point if there's a hit with the mesh,
    // otherwise returns undefined
    // Note: These functions have been moved to the threeHelpers.js file
    // and are now imported at the top of this file

    /**
     * Animation loop function
     */
    function animate() {
      // Step the physics world with smaller steps for better stability
      world.fixedStep();

      // Sync the three.js meshes with the bodies
      for (let i = 0; i < physicsObjects.length; i++) {
        const obj = physicsObjects[i];
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);

        // Log positions more frequently during initial run to help with debugging
        const initialRun = animationFrameId < 100; // First ~100 frames
        if (initialRun && i === 0 && animationFrameId % 10 === 0) {
          console.log(
            `Frame ${animationFrameId}, Object ${i} position:`,
            obj.mesh.position,
            `velocity:`,
            obj.body.velocity
          );
        } else if (Math.random() < 0.001) {
          // Still occasionally log after initial frames
          console.log(`Object ${i} position:`, obj.mesh.position);
        }
      }

      // Render the scene
      renderer.render(scene, camera);

      // Request the next frame
      animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Debug function to check visibility and add visual markers
     */
    function debugSceneVisibility() {
      console.log("Scene debug info:");
      console.log("- Camera position:", camera.position);
      console.log("- # of objects in scene:", scene.children.length);
      console.log("- # of physics objects:", physicsObjects.length);
      console.log("- Renderer:", renderer);
      console.log("- Animation frame ID:", animationFrameId);

      // Create larger axes helper to see orientation
      const axesHelper = new THREE.AxesHelper(20);
      scene.add(axesHelper);
    }

    /**
     * Start the animation loop
     */
    function startAnimation() {
      console.log("Starting animation loop");

      // Run debug visualization immediately
      debugSceneVisibility();

      // Start the animation loop
      animationFrameId = requestAnimationFrame(animate);

      // Log initial scene state
      console.log("Initial scene state:", {
        cameraPosition: camera.position.clone(),
        objectCount: scene.children.length,
        rendererDomElement: renderer.domElement,
        containerSize: {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        },
      });
    }

    // Clean up function for React useEffect
    return () => {
      // Remove event listeners
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      // Cancel animation frame
      cancelAnimationFrame(animationFrameId);

      // Clean up constraint if it exists
      if (jointConstraint && world) {
        removeJointConstraint(world, jointConstraint);
      }

      // Remove the renderer DOM element
      if (
        containerRef.current &&
        renderer?.domElement &&
        containerRef.current.contains(renderer.domElement)
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // Dispose of Three.js resources
      disposeResources({
        renderer,
        meshes: [...meshes, clickMarker, movementPlane],
      });
    };
  }, []);

  return (
    <>
      {/* Debug overlay */}
      <div className="fixed top-0 left-0 bg-black bg-opacity-70 text-white p-2 z-10 text-sm">
        <h1 className="text-lg font-bold mb-1">ThreeJS Physics Demo</h1>
        <p>Click and drag cubes to move them</p>
        <p className="opacity-75">Drag across a cube to pick it up</p>
      </div>

      {/* Loading indicator */}
      <div className="fixed top-0 right-0 bg-green-700 text-white p-2 z-10">
        3D Scene Active
      </div>

      {/* Canvas container - must be full window */}
      <div
        ref={containerRef}
        className="fixed inset-0 w-full h-full"
        style={{
          overflow: "hidden",
          background: "linear-gradient(to bottom, #87CEEB, #ffffff)",
        }}
        aria-label="3D interactive scene with draggable cubes"
      ></div>
    </>
  );
}
