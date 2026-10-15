# UAP-51 🛸

An autonomous UAP (Unidentified Aerial Phenomenon) flight simulator featuring PID-controlled evasion physics, neon cyberpunk aesthetics, and hostile alien encounters.

![UAP-51 Demo]

## 🎮 Play Now

**[Live Demo]**

Or run locally:

```bash
git clone https://github.com/your-username/uap-51.git
cd uap-51
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## 🚀 Features

- **Autonomous Flight Mode** — Watch the UAP evade lasers using real PID control algorithms
- **Manual Control Mode** — Take the controls yourself and navigate the neon city
- **5 Hostile Aliens** — Full alien bodies riding neon hover-pods, with tracking lasers that predict your movement
- **Night City** — a street-grid city of setback towers with physically based facades (lit interiors, reflective glass), neon signage, rooftop masts and blinking aircraft beacons
- **Wet Streets** — asphalt roads with lane markings, puddles that mirror the city glow, and sodium street lamps
- **Cinematic Night Sky** — light-polluted horizon haze, atmospheric fog, stars and a haloed moon
- **Real-time Telemetry** — Altitude, velocity, evasion count, PID visualization
- **Detailed Saucer** — Metallic lathed hull, glass dome, plasma core, chasing rim lights, tractor-beam under-glow, and velocity-based banking
- **Post-Processing** — multisampled HDR rendering, bloom, ACES filmic tone mapping, vignette and film grain

---

## 🎛 Controls

| Key | Action |
|-----|--------|
| `W` `A` `S` `D` | Move horizontally |
| `Space` | Ascend |
| `Shift` | Descend |
| `E` | Boost (faster movement) |
| `Tab` | Toggle Autopilot / Manual |
| `Esc` | Pause |

---

## 🧠 The Physics: PID Control Explained

The autopilot system uses **PID Controllers** (Proportional-Integral-Derivative) — the same control mechanism used in real drones, cruise control, and industrial automation.

### What is PID?

A PID controller continuously calculates an **error value** (the difference between where you want to be and where you are) and applies a correction based on three terms:

```
Output = P + I + D
```

### The Three Components

#### **P — Proportional** (React to NOW)
```javascript
P = Kp × error
```
- Responds to the **current** error
- Bigger error = stronger correction
- Like steering harder when you're further off course
- *Problem:* Can overshoot the target

#### **I — Integral** (Learn from the PAST)
```javascript
I = Ki × ∫(error × dt)
```
- Accumulates error **over time**
- Eliminates steady-state offset (drift)
- Like noticing you're *always* slightly left and compensating
- *Problem:* Can cause oscillation if too high ("integral windup")

#### **D — Derivative** (Predict the FUTURE)
```javascript
D = Kd × (d(error)/dt)
```
- Responds to **rate of change** of error
- Applies damping to prevent overshoot
- Like easing off the steering as you approach center
- *Problem:* Sensitive to noise

### UAP-51's Implementation

```javascript
// Three independent PID controllers for X, Y, Z axes
pidX = new PIDController(10, 0.5, 5);  // Horizontal
pidY = new PIDController(12, 0.8, 6);  // Vertical  
pidZ = new PIDController(10, 0.5, 5);  // Depth

// Each frame, calculate safe position and apply PID
const target = calculateEvadeTarget();  // Threat avoidance
force.x = pidX.calculate(target.x - position.x, deltaTime);
force.y = pidY.calculate(target.y - position.y, deltaTime);
force.z = pidZ.calculate(target.z - position.z, deltaTime);
```

### Threat Avoidance Algorithm

The autopilot doesn't just fly randomly — it calculates the **safest direction** by:

1. **Laser Avoidance**: Vector away from nearby lasers (stronger when closer)
2. **Alien Avoidance**: Maintain distance from alien positions
3. **Boundary Awareness**: Stay within the playable arena
4. **Patrol Behavior**: Smooth figure-8 pattern when no threats detected

```javascript
// Danger vector accumulates all threats
lasers.forEach(laser => {
  const distance = laser.distanceTo(uap);
  if (distance < 20) {
    dangerVector.add(awayFromLaser.multiplyScalar(20 / distance));
  }
});

// Target = current position + escape direction
const safeTarget = position.clone().add(dangerVector);
```

### Tuning the PID

The `constants.js` file contains all tuning parameters:

```javascript
PID: {
  X: { P: 10, I: 0.5, D: 5 },   // Horizontal response
  Y: { P: 12, I: 0.8, D: 6 },   // Vertical (slightly more aggressive)
  Z: { P: 10, I: 0.5, D: 5 }    // Depth
}
```

**Experiment with these values:**
- Higher P = More aggressive, may oscillate
- Higher I = Eliminates drift, may overshoot
- Higher D = More damping, smoother but slower

---

## 🏗 Project Structure

```
uap-51/
├── src/
│   ├── components/
│   │   ├── Game.jsx        # Main game component
│   │   ├── Game.css
│   │   ├── HUD.jsx         # Heads-up display
│   │   ├── HUD.css
│   │   ├── Menu.jsx        # Start/pause/gameover menus
│   │   └── Menu.css
│   ├── engine/
│   │   └── GameEngine.js   # Three.js game logic
│   ├── utils/
│   │   ├── PIDController.js  # PID implementation
│   │   └── constants.js      # Game configuration
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 🛠 Tech Stack

- **React 18** — UI framework
- **Three.js** — 3D WebGL rendering
- **Vite** — Fast build tool
- **Vanilla CSS** — No framework, custom cyberpunk styling

---

## 📦 Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Development

```bash
# Clone the repo
git clone https://github.com/your-username/uap-51.git
cd uap-51

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Production Build

```bash
npm run build
npm run preview  # Test the build locally
```

### Deploy to GitHub Pages

1. Update `vite.config.js` base path:
```javascript
export default defineConfig({
  base: '/uap-51/',  // Your repo name
  plugins: [react()],
})
```

2. Build and deploy:
```bash
npm run build
# Push dist/ folder to gh-pages branch
```

Or use GitHub Actions for automatic deployment.

---

## ⚙️ Configuration

All game parameters are in `src/utils/constants.js`:

```javascript
export const GAME_CONFIG = {
  ALIEN_COUNT: 5,           // Number of enemies
  ALIEN_FIRE_RATE_MIN: 2500, // Milliseconds between shots
  LASER_SPEED: 60,          // Projectile speed
  LASER_DAMAGE: 18,         // Damage per hit
  UAP_THRUST: 40,           // Base movement speed
  UAP_BOOST_THRUST: 100,    // Boosted speed
  SHIELD_MAX: 100,          // Starting health
  // ... more options
};
```

---

## 🎨 Customization Ideas

- Add more alien types with different behaviors
- Implement power-ups (shield boost, temporary invincibility)
- Add sound effects and music
- Create multiple arenas/levels
- Add multiplayer support

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Credits

- Built with [Three.js](https://threejs.org/)
- React framework by [Meta](https://react.dev/)
- Fonts: [Orbitron](https://fonts.google.com/specimen/Orbitron), [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono)

---

## 🛸 About the Name

**UAP-51** combines:
- **UAP** (Unidentified Aerial Phenomenon) — the modern term for UFOs
- **51** — a nod to Area 51, the famous Nevada facility associated with UFO lore

---

**Good luck, pilot. The aliens are watching.** 👽
