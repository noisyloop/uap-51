import * as THREE from 'three';
import { GAME_CONFIG, COLORS } from '../utils/constants';

/**
 * Building Factory Module
 *
 * Generates a night-time city laid out on a street grid around the
 * play area. Buildings use physically based materials: a facade
 * texture set (albedo, emissive lit windows, roughness) so towers
 * react to the moon, the UAP light and the environment map instead
 * of being flat unlit boxes. Tall buildings get setback tiers,
 * rooftop masts and blinking aircraft beacons; some carry neon
 * signage in the city's accent colors.
 */

// ---------------------------------------------------------------------------
// Facade textures
// ---------------------------------------------------------------------------

/**
 * Facade styles. Each style defines a window grid for one texture tile;
 * the tile is repeated across a face so window size stays consistent
 * regardless of building size. One tile = TILE_W x TILE_H world units.
 */
const FACADE_STYLES = {
  glass: { cols: 6, rows: 6, frame: '#1b2130', glass: '#0b1220', inset: 0.06, litChance: 0.34 },
  office: { cols: 5, rows: 6, frame: '#2a2c33', glass: '#0d1119', inset: 0.18, litChance: 0.4 },
  residential: { cols: 4, rows: 6, frame: '#2e2925', glass: '#120f0d', inset: 0.26, litChance: 0.32 }
};
const STYLE_NAMES = Object.keys(FACADE_STYLES);
const TILE_W = 8;   // world units covered by one texture tile horizontally
const TILE_H = 12;  // world units covered by one texture tile vertically
const VARIANTS_PER_STYLE = 3;

const facadeCache = new Map();

/** Interior light colours — mostly warm and cool white, rarely neon */
function pickInteriorColor(accent) {
  const r = Math.random();
  if (r < 0.45) return [255, 196, 130];   // warm tungsten
  if (r < 0.8) return [190, 215, 255];    // cool LED / office
  if (r < 0.92) return [255, 235, 200];   // neutral
  return accent;                           // neon-lit room
}

/**
 * Paint one facade variant into three canvases (albedo, emissive,
 * roughness) and return them as textures.
 */
function paintFacade(styleName, accentHex) {
  const style = FACADE_STYLES[styleName];
  const W = 256;
  const H = 384;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')];
  };
  const [albedoC, a] = make();
  const [emissiveC, e] = make();
  const [roughC, r] = make();

  const accent = [(accentHex >> 16) & 255, (accentHex >> 8) & 255, accentHex & 255];

  // Base: frame / concrete with subtle noise so large faces aren't flat
  a.fillStyle = style.frame;
  a.fillRect(0, 0, W, H);
  for (let i = 0; i < 1800; i++) {
    const v = Math.random() * 18 - 9;
    a.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},0.05)`;
    a.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(205,205,205)'; // frames are rough
  r.fillRect(0, 0, W, H);

  const cellW = W / style.cols;
  const cellH = H / style.rows;
  const insetX = cellW * style.inset;
  const insetY = cellH * style.inset;

  // Floors are lit as a whole more often than random windows (realistic)
  const floorLit = Array.from({ length: style.rows }, () => Math.random() < 0.12);

  for (let row = 0; row < style.rows; row++) {
    // Floor slab line
    a.fillStyle = 'rgba(0,0,0,0.35)';
    a.fillRect(0, row * cellH, W, 2);

    for (let col = 0; col < style.cols; col++) {
      const x = col * cellW + insetX;
      const y = row * cellH + insetY;
      const w = cellW - insetX * 2;
      const h = cellH - insetY * 2;

      // Dark glass
      a.fillStyle = style.glass;
      a.fillRect(x, y, w, h);
      // Faint sky reflection gradient on the glass
      const refl = a.createLinearGradient(x, y, x + w, y + h);
      refl.addColorStop(0, 'rgba(90,110,160,0.18)');
      refl.addColorStop(1, 'rgba(20,25,40,0)');
      a.fillStyle = refl;
      a.fillRect(x, y, w, h);
      r.fillStyle = 'rgb(28,28,28)'; // glass is smooth → reflective
      r.fillRect(x, y, w, h);

      const lit = Math.random() < (floorLit[row] ? 0.85 : style.litChance * 0.7);
      if (!lit) continue;

      const [cr, cg, cb] = pickInteriorColor(accent);
      const brightness = 0.3 + Math.random() * 0.6;
      // Interior light falls off toward the top of the window
      const g = e.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${brightness * 0.55})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},${brightness})`);
      e.fillStyle = g;
      e.fillRect(x, y, w, h);

      // Blinds on some windows
      if (Math.random() < 0.3) {
        e.fillStyle = 'rgba(0,0,0,0.45)';
        const blindTop = h * (0.2 + Math.random() * 0.5);
        e.fillRect(x, y, w, blindTop);
        for (let by = y + 2; by < y + blindTop; by += 3) {
          e.fillStyle = `rgba(${cr},${cg},${cb},0.08)`;
          e.fillRect(x, by, w, 1);
        }
      }
      // A silhouette or furniture shape in a few rooms
      if (Math.random() < 0.15) {
        e.fillStyle = 'rgba(0,0,0,0.55)';
        e.fillRect(x + w * Math.random() * 0.6, y + h * 0.55, w * 0.25, h * 0.45);
      }
      // Lit glass reads bright in albedo too
      a.fillStyle = `rgba(${cr},${cg},${cb},0.25)`;
      a.fillRect(x, y, w, h);
    }
  }

  const toTex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return {
    map: toTex(albedoC, true),
    emissiveMap: toTex(emissiveC, true),
    roughnessMap: toTex(roughC, false)
  };
}

/** Get a cached facade variant for a style + accent colour */
function getFacade(styleName, accentHex) {
  const variant = Math.floor(Math.random() * VARIANTS_PER_STYLE);
  const key = `${styleName}:${accentHex}:${variant}`;
  if (!facadeCache.has(key)) facadeCache.set(key, paintFacade(styleName, accentHex));
  return facadeCache.get(key);
}

/** Clone a facade set with a repeat that matches a face's real size */
function facadeMaterial(facade, faceWidth, faceHeight) {
  const repeatX = Math.max(1, faceWidth / TILE_W);
  const repeatY = Math.max(1, faceHeight / TILE_H);
  const offsetX = Math.floor(Math.random() * 6) / 6;
  const clone = (tex) => {
    const t = tex.clone();
    t.repeat.set(repeatX, repeatY);
    t.offset.set(offsetX, 0);
    t.needsUpdate = true;
    return t;
  };
  return new THREE.MeshStandardMaterial({
    map: clone(facade.map),
    emissiveMap: clone(facade.emissiveMap),
    emissive: 0xffffff,
    emissiveIntensity: 0.95,
    roughnessMap: clone(facade.roughnessMap),
    roughness: 1,
    metalness: 0.35,
    envMapIntensity: 1.2
  });
}

// ---------------------------------------------------------------------------
// Shared materials and geometry
// ---------------------------------------------------------------------------

const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.85, metalness: 0.1 });
const clutterMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2b33, roughness: 0.7, metalness: 0.4 });
const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x55565f, metalness: 0.9, roughness: 0.4 });
const beaconGeometry = new THREE.SphereGeometry(0.3, 8, 8);
const unitBox = new THREE.BoxGeometry(1, 1, 1);

// ---------------------------------------------------------------------------
// Building construction
// ---------------------------------------------------------------------------

/** One box tier of a building with per-face facade materials */
function createTier(facade, w, h, d) {
  const wideFace = facadeMaterial(facade, w, h);
  const deepFace = facadeMaterial(facade, d, h);
  // Box face order: +x, -x, +y, -y, +z, -z
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    [deepFace, deepFace, roofMaterial, roofMaterial, wideFace, wideFace]
  );
  return mesh;
}

/** Neon signage: a vertical corner strip and/or a glowing rooftop band */
function addNeonSign(group, color, w, h, d) {
  const neon = new THREE.MeshBasicMaterial({ color });
  neon.color.multiplyScalar(1.6); // push above 1 so bloom catches it

  if (Math.random() < 0.6) {
    const stripH = Math.min(h * 0.5, 14);
    const strip = new THREE.Mesh(unitBox, neon);
    strip.scale.set(0.35, stripH, 0.35);
    const sx = (Math.random() < 0.5 ? -1 : 1) * (w / 2 + 0.05);
    const sz = (Math.random() < 0.5 ? -1 : 1) * (d / 2 + 0.05);
    strip.position.set(sx, h * 0.35 - stripH / 2 + h * 0.15, sz);
    group.add(strip);
  }
  if (Math.random() < 0.5) {
    const band = new THREE.Mesh(unitBox, neon);
    band.scale.set(w * 0.8, 0.9, 0.15);
    band.position.set(0, h / 2 - 1.2, d / 2 + 0.1);
    group.add(band);
  }
}

/**
 * Create one building at (x, z) with footprint w × d and height h.
 * Tall buildings are stacked from setback tiers.
 */
function createBuilding(scene, x, z, w, h, d) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const style = h > 30 ? (Math.random() < 0.7 ? 'glass' : 'office')
    : STYLE_NAMES[Math.floor(Math.random() * STYLE_NAMES.length)];
  const accent = COLORS.NEON[Math.floor(Math.random() * COLORS.NEON.length)];
  const facade = getFacade(style, accent);

  // Setback tiers: each tier narrower than the one below
  const tierCount = h > 34 ? 3 : h > 20 ? 2 : 1;
  let base = 0;
  let tw = w;
  let td = d;
  let remaining = h;
  let topW = w;
  let topD = d;
  for (let t = 0; t < tierCount; t++) {
    const th = t === tierCount - 1 ? remaining : remaining * (0.5 + Math.random() * 0.15);
    const tier = createTier(facade, tw, th, td);
    tier.position.y = base + th / 2;
    group.add(tier);
    topW = tw;
    topD = td;
    base += th;
    remaining -= th;
    tw *= 0.7 + Math.random() * 0.15;
    td *= 0.7 + Math.random() * 0.15;
  }

  // Rooftop clutter (HVAC boxes, water tanks)
  const clutterCount = Math.floor(Math.random() * 3);
  for (let i = 0; i < clutterCount; i++) {
    const s = 0.8 + Math.random() * 1.4;
    const box = new THREE.Mesh(unitBox, clutterMaterial);
    box.scale.set(s, s * 0.6, s);
    box.position.set(
      (Math.random() - 0.5) * topW * 0.5,
      h + s * 0.3,
      (Math.random() - 0.5) * topD * 0.5
    );
    group.add(box);
  }

  // Aircraft warning beacon (blink animated in VisualEffects)
  const beacon = new THREE.Mesh(
    beaconGeometry,
    new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.9 })
  );
  beacon.position.y = h + 0.4;

  if (h > 26) {
    const mastHeight = 3 + Math.random() * 6;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, mastHeight, 6), mastMaterial);
    mast.position.y = h + mastHeight / 2;
    group.add(mast);
    beacon.position.y = h + mastHeight + 0.3;
  }
  group.add(beacon);
  group.userData.beacon = beacon;
  group.userData.beaconPhase = Math.random() * Math.PI * 2;

  // Neon signage on roughly a third of buildings
  if (Math.random() < 0.35) addNeonSign(group, accent, w, Math.min(h, 24), d);

  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------
// Street lights
// ---------------------------------------------------------------------------

/**
 * Sodium street lamps along the street grid: glowing lamp heads plus
 * soft pools of light on the road, each drawn as one instanced mesh.
 */
function createStreetLights(scene, lampPositions, glowTexture) {
  const count = lampPositions.length;
  const dummy = new THREE.Object3D();

  const poles = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.08, 5, 5),
    mastMaterial,
    count
  );
  const heads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.18, 6, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb35a).multiplyScalar(3) }),
    count
  );
  const pools = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0xff9a40,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2
    }),
    count
  );

  lampPositions.forEach((p, i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(p.x, 2.5, p.z);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x, 5.05, p.z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);

    dummy.position.set(p.x, 0.03, p.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(9, 9, 1);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
  });

  scene.add(poles, heads, pools);
}

// ---------------------------------------------------------------------------
// City layout
// ---------------------------------------------------------------------------

/**
 * Lay out the city on a street grid. Blocks inside the open centre
 * (BUILDING_MIN_RADIUS) stay empty so there is room to fly; blocks
 * further out than BUILDING_MAX_RADIUS are dropped and hidden by fog.
 * Returns building groups for later animation.
 */
export function createBuildings(scene, glowTexture) {
  const buildings = [];
  const { BLOCK_SIZE, STREET_WIDTH, BUILDING_MIN_RADIUS, BUILDING_MAX_RADIUS } = GAME_CONFIG;
  const pitch = BLOCK_SIZE + STREET_WIDTH;
  const extent = Math.ceil(BUILDING_MAX_RADIUS / pitch);
  const lamps = [];

  for (let gx = -extent; gx <= extent; gx++) {
    for (let gz = -extent; gz <= extent; gz++) {
      const cx = gx * pitch;
      const cz = gz * pitch;
      const dist = Math.hypot(cx, cz);
      if (dist > BUILDING_MAX_RADIUS) continue;

      // Lamps at the block corner (street intersections)
      const lx = cx + pitch / 2 - STREET_WIDTH * 0.15;
      const lz = cz + pitch / 2 - STREET_WIDTH * 0.15;
      if (Math.hypot(lx, lz) < BUILDING_MAX_RADIUS) lamps.push({ x: lx, z: lz });

      if (dist < BUILDING_MIN_RADIUS) continue;

      // Taller towers cluster toward the middle ring, like a downtown
      const downtown = 1 - Math.min(1, (dist - BUILDING_MIN_RADIUS) / (BUILDING_MAX_RADIUS - BUILDING_MIN_RADIUS));
      const heightFor = () => 6 + Math.random() * 14 + Math.pow(Math.random(), 1.5) * 34 * (0.4 + downtown * 0.8);

      // Split a block into 1, 2 or 4 lots
      const split = Math.random();
      const lots = split < 0.4 ? [[0, 0, 1, 1]]
        : split < 0.75 ? [[-0.25, 0, 0.5, 1], [0.25, 0, 0.5, 1]]
        : [[-0.25, -0.25, 0.5, 0.5], [0.25, -0.25, 0.5, 0.5], [-0.25, 0.25, 0.5, 0.5], [0.25, 0.25, 0.5, 0.5]];

      for (const [ox, oz, fw, fd] of lots) {
        const gap = 1.2;
        const w = BLOCK_SIZE * fw - gap * (0.6 + Math.random() * 0.8);
        const d = BLOCK_SIZE * fd - gap * (0.6 + Math.random() * 0.8);
        const h = heightFor();
        buildings.push(createBuilding(scene, cx + ox * BLOCK_SIZE, cz + oz * BLOCK_SIZE, w, h, d));
      }
    }
  }

  createStreetLights(scene, lamps, glowTexture);

  // Searchlight-style uplights at the edge of the open centre
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spot = new THREE.SpotLight(COLORS.NEON[i % COLORS.NEON.length], 900, 90, Math.PI / 7, 0.6, 1.6);
    spot.position.set(Math.cos(angle) * 34, 0.5, Math.sin(angle) * 34);
    spot.target.position.set(Math.cos(angle) * 48, 30, Math.sin(angle) * 48);
    scene.add(spot, spot.target);
  }

  return buildings;
}
