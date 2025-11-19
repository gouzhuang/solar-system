import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const container = document.getElementById('container');

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 10, 30);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.copy(DEFAULT_CAMERA_POSITION);

// WebGL Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// CSS2D Renderer for labels
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.id = 'label-container';
container.appendChild(labelRenderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Camera tracking variables
let currentCameraTarget = 'default';
let cameraTargetObject = null;

// Multi-view preset configuration
const VIEW_PRESETS = {
  rear: { distance: 4, height: 1, angle: 0.5 * Math.PI, name: 'Rear' },
  outer: { distance: 4, height: 1, angle: 0, name: 'Outer' },
  front: { distance: 4, height: 1, angle: 1.5 * Math.PI, name: 'Front' },
  inner: { distance: 4, height: 1, angle: Math.PI, name: 'Inner' },
  top: { distance: 6, height: 3, angle: 0, name: 'Top' }
};
let currentView = 'rear';

// Camera parameters save/restore
let savedCameraParams = null;

// Object pool: Avoid creating new objects every frame
const tempVectors = {
  earthWorldPosition: new THREE.Vector3(),
  cameraPosition: new THREE.Vector3(),
  cameraTarget: new THREE.Vector3(),
  smoothTarget: new THREE.Vector3()
};

// Camera parameters
const cameraParams = {
  position: new THREE.Vector3(),
  target: new THREE.Vector3(),
  orbitAngle: 0,
  zoomFactor: 1.0,  // Zoom factor, used to control the distance between camera and celestial body
  smoothingFactor: 0.05,  // Smoothing factor, used to control smooth transition of camera position and target, smaller is smoother
  trackTime: 0  // Used to record the start time of camera tracking, used to adjust smoothing factor
};

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 100, 300);
pointLight.castShadow = true;
pointLight.shadow.bias = -0.0001;
scene.add(pointLight);

// Texture Loader
const textureLoader = new THREE.TextureLoader();
const loadingManager = new THREE.LoadingManager();
const textureCache = new Map();

// Texture loading error handling
loadingManager.onError = (url) => {
  console.error(`Texture loading failed: ${url}`);
};

// Create default texture as fallback
function createFallbackTexture(color = 0x888888) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Safe texture loading function
function loadTexture(url, fallbackColor = 0x888888) {
  // Check cache
  if (textureCache.has(url)) {
    return textureCache.get(url);
  }

  try {
    const texture = textureLoader.load(
      url,
      undefined, // onProgress
      undefined, // onError
      (error) => {
        console.warn(`Texture loading failed, using fallback texture: ${url}`, error);
        const fallbackTexture = createFallbackTexture(fallbackColor);
        textureCache.set(url, fallbackTexture);
        return fallbackTexture;
      }
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, texture);
    return texture;
  } catch (error) {
    console.error(`Texture loading exception: ${url}`, error);
    const fallbackTexture = createFallbackTexture(fallbackColor);
    textureCache.set(url, fallbackTexture);
    return fallbackTexture;
  }
}

// Function to create a label
function createLabel(text) {
  const div = document.createElement('div');
  div.className = 'label';
  div.textContent = text;
  return new CSS2DObject(div);
}

const labels = [];
const rotationAxes = [];
const fixedAxisContainers = [];

// Shared Geometries and Materials
const sharedSphereGeometry = new THREE.SphereGeometry(1, 32, 32);

// Shared Orbit Geometry (Unit Circle on XZ plane)
const orbitPoints = [];
const orbitSegments = 128;
for (let i = 0; i <= orbitSegments; i++) {
  const theta = (i / orbitSegments) * Math.PI * 2;
  orbitPoints.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
}
const sharedOrbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
const sharedOrbitMaterial = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });

// Shared Axis Geometry (Unit Line along Y axis, length 1, centered at 0)
const axisPoints = [
  new THREE.Vector3(0, -0.5, 0),
  new THREE.Vector3(0, 0.5, 0)
];
const sharedAxisGeometry = new THREE.BufferGeometry().setFromPoints(axisPoints);

// Function to create a rotation axis
function createRotationAxis(radius, color = 0xff0000) {
  const axisMaterial = new THREE.LineBasicMaterial({
    color: color,
    transparent: false,
    linewidth: 1
  });

  const axis = new THREE.Line(sharedAxisGeometry, axisMaterial);
  // Original length was radius * 2 * 1.2 = radius * 2.4
  // Shared geometry length is 1. So scale Y by radius * 2.4
  axis.scale.set(1, radius * 2.4, 1);
  return axis;
}

// Sun
const sunTexture = loadTexture('textures/2k_sun.jpg', 0xffff00);
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture });
const sun = new THREE.Mesh(sharedSphereGeometry, sunMaterial);
sun.scale.set(2, 2, 2);
const sunLabel = createLabel('Sun');
// the default position is (0, 0, 0), that is what we want, so no need to set position here
sun.add(sunLabel);
labels.push(sunLabel);
scene.add(sun);


// Planets data
const planetsData = [
  { name: 'Mercury', texture: '2k_mercury.jpg', radius: 0.38, distance: 5, speed: 0.120, rotationSpeed: 0.15, axialTilt: 0.034 },
  { name: 'Venus', texture: '2k_venus.jpg', radius: 0.95, distance: 7, speed: 0.047, rotationSpeed: 0.32, axialTilt: 177.4 },
  { name: 'Earth', texture: '2k_earth.jpg', radius: 1, distance: 10, speed: 0.029, rotationSpeed: 1.7, axialTilt: 23.44 },
  { name: 'Mars', texture: '2k_mars.jpg', radius: 0.53, distance: 15, speed: 0.015, rotationSpeed: 0.48, axialTilt: 25.19 },
  { name: 'Jupiter', texture: '2k_jupiter.jpg', radius: 4, distance: 25, speed: 0.010, rotationSpeed: 1.2, axialTilt: 3.13 },
  { name: 'Saturn', texture: '2k_saturn.jpg', radius: 3.5, distance: 35, speed: 0.007, rotationSpeed: 1.1, axialTilt: 26.73 },
  { name: 'Uranus', texture: '2k_uranus.jpg', radius: 2, distance: 45, speed: 0.004, rotationSpeed: -0.7, axialTilt: 97.77 },
  { name: 'Neptune', texture: '2k_neptune.jpg', radius: 1.9, distance: 55, speed: 0.003, rotationSpeed: 0.65, axialTilt: 28.32 },
];

const planetAxisColors = {
  'Mercury': 0x8c8c8c,
  'Venus': 0xffc649,
  'Earth': 0x4169e1,
  'Mars': 0xcd5c5c,
  'Jupiter': 0xdaa520,
  'Saturn': 0xf4a460,
  'Uranus': 0x4fd0e0,
  'Neptune': 0x4169e1
};

const planets = [];

planetsData.forEach(planetData => {
  const planetTexture = loadTexture(`textures/${planetData.texture}`);
  const planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture });
  const planet = new THREE.Mesh(sharedSphereGeometry, planetMaterial);
  planet.scale.set(planetData.radius, planetData.radius, planetData.radius);
  planet.name = planetData.name;
  planet.castShadow = true;
  planet.receiveShadow = true;
  const planetLabel = createLabel(planetData.name);
  planetLabel.position.set(0, 1.5, 0);
  planet.add(planetLabel);
  labels.push(planetLabel);

  if (planetData.name === 'Saturn') {
    const innerRadius = 4;
    const outerRadius = 6;
    const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);

    const pos = ringGeometry.attributes.position;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++){
        v3.fromBufferAttribute(pos, i);
        ringGeometry.attributes.uv.setXY(i, (v3.length() - innerRadius) / (outerRadius - innerRadius), 1);
    }

    const ringTexture = loadTexture('textures/2k_saturn_ring_alpha.png');
    const ringMaterial = new THREE.MeshBasicMaterial({
      map: ringTexture,
      side: THREE.DoubleSide,
      transparent: true
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.receiveShadow = true;

    // Saturn is scaled by 3.5 (radius). The ring geometry is defined with innerRadius 4 and outerRadius 6.
    // If we add it directly to the scaled planet, the ring will be huge (4*3.5 = 14 inner radius).
    // We need to scale the ring down by 1/planetData.radius to counteract the parent's scale.
    const ringScale = 1 / planetData.radius;
    ring.scale.set(ringScale, ringScale, ringScale);

    planet.add(ring);
  }

  // Create a fixed container for the rotation axis and planet that doesn't rotate with the orbit
  const fixedAxisContainer = new THREE.Object3D();

  // Apply axial tilt to the fixed axis container
  fixedAxisContainer.rotation.z = planetData.axialTilt * (Math.PI / 180);

  // Add planet to the fixed container so it tilts with the axis
  fixedAxisContainer.add(planet);

  // Create rotation axis and add it to the fixed container
  const axisColor = planetAxisColors[planetData.name] || 0xff0000;
  const planetAxis = createRotationAxis(planetData.radius, axisColor);
  fixedAxisContainer.add(planetAxis);

  // Create the orbital container and add the fixed container to it
  const planetObject = new THREE.Object3D();
  planetObject.add(fixedAxisContainer);
  scene.add(planetObject);

  // Position the planet at its orbital distance
  fixedAxisContainer.position.x = planetData.distance;

  rotationAxes.push(planetAxis);
  fixedAxisContainers.push(fixedAxisContainer);

  planets.push({
    object: planetObject,
    planet: planet,
    distance: planetData.distance,
    speed: planetData.speed,
    rotationSpeed: planetData.rotationSpeed,
    fixedAxisContainer: fixedAxisContainer,
    orbitAngle: 0 // Add orbit angle tracking
  });

  // Orbit
  const orbit = new THREE.LineLoop(sharedOrbitGeometry, sharedOrbitMaterial);
  orbit.scale.set(planetData.distance, 1, planetData.distance);
  scene.add(orbit);
});

const earth = planets.find(p => p.planet.name === 'Earth').planet;

// Moon
const moonData = {
  distance: 1.5,
  speed: 0.02,
  orbitAngle: 0,
  orbitalInclination: 5.14 * (Math.PI / 180) // Orbital inclination
};

const moonTexture = loadTexture('textures/2k_moon.jpg');
const moonMaterial = new THREE.MeshStandardMaterial({ map: moonTexture });
const moon = new THREE.Mesh(sharedSphereGeometry, moonMaterial);
moon.scale.set(0.27, 0.27, 0.27);
moon.castShadow = true;
moon.receiveShadow = true;
// The moon's local position should be at the origin of its fixed-axis container.
// We set the orbital distance on the fixed container to avoid double-offsetting the moon.
moon.position.set(0, 0, 0);
const moonLabel = createLabel('Moon');
moonLabel.position.set(0, 1.5, 0);
moon.add(moonLabel);
labels.push(moonLabel);

// Create a fixed container for the moon's rotation axis and moon itself
const moonFixedAxisContainer = new THREE.Object3D();

// Moon's axial tilt is approximately 1.54 degrees
moonFixedAxisContainer.rotation.z = 1.54 * (Math.PI / 180);

// Add moon to the fixed container so it tilts with the axis
moonFixedAxisContainer.add(moon);

// Create rotation axis for moon and add it to the fixed container
const moonAxis = createRotationAxis(0.27, 0xc0c0c0);
moonFixedAxisContainer.add(moonAxis);

// Create the orbital container for moon
const moonObject = new THREE.Object3D();
moonObject.add(moonFixedAxisContainer);
moonObject.rotation.x = moonData.orbitalInclination; // Apply orbital inclination
// Add moonObject to the same level as Earth, not as a child of Earth
// This prevents the moon from rotating with Earth's self-rotation
scene.add(moonObject);

// Position the moon at its orbital distance (relative to Earth)
moonFixedAxisContainer.position.x = 1.5;

rotationAxes.push(moonAxis);
fixedAxisContainers.push(moonFixedAxisContainer);


// Moon Orbit
const moonOrbit = new THREE.LineLoop(sharedOrbitGeometry, sharedOrbitMaterial);
moonOrbit.scale.set(1.5, 1, 1.5);

// Create a container for the moon orbit and apply orbital inclination
const moonOrbitObject = new THREE.Object3D();
moonOrbitObject.add(moonOrbit);
moonOrbitObject.rotation.x = moonData.orbitalInclination; // Apply orbital inclination
scene.add(moonOrbitObject); // Add moon orbit container to scene (not Earth)

// Create a map of celestial bodies for camera targeting
const celestialBodies = ['Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Moon']
  .map(name => {
    if (name === 'Sun') {
      return { name, body: sun }
    } else if (name === 'Moon') {
      return { name, body: moon, parent: planets.find(p => p.planet.name === 'Earth') }
    } else {
      const planet = planets.find(p => p.planet.name === name)
      return { name, body: planet.planet, planet: planet }
    }
  })
  .reduce((acc, curr) => {
    acc[curr.name] = curr;
    return acc;
  }, {});

// Function to save current camera parameters
function saveCameraParameters() {
  savedCameraParams = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    zoom: camera.zoom,
    fov: camera.fov,
    near: camera.near,
    far: camera.far
  };
}

// Function to restore saved camera parameters
function restoreCameraParameters() {
  if (savedCameraParams) {
    camera.position.copy(savedCameraParams.position);
    controls.target.copy(savedCameraParams.target);
    camera.zoom = savedCameraParams.zoom;
    camera.fov = savedCameraParams.fov;
    camera.near = savedCameraParams.near;
    camera.far = savedCameraParams.far;
    camera.updateProjectionMatrix();
    controls.update();
  } else {
    // If no saved parameters, use default position
    camera.position.copy(DEFAULT_CAMERA_POSITION);
    controls.target.copy(DEFAULT_CAMERA_TARGET);
    camera.updateProjectionMatrix();
    controls.update();
  }
}

// Function to update camera position based on selected target
function updateCameraPosition(newTarget) {
  if (currentCameraTarget === newTarget) return;

  // Remove existing wheel event listener if any
  const existingWheelHandler = eventListeners.find(item =>
    item.element === renderer.domElement && item.event === 'wheel'
  );
  if (existingWheelHandler) {
    renderer.domElement.removeEventListener('wheel', existingWheelHandler.handler, existingWheelHandler.options);
    const index = eventListeners.indexOf(existingWheelHandler);
    if (index > -1) eventListeners.splice(index, 1);
  }

  currentCameraTarget = newTarget;
  // Reset start time, zoomFactor and smoothingFactor when switching celestial bodies
  cameraParams.trackTime = Date.now();
  cameraParams.zoomFactor = 1.0;
  cameraParams.smoothingFactor = 0.05;

  if (currentCameraTarget === 'default') {
    viewPresetsDiv.style.display = 'none';  // Hide preset view selector
    // Switching back to default - restore saved parameters
    controls.enabled = true;
    cameraTargetObject = null;
    restoreCameraParameters();
    // Don't register wheel handler in default mode - let OrbitControls handle it
  } else {
    viewPresetsDiv.style.display = 'block';  // Show preset view selector
    // Switching to follow a celestial body - save current parameters first
    if (cameraTargetObject === null) {
      // Only save if we're switching from default mode
      saveCameraParameters();
    }

    // Follow the selected celestial body
    const targetBody = celestialBodies[currentCameraTarget]; // Object structure: { name: string, body: Mesh, planet?: Planet, parent?: Planet }
    if (targetBody) {
      cameraTargetObject = targetBody;
      controls.enabled = false; // Disable OrbitControls when following
      // Register wheel handler for follow mode zoom
      renderer.domElement.addEventListener('wheel', handleWheelZoom, { passive: false });
      eventListeners.push({ element: renderer.domElement, event: 'wheel', handler: handleWheelZoom, options: { passive: false } });
    }
  }
}

// Camera following system - supports multiple view presets and intelligent smooth following
function updateCamera(targetObject, delta) {
  tempVectors.cameraTarget.set(0, 0, 0);
  targetObject.body.getWorldPosition(tempVectors.cameraTarget);

  const radius = targetObject.body.geometry.parameters.radius * targetObject.body.scale.x;
  const baseDistance = currentCameraTarget === 'Sun' ? 8 : 5;
  const planet = targetObject.planet;

  // Update smoothing factor - use tanh(t/10) to make smoothing factor approach 1.0 from 0 to infinity, reaching 1.0 within 30 seconds
  const smoothingFactor = Math.tanh((Date.now() - cameraParams.trackTime) / 10000);

  // Minimum distance is 1.1 times the radius to ensure the camera does not enter the celestial body
  const distance = radius * 1.1 + (baseDistance + radius * 1.4) * cameraParams.zoomFactor;
  const height = radius * 0.4;

  if (planet) {
    const view = VIEW_PRESETS[currentView];
    cameraParams.orbitAngle = view.angle - planet.orbitAngle;
  } else {
    cameraParams.orbitAngle -= 0.004 * simulationSpeed
  }

  // Add slight randomness to simulate natural handheld camera shake
  const time = Date.now() * 0.001;
  const noiseX = Math.sin(time * 0.3) * 0.04;
  const noiseY = Math.cos(time * 0.4) * 0.03;
  const noiseZ = Math.sin(time * 0.5) * 0.04;

  // Calculate target position (add noise)
  if (currentView === 'top') {
    // Top bird's eye view, double distance
    // Determine pitchAngle based on the planet's orbital radius, the smaller the radius the larger the pitchAngle
    let pitchAngle;
    if (targetObject && targetObject.name && targetObject.name !== 'Sun' && targetObject.name !== 'Moon') {
      // Get planet data
      const planetData = planetsData.find(p => p.name === targetObject.name);
      if (planetData) {
        // Calculate pitchAngle based on orbital radius, ranging between 0.36*Math.PI and 0.15*Math.PI
        // Orbital radius range: Mercury(5) to Neptune(55), mapped to angle range
        // The smaller the radius (closer orbit), the larger the pitchAngle, the steeper the downward viewing angle
        const minDistance = 5; // Mercury's orbital radius
        const maxDistance = 55; // Neptune's orbital radius
        const minAngle = 0.15 * Math.PI; // Minimum downward viewing angle of the outermost planet
        const maxAngle = 0.36 * Math.PI; // Maximum downward viewing angle of the innermost planet

        // Linear mapping: the smaller the distance, the larger the angle
        const normalizedDistance = (planetData.distance - minDistance) / (maxDistance - minDistance);
        pitchAngle = maxAngle - normalizedDistance * (maxAngle - minAngle);

      } else {
        pitchAngle = Math.PI / 4; // Default downward viewing angle
      }
    } else {
      pitchAngle = Math.PI / 4; // Default downward viewing angle
    }

    tempVectors.cameraPosition.set(
      tempVectors.cameraTarget.x + Math.cos(cameraParams.orbitAngle) * Math.cos(pitchAngle) * distance * 2 + noiseX * radius,
      tempVectors.cameraTarget.y + Math.sin(pitchAngle) * distance * 2 + noiseY * radius,
      tempVectors.cameraTarget.z + Math.sin(cameraParams.orbitAngle) * Math.cos(pitchAngle) * distance * 2 + noiseZ * radius
    );
  } else {
    tempVectors.cameraPosition.set(
      tempVectors.cameraTarget.x + Math.cos(cameraParams.orbitAngle) * distance + noiseX * radius,
      tempVectors.cameraTarget.y + height + noiseY * radius,
      tempVectors.cameraTarget.z + Math.sin(cameraParams.orbitAngle) * distance + noiseZ * radius
    );
  }

  // Use linear interpolation to achieve smooth transition
  cameraParams.position.lerp(tempVectors.cameraPosition, smoothingFactor);

  // Also smoothly process the observation target (slightly upward, more natural)
  tempVectors.smoothTarget.copy(tempVectors.cameraTarget);
  tempVectors.smoothTarget.y += radius * 0.1; // Look slightly upward

  cameraParams.target.lerp(tempVectors.smoothTarget, smoothingFactor);

  camera.position.copy(cameraParams.position);
  camera.lookAt(cameraParams.target);
}

// Animation loop
const clock = new THREE.Clock();
let isPaused = false;
let simulationSpeed = 1.0; // Simulation speed multiplier

// Event listener management
const eventListeners = [];

// Helper function to register event listeners
function addEventListenerWithCleanup(element, event, handler, options) {
  element.addEventListener(event, handler, options);
  eventListeners.push({ element, event, handler, options });
}

// Mouse wheel zoom handling function (only valid in camera follow mode)
function handleWheelZoom(event) {
  // This function is only registered when in follow mode, so we can handle zoom directly
  event.preventDefault();

  // Calculate scaling factor
  const wheelDelta = event.deltaY;
  const scaleFactor = 1 + Math.abs(wheelDelta) * 0.001;

  if (wheelDelta > 0) {
    // Scroll down (mouse wheel backward) - enlarge zoomFactor (closer)
    cameraParams.zoomFactor = Math.min(cameraParams.zoomFactor * scaleFactor, 4.0); // Limit maximum 4x
  } else {
    // Scroll up (mouse wheel forward) - reduce zoomFactor (farther)
    cameraParams.zoomFactor = Math.max(cameraParams.zoomFactor / scaleFactor, 0.02); // Limit minimum 1/50x
  }
}


function animate() {
  requestAnimationFrame(animate);

  if (isPaused) {
    // Skip animation updates if paused, but keep rendering
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    return;
  }

  const delta = clock.getDelta();

  // Sun rotation - increased rotation speed for visibility
  sun.rotation.y += 0.15 * delta * simulationSpeed;

  // Planets animation
  planets.forEach(p => {
    // Use position calculation method to achieve orbit, instead of rotating container
    p.orbitAngle += p.speed * 0.2 * simulationSpeed;
    p.fixedAxisContainer.position.x = Math.cos(p.orbitAngle) * p.distance;
    p.fixedAxisContainer.position.z = -Math.sin(p.orbitAngle) * p.distance;

    // Planetary rotation - use separate rotation speed
    p.planet.rotation.y += p.rotationSpeed * delta * simulationSpeed;
  });

  // Moon animation using position calculation with orbital inclination
  moonData.orbitAngle += moonData.speed * simulationSpeed;

  // Calculate moon's position relative to Earth with orbital inclination
  // Use object pool to reuse Vector3, avoid memory leaks
  tempVectors.earthWorldPosition.set(0, 0, 0);
  earth.getWorldPosition(tempVectors.earthWorldPosition);

  // Calculate moon's position in 3D space with orbital inclination
  const moonX = Math.cos(moonData.orbitAngle) * moonData.distance;
  const moonY = Math.sin(moonData.orbitAngle) * moonData.distance * Math.sin(moonData.orbitalInclination);
  const moonZ = -Math.sin(moonData.orbitAngle) * moonData.distance * Math.cos(moonData.orbitalInclination);

  // Set moon's position relative to Earth
  moonObject.position.x = tempVectors.earthWorldPosition.x + moonX;
  moonObject.position.y = tempVectors.earthWorldPosition.y + moonY;
  moonObject.position.z = tempVectors.earthWorldPosition.z + moonZ;

  // Reset moonFixedAxisContainer position to origin (it moves with moonObject)
  moonFixedAxisContainer.position.set(0, 0, 0);

  // Moon tidal locking: rotation period equals orbital period
  // The moon's rotation angle should equal its orbital angle, making it always face the Earth
  moon.rotation.y = moonData.orbitAngle + Math.PI; // Add π to adjust orientation

  // Update moon orbit position to follow Earth
  moonOrbitObject.position.copy(tempVectors.earthWorldPosition);

  // Update camera position if following a celestial body
  if (cameraTargetObject && currentCameraTarget !== 'default') {
    updateCamera(cameraTargetObject, delta);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// Hide loading spinner on first render
const loadingSpinner = document.getElementById('loading-spinner');
if (loadingSpinner && !loadingSpinner.classList.contains('hidden')) {
  loadingSpinner.classList.add('hidden');
  setTimeout(() => {
    if (loadingSpinner.parentNode) {
      loadingSpinner.parentNode.removeChild(loadingSpinner);
    }
  }, 500);
}

animate();

// Mouse button reset zoom
function handleMouseButtonReset(event) {
  // Only valid in camera follow mode
  if (currentCameraTarget === 'default') {
    return;
  }

  // Middle mouse button pressed (button === 1) reset zoomFactor to 1
  if (event.button === 1) {
    event.preventDefault();
    cameraParams.zoomFactor = 1.0;
  }
}

// Clean up all event listeners
function cleanupEventListeners() {
  eventListeners.forEach(({ element, event, handler, options }) => {
    element.removeEventListener(event, handler, options);
  });
  eventListeners.length = 0;
}

// Register mouse button events (wheel events are handled dynamically based on camera mode)
// addEventListenerWithCleanup(renderer.domElement, 'wheel', handleWheelZoom, { passive: false });
addEventListenerWithCleanup(renderer.domElement, 'mousedown', handleMouseButtonReset);

// Clean up resources when page unloads
window.addEventListener('beforeunload', () => {
  // Clean up event listeners
  cleanupEventListeners();

  // Clean up texture cache
  textureCache.forEach(texture => {
    if (texture.dispose) texture.dispose();
  });
  textureCache.clear();

  // Clean up geometries and materials
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  // Clean up renderers
  renderer.dispose();
  labelRenderer.dispose();
});

// Handle window resize
function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

addEventListenerWithCleanup(window, 'resize', handleResize);

// Toggle labels
const toggleLabelsCheckbox = document.getElementById('toggle-labels');
function handleToggleLabels(e) {
  const isChecked = e.target.checked;
  labels.forEach(label => {
    label.visible = isChecked;
  });
}
addEventListenerWithCleanup(toggleLabelsCheckbox, 'change', handleToggleLabels);

// Toggle rotation axes
const toggleAxesCheckbox = document.getElementById('toggle-axes');
function handleToggleAxes(e) {
  const isChecked = e.target.checked;
  rotationAxes.forEach(axis => {
    axis.visible = isChecked;
  });
}
addEventListenerWithCleanup(toggleAxesCheckbox, 'change', handleToggleAxes);

// Pause/Resume button
const pauseButton = document.getElementById('pause-button');
const buttonIcon = pauseButton.querySelector('.button-icon');

function handlePauseClick() {
  isPaused = !isPaused;

  // Toggle button styling class
  if (isPaused) {
    pauseButton.classList.add('resumed');
    // Change to play icon
    buttonIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  } else {
    pauseButton.classList.remove('resumed');
    // Change to pause icon
    buttonIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
  }

  if (!isPaused) {
    clock.getDelta(); // Reset clock delta to avoid a jump
  }
}
addEventListenerWithCleanup(pauseButton, 'click', handlePauseClick);

// Help button
const helpButton = document.getElementById('help-button');
addEventListenerWithCleanup(helpButton, 'click', toggleHelpDialog);

// Camera position selector
const cameraPositionSelect = document.getElementById('camera-position');
function handleCameraPositionChange(e) {
  updateCameraPosition(e.target.value);
  // Remove focus to prevent conflicts with keyboard shortcuts
  e.target.blur();
}
addEventListenerWithCleanup(cameraPositionSelect, 'change', handleCameraPositionChange);

// View selector
const viewPresetsDiv = document.getElementById('view-presets');
const viewPresetSelect = document.getElementById('view-preset-select');

function updateView(newView) {
  if (newView !== currentView) {
    currentView = newView;
    cameraParams.trackTime = Date.now(); // Reset tracking time
  }
}

// View preset selector
function handleViewPresetChange(e) {
  updateView(e.target.value);
  // Remove focus to prevent conflicts with keyboard shortcuts
  e.target.blur();
}
addEventListenerWithCleanup(viewPresetSelect, 'change', handleViewPresetChange);

// Speed slider with logarithmic scale
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');

// Logarithmic conversion function: convert linear slider value (0-100) to logarithmic speed value (0.1-10)
function linearToLogarithmic(linearValue) {
  // Map 0-100 to logarithmic scale of 0.1-10
  const minSpeed = 0.1;
  const maxSpeed = 10;
  const normalizedValue = linearValue / 100; // 0-1

  // Use logarithmic formula: result = min * (max/min)^normalized
  return minSpeed * Math.pow(maxSpeed / minSpeed, normalizedValue);
}

// Reverse conversion function: convert logarithmic speed value to linear slider value
function logarithmicToLinear(logValue) {
  const minSpeed = 0.1;
  const maxSpeed = 10;

  // Reverse logarithmic formula: normalized = log(result/min) / log(max/min)
  const normalizedValue = Math.log(logValue / minSpeed) / Math.log(maxSpeed / minSpeed);
  return Math.round(normalizedValue * 100);
}

// Initialize slider value
speedSlider.value = logarithmicToLinear(1.0);

function handleSpeedSliderInput(e) {
  simulationSpeed = linearToLogarithmic(parseFloat(e.target.value));
  speedValue.textContent = simulationSpeed.toFixed(2) + 'x';
}
addEventListenerWithCleanup(speedSlider, 'input', handleSpeedSliderInput);

// Function to reset speed to 1x
function resetSpeedTo1x() {
  simulationSpeed = 1.0;
  speedSlider.value = logarithmicToLinear(1.0);
  speedValue.textContent = '1.0x';
}

// Reset button event listener
const resetSpeedButton = document.getElementById('reset-speed');
addEventListenerWithCleanup(resetSpeedButton, 'click', resetSpeedTo1x);

// Keyboard shortcut support
function handleKeydown(e) {
  // Space key to toggle pause/resume
  if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    e.preventDefault(); // Prevent page scrolling
    handlePauseClick();
  } else if (e.key === 's' || e.key === 'S') { // Press 's' key to reset to 1x speed
    if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
      resetSpeedTo1x();
      // Provide visual feedback
      resetSpeedButton.style.background = 'rgba(102, 126, 234, 0.3)';
      setTimeout(() => {
        resetSpeedButton.style.background = 'rgba(255,255,255,0.1)';
      }, 200);
    }
  } else if ((e.key === 'v' || e.key === 'V')) { // Cycle view presets
    if (currentCameraTarget !== 'default' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      const presets = Object.keys(VIEW_PRESETS);
      const currentIndex = presets.indexOf(currentView);
      const nextIndex = (currentIndex + 1) % presets.length;
      const nextPreset = presets[nextIndex];

      updateView(nextPreset);
      viewPresetSelect.value = nextPreset;
    }
  } else if (e.key === 'm' || e.key === 'M') { // Press 'm' key to switch to moon
    if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
      updateCameraPosition('Moon');
      cameraPositionSelect.value = 'Moon';
    }
  } else if (e.key >= '0' && e.key <= '9') { // Number keys to select celestial bodies
    if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
      const key = parseInt(e.key);
      const targetMap = {
        0: 'default',
        1: 'Mercury',
        2: 'Venus',
        3: 'Earth',
        4: 'Mars',
        5: 'Jupiter',
        6: 'Saturn',
        7: 'Uranus',
        8: 'Neptune',
        9: 'Sun'
      };

      const target = targetMap[key];
      if (target) {
        updateCameraPosition(target);
        cameraPositionSelect.value = target;
      }
    }
  } else if (e.key === 'h' || e.key === 'H') { // Show/hide keyboard shortcut help
    if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
      toggleHelpDialog();
    }
  } else if ((e.key === 'f' || e.key === 'F') ||
             (e.key === 'r' || e.key === 'R') ||
             (e.key === 'i' || e.key === 'I') ||
             (e.key === 'o' || e.key === 'O') ||
             (e.key === 't' || e.key === 'T')) {
    // Camera view shortcuts (only valid in follow mode)
    if (currentCameraTarget !== 'default' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      const viewMap = {
        'f': 'front',
        'F': 'front',
        'r': 'rear',
        'R': 'rear',
        'i': 'inner',
        'I': 'inner',
        'o': 'outer',
        'O': 'outer',
        't': 'top',
        'T': 'top'
      };

      const newView = viewMap[e.key];
      if (newView) {
        updateView(newView);
        viewPresetSelect.value = newView;
      }
    }
  } else if (e.key === 'Escape') { // Esc key to close help interface
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog && helpDialog.style.display === 'block') {
      helpDialog.style.display = 'none';
    }
  }
}
addEventListenerWithCleanup(document, 'keydown', handleKeydown);

// Show/hide keyboard shortcut help dialog
function toggleHelpDialog() {
  let helpDialog = document.getElementById('help-dialog');
  if (!helpDialog) {
    // Create help dialog
    helpDialog = document.createElement('div');
    helpDialog.id = 'help-dialog';
    helpDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(30, 30, 40, 0.95);
      color: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: none;
      max-width: 500px;
      font-family: Arial, sans-serif;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    helpDialog.innerHTML = `
      <h2 style="margin-top: 0; margin-bottom: 20px; font-size: 24px;">Keyboard Shortcuts</h2>
      <button onclick="this.parentElement.style.display='none'" style="
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
      ">×</button>
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px 20px; line-height: 1.8;">
        <div style="font-weight: bold;">Space</div>
        <div>Pause/Resume animation</div>
        <div style="font-weight: bold;">0</div>
        <div>Reset camera position (default view)</div>
        <div style="font-weight: bold;">1-8</div>
        <div>Switch to planet (1=Mercury, 2=Venus, ..., 8=Neptune)</div>
        <div style="font-weight: bold;">9</div>
        <div>Switch to Sun</div>
        <div style="font-weight: bold;">M</div>
        <div>Switch to Moon</div>
        <div style="font-weight: bold;">S</div>
        <div>Reset simulation speed to 1x</div>
        <div style="font-weight: bold;">V</div>
        <div>Cycle camera view presets (Rear/Front/Outer/Inner/Top)</div>
        <div style="font-weight: bold;">R/F/O/I/T</div>
        <div>Camera views (follow mode only): Rear/Front/Outer/Inner/Top</div>
        <div style="font-weight: bold;">H</div>
        <div>Show this help</div>
        <div style="font-weight: bold;">Esc</div>
        <div>Close help interface</div>
      </div>
      <p style="margin-top: 20px; font-size: 12px; color: rgba(255, 255, 255, 0.6);">
        Tip: Use Ctrl + mouse drag to rotate view, scroll to zoom
      </p>
    `;

    document.body.appendChild(helpDialog);
  }

  // Toggle display state
  helpDialog.style.display = helpDialog.style.display === 'block' ? 'none' : 'block';
}

