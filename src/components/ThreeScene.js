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
  isMobileDevice,
  getNormalizedEventCoords,
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

      // Event listeners for both mouse and touch
      window.addEventListener("resize", handleResize);

      // Check if this is a mobile device
      const isMobile = isMobileDevice();

      if (isMobile) {
        // On mobile, prioritize direct touch events over pointer events
        // with passive: false to properly prevent scrolling during interaction
        containerRef.current.addEventListener("touchstart", handleTouchStart, {
          passive: false,
        });
        containerRef.current.addEventListener("touchmove", handleTouchMove, {
          passive: false,
        });
        containerRef.current.addEventListener("touchend", handleTouchEnd, {
          passive: false,
        });
        containerRef.current.addEventListener("touchcancel", handleTouchEnd, {
          passive: false,
        });

        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
          console.log("Mobile touch handlers initialized");
        }, 100);
      } else {
        // For desktop, use standard pointer events
        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
      }

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

    // Note: isMobileDevice and getNormalizedEventCoords have been moved to threeHelpers.js

    /**
     * Handle pointer down events - check for cube hits and start dragging
     */
    function handlePointerDown(event) {
      // Prevent default to avoid scrolling on touch devices
      if (event.cancelable) {
        event.preventDefault();
      }

      // Get normalized coordinates
      const coords = getNormalizedEventCoords(event);

      // Try to find which cube was clicked
      let selectedCube = null;
      let hitPoint = null;

      // Test each cube for intersection
      for (const object of physicsObjects) {
        hitPoint = getHitPoint(
          coords.clientX,
          coords.clientY,
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

      // Check if we're on mobile
      const isMobile = isMobileDevice();

      // Add constraint between joint body and cube, with mobile optimization flag
      jointConstraint = addJointConstraint(
        hitPoint,
        selectedCube.body,
        jointBody,
        world,
        isMobile
      );

      // Ensure the selected body is awake
      selectedCube.body.wakeUp();

      // Apply a small impulse to overcome inertia/sticking on mobile
      if (isMobile) {
        // Small upward impulse to unstick the cube
        selectedCube.body.applyImpulse(
          new CANNON.Vec3(0, 0.1, 0),
          selectedCube.body.position
        );
      }

      // Set dragging state
      isDragging = true;
    }

    /**
     * Handle pointer move events - update dragging if active
     */
    function handlePointerMove(event) {
      if (!isDragging) return;

      // Prevent default to avoid scrolling on touch devices
      if (event.cancelable) {
        event.preventDefault();
      }

      // Get normalized coordinates
      const coords = getNormalizedEventCoords(event);

      // Get intersection with movement plane
      const hitPoint = getHitPoint(
        coords.clientX,
        coords.clientY,
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

    /**
     * Mobile-specific touch handlers with improved touch behavior
     */
    function handleTouchStart(event) {
      console.log("Touch start event received");

      // Always prevent default to avoid scrolling/zooming
      event.preventDefault();

      // Get the touch coordinates
      const coords = getNormalizedEventCoords(event);

      // Try to find which cube was tapped
      let selectedCube = null;
      let hitPoint = null;

      // Test each cube for intersection
      for (const object of physicsObjects) {
        hitPoint = getHitPoint(
          coords.clientX,
          coords.clientY,
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

      // Show the click marker for visual feedback
      clickMarker.visible = true;
      clickMarker.position.copy(hitPoint);

      // Position movement plane for dragging
      moveMovementPlane(movementPlane, hitPoint, camera);

      // Add constraint - optimized specifically for mobile touch
      jointConstraint = addJointConstraint(
        hitPoint,
        selectedCube.body,
        jointBody,
        world,
        true // Force mobile optimization flag
      );

      // Apply a stronger initial impulse to make the selected cube more responsive
      selectedCube.body.wakeUp();
      selectedCube.body.applyImpulse(
        new CANNON.Vec3(0, 0.2, 0),
        selectedCube.body.position
      );

      // Set dragging state
      isDragging = true;

      // Apply additional touch-specific settings
      if (jointConstraint) {
        // Make joint more responsive but softer for touch
        const eqs = jointConstraint.equations;
        if (eqs && eqs.length) {
          eqs.forEach((eq) => {
            // Use softer parameters for a more natural touch feel
            eq.setSpookParams(1e6, 10, world.dt);
          });
        }

        // Always allow collisions for more natural behavior
        jointConstraint.collideConnected = true;
      }
    }

    function handleTouchMove(event) {
      // Always prevent default on touch move
      event.preventDefault();

      // Only process if we're dragging
      if (isDragging) {
        // Get the touch coordinates
        const coords = getNormalizedEventCoords(event);

        // Get intersection with movement plane
        const hitPoint = getHitPoint(
          coords.clientX,
          coords.clientY,
          movementPlane,
          camera,
          raycaster
        );

        if (hitPoint) {
          // Update marker and constraint positions
          clickMarker.position.copy(hitPoint);
          moveJoint(hitPoint, jointBody, jointConstraint);

          // Keep the joint body awake to prevent sticking
          if (jointBody && jointBody.sleepState === CANNON.Body.SLEEPING) {
            jointBody.wakeUp();
          }
        }
      }
    }

    function handleTouchEnd(event) {
      // Clean up the drag state
      if (isDragging) {
        // Hide marker
        clickMarker.visible = false;

        // Apply a small impulse for a more natural release on mobile
        // This simulates the "throw" effect better
        if (jointConstraint && physicsObjects.length > 0) {
          // Get the first body (typically the one being dragged)
          const activeBody = physicsObjects[0].body;

          // Apply a small random impulse to create more natural motion
          activeBody.applyImpulse(
            new CANNON.Vec3(
              (Math.random() - 0.5) * 2,
              1 + Math.random(),
              (Math.random() - 0.5) * 2
            ),
            activeBody.position
          );
        }

        // Remove constraint
        removeJointConstraint(world, jointConstraint);
        jointConstraint = null;

        // End drag state
        isDragging = false;

        // Prevent any default browser behavior
        event.preventDefault();
      }
    }

    // Returns an hit point if there's a hit with the mesh,
    // otherwise returns undefined
    // Note: These functions have been moved to the threeHelpers.js file
    // and are now imported at the top of this file

    /**
     * Animation loop function
     */
    function animate() {
      // Use optimized physics stepping based on device
      const isMobile = isMobileDevice();
      if (isMobile) {
        // For mobile: balanced approach with more substeps and slightly longer timestep
        // This prevents physics calculation overload on lower-power devices
        const timeStep = 1 / 45; // Slightly longer timestep for mobile (was 1/60)
        const maxSubSteps = 4; // More substeps for stable simulation

        try {
          world.step(timeStep, timeStep, maxSubSteps);
        } catch (e) {
          // Recover from physics solver errors that sometimes occur on mobile
          console.warn("Physics solver error, resetting step:", e);
          world.step(timeStep, 0); // Try with no substeps as fallback
        }
      } else {
        // For desktop: use standard fixed step
        world.fixedStep();
      }

      // Sync the three.js meshes with the bodies
      // Use different sync strategies based on device capability
      for (let i = 0; i < physicsObjects.length; i++) {
        const obj = physicsObjects[i];

        // Always update position for visual continuity
        obj.mesh.position.copy(obj.body.position);

        // For mobile: only update rotation if there's significant change to improve performance
        if (!isMobile || obj.body.angularVelocity.lengthSquared() > 0.05) {
          obj.mesh.quaternion.copy(obj.body.quaternion);
        }

        // Wake up bodies that might be stuck on mobile
        if (
          isMobile &&
          isDragging &&
          i === 0 &&
          obj.body.sleepState === CANNON.Body.SLEEPING
        ) {
          obj.body.wakeUp();
        }

        // Reduce logging on mobile for performance
        if (!isMobile) {
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

      // Check device type for proper cleanup
      const isMobile = isMobileDevice();

      if (isMobile) {
        // Clean up mobile-specific touch handlers
        if (containerRef.current) {
          containerRef.current.removeEventListener(
            "touchstart",
            handleTouchStart
          );
          containerRef.current.removeEventListener(
            "touchmove",
            handleTouchMove
          );
          containerRef.current.removeEventListener("touchend", handleTouchEnd);
          containerRef.current.removeEventListener(
            "touchcancel",
            handleTouchEnd
          );
        }
      } else {
        // Clean up desktop pointer events
        window.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      }

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

  // Use a ref to track if we're on a mobile device
  const isMobile = useRef(false);

  // Set the mobile flag once on component mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      isMobile.current =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
    }
  }, []);

  return (
    <>
      {/* Centered minimal app title with transparent background */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-10">
        <div className="app-title bg-black bg-opacity-30 backdrop-blur-md rounded-full shadow-lg py-2 px-5 flex items-center gap-2 cursor-pointer">
          <div className="w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-inner">
            <div className="w-2.5 h-2.5 bg-blue-300 rounded transform rotate-45"></div>
          </div>
          <h1 className="text-sm font-bold text-white">Physical Cubes</h1>
        </div>
      </div>

      {/* Touch status indicator that shows only on mobile */}
      {isMobile.current && (
        <div className="fixed bottom-6 right-6 z-10 flex items-center gap-1.5 bg-black bg-opacity-30 backdrop-blur-md rounded-full py-1.5 px-3">
          <div className="w-2 h-2 rounded-full bg-green-400 pulse-animation"></div>
          <span className="text-xs text-white">Touch Mode</span>
        </div>
      )}

      {/* Canvas container - must be full window */}
      <div
        ref={containerRef}
        className="fixed inset-0 w-full h-full"
        style={{
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        }}
        aria-label="3D interactive scene with draggable cubes"
      ></div>

      {/* Add enhanced animations */}
      <style jsx global>{`
        .pulse-animation {
          animation: pulse 2s infinite;
          box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
        }

        @keyframes pulse {
          0% {
            opacity: 0.7;
            box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
          }
          50% {
            opacity: 1;
            box-shadow: 0 0 0 5px rgba(74, 222, 128, 0);
          }
          100% {
            opacity: 0.7;
            box-shadow: 0 0 0 0 rgba(74, 222, 128, 0);
          }
        }

        .fade-out-animation {
          animation: fadeOut 1s ease-in forwards;
          animation-delay: 4s; /* Shorter delay for better UX */
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(10px);
            pointer-events: none;
          }
        }

        /* Add a subtle hover effect for the app title */
        .app-title {
          transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
        }

        .app-title:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </>
  );
}
