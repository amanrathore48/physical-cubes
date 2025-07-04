# Three.js Physics Implementation Explanation

## Overview

This document explains the physics implementation in our 3D web application built with Three.js, Cannon.js, and Next.js. The application creates an interactive 3D environment where users can drag and throw objects that respond realistically to physics.

## Core Technologies

- **Three.js**: Handles 3D rendering, scene management, and user interaction
- **Cannon.js**: Provides the physics simulation capabilities
- **Next.js**: React framework that manages the application structure
- **React**: Handles component lifecycle and DOM interaction

## Architecture

The application follows a modular architecture with clear separation of concerns:

1. **React Component Layer** (`ThreeScene.js`): Manages lifecycle, DOM interaction, and event handling
2. **Helper Functions** (`threeHelpers.js`): Provides reusable functions for scene creation and physics
3. **Physics Engine** (Cannon.js): Simulates real-world physics independently from rendering
4. **Rendering Engine** (Three.js): Visualizes the 3D scene based on physics calculations

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
  world.solver.iterations = 10; // More iterations = more accurate but slower
  world.solver.tolerance = 0.01; // Lower tolerance for more precise solutions

  // Configure sleep properties to allow objects to rest
  world.allowSleep = true;
  world.sleepTimeLimit = 1.0; // Time before sleeping (seconds)
  world.sleepSpeedLimit = 0.1; // Speed limit before sleeping (m/s)

  // Configure material properties for realistic interactions
  world.defaultContactMaterial.restitution = 0.4; // Moderate bounciness
  world.defaultContactMaterial.friction = 0.7; // Good friction

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

#### 4.4. Releasing Objects

When the user releases the pointer, the constraint is removed and the object continues with its current velocity:

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

## Visual Feedback for Physics Interaction

### 1. Click Marker

A small red sphere shows where the user has clicked:

```javascript
// Show and position the click marker
clickMarker.visible = true;
clickMarker.position.copy(hitPoint);
```

### 2. Movement Plane

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

1. **Object Sleeping**: Bodies that aren't moving "sleep" to save CPU
2. **Fixed Time Step**: Physics calculations use a consistent time step for stability
3. **Resource Disposal**: Three.js resources are properly disposed when unmounting
4. **Render Loop Management**: Animation frames are properly cancelled during cleanup
5. **Pixel Ratio Limits**: Renderer pixel ratio is limited for performance
6. **Selective Updates**: Only moving objects have their positions synchronized

## Debugging Features

The application includes several debugging features:

1. **Visual Helpers**: Grid helpers and axis helpers show orientation
2. **Debug Overlays**: UI elements show the application state
3. **Console Logging**: Key events and object states are logged
4. **Test Objects**: Simple objects with basic materials for visibility testing

## Conclusion

The Three.js and Cannon.js integration creates a physically realistic interactive 3D environment. The physics simulation is independent of the rendering, allowing for accurate physics calculations while maintaining smooth visual performance. The constraint-based interaction system provides intuitive dragging that respects the laws of physics, creating a compelling and responsive user experience.
