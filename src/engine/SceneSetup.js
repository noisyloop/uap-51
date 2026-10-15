import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { COLORS, GAME_CONFIG } from '../utils/constants';

/**
 * Scene Setup Module
 *
 * Creates and configures the Three.js scene, camera, renderer,
 * post-processing composer, and static environment elements
 * (ground, starfield, moon, nebula).
 */

/**
 * Create the Three.js scene with fog and base lighting
 */
export function createScene() {
  const scene = new THREE.Scene();
  // Hazy night air: distant blocks fade into the city's light pollution
  scene.fog = new THREE.FogExp2(COLORS.FOG, 0.011);
  scene.background = new THREE.Color(COLORS.FOG);

  // Cool sky from above, warm sodium bounce from the streets below
  scene.add(new THREE.HemisphereLight(0x4a5a8c, 0x3a2414, 0.55));

  // Moonlight: the key light that gives every facade a lit and a shaded side
  const moonLight = new THREE.DirectionalLight(0xa8b8ff, 0.9);
  moonLight.position.set(-60, 80, -40);
  scene.add(moonLight);

  return scene;
}

/**
 * Sky dome: a gradient from black-blue at the zenith to the orange-violet
 * glow that city lights throw onto low haze at the horizon. Its horizon
 * colour matches the fog so buildings dissolve into the sky.
 */
export function createSky(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(480, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        zenith: { value: new THREE.Color(COLORS.SKY_ZENITH) },
        mid: { value: new THREE.Color(COLORS.SKY_MID) },
        horizon: { value: new THREE.Color(COLORS.FOG) },
        glow: { value: new THREE.Color(COLORS.SKY_GLOW) }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 zenith, mid, horizon, glow;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
          col = mix(col, zenith, smoothstep(0.15, 0.7, h));
          // Light-pollution band hugging the horizon
          col += glow * exp(-h * 14.0) * 0.9;
          gl_FragColor = vec4(col, 1.0);
        }`
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);
  return sky;
}

/**
 * Create the perspective camera
 */
export function createCamera() {
  return new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
}

/**
 * Create the WebGL renderer attached to a canvas element
 */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  return renderer;
}

/**
 * Environment map for reflections. Instead of a generic studio room,
 * bake a small night-city scene: the gradient sky plus a ring of
 * glowing panels at the horizon standing in for neon signs and lit
 * windows. Wet streets, glass and the saucer hull reflect it.
 */
export function applyEnvironment(renderer, scene) {
  const envScene = new THREE.Scene();
  createSky(envScene);

  const panelGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2 + Math.random() * 0.1;
    const neon = Math.random() < 0.3;
    const color = neon
      ? new THREE.Color(COLORS.NEON[i % COLORS.NEON.length]).multiplyScalar(2.5)
      : new THREE.Color(Math.random() < 0.5 ? 0xffc88a : 0xbcd2ff).multiplyScalar(0.6 + Math.random());
    const panel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    const r = 60;
    const h = 4 + Math.random() * 18;
    panel.scale.set(3 + Math.random() * 6, neon ? 1.5 : h, 1);
    panel.position.set(Math.cos(angle) * r, neon ? 4 + Math.random() * 20 : h / 2, Math.sin(angle) * r);
    panel.lookAt(0, panel.position.y, 0);
    envScene.add(panel);
  }
  // Warm street glow on the ground plane of the env
  const street = new THREE.Mesh(
    new THREE.CircleGeometry(80, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a200c) })
  );
  street.rotation.x = -Math.PI / 2;
  street.position.y = -2;
  envScene.add(street);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
}

/**
 * Film finish applied after tone mapping: a gentle vignette and fine
 * animated grain, which hides banding in the dark sky gradient.
 */
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grain: { value: 0.035 },
    vignette: { value: 0.35 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time, grain, vignette;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * vignette * 2.0;
      c.rgb += (rand(vUv * 1000.0 + fract(time)) - 0.5) * grain;
      gl_FragColor = c;
    }`
};

/**
 * Create the post-processing chain: render -> bloom -> output -> film.
 * The render target is multisampled so edges stay anti-aliased
 * (the canvas's own antialias is bypassed once a composer is used).
 */
export function createComposer(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55,   // strength
    0.4,    // radius
    0.82    // threshold — only light sources bloom, not lit facades
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const film = new ShaderPass(FilmShader);
  composer.addPass(film);
  composer.film = film;
  return composer;
}

/**
 * Paint a tile of city ground: asphalt streets with lane markings,
 * concrete sidewalks around each block, and a roughness map with
 * puddles so the wet road mirrors the neon and street lamps.
 * One tile covers one block + street pitch.
 */
function createStreetTextures() {
  const { BLOCK_SIZE, STREET_WIDTH } = GAME_CONFIG;
  const pitch = BLOCK_SIZE + STREET_WIDTH;
  const S = 512;
  const px = S / pitch;              // pixels per world unit
  const street = STREET_WIDTH * px;
  const curb = 1.4 * px;

  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return [c, c.getContext('2d')];
  };
  const [colorC, c] = make();
  const [roughC, r] = make();

  // Asphalt with speckle
  c.fillStyle = '#16171a';
  c.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const v = 10 + Math.random() * 28;
    c.fillStyle = `rgba(${v},${v},${v + 2},0.6)`;
    c.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  r.fillStyle = 'rgb(170,170,170)';
  r.fillRect(0, 0, S, S);

  // Block (the street runs along the tile edges, centred on 0/S)
  const half = street / 2;
  c.fillStyle = '#2b2b2e';           // sidewalk concrete
  c.fillRect(half, half, S - street, S - street);
  c.fillStyle = '#1e1e21';           // block interior / lot
  c.fillRect(half + curb, half + curb, S - street - curb * 2, S - street - curb * 2);
  r.fillStyle = 'rgb(215,215,215)';
  r.fillRect(half, half, S - street, S - street);

  // Lane markings: dashed centre lines along both streets
  c.fillStyle = 'rgba(210,180,90,0.7)';
  for (let t = 0; t < S; t += px * 3) {
    c.fillRect(t, -1, px * 1.6, 2.5);
    c.fillRect(t, S - 1.5, px * 1.6, 2.5);
    c.fillRect(-1, t, 2.5, px * 1.6);
    c.fillRect(S - 1.5, t, 2.5, px * 1.6);
  }
  // Crosswalk stripes near the intersection
  c.fillStyle = 'rgba(200,200,200,0.45)';
  for (let k = 0; k < 6; k++) {
    const o = half - street * 0.45 + k * (street * 0.9 / 6);
    c.fillRect(o + S * 0, half + 2, street * 0.08, px * 1.5);
  }

  // Puddles: smooth (dark) blobs in the roughness map
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const rad = 14 + Math.random() * 34;
    const g = r.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(60,60,60,0.8)');
    g.addColorStop(0.6, 'rgba(90,90,90,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    r.fillStyle = g;
    r.beginPath();
    r.ellipse(x, y, rad * 1.6, rad, Math.random() * Math.PI, 0, Math.PI * 2);
    r.fill();
  }

  const tex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(colorC, true), roughnessMap: tex(roughC, false), pitch };
}

/**
 * Create the wet street-grid ground
 */
export function createGround(scene) {
  const size = 800;
  const { map, roughnessMap, pitch } = createStreetTextures();
  const repeat = size / pitch;
  [map, roughnessMap].forEach(t => {
    t.repeat.set(repeat, repeat);
    // Align tile edges (streets) with the city grid around the origin
    const o = (0.5 - ((size / 2) / pitch % 1) + 1) % 1;
    t.offset.set(o, o);
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      roughness: 1,
      metalness: 0.15,
      envMapIntensity: 1.4
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);
}

/**
 * Build a soft radial-gradient texture, used for star sprites,
 * nebula clouds and glow halos.
 */
export function createGlowTexture(innerColor, outerColor) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.4, outerColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Create the night sky: twinkling starfield, moon, and nebula clouds.
 * Returns references used by VisualEffects for animation.
 */
export function createStars(scene) {
  const geometry = new THREE.BufferGeometry();
  const count = 5000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.6;
    const r = 200 + Math.random() * 200;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const color = new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.15, 0.6 + Math.random() * 0.4);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const starTexture = createGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)');
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 1.2,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending
    })
  );
  scene.add(stars);

  // Moon with halo
  const moon = new THREE.Group();
  moon.add(new THREE.Mesh(
    new THREE.SphereGeometry(14, 32, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdde4ff).multiplyScalar(1.4), fog: false })
  ));
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createGlowTexture('rgba(200,215,255,0.8)', 'rgba(120,140,255,0.15)'),
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending
  }));
  moonHalo.scale.setScalar(70);
  moon.add(moonHalo);
  moon.position.set(-160, 140, -220);
  scene.add(moon);

  // Nebula clouds: large tinted sprites drifting in the distance
  const nebulaTints = [
    ['rgba(180,60,255,0.30)', 'rgba(80,0,160,0.08)'],
    ['rgba(0,200,255,0.25)', 'rgba(0,60,160,0.07)'],
    ['rgba(255,60,180,0.22)', 'rgba(120,0,80,0.06)']
  ];
  const nebulae = [];
  for (let i = 0; i < 9; i++) {
    const [inner, outer] = nebulaTints[i % nebulaTints.length];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowTexture(inner, outer),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    const angle = (i / 9) * Math.PI * 2;
    const radius = 220 + Math.random() * 120;
    sprite.position.set(
      Math.cos(angle) * radius,
      60 + Math.random() * 120,
      Math.sin(angle) * radius
    );
    sprite.scale.setScalar(90 + Math.random() * 120);
    sprite.userData.baseOpacity = 0.12 + Math.random() * 0.12;
    sprite.material.fog = false;
    scene.add(sprite);
    nebulae.push(sprite);
  }

  return { stars, nebulae };
}
