// Game configuration constants

export const GAME_CONFIG = {
  // Alien settings
  ALIEN_COUNT: 5,
  ALIEN_FIRE_RATE_MIN: 2500,  // ms
  ALIEN_FIRE_RATE_MAX: 4500,  // ms
  ALIEN_RANGE: 60,            // How close before they shoot
  
  // Laser settings
  LASER_SPEED: 60,
  LASER_MAX_DISTANCE: 120,
  LASER_DAMAGE: 18,
  
  // UAP settings
  UAP_THRUST: 40,
  UAP_BOOST_THRUST: 100,
  UAP_BOOST_DRAIN: 30,        // per second
  UAP_BOOST_RECHARGE: 15,     // per second
  UAP_GRAVITY: -15,
  UAP_HOVER_FORCE: 14,
  UAP_DAMPING: 0.94,
  
  // Shield settings
  SHIELD_MAX: 100,
  SHIELD_REGEN: 4,            // per second
  
  // World bounds
  WORLD_BOUNDS: {
    x: 60,
    y: { min: 1, max: 50 },
    z: 60
  },
  
  // City settings (street grid: one block + one street = 20 units)
  BLOCK_SIZE: 14,
  STREET_WIDTH: 6,
  BUILDING_MIN_RADIUS: 30,
  BUILDING_MAX_RADIUS: 110,
  
  // PID tuning (these values control autopilot behavior)
  PID: {
    X: { P: 10, I: 0.5, D: 5 },
    Y: { P: 12, I: 0.8, D: 6 },
    Z: { P: 10, I: 0.5, D: 5 }
  }
};

export const COLORS = {
  // Neon city colors
  NEON: [
    0xff00ff,  // Magenta
    0x00ffff,  // Cyan
    0xff0088,  // Pink
    0x00ff88,  // Green
    0xffff00,  // Yellow
    0xff4400,  // Orange
    0x8800ff,  // Purple
    0x0088ff   // Blue
  ],
  
  // UAP colors
  UAP_CORE: 0x00ffff,
  UAP_GLOW: 0x0088ff,
  UAP_BOOST: 0xffaa00,
  UAP_HULL: 0x9aa8bb,
  
  // Alien colors
  ALIEN_EYES: 0x00ff00,
  LASER: 0x00ff00,
  
  // Environment
  FOG: 0x1b1726,          // hazy horizon, matches the sky's lowest band
  SKY_ZENITH: 0x01020a,
  SKY_MID: 0x080b1e,
  SKY_GLOW: 0x2a160e,     // sodium light pollution on low haze
  GROUND: 0x000208,
  GRID: 0x00ffff
};
