import * as THREE from 'three';
import { COLORS } from '../utils/constants';
import { createGlowTexture } from './SceneSetup';

/**
 * UAP Factory Module
 *
 * Creates the player's UAP (Unidentified Aerial Phenomenon) craft:
 * a classic saucer with a brushed-metal hull, glass dome, glowing
 * plasma core, chasing rim lights, spinning energy rings and an
 * under-hull tractor glow.
 *
 * The group origin is the physics/collision point. All visual parts
 * live in a child `model` group so VisualEffects can bank/tilt the
 * craft without ever touching the physics-driven position.
 */

/**
 * Create and return the UAP group.
 *
 * References exposed for VisualEffects:
 * - model: tiltable child group holding all geometry
 * - core: glowing plasma core (boost color hook)
 * - dome: glass canopy
 * - rimLights: array of rim light meshes (chase animation)
 * - ring1, ring2: spinning energy rings
 * - halo: additive glow sprite (pulse hook)
 * - underGlow: tractor-beam cone under the hull
 * - light: main point light
 */
export function createUAP(scene) {
  const uap = new THREE.Group();
  const model = new THREE.Group();
  uap.add(model);
  uap.model = model;

  // Saucer hull: lathed profile — flat lens shape with a rim lip
  const hullProfile = [
    new THREE.Vector2(0.0, -0.32),
    new THREE.Vector2(0.55, -0.30),
    new THREE.Vector2(1.05, -0.18),
    new THREE.Vector2(1.45, -0.04),
    new THREE.Vector2(1.55, 0.0),
    new THREE.Vector2(1.45, 0.06),
    new THREE.Vector2(1.0, 0.22),
    new THREE.Vector2(0.55, 0.3),
    new THREE.Vector2(0.0, 0.34)
  ];
  const hull = new THREE.Mesh(
    new THREE.LatheGeometry(hullProfile, 48),
    new THREE.MeshStandardMaterial({
      color: COLORS.UAP_HULL,
      metalness: 0.95,
      roughness: 0.25,
      emissive: 0x0a1428,
      emissiveIntensity: 0.4
    })
  );
  model.add(hull);

  // Rim band: thin emissive ring around the widest point of the hull
  const rimBand = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.045, 8, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.UAP_CORE })
  );
  rimBand.rotation.x = Math.PI / 2;
  model.add(rimBand);

  // Glass dome canopy
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x66ccff,
      metalness: 0.1,
      roughness: 0.05,
      transparent: true,
      opacity: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.1
    })
  );
  dome.position.y = 0.3;
  model.add(dome);
  uap.dome = dome;

  // Plasma core inside the dome (changes color when boosting)
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 24),
    new THREE.MeshBasicMaterial({ color: COLORS.UAP_CORE })
  );
  core.position.y = 0.38;
  model.add(core);
  uap.core = core;

  // Chasing rim lights around the saucer edge
  const rimLights = [];
  const rimLightGeometry = new THREE.SphereGeometry(0.09, 8, 8);
  const RIM_LIGHT_COUNT = 14;
  for (let i = 0; i < RIM_LIGHT_COUNT; i++) {
    const angle = (i / RIM_LIGHT_COUNT) * Math.PI * 2;
    const lightMesh = new THREE.Mesh(
      rimLightGeometry,
      new THREE.MeshBasicMaterial({
        color: COLORS.UAP_CORE,
        transparent: true,
        opacity: 0.9
      })
    );
    lightMesh.position.set(Math.cos(angle) * 1.5, 0, Math.sin(angle) * 1.5);
    lightMesh.userData.phase = angle;
    model.add(lightMesh);
    rimLights.push(lightMesh);
  }
  uap.rimLights = rimLights;

  // Under-hull vents: three glowing pads on the underside
  const ventGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const vent = new THREE.Mesh(
      ventGeometry,
      new THREE.MeshBasicMaterial({
        color: COLORS.UAP_GLOW,
        transparent: true,
        opacity: 0.8
      })
    );
    vent.position.set(Math.cos(angle) * 0.7, -0.3, Math.sin(angle) * 0.7);
    model.add(vent);
  }

  // Tractor-beam under-glow cone
  const underGlow = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.6, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: COLORS.UAP_GLOW,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  underGlow.position.y = -1.1;
  underGlow.rotation.x = Math.PI;
  model.add(underGlow);
  uap.underGlow = underGlow;

  // Spinning energy rings
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.035, 8, 48),
    new THREE.MeshBasicMaterial({
      color: COLORS.UAP_CORE,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  ring1.rotation.x = Math.PI / 2;
  uap.add(ring1);
  uap.ring1 = ring1;

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.025, 8, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  ring2.rotation.x = Math.PI / 3;
  uap.add(ring2);
  uap.ring2 = ring2;

  // Soft halo sprite around the whole craft
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createGlowTexture('rgba(0,255,255,0.28)', 'rgba(0,80,255,0.06)'),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  halo.scale.setScalar(5.5);
  uap.add(halo);
  uap.halo = halo;

  // Main point light illuminating nearby buildings and ground
  const light = new THREE.PointLight(COLORS.UAP_CORE, 120, 45, 1.7);
  uap.add(light);
  uap.light = light;

  uap.position.set(0, 10, 0);
  scene.add(uap);

  return uap;
}
