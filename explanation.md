# Physical Cubes: 3D Physics Implementation Guide

## Overview

This document explains the technical implementation of "Physical Cubes", a 3D web application built with Three.js, Cannon.js, and Next.js. The application creates an interactive 3D environment where users can drag, throw, and interact with objects that respond realistically to physics. The implementation supports both desktop and mobile devices with optimized experiences for each platform.

## Core Technologies

- **Three.js**: Handles 3D rendering, scene management, and user interaction
- **Cannon.js**: Provides the physics simulation capabilities
- **Next.js**: React framework that manages the application structure
- **React**: Handles component lifecycle and DOM interaction
- **Tailwind CSS**: Utility-first CSS framework for the modern UI elements

## Architecture

The application follows a modular architecture with clear separation of concerns:

1. **React Component Layer**:

   - `ThreeScene.js`: Manages lifecycle, DOM interaction, and event handling
   - `ThreeSceneWrapper.js`: Client-side only wrapper with dynamic loading and loading state

2. **Utility Layer**:

   - `threeHelpers.js`: Provides reusable functions for scene creation and physics simulation

3. **Core Engines**:

   - **Physics Engine** (Cannon.js): Simulates real-world physics independently from rendering
   - **Rendering Engine** (Three.js): Visualizes the 3D scene based on physics calculations

4. **Platform-Specific Logic**:
   - Mobile-optimized touch handling
   - Desktop-optimized mouse interaction
   - Adaptive physics settings based on device capability

## Physics Implementation Details

### 1. Physics World Setup

The physics world is the container for all physics-related objects and calculations:

```javascript
// Create physics world with gravity
world = createPhysicsWorld();
```

Inside our helper function:

```javascript
export function createPhysicsWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0), // Earth gravity (m/s²)
  });

  // Configure the solver for better stability
  world.solver.iterations = 20; // More iterations for more accurate simulation
  world.solver.tolerance = 0.005; // Lower tolerance for more precise solutions

  // Configure sleep properties to allow objects to rest
  world.allowSleep = true;
  world.sleepTimeLimit = 0.5; // Time before sleeping (seconds)
  world.sleepSpeedLimit = 0.15; // Speed limit before sleeping (m/s)

  // BOUNCE CONTROL: Configure material properties for realistic interactions
  // Lower restitution value makes objects less bouncy
  world.defaultContactMaterial.restitution = 0.2; // Low default bounciness
  world.defaultContactMaterial.friction = 0.7; // Good friction

  // Create materials for specific interactions
  const cubeMaterial = new CANNON.Material("cube");
  const floorMaterial = new CANNON.Material("floor");

  // BOUNCE CONTROL: Create a contact material for better cube-floor interactions
  const cubeFloorContactMaterial = new CANNON.ContactMaterial(
    cubeMaterial,
    floorMaterial,
    {
      friction: 0.8, // High friction with floor
      restitution: 0.1, // Very low bounce with floor
      contactEquationStiffness: 1e8, // Stable floor contacts
      contactEquationRelaxation: 3, // Good relaxation
    }
  );

  // Add contact materials to world
  world.addContactMaterial(cubeFloorContactMaterial);

  return world;
}
```

### 2. Physical Bodies and Visual Meshes

Each 3D object has two parts:

1. A **Three.js mesh** for visual representation
2. A **Cannon.js body** for physics simulation

```javascript
// Creating a cube with both visual and physics components
const cube = createCube(scene, world, position, cubeColors[index], cubeSize);
physicsObjects.push(cube); // Store for later access
```

The createCube helper function:

```javascript
export function createCube(scene, world, position, color, size = 2) {
  // THREE.JS VISUAL PART
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.3,
    roughness: 0.4,
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.copy(position);
  cube.castShadow = true;
  cube.receiveShadow = true;
  scene.add(cube); // Add to visual scene

  // CANNON.JS PHYSICS PART
  const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
  const body = new CANNON.Body({
    mass: 1, // Mass of 1 kg (0 would make it static/immovable)
    position: new CANNON.Vec3(position.x, position.y, position.z),
    shape,
    material: new CANNON.Material("cube"),
  });

  // Configure physics properties
  body.linearDamping = 0.5; // Air resistance/friction
  body.angularDamping = 0.7; // Rotational resistance
  body.allowSleep = true; // Performance optimization

  world.addBody(body); // Add to physics world

  // Return both visual and physics parts as a single object
  return { mesh: cube, body };
}
```

### 3. Physics Simulation Loop

The physics simulation runs in an animation loop that:

1. Steps the physics simulation forward in time
2. Updates the visual meshes to match their corresponding physics bodies
3. Renders the scene

```javascript
function animate() {
  // Step the physics world with smaller steps for better stability
  world.fixedStep(); // Advances physics by a fixed time step

  // Sync the three.js meshes with the bodies
  for (let i = 0; i < physicsObjects.length; i++) {
    const obj = physicsObjects[i];
    // Update visual position and rotation to match physics
    obj.mesh.position.copy(obj.body.position);
    obj.mesh.quaternion.copy(obj.body.quaternion);
  }

  // Render the updated scene
  renderer.render(scene, camera);

  // Schedule the next frame
  animationFrameId = requestAnimationFrame(animate);
}
```

### 4. User Interaction with Physics Objects

The most sophisticated aspect of the physics implementation is the ability for users to interact with objects through pointer events:

#### 4.1. Object Selection (Raycasting)

When a user clicks, the application uses Three.js raycasting to determine which object was clicked:

```javascript
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

  // ... continue with drag handling
}
```

#### 4.2. Physics-Based Dragging with Constraints

To drag objects in a physically realistic way, the application uses a Cannon.js PointToPointConstraint:

1. A "joint body" is created - an invisible physics body at the cursor position
2. A constraint is added between this joint body and the selected cube
3. As the pointer moves, the joint body follows, pulling the cube with it

```javascript
// Create constraint between joint body and cube
jointConstraint = addJointConstraint(
  hitPoint,
  selectedCube.body,
  jointBody,
  world
);
```

The constraint creation:

```javascript
export function addJointConstraint(
  position,
  constrainedBody,
  jointBody,
  world
) {
  // Calculate the vector from the body's center to the clicked point
  const vector = new CANNON.Vec3()
    .copy(position)
    .vsub(constrainedBody.position);

  // Convert to the body's local coordinate system
  const antiRotation = constrainedBody.quaternion.inverse();
  const pivot = antiRotation.vmult(vector);

  // Move the joint body to the clicked position
  jointBody.position.copy(position);

  // Create the constraint
  const constraint = new CANNON.PointToPointConstraint(
    constrainedBody, // The object being dragged
    pivot, // Point on the object to constrain
    jointBody, // The invisible body that follows the pointer
    new CANNON.Vec3(0, 0, 0) // Point on joint body (origin)
  );

  // Add to world
  world.addConstraint(constraint);
  return constraint;
}
```

#### 4.3. Updating During Drag

When the user moves the pointer, the joint body position is updated:

```javascript
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
```

The joint movement:

```javascript
export function moveJoint(position, jointBody, constraint) {
  // Move the joint body to the new position
  jointBody.position.copy(position);
  // Update the constraint
  constraint.update();
}
```

#### 4.4. Platform-Specific Interaction

The application has separate handlers for desktop (mouse/pointer) and mobile (touch) interactions:

**Desktop handling:**

```javascript
function handlePointerUp() {
  if (!isDragging) return;

  // Hide marker and remove constraint
  clickMarker.visible = false;
  removeJointConstraint(world, jointConstraint);
  jointConstraint = null;

  // End drag state
  isDragging = false;
}
```

**Mobile-optimized handling:**

```javascript
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
```

### 5. Advanced Physics Features

#### 5.1. Material Properties and Contacts

The physics engine uses materials to define how objects interact when they collide:

```javascript
// Create materials for specific interactions
const cubeMaterial = new CANNON.Material("cube");
const floorMaterial = new CANNON.Material("floor");

// Create a contact material for cube-floor interactions
const cubeFloorContactMaterial = new CANNON.ContactMaterial(
  cubeMaterial,
  floorMaterial,
  {
    friction: 0.8, // High friction with floor
    restitution: 0.2, // Low bounce with floor
  }
);

world.addContactMaterial(cubeFloorContactMaterial);
```

#### 5.2. Initial Motion and Forces

Objects can have forces applied to make them move:

```javascript
// Apply initial impulse to make objects move
const randomImpulse = new CANNON.Vec3(
  (Math.random() - 0.5) * 10, // Random X direction
  5, // Upward force
  (Math.random() - 0.5) * 10 // Random Z direction
);
cube.body.applyImpulse(randomImpulse, cube.body.position);
```

#### 5.3. Sleep States for Performance

The physics engine allows bodies to "sleep" when they're not moving, improving performance:

```javascript
world.allowSleep = true;
world.sleepTimeLimit = 1.0; // Time before sleeping
world.sleepSpeedLimit = 0.1; // Speed limit before sleeping

// For individual bodies
body.allowSleep = true;
body.wakeUp(); // Force a body to be active
```

## User Interface and Visual Feedback

### 1. Minimalist UI

The application features a clean, modern UI with transparent elements:

```jsx
{
  /* Centered minimal app title with transparent background */
}
<div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-10">
  <div className="app-title bg-black bg-opacity-30 backdrop-blur-md rounded-full shadow-lg py-2 px-5 flex items-center gap-2 cursor-pointer">
    <div className="w-5 h-5 bg-blue-500 rounded-md flex items-center justify-center shadow-inner">
      <div className="w-2.5 h-2.5 bg-blue-300 rounded transform rotate-45"></div>
    </div>
    <h1 className="text-sm font-bold text-white">Physical Cubes</h1>
  </div>
</div>;
```

### 2. Adaptive Platform Indicators

The UI adapts to show platform-specific elements:

```jsx
{
  /* Touch status indicator that shows only on mobile */
}
{
  isMobile.current && (
    <div className="fixed bottom-6 right-6 z-10 flex items-center gap-1.5 bg-black bg-opacity-30 backdrop-blur-md rounded-full py-1.5 px-3">
      <div className="w-2 h-2 rounded-full bg-green-400 pulse-animation"></div>
      <span className="text-xs text-white">Touch Mode</span>
    </div>
  );
}
```

### 3. Physics Interaction Feedback

#### Click/Touch Marker

A small red sphere shows where the user has clicked/touched:

```javascript
// Show and position the click marker
clickMarker.visible = true;
clickMarker.position.copy(hitPoint);
```

#### Movement Plane

An invisible plane helps with 3D dragging by providing a surface for the ray to intersect:

```javascript
// Position movement plane for dragging
moveMovementPlane(movementPlane, hitPoint, camera);
```

## React Integration

The entire 3D scene is managed within a React component using useEffect for proper lifecycle management:

```javascript
useEffect(() => {
  // Initialize scene
  // ...

  // Clean up function
  return () => {
    // Remove event listeners
    // Cancel animation frames
    // Clean up physics constraints
    // Dispose of Three.js resources
  };
}, []);
```

## Optimization Techniques

### Desktop Optimizations

1. **Object Sleeping**: Bodies that aren't moving "sleep" to save CPU
2. **Fixed Time Step**: Physics calculations use a consistent time step for stability
3. **Resource Disposal**: Three.js resources are properly disposed when unmounting
4. **Render Loop Management**: Animation frames are properly cancelled during cleanup
5. **Pixel Ratio Limits**: Renderer pixel ratio is limited for performance
6. **Selective Updates**: Only moving objects have their positions synchronized

### Mobile-Specific Optimizations

1. **Adaptive Physics Step**: Adjusted time step and sub-steps for mobile devices

   ```javascript
   // For mobile: balanced approach with more substeps and slightly longer timestep
   const timeStep = 1 / 45; // Slightly longer timestep for mobile
   const maxSubSteps = 4; // More substeps for stable simulation

   try {
     world.step(timeStep, timeStep, maxSubSteps);
   } catch (e) {
     // Recover from physics solver errors that sometimes occur on mobile
     world.step(timeStep, 0); // Try with no substeps as fallback
   }
   ```

2. **Touch-Optimized Constraints**: Softer constraints for more natural touch feel

   ```javascript
   // For mobile touch: more responsive but softer constraint
   const eqs = constraint.equations;
   if (eqs && eqs.length) {
     eqs.forEach((eq) => {
       // Softer parameters for a more natural "held" feel
       eq.setSpookParams(1e6, 10, world.dt);
     });
   }
   ```

3. **Selective Rotation Updates**: Only update quaternions when significant rotation occurs

   ```javascript
   // For mobile: only update rotation if there's significant change
   if (!isMobile || obj.body.angularVelocity.lengthSquared() > 0.05) {
     obj.mesh.quaternion.copy(obj.body.quaternion);
   }
   ```

4. **Reduced Logging**: Minimize console logging on mobile devices
5. **Wake-Up Prevention**: Special handling to prevent bodies from getting stuck
6. **Error Recovery**: Gracefully handle physics solver errors common on lower-power devices
7. **Enhanced Touch Events**: Passive: false for all touch events to prevent scrolling/zooming
8. **Viewport Optimization**: Special meta tags for mobile browser compatibility

## Debugging Features

The application includes several debugging features:

1. **Visual Helpers**: Grid helpers and axis helpers show orientation
2. **Debug Overlays**: UI elements show the application state
3. **Console Logging**: Key events and object states are logged
4. **Test Objects**: Simple objects with basic materials for visibility testing

## Physics Tuning

### Bounce Control

The bounciness of objects in the simulation is controlled through several key parameters:

1. **Restitution Values**: Lower values make objects bounce less

   ```javascript
   // BOUNCE CONTROL: Lower restitution value makes objects less bouncy
   world.defaultContactMaterial.restitution = 0.2; // Low default bounciness

   // BOUNCE CONTROL: Create a contact material for better cube-floor interactions
   const cubeFloorContactMaterial = new CANNON.ContactMaterial(
     cubeMaterial,
     floorMaterial,
     {
       restitution: 0.1, // Very low bounce with floor (reduced from 0.2)
     }
   );

   // BOUNCE CONTROL: Create cube-to-cube contact material
   const cubeCubeContactMaterial = new CANNON.ContactMaterial(
     cubeMaterial,
     cubeMaterial,
     {
       restitution: 0.3, // Reduced bounce between cubes (reduced from 0.6)
     }
   );
   ```

2. **Damping Values**: Higher values make objects lose energy faster

   ```javascript
   // BOUNCE CONTROL: Higher damping values reduce energy in the system
   body.linearDamping = 0.6; // Increased linear damping (was 0.5)
   body.angularDamping = 0.8; // Increased angular damping (was 0.7)
   ```

3. **Contact Equation Parameters**: Control how collisions are resolved
   ```javascript
   contactEquationStiffness: 1e8, // Stiffer contacts = less penetration
   contactEquationRelaxation: 3, // Higher relaxation = more damping
   ```

## Conclusion

The integration of Three.js and Cannon.js creates a physically realistic, interactive 3D environment that works seamlessly across both desktop and mobile devices. The modular architecture separates physics simulation from rendering, allowing for accurate physics calculations while maintaining smooth visual performance.

Key achievements:

1. **Platform Adaptivity**: Custom handling for mouse vs. touch input
2. **Visual Quality**: Modern, minimalist UI with transparent elements and subtle animations
3. **Physics Realism**: Tunable physics parameters for precise control over object behavior
4. **Performance Optimization**: Device-specific optimizations for consistent performance
5. **Error Resilience**: Robust error handling for reliable operation across devices

The constraint-based interaction system provides intuitive dragging that respects the laws of physics, creating a compelling and responsive user experience that adapts to different input methods and device capabilities.
