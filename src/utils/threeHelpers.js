/**
 * Three.js and Cannon.js helper functions
 * This file contains utility functions for creating and managing 3D scenes
 */

import * as THREE from "three";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * Creates and configures a Three.js scene
 * @returns {THREE.Scene} Configured scene
 */
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x333333);
  return scene;
}

/**
 * Sets up the camera for the 3D scene
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @returns {THREE.PerspectiveCamera} Configured camera
 */
export function setupCamera(width, height) {
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 15;
  return camera;
}

/**
 * Creates orbit controls for camera navigation
 * @param {THREE.Camera} camera - The scene camera
 * @param {HTMLElement} domElement - DOM element for event listening
 * @returns {OrbitControls} Configured controls
 */
export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  return controls;
}

/**
 * Creates a physics world for simulation
 * @returns {CANNON.World} Configured physics world
 */
export function createPhysicsWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });

  // Configure the solver for better stability
  world.solver.iterations = 10; // More iterations for more stable simulation
  world.solver.tolerance = 0.01; // Lower tolerance for more precise solutions

  // Configure sleep properties to allow objects to rest
  world.allowSleep = true;
  world.sleepTimeLimit = 1.0; // Time before sleeping (seconds)
  world.sleepSpeedLimit = 0.1; // Speed limit before sleeping (m/s)

  // Configure material properties
  // BOUNCE CONTROL: Lower restitution (bounciness) value makes objects less bouncy
  world.defaultContactMaterial.restitution = 0.2; // Low default bounciness
  world.defaultContactMaterial.friction = 0.7; // Good friction
  world.defaultContactMaterial.contactEquationStiffness = 1e7; // More stable contacts
  world.defaultContactMaterial.contactEquationRelaxation = 3; // Relaxation for stability

  // Create materials for specific interactions
  const cubeMaterial = new CANNON.Material("cube");
  const floorMaterial = new CANNON.Material("floor");

  // Create a contact material for better cube-floor interactions
  // BOUNCE CONTROL: Lower restitution value for cube-floor makes cubes bounce less against the floor
  const cubeFloorContactMaterial = new CANNON.ContactMaterial(
    cubeMaterial,
    floorMaterial,
    {
      friction: 0.8, // High friction with floor
      restitution: 0.1, // Very low bounce with floor (reduced from 0.2)
      contactEquationStiffness: 1e8, // Very stable floor contacts
      contactEquationRelaxation: 3, // Good relaxation
    }
  );

  // Create cube-to-cube contact material
  // BOUNCE CONTROL: Lower restitution value for cube-cube makes cubes bounce less against each other
  const cubeCubeContactMaterial = new CANNON.ContactMaterial(
    cubeMaterial,
    cubeMaterial,
    {
      friction: 0.4, // Lower friction between cubes
      restitution: 0.3, // Reduced bounce between cubes (reduced from 0.6)
      contactEquationStiffness: 1e7, // Stable cube-cube contacts
      contactEquationRelaxation: 5, // More relaxation for cube collisions
    }
  );

  world.addContactMaterial(cubeFloorContactMaterial);
  world.addContactMaterial(cubeCubeContactMaterial);

  return world;
}

/**
 * Creates a cube with both Three.js visual mesh and Cannon.js physics body
 * @param {THREE.Scene} scene - Scene to add the cube to
 * @param {CANNON.World} world - Physics world
 * @param {THREE.Vector3} position - Initial position
 * @param {number|string} color - Cube color
 * @param {number} size - Cube size
 * @returns {Object} Object containing mesh and physics body
 */
export function createCube(scene, world, position, color = 0xffffff, size = 2) {
  // Three.js geometry
  const geometry = new THREE.BoxGeometry(size, size, size);

  // Create material
  const material = new THREE.MeshStandardMaterial({
    color:
      color || new THREE.Color(Math.random(), Math.random(), Math.random()),
    metalness: 0.3,
    roughness: 0.4,
  });

  // Create mesh and add to scene
  const cube = new THREE.Mesh(geometry, material);
  cube.position.copy(position);
  cube.castShadow = true;
  cube.receiveShadow = true;
  scene.add(cube);

  // Create physics body
  const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
  const cubeMaterial = new CANNON.Material("cube");
  const body = new CANNON.Body({
    mass: 1,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    shape,
    material: cubeMaterial,
  });

  // Add physics properties for better behavior with pointer interaction
  // BOUNCE CONTROL: Higher damping values reduce the energy in the system, making objects settle faster
  body.linearDamping = 0.6; // Increased linear damping to reduce motion (was 0.5)
  body.angularDamping = 0.8; // Increased angular damping for less rotation (was 0.7)
  body.allowSleep = true; // Allow objects to sleep when inactive for performance

  // Add to physics world
  world.addBody(body);

  return { mesh: cube, body };
}

/**
 * Creates a floor for objects to land on
 * @param {THREE.Scene} scene - Scene to add the floor to
 * @param {CANNON.World} world - Physics world
 * @param {number} width - Floor width
 * @param {number} height - Floor height
 * @param {number} yPosition - Y-axis position
 * @returns {Object} Object containing mesh and physics body
 */
export function createFloor(
  scene,
  world,
  width = 30,
  height = 30,
  yPosition = -5
) {
  // Create Three.js floor
  const floorGeometry = new THREE.PlaneGeometry(width, height);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.3,
    roughness: 0.4,
  });

  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = yPosition;
  floor.receiveShadow = true;
  scene.add(floor);

  // Create physics floor
  const floorShape = new CANNON.Plane();
  const floorPhysicsMaterial = new CANNON.Material("floor");
  const floorBody = new CANNON.Body({
    mass: 0, // Static body
    material: floorPhysicsMaterial,
  });

  floorBody.addShape(floorShape);
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  floorBody.position.y = yPosition;
  world.addBody(floorBody);

  return { mesh: floor, body: floorBody };
}

/**
 * Sets up lighting for the scene
 * @param {THREE.Scene} scene - Scene to add lights to
 * @returns {Object} Object containing created lights
 */
export function setupLighting(scene) {
  // Ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;

  // Configure shadow properties
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 20;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.bottom = -10;
  directionalLight.shadow.camera.left = -10;

  scene.add(directionalLight);

  return { ambientLight, directionalLight };
}

/**
 * Creates and configures a WebGL renderer
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @returns {THREE.WebGLRenderer} Configured renderer
 */
export function createRenderer(width, height) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return renderer;
}

/**
 * Sets up raycasting for object interaction
 * @returns {THREE.Raycaster} Configured raycaster
 */
export function setupRaycaster() {
  return new THREE.Raycaster();
}

/**
 * Updates physics bodies and visual meshes
 * @param {Array} objects - Array of objects with mesh and body properties
 */
export function updatePhysicsObjects(objects) {
  objects.forEach((object) => {
    const { mesh, body } = object;

    // Check if the body has any significant velocity before updating
    const hasVelocity = body.velocity.lengthSquared() > 0.001;
    const hasAngularVelocity = body.angularVelocity.lengthSquared() > 0.001;

    if (
      hasVelocity ||
      hasAngularVelocity ||
      body.sleepState === CANNON.Body.AWAKE
    ) {
      // Only update the mesh if the body is actually moving or awake
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  });
}

/**
 * Calculates normalized mouse coordinates for raycasting
 * @param {MouseEvent} event - Mouse event
 * @returns {THREE.Vector2} Normalized coordinates
 */
export function getNormalizedMouseCoordinates(event) {
  return new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
}

/**
 * Disposes of Three.js resources to prevent memory leaks
 * @param {Object} resources - Object containing resources to dispose
 */
export function disposeResources(resources) {
  const {
    meshes = [],
    geometries = [],
    materials = [],
    renderer = null,
  } = resources;

  // Dispose meshes
  meshes.forEach((mesh) => {
    if (mesh.geometry) mesh.geometry.dispose();

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
    } else if (mesh.material) {
      mesh.material.dispose();
    }
  });

  // Dispose individual geometries
  geometries.forEach((geometry) => {
    if (geometry) geometry.dispose();
  });

  // Dispose individual materials
  materials.forEach((material) => {
    if (material) material.dispose();
  });

  // Dispose renderer
  if (renderer) renderer.dispose();
}

/**
 * Creates a click marker (red sphere) to indicate selection
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {THREE.Mesh} Click marker mesh
 */
export function createClickMarker(scene) {
  const markerGeometry = new THREE.SphereGeometry(0.2, 8, 8);
  const markerMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  const clickMarker = new THREE.Mesh(markerGeometry, markerMaterial);
  clickMarker.visible = false; // Hidden by default
  scene.add(clickMarker);
  return clickMarker;
}

/**
 * Creates a movement plane for dragging
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {THREE.Mesh} Movement plane mesh
 */
export function createMovementPlane(scene) {
  const planeGeometry = new THREE.PlaneGeometry(100, 100);
  const planeMaterial = new THREE.MeshLambertMaterial({
    color: 0x777777,
    visible: false,
    opacity: 0.25,
    transparent: true,
  });
  const movementPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  movementPlane.visible = false; // Hidden by default
  scene.add(movementPlane);
  return movementPlane;
}

/**
 * Creates a joint body for constraints
 * @param {CANNON.World} world - Cannon.js physics world
 * @returns {CANNON.Body} Joint body
 */
export function createJointBody(world) {
  const jointShape = new CANNON.Sphere(0.1);
  const jointBody = new CANNON.Body({ mass: 0 });
  jointBody.addShape(jointShape);
  jointBody.collisionFilterGroup = 0;
  jointBody.collisionFilterMask = 0;
  world.addBody(jointBody);
  return jointBody;
}

/**
 * Gets a hit point from raycasting
 * @param {number} clientX - Mouse X position
 * @param {number} clientY - Mouse Y position
 * @param {THREE.Object3D} mesh - Mesh to test intersection with
 * @param {THREE.Camera} camera - Camera for raycasting
 * @param {THREE.Raycaster} raycaster - Raycaster to use
 * @returns {THREE.Vector3|undefined} Hit point or undefined
 */
export function getHitPoint(clientX, clientY, mesh, camera, raycaster) {
  const mouse = new THREE.Vector2();
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -((clientY / window.innerHeight) * 2 - 1);

  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObject(mesh);
  return hits.length > 0 ? hits[0].point : undefined;
}

/**
 * Moves the movement plane to face the camera at the hit point
 * @param {THREE.Mesh} movementPlane - The movement plane mesh
 * @param {THREE.Vector3} point - Point to center plane at
 * @param {THREE.Camera} camera - Camera to face
 */
export function moveMovementPlane(movementPlane, point, camera) {
  movementPlane.position.copy(point);
  movementPlane.quaternion.copy(camera.quaternion);
}

/**
 * Adds a point-to-point constraint
 * @param {THREE.Vector3} position - Constraint position
 * @param {CANNON.Body} constrainedBody - Body to constrain
 * @param {CANNON.Body} jointBody - Joint body
 * @param {CANNON.World} world - Physics world
 * @returns {CANNON.PointToPointConstraint} Constraint
 */
export function addJointConstraint(
  position,
  constrainedBody,
  jointBody,
  world
) {
  // Vector from body to clicked point
  const vector = new CANNON.Vec3()
    .copy(position)
    .vsub(constrainedBody.position);

  // Transform to local body coordinates
  const antiRotation = constrainedBody.quaternion.inverse();
  const pivot = antiRotation.vmult(vector);

  // Move the joint body to the clicked position
  jointBody.position.copy(position);

  // Create constraint
  const constraint = new CANNON.PointToPointConstraint(
    constrainedBody,
    pivot,
    jointBody,
    new CANNON.Vec3(0, 0, 0)
  );

  // Add to world
  world.addConstraint(constraint);
  return constraint;
}

/**
 * Update joint position
 * @param {THREE.Vector3} position - New position
 * @param {CANNON.Body} jointBody - Joint body
 * @param {CANNON.PointToPointConstraint} constraint - Constraint to update
 */
export function moveJoint(position, jointBody, constraint) {
  jointBody.position.copy(position);
  constraint.update();
}

/**
 * Remove a constraint from the physics world
 * @param {CANNON.World} world - Physics world
 * @param {CANNON.Constraint} constraint - Constraint to remove
 */
export function removeJointConstraint(world, constraint) {
  if (constraint) {
    world.removeConstraint(constraint);
  }
}

/**
 * Helper to detect if running on mobile device
 * @returns {boolean} True if the user is on a mobile device
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Get normalized coordinates from any pointer/touch event
 * @param {Event} event - The pointer or touch event
 * @returns {Object} Object with clientX and clientY properties
 */
export function getNormalizedEventCoords(event) {
  // Handle both touch and mouse events
  if (event.touches && event.touches.length > 0) {
    return {
      clientX: event.touches[0].clientX,
      clientY: event.touches[0].clientY,
    };
  } else {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }
}
