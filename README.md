# Solar System Simulator

This is an interactive 3D solar system simulator created using the three.js library. It showcases the Sun and the eight planets of the solar system (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune), as well as Earth's satellite (the Moon), with realistic textures and simulated orbital and rotational movements.

**Live Demo**: [https://gouzhuang.github.io/solar-system/](https://gouzhuang.github.io/solar-system/)

## Key Features

- **Accurate Physics Simulation**: All celestial bodies have fixed axial tilts based on real astronomical data, ensuring physical accuracy.
- **Complete Solar System**: Includes the Sun, eight planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune) and Earth's Moon.
- **Interactive 3D Controls**: Supports camera following any celestial body, and implements panning, zooming, and rotation through `OrbitControls` for an immersive experience.
- **Visual Feedback**: Provides celestial body labels, rotation axes, orbital paths, and real-time camera tracking to enhance visualization.
- **Customizable Experience**: Adjustable simulation speed (0.1x-10x), pause/resume functionality, and multiple camera presets.
- **Realistic Textures and Models**: Planets and the Sun rendered as spheres with realistic textures, including Saturn's rings and the Moon system.
- **Orbital Animation and Rotation**: Planets orbit around the Sun and rotate around their own axis.
- **Moon System**: Earth's Moon orbits Earth with the correct orbital inclination (5.14°) and achieves tidal locking.

## Running the Project

This project has no formal build process. To run the simulator, you need to serve the files using a local web server.

1. **Start the Server**:
    Open a terminal in the project's root directory and run the following command:

    ```bash
    python3 -m http.server 8000
    ```

    Alternative options:

    ```bash
    # Python 2
    python -m SimpleHTTPServer 8000

    # Node.js (if http-server is installed)
    npx http-server -p 8000
    ```

2. **View the Application**:
    Open your web browser and navigate to: `http://localhost:8000`

## Usage Instructions

### Control Panel

The control panel at the top of the page provides the following functions:

- **Show Labels**: Toggle display/hide of planet name labels
- **Show Rotation Axes**: Toggle display/hide of rotation axis visualization lines
- **Camera Position**: Select the celestial body to follow (Sun, any planet, or Moon)
- **View Presets**: When following a celestial body, switch between different perspectives (rear, front, inner side, outer side, top)
- **Animation Speed**: Slide to adjust animation playback speed (0.1x to 10x, logarithmic scale)
- **Reset Speed**: Reset speed to 1x
- **Pause/Resume**: Pause or resume animation playback

### Keyboard Shortcuts

- **Space bar**: Pause/resume animation
- **S key**: Reset animation speed to 1x
- **V key**: Cycle through view presets (only effective when following a celestial body)
- **M key**: Switch camera target to the Moon
- **Number keys 0-9**: Select celestial body as camera target
  - **0**: Default view
  - **1**: Mercury
  - **2**: Venus
  - **3**: Earth
  - **4**: Mars
  - **5**: Jupiter
  - **6**: Saturn
  - **7**: Uranus
  - **8**: Neptune
  - **9**: Sun

### Mouse Controls

- **Left-click drag**: Rotate camera view (only effective in default view)
- **Right-click drag**: Pan camera position (only effective in default view)
- **Scroll wheel**: Zoom camera distance (scroll forward to zoom out, scroll backward to zoom in)
- **Middle-click**: Reset camera zoom scale to 1x (only effective in follow mode)

## Technical Implementation

### Fixed Direction of Rotation Axis Implementation

An important feature of this simulator is that planetary rotation axes maintain a fixed direction in space, conforming to real physical laws. This is achieved through the following technical approach:

```javascript
// Object hierarchy
scene
└── planetObject (orbital container, does not rotate, only for position calculation)
    └── fixedAxisContainer (rotation axis container, set axial tilt and keep fixed)
        ├── planet (planet body, rotates)
        └── planetAxis (rotation axis visualization)

// Animation implementation
planets.forEach(p => {
    // Implement orbital motion using position calculation instead of rotating container
    p.orbitAngle += p.speed * 0.2 * simulationSpeed;
    p.fixedAxisContainer.position.x = Math.cos(p.orbitAngle) * p.distance;
    p.fixedAxisContainer.position.z = -Math.sin(p.orbitAngle) * p.distance;

    // Planetary rotation
    p.planet.rotation.y += p.rotationSpeed * delta * simulationSpeed;
});
```

**Key Principles:**

1. **Separation of Orbital Motion and Rotation**: Orbital motion is implemented through position calculation, rotation through rotating the planet body
2. **Fixed Axial Container**: `fixedAxisContainer` sets the axial tilt only once and does not rotate with orbital motion
3. **Position Calculation Method**: Uses trigonometric functions to directly calculate planet positions, avoiding axial changes caused by container rotation

### Special Handling of the Moon

The Moon is not a child object of Earth to prevent inheriting Earth's rotation. The Moon's position is calculated relative to Earth through `getWorldPosition()` to maintain the correct orbital relationship.

### Saturn's Ring Implementation

Saturn's rings use a transparent PNG texture (`2k_saturn_ring_alpha.png`) and implement correct texture display through custom UV mapping.

### Parameter Authenticity Notes

#### Real Parameters

- **Axial Tilt**: All planets' axial tilts are based on real astronomical data
  - Mercury: 0.034°
  - Venus: 177.4° (retrograde rotation)
  - Earth: 23.44°
  - Mars: 25.19°
  - Jupiter: 3.13°
  - Saturn: 26.73°
  - Uranus: 97.77° (tilted on its side, rotation axis almost parallel to orbital plane)
  - Neptune: 28.32°
  - Moon: 1.54°

- **Moon's Orbital Inclination**: 5.14° (relative to the ecliptic plane)

- **Moon's Tidal Locking**: The Moon's rotation period equals its orbital period, so the same side always faces Earth

#### Visually Adjusted Parameters

- **Orbital Radius**: Compressed significantly for clear display on screen
  - Mercury: 5 units (actual: 0.39 AU)
  - Earth: 10 units (actual: 1.0 AU)
  - Neptune: 55 units (actual: 30.1 AU)

- **Planet Sizes**: Enlarged for visibility
  - Relative planet sizes maintain a certain proportion, but overall enlarged for observation

- **Motion Speed**: Dramatically accelerated for demonstration effect
  - Inner planets move faster, outer planets move slower, maintaining relative relationships
  - All parameters can be adjusted through the speed slider (0.1x to 10x)

## Browser Compatibility

- Modern browsers such as Chrome, Firefox, Safari, Edge
- Requires WebGL support
- Performance may be reduced on mobile devices

## Important Notice

Please note that this project is primarily for educational demonstration purposes. Although key parameters such as axial tilt are based on real astronomical data, parameters such as orbital radius, planet size, and motion speed have been significantly adjusted for visual effects and demonstration purposes. The real solar system scale is much larger and the motion speeds are much slower.

## Technology Stack

- **3D Engine**: three.js v0.164.1 (loaded via unpkg.com CDN)
- **Language**: JavaScript (ES Modules)
- **HTML/CSS**: HTML5 and CSS3
- **No Build System**: Static files served through any web server

## File Structure

```text
solar-system/
├── index.html          # Main HTML file, containing UI controls and styles
├── main.js             # 3D scene logic and animation engine
├── textures/           # 11 2K resolution planet textures
│   ├── 2k_sun.jpg
│   ├── 2k_mercury.jpg
│   ├── 2k_venus.jpg
│   ├── 2k_earth.jpg
│   ├── 2k_mars.jpg
│   ├── 2k_jupiter.jpg
│   ├── 2k_saturn.jpg
│   ├── 2k_saturn_ring_alpha.png
│   ├── 2k_uranus.jpg
│   ├── 2k_neptune.jpg
│   └── 2k_moon.jpg
└── README.md           # User documentation (this file)
```

## License

This project uses the three.js library, following its MIT license. Texture resources are from [Solar System Scope](https://www.solarsystemscope.com/textures/).