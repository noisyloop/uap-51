import { COLORS } from '../utils/constants';

/**
 * Visual Effects Module
 *
 * Handles all per-frame visual updates that are independent of game logic:
 * - UAP halo pulsing, ring rotation, and rim-light chase
 * - Banking tilt derived from velocity (visual only — position untouched)
 * - Boost color changes
 * - Building beacon blinking
 * - Nebula drift
 */

/**
 * Update all visual effects for the current frame
 *
 * @param {THREE.Group} uap - The UAP group object
 * @param {Array} buildings - Array of building meshes
 * @param {boolean} isBoosting - Whether the boost is active
 * @param {number} time - Elapsed time from the clock
 * @param {THREE.Vector3} velocity - Current UAP velocity (read-only, for tilt)
 * @param {Object} env - Environment refs from createStars ({ stars, nebulae })
 */
export function updateVisuals(uap, buildings, isBoosting, time, velocity, env) {
  if (!uap) return;

  // Halo pulsing (slow pulse + fast shimmer)
  const pulse = 1 + Math.sin(time * 4) * 0.1 + Math.sin(time * 12) * 0.04;
  uap.halo.scale.setScalar(5.5 * pulse * (isBoosting ? 1.25 : 1));

  // Ring rotation
  uap.ring1.rotation.z = time * 3;
  uap.ring2.rotation.z = -time * 2;
  uap.ring2.rotation.x = Math.PI / 3 + Math.sin(time) * 0.2;

  // Rim-light chase: a bright pulse runs around the saucer edge
  const chase = time * (isBoosting ? 10 : 5);
  uap.rimLights.forEach(lightMesh => {
    const wave = Math.sin(chase - lightMesh.userData.phase * 2);
    lightMesh.material.opacity = 0.35 + Math.max(0, wave) * 0.65;
    const s = 1 + Math.max(0, wave) * 0.6;
    lightMesh.scale.setScalar(s);
  });

  // Slow saucer spin + banking tilt from velocity (visual only)
  uap.model.rotation.y = time * 0.6;
  if (velocity) {
    const bank = -velocity.x * 0.03;
    const pitch = velocity.z * 0.03;
    uap.model.rotation.z += (Math.max(-0.45, Math.min(0.45, bank)) - uap.model.rotation.z) * 0.1;
    uap.model.rotation.x += (Math.max(-0.45, Math.min(0.45, pitch)) - uap.model.rotation.x) * 0.1;
  }

  // Under-glow flicker
  uap.underGlow.material.opacity = 0.12 + Math.sin(time * 9) * 0.04 + (isBoosting ? 0.1 : 0);

  // Light intensity variation
  uap.light.intensity = 120 * (1 + Math.sin(time * 5) * 0.25) * (isBoosting ? 1.4 : 1);

  // Color based on boost state
  if (isBoosting) {
    uap.core.material.color.setHex(COLORS.UAP_BOOST);
    uap.underGlow.material.color.setHex(0xff8800);
    uap.light.color.setHex(0xff8800);
    uap.rimLights.forEach(l => l.material.color.setHex(0xffaa00));
  } else {
    uap.core.material.color.setHex(COLORS.UAP_CORE);
    uap.underGlow.material.color.setHex(COLORS.UAP_GLOW);
    uap.light.color.setHex(COLORS.UAP_CORE);
    uap.rimLights.forEach(l => l.material.color.setHex(COLORS.UAP_CORE));
  }

  // Building rooftop beacons blink out of phase
  buildings.forEach(building => {
    const beacon = building.userData.beacon;
    if (beacon) {
      const blink = Math.sin(time * 2.5 + building.userData.beaconPhase);
      beacon.material.opacity = 0.25 + Math.max(0, blink) * 0.75;
    }
  });

  // Nebula clouds slowly breathe
  if (env && env.nebulae) {
    env.nebulae.forEach((sprite, i) => {
      sprite.material.opacity =
        sprite.userData.baseOpacity * (0.8 + Math.sin(time * 0.2 + i * 1.7) * 0.2);
    });
  }
}
