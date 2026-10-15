import * as THREE from 'three';
import { PIDController } from '../utils/PIDController';
import { GAME_CONFIG } from '../utils/constants';
import { createScene, createSky, createCamera, createRenderer, createComposer, applyEnvironment, createGround, createStars, createGlowTexture } from './SceneSetup';
import { createBuildings } from './BuildingFactory';
import { createUAP } from './UAPFactory';
import { createAliens } from './AlienFactory';
import { updateUAPMovement, enforceBounds, updateBoost, updateShields, updateAliens, updateLasers, updateCamera } from './PhysicsEngine';
import { updateVisuals } from './VisualEffects';

/**
 * UAP-51 Game Engine
 *
 * Orchestrates all game systems by delegating to specialized modules:
 * - SceneSetup: Three.js scene, camera, renderer, environment
 * - BuildingFactory: Cyberpunk city generation
 * - UAPFactory: Player craft creation
 * - AlienFactory: Enemy entities and laser projectiles
 * - AutopilotController: PID-based threat evasion
 * - PhysicsEngine: Movement, collisions, AI behavior
 * - VisualEffects: Pulsing, animations, color changes
 */
export class GameEngine {
  constructor(canvas, onStateChange) {
    this.canvas = canvas;
    this.onStateChange = onStateChange;

    // Three.js core (initialized in init())
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Game objects
    this.uap = null;
    this.uapVelocity = new THREE.Vector3();
    this.aliens = [];
    this.lasers = [];
    this.buildings = [];

    // Game state
    this.shields = GAME_CONFIG.SHIELD_MAX;
    this.boost = 100;
    this.survivalTime = 0;
    this.evadeCount = 0;
    this.isBoosting = false;
    this.autopilot = true;

    // Control state
    this.gameStarted = false;
    this.gamePaused = false;
    this.gameOver = false;
    this.keys = {};

    // PID Controllers for autonomous flight
    this.pidX = new PIDController(
      GAME_CONFIG.PID.X.P,
      GAME_CONFIG.PID.X.I,
      GAME_CONFIG.PID.X.D
    );
    this.pidY = new PIDController(
      GAME_CONFIG.PID.Y.P,
      GAME_CONFIG.PID.Y.I,
      GAME_CONFIG.PID.Y.D
    );
    this.pidZ = new PIDController(
      GAME_CONFIG.PID.Z.P,
      GAME_CONFIG.PID.Z.I,
      GAME_CONFIG.PID.Z.D
    );

    this.disposed = false;
  }

  /**
   * Initialize the engine: create scene, world objects, and start rendering
   */
  init() {
    this.scene = createScene();
    this.camera = createCamera();
    this.renderer = createRenderer(this.canvas);
    this.composer = createComposer(this.renderer, this.scene, this.camera);
    applyEnvironment(this.renderer, this.scene);

    // Build the world
    createSky(this.scene);
    createGround(this.scene);
    this.env = createStars(this.scene);
    this.buildings = createBuildings(
      this.scene,
      createGlowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.25)')
    );
    this.uap = createUAP(this.scene);
    this.aliens = createAliens(this.scene);

    // Event listeners
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Start render loop
    this.animate();
  }

  // --- Game lifecycle ---

  start(isAutopilot) {
    this.autopilot = isAutopilot;
    this.gameStarted = true;
    this.gamePaused = false;
    this.gameOver = false;
    this.updateState();
  }

  togglePause() {
    if (!this.gameStarted || this.gameOver) return;
    this.gamePaused = !this.gamePaused;
    this.updateState();
  }

  toggleAutopilot() {
    this.autopilot = !this.autopilot;
    this.pidX.reset();
    this.pidY.reset();
    this.pidZ.reset();
    this.updateState();
  }

  restart() {
    this.shields = GAME_CONFIG.SHIELD_MAX;
    this.boost = 100;
    this.survivalTime = 0;
    this.evadeCount = 0;
    this.uap.position.set(0, 10, 0);
    this.uapVelocity.set(0, 0, 0);

    // Reset aliens
    this.aliens.forEach(alien => {
      alien.userData.alive = true;
      alien.visible = true;
      alien.userData.lastShot = Math.random() * 2000;
    });

    // Clear lasers
    this.lasers.forEach(laser => this.scene.remove(laser.mesh));
    this.lasers = [];

    // Reset PIDs
    this.pidX.reset();
    this.pidY.reset();
    this.pidZ.reset();

    this.gameStarted = true;
    this.gamePaused = false;
    this.gameOver = false;

    this.updateState();
  }

  quit() {
    this.restart();
    this.gameStarted = false;
    this.updateState();
  }

  endGame() {
    this.gameOver = true;
    this.updateState();
  }

  // --- State sync with React ---

  updateState() {
    this.onStateChange({
      gameStarted: this.gameStarted,
      gamePaused: this.gamePaused,
      gameOver: this.gameOver,
      autopilot: this.autopilot,
      shields: this.shields,
      boost: this.boost,
      survivalTime: this.survivalTime,
      evadeCount: this.evadeCount,
      altitude: this.uap?.position.y || 0,
      velocity: this.uapVelocity?.length() || 0,
      pid: {
        p: Math.abs(this.pidX.lastP),
        i: Math.abs(this.pidX.lastI),
        d: Math.abs(this.pidX.lastD)
      }
    });
  }

  // --- Input handling ---

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  handleKeyDown(e) {
    this.keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Tab') e.preventDefault();
  }

  handleKeyUp(e) {
    this.keys[e.code] = false;
  }

  // --- Per-frame update (delegates to PhysicsEngine) ---

  update(dt, time) {
    this.survivalTime += dt;

    updateBoost(this, dt);
    updateUAPMovement(this, dt);
    enforceBounds(this);
    updateShields(this, dt);
    updateAliens(this, time);
    updateLasers(this, dt);
    updateCamera(this.camera, this.uap.position);

    this.updateState();
  }

  // --- Render loop ---

  animate = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    if (this.gameStarted && !this.gamePaused && !this.gameOver) {
      this.update(dt, time);
    }

    updateVisuals(this.uap, this.buildings, this.isBoosting, time, this.uapVelocity, this.env);
    this.composer.film.uniforms.time.value = time;
    this.composer.render();
  };

  // --- Cleanup ---

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.composer.dispose();
    this.renderer.dispose();
  }
}

export default GameEngine;
