import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { WeatherEffect } from '../types';

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    return /SwiftShader|llvmpipe|softpipe|Software/i.test(renderer);
  } catch {
    return false;
  }
}

function createTaperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments = 20,
  radiusStart = 0.2,
  radiusEnd = 0.02,
  radialSegments = 10,
  taperPower = 1.0,
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const vertexCount = (tubularSegments + 1) * (radialSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const normal = new THREE.Vector3();

  let vPtr = 0;
  let uvPtr = 0;
  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(u, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = THREE.MathUtils.lerp(radiusStart, radiusEnd, Math.pow(u, taperPower));

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = -Math.cos(theta);

      normal.x = cos * N.x + sin * B.x;
      normal.y = cos * N.y + sin * B.y;
      normal.z = cos * N.z + sin * B.z;
      normal.normalize();

      normals[vPtr] = normal.x;
      normals[vPtr + 1] = normal.y;
      normals[vPtr + 2] = normal.z;

      positions[vPtr] = P.x + r * normal.x;
      positions[vPtr + 1] = P.y + r * normal.y;
      positions[vPtr + 2] = P.z + r * normal.z;
      vPtr += 3;

      uvs[uvPtr] = v;
      uvs[uvPtr + 1] = u;
      uvPtr += 2;
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

function createSingleLeafMesh(length = 0.7, width = 0.36, colorHex = 0x8ef564) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.55, length * 0.25, width * 0.5, length * 0.72, 0, length);
  shape.bezierCurveTo(-width * 0.5, length * 0.72, -width * 0.55, length * 0.25, 0, 0);

  const geo = new THREE.ShapeGeometry(shape, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const fold = Math.abs(x) * 0.24 - Math.pow(y / length, 2) * 0.08;
    pos.setZ(i, fold);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.14,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function createStylizedFoliageCluster(radius: number, bottomHex: number, topHex: number, seed = 0) {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cBot = new THREE.Color(bottomHex);
  const cTop = new THREE.Color(topHex);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const n =
      1.0 +
      0.14 * Math.sin(x * 5.0 + seed) * Math.cos(z * 5.0 - seed) +
      0.08 * Math.sin(y * 6.0 + seed);
    x *= n;
    y *= n * 0.88;
    z *= n;
    pos.setXYZ(i, x, y, z);

    const t = THREE.MathUtils.clamp((y / radius + 1.0) * 0.5, 0, 1);
    tmp.lerpColors(cBot, cTop, Math.pow(t, 0.85));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.68,
      metalness: 0.03,
      flatShading: true,
    }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWillowStrandGeometry() {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const leafPairs = 4;
  const strandLen = 0.78;
  let vOffset = 0;

  for (let p = 0; p < leafPairs; p++) {
    const tTop = p / leafPairs;
    const yTop = -tTop * (strandLen * 0.76);
    const yBot = yTop - strandLen * 0.34;
    const yMid = (yTop + yBot) * 0.5;
    const w = 0.135 * (1.0 - tTop * 0.25);
    const rotY = p * 1.15;
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);

    const localVerts: [number, number, number, number, number][] = [
      [0, yTop, 0, 0.5, 1.0 - tTop],
      [-w, yMid, 0.025, 0.0, 1.0 - (tTop + 0.15)],
      [0, yBot, 0.01, 0.5, Math.max(0, 1.0 - (tTop + 0.32))],
      [w, yMid, 0.025, 1.0, 1.0 - (tTop + 0.15)],
    ];

    localVerts.forEach(([lx, ly, lz, u, v]) => {
      const rx = lx * cosR - lz * sinR;
      const rz = lx * sinR + lz * cosR;
      positions.push(rx, ly, rz);
      normals.push(sinR * 0.3, 0.45, cosR * 0.85);
      uvs.push(u, v);
    });

    indices.push(vOffset, vOffset + 1, vOffset + 2, vOffset, vOffset + 2, vOffset + 3);
    vOffset += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function createRuneCircleTexture(primaryColor = '#ffcf56', secondaryColor = '#d98a1c', isSupreme = true) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.5, 0.5);

  const drawRing = (r: number, width: number, color: string, dash: number[] = []) => {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawRing(465, 5, primaryColor);
  drawRing(445, 2.5, secondaryColor, [16, 10]);
  drawRing(365, 4, primaryColor);
  drawRing(255, 3, secondaryColor);
  drawRing(155, 2.5, primaryColor, [8, 8]);

  const drawPolygon = (sides: number, radius: number, rot: number, color: string, width = 3) => {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawPolygon(6, 365, 0, primaryColor, 2.5);
  drawPolygon(6, 365, Math.PI / 6, secondaryColor, 2.5);
  if (isSupreme) {
    drawPolygon(8, 255, 0, primaryColor, 2);
    drawPolygon(8, 255, Math.PI / 8, secondaryColor, 2);
  }

  const glyphs = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ'];
  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 24px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -405);
    ctx.fillText(glyphs[i % glyphs.length], 0, 0);
    ctx.restore();
  }

  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSoftGlowTexture(innerColor = '#ffffff', outerColor = 'rgba(255,255,255,0)') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, innerColor);
  grad.addColorStop(0.35, innerColor);
  grad.addColorStop(1.0, outerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSnowflakeTexture() {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  glow.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  glow.addColorStop(0.35, 'rgba(224, 244, 255, 0.85)');
  glow.addColorStop(0.75, 'rgba(186, 230, 253, 0.28)');
  glow.addColorStop(1.0, 'rgba(186, 230, 253, 0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -size * 0.34);
    ctx.moveTo(0, -size * 0.2);
    ctx.lineTo(-size * 0.08, -size * 0.27);
    ctx.moveTo(0, -size * 0.2);
    ctx.lineTo(size * 0.08, -size * 0.27);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createAutumnLeafGeometry() {
  const w = 0.14;
  const l = 0.28;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(w * 0.72, l * 0.24, w * 0.65, l * 0.74, 0, l);
  shape.bezierCurveTo(-w * 0.65, l * 0.74, -w * 0.72, l * 0.24, 0, 0);

  const geo = new THREE.ShapeGeometry(shape, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const fold = Math.abs(x) * 0.26 - Math.pow(y / l, 2) * 0.06;
    pos.setZ(i, fold);
  }
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

function createScaleBumpTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 8;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const cx = (c + (r % 2) * 0.5) * cellW;
      const cy = r * cellH;
      const grad = ctx.createRadialGradient(cx, cy - cellH * 0.15, 2, cx, cy, cellW * 0.65);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#9a9a9a');
      grad.addColorStop(1, '#303030');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, cellW * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 26);
  tex.needsUpdate = true;
  return tex;
}

interface DragonConfig {
  isChibi: boolean;
  maxRadius: number;
  orbitRadius: number;
  baseHeight: number;
  verticalPitch: number;
  waveAmp: number;
  orbitSpeed: number;
  arcSpan: number;
  headScale: number;
  primary: number;
  belly: number;
  mane: number;
  horn: number;
}

class SeamlessEasternDragon {
  private scene: THREE.Scene;
  private level = 1;
  private root = new THREE.Group();
  private tubularSegments = 96;
  private radialSegments = 18;
  private bodyGeo: THREE.BufferGeometry | null = null;
  private bodyMesh: THREE.Mesh | null = null;
  private headGroup: THREE.Group | null = null;
  private headHalo: THREE.Mesh | null = null;
  private tailPlumeGroup: THREE.Group | null = null;
  private breathSystem: { points: THREE.Points; count: number; phases: Float32Array } | null = null;
  private trailSystem: { points: THREE.Points; count: number; writeIdx: number; initialized: boolean } | null = null;
  private dorsalSpines: { mesh: THREE.Object3D; u: number; offsetY: number }[] = [];
  private spineManeTufts: { mesh: THREE.Object3D; u: number; offsetY: number }[] = [];
  private legs: { pivot: THREE.Group; u: number; side: number; isFront: boolean; isChibi: boolean }[] = [];
  private whiskers: { mesh: THREE.Object3D; side: number }[] = [];
  private silkRibbons: { mesh: THREE.Mesh; ribbonSegs: number; phaseOffset: number }[] = [];
  private descentAnim = { active: false, time: 0, duration: 2.8 };
  private scaleBumpTex: THREE.CanvasTexture;
  private config: DragonConfig;

  // Pre-allocated scratch buffers for zero-GC update loop
  private spinePts: THREE.Vector3[] = [];
  private tangents: THREE.Vector3[] = [];
  private normals: THREE.Vector3[] = [];
  private binormals: THREE.Vector3[] = [];
  private tmpVec = new THREE.Vector3();
  private tmpRadial = new THREE.Vector3();
  private tmpAhead = new THREE.Vector3();
  private tmpWorldUp = new THREE.Vector3(0, 1, 0);
  private tmpRotAxis = new THREE.Vector3();
  private tmpRotQuat = new THREE.Quaternion();
  private tmpMatrix = new THREE.Matrix4();
  private tmpForward = new THREE.Vector3();
  private tmpDotVec = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.root);
    this.scaleBumpTex = createScaleBumpTexture();
    this.config = this.getLevelConfig(1);
    for (let i = 0; i <= this.tubularSegments; i++) {
      this.spinePts.push(new THREE.Vector3());
      this.tangents.push(new THREE.Vector3());
      this.normals.push(new THREE.Vector3());
      this.binormals.push(new THREE.Vector3());
    }
  }

  getLevelConfig(level: number): DragonConfig {
    const isChibi = level <= 7;
    if (isChibi) {
      const t = (level - 1) / 6;
      const palettes = [
        { primary: 0x4ee68a, belly: 0xdfffe8, mane: 0x9effb8, horn: 0xffe89e },
        { primary: 0x62eb7a, belly: 0xeaffd9, mane: 0xb8ff94, horn: 0xffe89e },
        { primary: 0x38d9a9, belly: 0xd8fff5, mane: 0x8efce0, horn: 0xffe082 },
        { primary: 0x3bc9db, belly: 0xdcfaff, mane: 0x99f3ff, horn: 0xffe082 },
        { primary: 0x5c9eff, belly: 0xe3f0ff, mane: 0xa8ceff, horn: 0xffdf73 },
        { primary: 0xa875ff, belly: 0xf2e6ff, mane: 0xd5b8ff, horn: 0xffdf73 },
        { primary: 0xff85b3, belly: 0xfff0f6, mane: 0xffc2da, horn: 0xffe599 },
      ];
      const pal = palettes[level - 1];
      return {
        isChibi: true,
        maxRadius: THREE.MathUtils.lerp(0.16, 0.24, t),
        orbitRadius: THREE.MathUtils.lerp(2.3, 3.8, t),
        baseHeight: THREE.MathUtils.lerp(1.4, 3.3, t),
        verticalPitch: THREE.MathUtils.lerp(0.28, 0.52, t),
        waveAmp: THREE.MathUtils.lerp(0.14, 0.24, t),
        orbitSpeed: THREE.MathUtils.lerp(0.75, 0.62, t),
        arcSpan: THREE.MathUtils.lerp(1.05, 1.45, t),
        headScale: THREE.MathUtils.lerp(0.88, 1.12, t),
        ...pal,
      };
    }

    if (level <= 9) {
      const is9 = level === 9;
      return {
        isChibi: false,
        maxRadius: is9 ? 0.29 : 0.26,
        orbitRadius: is9 ? 5.1 : 4.7,
        baseHeight: is9 ? 4.3 : 3.9,
        verticalPitch: 0.72,
        waveAmp: 0.34,
        orbitSpeed: 0.54,
        arcSpan: is9 ? 2.25 : 2.05,
        headScale: is9 ? 1.15 : 1.05,
        primary: is9 ? 0x3c2a85 : 0x34468c,
        belly: 0x7df9ff,
        mane: 0xd580ff,
        horn: 0xffe082,
      };
    }

    return {
      isChibi: false,
      maxRadius: 0.33,
      orbitRadius: 5.55,
      baseHeight: 4.85,
      verticalPitch: 0.85,
      waveAmp: 0.38,
      orbitSpeed: 0.5,
      arcSpan: 2.55,
      headScale: 1.24,
      primary: 0xf4f8ff,
      belly: 0xfff4d6,
      mane: 0x1ef2b8,
      horn: 0xd99b26,
    };
  }

  private createMaterials(level: number) {
    const cfg = this.config;
    const isLevel10 = level === 10;

    return {
      bodyMat: new THREE.MeshStandardMaterial({
        vertexColors: true,
        bumpMap: this.scaleBumpTex,
        bumpScale: isLevel10 ? 0.028 : cfg.isChibi ? 0.006 : 0.02,
        roughness: isLevel10 ? 0.24 : cfg.isChibi ? 0.42 : 0.32,
        metalness: isLevel10 ? 0.48 : cfg.isChibi ? 0.05 : 0.28,
        emissive: isLevel10 ? 0x0b3d30 : cfg.isChibi ? 0x000000 : 0x181438,
        emissiveIntensity: isLevel10 ? 0.26 : cfg.isChibi ? 0.0 : 0.28,
      }),
      headMat: new THREE.MeshStandardMaterial({
        color: cfg.primary,
        roughness: isLevel10 ? 0.22 : cfg.isChibi ? 0.38 : 0.3,
        metalness: isLevel10 ? 0.5 : cfg.isChibi ? 0.05 : 0.28,
        emissive: isLevel10 ? 0x0e4738 : 0x000000,
        emissiveIntensity: isLevel10 ? 0.22 : 0.0,
      }),
      muzzleMat: new THREE.MeshStandardMaterial({
        color: cfg.belly,
        roughness: 0.36,
        metalness: isLevel10 ? 0.32 : 0.08,
      }),
      maneMat: new THREE.MeshStandardMaterial({
        color: cfg.mane,
        emissive: isLevel10 ? 0x00c888 : cfg.mane,
        emissiveIntensity: isLevel10 ? 1.15 : cfg.isChibi ? 0.25 : 0.85,
        roughness: 0.32,
      }),
      hornMat: new THREE.MeshStandardMaterial({
        color: cfg.horn,
        emissive: isLevel10 ? 0x8f5d08 : 0x4a3508,
        emissiveIntensity: isLevel10 ? 0.42 : 0.25,
        roughness: 0.24,
        metalness: isLevel10 ? 0.78 : 0.45,
      }),
      jadeAccentMat: new THREE.MeshStandardMaterial({
        color: 0x3dffbe,
        emissive: 0x00d48f,
        emissiveIntensity: 1.25,
        roughness: 0.2,
      }),
    };
  }

  clearDragon() {
    while (this.root.children.length > 0) {
      this.root.remove(this.root.children[0]);
    }
    if (this.trailSystem) {
      this.scene.remove(this.trailSystem.points);
      this.trailSystem = null;
    }
    this.bodyGeo = null;
    this.bodyMesh = null;
    this.headGroup = null;
    this.headHalo = null;
    this.tailPlumeGroup = null;
    this.breathSystem = null;
    this.dorsalSpines = [];
    this.spineManeTufts = [];
    this.legs = [];
    this.whiskers = [];
    this.silkRibbons = [];
  }

  build(level: number) {
    this.level = level;
    this.clearDragon();
    this.config = this.getLevelConfig(level);
    const mat = this.createMaterials(level);

    this.initSeamlessBodyMesh(mat.bodyMat, this.config.primary, this.config.belly);
    if (this.config.isChibi) {
      this.buildChibiHeadAndLimbs(mat);
    } else {
      this.buildDivineHeadAndLimbs(mat, level === 10);
    }
    this.initTrailParticles(level);
  }

  private buildChibiHeadAndLimbs(mat: ReturnType<SeamlessEasternDragon['createMaterials']>) {
    this.headGroup = new THREE.Group();
    this.headGroup.scale.setScalar(this.config.headScale);
    this.root.add(this.headGroup);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.27, 22, 18), mat.headMat);
    cranium.scale.set(1.04, 0.96, 1.08);
    cranium.castShadow = true;
    this.headGroup.add(cranium);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), mat.muzzleMat);
    snout.position.set(0, -0.05, 0.22);
    snout.scale.set(1.12, 0.78, 0.95);
    this.headGroup.add(snout);

    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.65 });
    const eyeBlackMat = new THREE.MeshStandardMaterial({ color: 0x111526, roughness: 0.1, metalness: 0.1 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), cheekMat);
      cheek.position.set(side * 0.17, -0.05, 0.17);
      cheek.scale.set(1.1, 0.7, 0.6);
      this.headGroup!.add(cheek);

      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.135, 0.04, 0.21);
      eyeGroup.rotation.y = side * 0.32;

      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 16), eyeBlackMat);
      eyeball.scale.set(0.92, 1.12, 0.75);
      eyeGroup.add(eyeball);

      const sparkleMain = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), eyeWhiteMat);
      sparkleMain.position.set(side * -0.015, 0.025, 0.045);
      eyeGroup.add(sparkleMain);

      const sparkleSub = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyeWhiteMat);
      sparkleSub.position.set(side * 0.018, -0.018, 0.045);
      eyeGroup.add(sparkleSub);

      this.headGroup!.add(eyeGroup);

      const hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.1, 0.18, -0.02),
        new THREE.Vector3(side * 0.15, 0.3, -0.1),
      ]);
      this.headGroup!.add(new THREE.Mesh(createTaperedTube(hornCurve, 8, 0.042, 0.014, 8), mat.hornMat));

      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), mat.maneMat);
      ear.position.set(side * 0.23, 0.06, -0.04);
      ear.rotation.z = -side * 1.1;
      ear.rotation.x = -0.3;
      this.headGroup!.add(ear);
    });

    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), mat.maneMat);
      puff.position.set(Math.cos(ang) * 0.18, Math.sin(ang) * 0.17 - 0.02, -0.16);
      puff.scale.set(1.0, 1.0, 1.25);
      this.headGroup.add(puff);
    }

    for (let s = 0; s < 7; s++) {
      const u = 0.16 + (s / 6) * 0.66;
      const rAtU = this.getBodyRadiusAt(u);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(rAtU * 0.38, 10, 8), mat.maneMat);
      fin.scale.set(0.45, 0.95, 1.2);
      this.root.add(fin);
      this.dorsalSpines.push({ mesh: fin, u, offsetY: rAtU * 0.88 });
    }

    this.tailPlumeGroup = new THREE.Group();
    const tailPuff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), mat.maneMat);
    tailPuff.scale.set(0.9, 0.9, 1.45);
    tailPuff.position.z = -0.06;
    this.tailPlumeGroup.add(tailPuff);
    this.root.add(this.tailPlumeGroup);

    [
      { u: 0.24, isFront: true },
      { u: 0.62, isFront: false },
    ].forEach((cfg) => {
      const rAtU = this.getBodyRadiusAt(cfg.u);
      [-1, 1].forEach((side) => {
        const legPivot = new THREE.Group();
        const stubLeg = new THREE.Mesh(new THREE.SphereGeometry(rAtU * 0.56, 14, 12), mat.headMat);
        stubLeg.scale.set(0.92, 1.08, 0.95);
        stubLeg.position.set(side * (rAtU * 0.86), -rAtU * 0.38, 0.02);
        stubLeg.castShadow = true;
        legPivot.add(stubLeg);

        [-0.42, 0.0, 0.42].forEach((angOffset) => {
          const toe = new THREE.Mesh(new THREE.SphereGeometry(rAtU * 0.2, 10, 8), mat.muzzleMat);
          toe.position.set(
            side * (rAtU * 0.92) + Math.sin(angOffset) * (rAtU * 0.28),
            -rAtU * 0.66,
            0.06 + Math.cos(angOffset) * (rAtU * 0.3),
          );
          legPivot.add(toe);
        });

        this.root.add(legPivot);
        this.legs.push({ pivot: legPivot, u: cfg.u, side, isFront: cfg.isFront, isChibi: true });
      });
    });
  }

  private buildDivineHeadAndLimbs(
    mat: ReturnType<SeamlessEasternDragon['createMaterials']>,
    isLevel10: boolean,
  ) {
    this.headGroup = new THREE.Group();
    this.headGroup.scale.setScalar(this.config.headScale);
    this.root.add(this.headGroup);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.44), mat.headMat);
    skull.castShadow = true;
    this.headGroup.add(skull);

    const upperJaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.46), mat.headMat);
    upperJaw.position.set(0, -0.02, 0.36);
    upperJaw.castShadow = true;
    this.headGroup.add(upperJaw);

    if (isLevel10) {
      const noseRidge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.48), mat.hornMat);
      noseRidge.position.set(0, 0.07, 0.36);
      this.headGroup.add(noseRidge);
    }

    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.4), mat.muzzleMat);
    lowerJaw.position.set(0, -0.12, 0.32);
    lowerJaw.rotation.x = 0.08;
    this.headGroup.add(lowerJaw);

    const fangMat = new THREE.MeshStandardMaterial({ color: 0xfffdf5, roughness: 0.2 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: isLevel10 ? 0x3dffbe : 0xffe066,
      emissive: isLevel10 ? 0x00e699 : 0xffaa00,
      emissiveIntensity: 1.4,
    });

    [-1, 1].forEach((side) => {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 6), fangMat);
      fang.position.set(side * 0.09, -0.1, 0.5);
      fang.rotation.x = Math.PI;
      this.headGroup!.add(fang);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 12), eyeMat);
      eye.position.set(side * 0.17, 0.05, 0.2);
      eye.scale.set(0.7, 0.85, 1.2);
      this.headGroup!.add(eye);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.24), mat.hornMat);
      brow.position.set(side * 0.17, 0.11, 0.2);
      brow.rotation.z = -side * 0.25;
      brow.rotation.y = side * 0.15;
      this.headGroup!.add(brow);

      const mainHornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.12, 0.14, -0.05),
        new THREE.Vector3(side * 0.24, 0.34, -0.32),
        new THREE.Vector3(side * 0.3, 0.56, -0.68),
        new THREE.Vector3(side * 0.24, 0.74, -0.96),
      ]);
      this.headGroup!.add(new THREE.Mesh(createTaperedTube(mainHornCurve, 16, 0.048, 0.008, 8), mat.hornMat));

      const branchHornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.23, 0.33, -0.3),
        new THREE.Vector3(side * 0.36, 0.48, -0.38),
        new THREE.Vector3(side * 0.42, 0.62, -0.46),
      ]);
      this.headGroup!.add(new THREE.Mesh(createTaperedTube(branchHornCurve, 10, 0.028, 0.005, 7), mat.hornMat));

      const whiskerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.13, -0.04, 0.5),
        new THREE.Vector3(side * 0.38, -0.08, 0.42),
        new THREE.Vector3(side * 0.58, 0.04, 0.1),
        new THREE.Vector3(side * 0.68, 0.16, -0.25),
      ]);
      const whiskerMesh = new THREE.Mesh(createTaperedTube(whiskerCurve, 18, 0.016, 0.003, 6), mat.maneMat);
      this.headGroup!.add(whiskerMesh);
      this.whiskers.push({ mesh: whiskerMesh, side });
    });

    for (let m = 0; m < 16; m++) {
      const ang = (m / 16) * Math.PI * 2;
      const tuftCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(ang) * 0.18, Math.sin(ang) * 0.15, -0.15),
        new THREE.Vector3(Math.cos(ang) * 0.32, Math.sin(ang) * 0.28 + 0.05, -0.42),
        new THREE.Vector3(Math.cos(ang) * 0.38, Math.sin(ang) * 0.34 + 0.08, -0.68),
      ]);
      this.headGroup.add(new THREE.Mesh(createTaperedTube(tuftCurve, 10, 0.042, 0.006, 6), mat.maneMat));
    }

    if (isLevel10) {
      this.headHalo = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.48, 32),
        new THREE.MeshBasicMaterial({ color: 0xffcf56, side: THREE.DoubleSide, transparent: true, opacity: 0.78 }),
      );
      this.headHalo.position.set(0, 0.12, -0.22);
      this.headGroup.add(this.headHalo);
    }

    const spineCount = isLevel10 ? 22 : 18;
    for (let s = 0; s < spineCount; s++) {
      const u = 0.08 + (s / (spineCount - 1)) * 0.84;
      const rAtU = this.getBodyRadiusAt(u);
      const scaleFactor = Math.sin((s / (spineCount - 1)) * Math.PI) * 0.7 + 0.4;

      const spineMesh = new THREE.Mesh(new THREE.ConeGeometry(rAtU * 0.24, rAtU * 1.15 * scaleFactor, 6), mat.hornMat);
      spineMesh.rotation.x = -0.45;
      this.root.add(spineMesh);
      this.dorsalSpines.push({ mesh: spineMesh, u, offsetY: rAtU * 0.92 });

      if (s % 2 === 0) {
        const maneStreak = new THREE.Mesh(
          new THREE.ConeGeometry(rAtU * 0.28, rAtU * 1.35 * scaleFactor, 6),
          isLevel10 ? mat.jadeAccentMat : mat.maneMat,
        );
        maneStreak.rotation.x = -0.85;
        this.root.add(maneStreak);
        this.spineManeTufts.push({ mesh: maneStreak, u, offsetY: rAtU * 0.85 });
      }
    }

    this.tailPlumeGroup = new THREE.Group();
    for (let t = 0; t < 7; t++) {
      const ang = ((t - 3) / 3) * 0.55;
      const plumeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.sin(ang) * 0.24, Math.cos(ang) * 0.12, -0.48),
        new THREE.Vector3(Math.sin(ang) * 0.42, Math.cos(ang) * 0.2, -0.95),
      ]);
      const plumeMat = isLevel10 && t % 2 === 1 ? mat.hornMat : mat.maneMat;
      this.tailPlumeGroup.add(new THREE.Mesh(createTaperedTube(plumeCurve, 12, 0.045, 0.005, 6), plumeMat));
    }
    this.root.add(this.tailPlumeGroup);

    [
      { u: 0.2, isFront: true },
      { u: 0.62, isFront: false },
    ].forEach((cfg) => {
      const rAtU = this.getBodyRadiusAt(cfg.u);
      [-1, 1].forEach((side) => {
        const legPivot = new THREE.Group();
        const shoulderPt = new THREE.Vector3(side * (rAtU * 0.72), -rAtU * 0.15, 0.0);
        const kneePt = new THREE.Vector3(side * (rAtU + 0.34), -rAtU * 0.34, cfg.isFront ? -0.14 : -0.22);
        const wristPt = new THREE.Vector3(side * (rAtU + 0.3), -rAtU * 0.86, cfg.isFront ? 0.18 : 0.14);

        legPivot.add(
          new THREE.Mesh(
            createTaperedTube(
              new THREE.CatmullRomCurve3([
                shoulderPt,
                new THREE.Vector3(side * (rAtU + 0.2), -rAtU * 0.2, -0.06),
                kneePt,
              ]),
              8,
              rAtU * 0.34,
              rAtU * 0.24,
              8,
            ),
            mat.headMat,
          ),
        );
        legPivot.add(
          new THREE.Mesh(
            createTaperedTube(
              new THREE.CatmullRomCurve3([
                kneePt,
                new THREE.Vector3(side * (rAtU + 0.4), -rAtU * 0.58, 0.02),
                wristPt,
              ]),
              8,
              rAtU * 0.25,
              rAtU * 0.17,
              8,
            ),
            mat.muzzleMat,
          ),
        );

        [-0.58, -0.28, 0.0, 0.28, 0.58].forEach((ca, cIdx) => {
          const clawLen = cIdx === 2 ? 0.32 : 0.27;
          const clawCurve = new THREE.CatmullRomCurve3([
            wristPt,
            new THREE.Vector3(
              wristPt.x + Math.sin(ca) * 0.16,
              wristPt.y - 0.03,
              wristPt.z + Math.cos(ca) * (clawLen * 0.65),
            ),
            new THREE.Vector3(wristPt.x + Math.sin(ca) * 0.21, wristPt.y - 0.18, wristPt.z + Math.cos(ca) * clawLen),
          ]);
          legPivot.add(new THREE.Mesh(createTaperedTube(clawCurve, 7, 0.028, 0.003, 5), mat.hornMat));
        });

        this.root.add(legPivot);
        this.legs.push({ pivot: legPivot, u: cfg.u, side, isFront: cfg.isFront, isChibi: false });
      });
    });

    const ribbonSegs = 48;
    [0, Math.PI].forEach((phaseOffset, idx) => {
      const rGeo = new THREE.BufferGeometry();
      const rVerts = new Float32Array((ribbonSegs + 1) * 2 * 3);
      const rIndices: number[] = [];
      for (let s = 0; s < ribbonSegs; s++) {
        const a = s * 2;
        rIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      rGeo.setIndex(rIndices);
      rGeo.setAttribute('position', new THREE.BufferAttribute(rVerts, 3));

      const rMat = new THREE.MeshBasicMaterial({
        color: isLevel10 ? (idx === 0 ? 0x1ef2b8 : 0xffcf56) : idx === 0 ? 0x7df9ff : 0xe08aff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.frustumCulled = false;
      this.root.add(rMesh);
      this.silkRibbons.push({ mesh: rMesh, ribbonSegs, phaseOffset });
    });

    const bCount = 24;
    const bPos = new Float32Array(bCount * 3);
    const bPhases = new Float32Array(bCount);
    for (let i = 0; i < bCount; i++) bPhases[i] = i / bCount;
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    const bPoints = new THREE.Points(
      bGeo,
      new THREE.PointsMaterial({
        size: 0.14,
        map: createSoftGlowTexture(isLevel10 ? '#5ef2ff' : '#d580ff', 'rgba(255,255,255,0)'),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.headGroup.add(bPoints);
    this.breathSystem = { points: bPoints, count: bCount, phases: bPhases };
  }

  private initTrailParticles(level: number) {
    const count = level === 10 ? 55 : level >= 8 ? 40 : 22;
    const positions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colorHex = level === 10 ? '#1ef2b8' : level >= 8 ? '#7df9ff' : '#a8ff78';
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: level === 10 ? 0.24 : 0.18,
        map: createSoftGlowTexture(colorHex, 'rgba(255,255,255,0)'),
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.frustumCulled = false;
    this.scene.add(points);
    this.trailSystem = { points, count, writeIdx: 0, initialized: false };
  }

  private getBodyRadiusAt(u: number): number {
    const maxR = this.config.maxRadius;
    const chestSwelling = 1.0 + 0.16 * Math.exp(-Math.pow((u - 0.14) / 0.12, 2));
    const taper = Math.pow(Math.max(1.0 - u * 0.94, 0.03), 0.72);
    return maxR * chestSwelling * taper;
  }

  private initSeamlessBodyMesh(material: THREE.MeshStandardMaterial, primaryHex: number, bellyHex: number) {
    const tSegs = this.tubularSegments;
    const rSegs = this.radialSegments;
    const vertexCount = (tSegs + 1) * (rSegs + 1);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices: number[] = [];

    const cBack = new THREE.Color(primaryHex);
    const cBelly = new THREE.Color(bellyHex);
    const tempCol = new THREE.Color();

    let ptr = 0;
    let uvPtr = 0;
    for (let i = 0; i <= tSegs; i++) {
      const u = i / tSegs;
      for (let j = 0; j <= rSegs; j++) {
        const v = j / rSegs;
        const theta = v * Math.PI * 2;
        const bellyFactor = THREE.MathUtils.clamp((-Math.cos(theta) + 1.0) * 0.5, 0, 1);
        tempCol.lerpColors(cBack, cBelly, Math.pow(bellyFactor, 1.3));
        colors[ptr] = tempCol.r;
        colors[ptr + 1] = tempCol.g;
        colors[ptr + 2] = tempCol.b;
        ptr += 3;
        uvs[uvPtr] = v;
        uvs[uvPtr + 1] = u;
        uvPtr += 2;
      }
    }

    const stride = rSegs + 1;
    for (let i = 0; i < tSegs; i++) {
      for (let j = 0; j < rSegs; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        indices.push(a, b, d, b, c, d);
      }
    }

    this.bodyGeo = new THREE.BufferGeometry();
    this.bodyGeo.setIndex(indices);
    this.bodyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.bodyGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    this.bodyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    this.bodyMesh = new THREE.Mesh(this.bodyGeo, material);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.frustumCulled = false;
    this.root.add(this.bodyMesh);
  }

  private evaluatePathPoint(out: THREE.Vector3, phase: number, elapsed: number, uAlongBody = 0) {
    const { orbitRadius, baseHeight, verticalPitch, waveAmp } = this.config;
    let orbitR = orbitRadius + Math.sin(phase * 1.5) * 0.42;
    let orbitY = baseHeight + Math.sin(phase * 1.2) * verticalPitch + Math.cos(phase * 2.4) * 0.32;

    if (this.descentAnim.active) {
      const p = this.descentAnim.time / this.descentAnim.duration;
      orbitY =
        p < 0.55
          ? THREE.MathUtils.lerp(10.5, 2.2, p / 0.55)
          : THREE.MathUtils.lerp(2.2, orbitY, (p - 0.55) / 0.45);
      orbitR =
        p < 0.55
          ? THREE.MathUtils.lerp(3.2, 5.1, p / 0.55)
          : THREE.MathUtils.lerp(5.1, orbitR, (p - 0.55) / 0.45);
      orbitY -= uAlongBody * 1.4;
    }

    out.set(Math.cos(phase) * orbitR, orbitY, Math.sin(phase) * orbitR);
    this.tmpRadial.set(out.x, 0, out.z).normalize();
    const waveFreq = 7.2 + this.level * 0.42;
    const wavePhase = elapsed * 5.0 - uAlongBody * waveFreq;
    const dampNeck = THREE.MathUtils.smoothstep(uAlongBody, 0.0, 0.16);

    out.addScaledVector(this.tmpRadial, Math.sin(wavePhase) * waveAmp * dampNeck);
    out.y += Math.cos(wavePhase * 0.95) * (waveAmp * 0.75) * dampNeck;
  }

  triggerCelebrationSwoop() {
    this.descentAnim = { active: true, time: 0, duration: 2.8 };
  }

  update(dt: number, elapsed: number) {
    if (!this.headGroup || !this.bodyGeo) return;

    if (this.descentAnim.active) {
      this.descentAnim.time += dt;
      if (this.descentAnim.time >= this.descentAnim.duration) this.descentAnim.active = false;
    }

    const speedMult = this.descentAnim.active ? 2.5 : 1.0;
    const headPhase = elapsed * this.config.orbitSpeed * speedMult;
    const arcSpan = this.config.arcSpan;

    const tSegs = this.tubularSegments;
    const rSegs = this.radialSegments;

    for (let i = 0; i <= tSegs; i++) {
      const u = i / tSegs;
      this.evaluatePathPoint(this.spinePts[i], headPhase - u * arcSpan, elapsed, u);
    }

    for (let i = 0; i <= tSegs; i++) {
      const prev = this.spinePts[Math.max(0, i - 1)];
      const next = this.spinePts[Math.min(tSegs, i + 1)];
      this.tangents[i].copy(next).sub(prev).normalize();
    }

    const t0 = this.tangents[0];
    this.tmpDotVec.copy(t0).multiplyScalar(this.tmpWorldUp.dot(t0));
    this.normals[0].copy(this.tmpWorldUp).sub(this.tmpDotVec);
    if (this.normals[0].lengthSq() < 1e-4) this.normals[0].set(1, 0, 0);
    this.normals[0].normalize();
    this.binormals[0].crossVectors(t0, this.normals[0]).normalize();

    for (let i = 1; i <= tSegs; i++) {
      const prevT = this.tangents[i - 1];
      const currT = this.tangents[i];
      const nextN = this.normals[i].copy(this.normals[i - 1]);
      this.tmpRotAxis.crossVectors(prevT, currT);
      if (this.tmpRotAxis.lengthSq() > 1e-8) {
        this.tmpRotAxis.normalize();
        this.tmpRotQuat.setFromAxisAngle(
          this.tmpRotAxis,
          Math.acos(THREE.MathUtils.clamp(prevT.dot(currT), -1, 1)),
        );
        nextN.applyQuaternion(this.tmpRotQuat);
      }
      nextN.lerp(this.tmpWorldUp, 0.04);
      this.tmpDotVec.copy(currT).multiplyScalar(nextN.dot(currT));
      nextN.sub(this.tmpDotVec).normalize();
      this.binormals[i].crossVectors(currT, nextN).normalize();
    }

    const posAttr = this.bodyGeo.attributes.position as THREE.BufferAttribute;
    const normAttr = this.bodyGeo.attributes.normal as THREE.BufferAttribute;
    let vIdx = 0;
    for (let i = 0; i <= tSegs; i++) {
      const u = i / tSegs;
      const r = this.getBodyRadiusAt(u);
      const P = this.spinePts[i];
      const N = this.normals[i];
      const B = this.binormals[i];
      for (let j = 0; j <= rSegs; j++) {
        const theta = (j / rSegs) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const nx = cos * N.x + sin * B.x * 0.92;
        const ny = cos * N.y + sin * B.y * 0.92;
        const nz = cos * N.z + sin * B.z * 0.92;
        const invLen = 1.0 / Math.hypot(nx, ny, nz);
        normAttr.setXYZ(vIdx, nx * invLen, ny * invLen, nz * invLen);
        posAttr.setXYZ(vIdx, P.x + r * nx, P.y + r * ny, P.z + r * nz);
        vIdx++;
      }
    }
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;

    const neckPos = this.spinePts[0];
    this.evaluatePathPoint(this.tmpAhead, headPhase + 0.08, elapsed, 0);
    this.headGroup.position.copy(neckPos);
    this.headGroup.up.set(0, 1, 0);
    this.headGroup.lookAt(this.tmpAhead);

    if (this.headHalo) this.headHalo.rotation.z += dt * 0.9;
    this.whiskers.forEach((w) => {
      w.mesh.rotation.y = Math.sin(elapsed * 4.5 + w.side) * 0.16;
      w.mesh.rotation.x = Math.cos(elapsed * 3.8 + w.side) * 0.1;
    });

    if (this.breathSystem) {
      const bAttr = this.breathSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let b = 0; b < this.breathSystem.count; b++) {
        const p = (this.breathSystem.phases[b] + elapsed * 1.6) % 1.0;
        const side = b % 2 === 0 ? 1 : -1;
        bAttr.setXYZ(
          b,
          side * (0.08 + p * 0.38) + Math.sin(elapsed * 6 + b) * 0.03,
          -0.06 - p * 0.12 + Math.cos(elapsed * 5 + b) * 0.02,
          0.52 + p * 0.55,
        );
      }
      bAttr.needsUpdate = true;
    }

    const alignObjectToSpineU = (obj: THREE.Object3D, u: number, offsetN = 0, offsetB = 0) => {
      const idx = Math.min(tSegs, Math.max(0, Math.round(u * tSegs)));
      const P = this.spinePts[idx];
      const N = this.normals[idx];
      const B = this.binormals[idx];
      this.tmpForward.copy(this.tangents[idx]).negate();
      obj.position.set(
        P.x + N.x * offsetN + B.x * offsetB,
        P.y + N.y * offsetN + B.y * offsetB,
        P.z + N.z * offsetN + B.z * offsetB,
      );
      this.tmpMatrix.makeBasis(B, N, this.tmpForward);
      obj.quaternion.setFromRotationMatrix(this.tmpMatrix);
    };

    this.dorsalSpines.forEach((sp) => alignObjectToSpineU(sp.mesh, sp.u, sp.offsetY, 0));
    this.spineManeTufts.forEach((dm) => alignObjectToSpineU(dm.mesh, dm.u, dm.offsetY, 0));
    this.legs.forEach((leg) => {
      alignObjectToSpineU(leg.pivot, leg.u, 0, 0);
      if (leg.isChibi) {
        leg.pivot.rotateX(Math.sin(elapsed * 6.5 + (leg.isFront ? 0 : Math.PI) + leg.side * 0.5) * 0.28);
      } else {
        leg.pivot.rotateX(Math.sin(elapsed * 4.5 + (leg.isFront ? 0 : 2)) * 0.16);
      }
    });

    if (this.tailPlumeGroup) alignObjectToSpineU(this.tailPlumeGroup, 1.0, 0, 0);

    this.silkRibbons.forEach((rb) => {
      const rPos = rb.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const segs = rb.ribbonSegs;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const idx = Math.min(tSegs, Math.round(t * tSegs));
        const pt = this.spinePts[idx];
        const N = this.normals[idx];
        const B = this.binormals[idx];
        const spiralAngle = t * Math.PI * 6.0 - elapsed * 4.2 + rb.phaseOffset;
        const spiralR = (0.36 + t * 0.24) * (1.0 - t * 0.35);
        const cx = pt.x + (N.x * Math.cos(spiralAngle) + B.x * Math.sin(spiralAngle)) * spiralR;
        const cy = pt.y + (N.y * Math.cos(spiralAngle) + B.y * Math.sin(spiralAngle)) * spiralR;
        const cz = pt.z + (N.z * Math.cos(spiralAngle) + B.z * Math.sin(spiralAngle)) * spiralR;
        const halfW = 0.055 * (1.0 - t * 0.6);
        rPos.setXYZ(s * 2, cx + N.x * halfW, cy + N.y * halfW, cz + N.z * halfW);
        rPos.setXYZ(s * 2 + 1, cx - N.x * halfW, cy - N.y * halfW, cz - N.z * halfW);
      }
      rPos.needsUpdate = true;
    });

    if (this.trailSystem) {
      const tailPos = this.spinePts[tSegs];
      const tAttr = this.trailSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      if (!this.trailSystem.initialized) {
        for (let k = 0; k < this.trailSystem.count; k++) tAttr.setXYZ(k, tailPos.x, tailPos.y, tailPos.z);
        this.trailSystem.initialized = true;
      } else {
        const idx = this.trailSystem.writeIdx;
        const jitter = this.level === 10 ? 0.24 : 0.14;
        tAttr.setXYZ(
          idx,
          tailPos.x + (Math.random() - 0.5) * jitter,
          tailPos.y + (Math.random() - 0.5) * jitter,
          tailPos.z + (Math.random() - 0.5) * jitter,
        );
        this.trailSystem.writeIdx = (idx + 1) % this.trailSystem.count;
      }
      tAttr.needsUpdate = true;
    }
  }
}

export interface XpProgressMeta {
  currentXp: number;
  maxXp: number;
  level: number;
  isMaxLevel?: boolean;
  isCompletedStage?: boolean;
}

export interface TreeTouchPayload {
  boosted: boolean;
  level: number;
  hitPoint: { x: number; y: number; z: number };
}

export class MindfulGardenScene {
  public container: HTMLElement;
  public disposed = false;
  private isSoftwareGl: boolean;
  private isNightTheme = false;
  private animFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private currentLevel = 1;
  private clock = new THREE.Clock();
  private useComposer = true;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private envTarget: THREE.WebGLRenderTarget | null = null;

  private islandGroup!: THREE.Group;
  private treeRootGroup!: THREE.Group;
  private dragon!: SeamlessEasternDragon;

  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  private swayElements: { obj: THREE.Object3D; speed: number; amp: number; phase: number; isIslandProp?: boolean }[] = [];
  private floatingRocks: { mesh: THREE.Object3D; baseY: number; phase: number }[] = [];
  private orbitingIslets: { group: THREE.Group; orbitR: number; baseY: number; angle: number; speed: number; bobPhase: number }[] = [];
  private runeRings: { mesh: THREE.Mesh; speed: number }[] = [];
  private burstSystems: { points: THREE.Points; velocities: THREE.Vector3[]; age: number; maxAge: number }[] = [];
  private shockwaves: { mesh: THREE.Mesh; age: number; maxAge: number; maxScale: number }[] = [];
  private celestialClouds: { group: THREE.Group; angle: number; radius: number; baseY: number; speed: number; phase: number }[] = [];
  private godRays: { mesh: THREE.Mesh; baseRotZ: number; phase: number }[] = [];

  private petalSystem: { points: THREE.Points; count: number; speeds: Float32Array; maxHeight: number } | null = null;
  private fireflySystem: { points: THREE.Points; count: number; phases: Float32Array } | null = null;
  private risingSpiritSystem: { points: THREE.Points; count: number; radii: Float32Array; angles: Float32Array; speeds: Float32Array; maxY: number } | null = null;
  private stardustRainSystem: { points: THREE.Points; count: number; speeds: Float32Array; phases: Float32Array; maxY: number } | null = null;
  private rootDropletSystem: { points: THREE.Points; count: number; tipPositions: THREE.Vector3[]; phases: Float32Array } | null = null;
  private rainShowerSystem: { points: THREE.Points; count: number; speeds: Float32Array; age: number; duration: number } | null = null;

  private activeWeather: WeatherEffect = 'clear';
  private weatherDummy = new THREE.Object3D();
  private weatherSnowSystem: {
    points: THREE.Points;
    count: number;
    speeds: Float32Array;
    swayPhases: Float32Array;
    swayAmps: Float32Array;
    maxY: number;
    radius: number;
  } | null = null;
  private weatherRainSystem: {
    points: THREE.Points;
    count: number;
    speeds: Float32Array;
    maxY: number;
    radius: number;
  } | null = null;
  private weatherLeafMesh: THREE.InstancedMesh | null = null;
  private weatherLeafData: {
    x: Float32Array;
    y: Float32Array;
    z: Float32Array;
    vy: Float32Array;
    rx: Float32Array;
    ry: Float32Array;
    rz: Float32Array;
    vrx: Float32Array;
    vry: Float32Array;
    vrz: Float32Array;
    phase: Float32Array;
    scale: Float32Array;
    count: number;
    maxY: number;
    radius: number;
  } | null = null;
  private weatherSunGroup: THREE.Group | null = null;
  private weatherSunRays: { mesh: THREE.Mesh; baseRotZ: number; phase: number }[] = [];
  private weatherSunMotes: {
    points: THREE.Points;
    count: number;
    phases: Float32Array;
    speeds: Float32Array;
    maxY: number;
    radius: number;
  } | null = null;

  private skyBeamMesh: THREE.Mesh | null = null;
  private summonBeamMesh: THREE.Mesh | null = null;
  private treeHeartGroup: THREE.Group | null = null;
  private cloudSeaGroup: THREE.Group | null = null;
  private godRaysGroup: THREE.Group | null = null;
  private islandMysticProps: THREE.Group | null = null;
  private grassGeo: THREE.BufferGeometry | null = null;

  private treeBounce = { active: false, time: 0 };
  private cameraShake = { active: false, time: 0, intensity: 0 };
  private levelUpSeq = { active: false, level: 1, time: 0, duration: 2.8 };
  private foliageTimeUniform = { value: 0 };
  private xpRingGroup: THREE.Group | null = null;
  private xpRingRadius = 4.1;
  private xpArcUniforms = {
    uProgress: { value: 0 },
    uTime: this.foliageTimeUniform,
    uIsMax: { value: 0 },
    uPulseBoost: { value: 0 },
  };
  private xpLeadOrb: THREE.Group | null = null;
  private xpLeadHalo: THREE.Mesh | null = null;
  private xpMilestoneNodes: { mesh: THREE.Mesh; threshold: number; mat: THREE.MeshStandardMaterial }[] = [];
  private xpBadgeCanvas: HTMLCanvasElement | null = null;
  private xpBadgeCtx: CanvasRenderingContext2D | null = null;
  private xpBadgeTexture: THREE.CanvasTexture | null = null;
  private targetXpProgress = 0;
  private displayedXpProgress = 0;
  private useExternalXpSpring = false;
  private xpRingPulse = { active: false, time: 0, duration: 1.15 };
  private xpInfo: XpProgressMeta = {
    currentXp: 0,
    maxXp: 150,
    level: 1,
    isMaxLevel: false,
    isCompletedStage: false,
  };
  private skyUniforms!: {
    uTime: { value: number };
    uMode: { value: number };
    topColor: { value: THREE.Color };
    midColor: { value: THREE.Color };
    horizonColor: { value: THREE.Color };
    sunColor: { value: THREE.Color };
    sunDir: { value: THREE.Vector3 };
  };
  private camTransition = { active: false, targetY: 2.0, idealDistance: 12.2, tiltOffset: 0 };
  private tmpOffset = new THREE.Vector3();
  private tmpUpAxis = new THREE.Vector3(0, 1, 0);

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private pointerDownState = { active: false, pointerId: -1, x: 0, y: 0, time: 0 };
  private lastHoverRaycast = 0;
  private onTreeTouch?: (payload: TreeTouchPayload) => void;
  private postDeepWorkBlessing = false;
  private treeMaterials: { mat: THREE.MeshStandardMaterial; baseEmissive: THREE.Color; baseIntensity: number }[] = [];
  private touchGlowTarget = new THREE.Color(0x6ee7b7);
  private treeTouchEffect = { active: false, time: 0, duration: 2.3, boosted: false, dirX: 0, dirZ: 0 };
  private touchLeafMesh: THREE.InstancedMesh | null = null;
  private touchLeafData: {
    x: Float32Array;
    y: Float32Array;
    z: Float32Array;
    vx: Float32Array;
    vy: Float32Array;
    vz: Float32Array;
    rx: Float32Array;
    ry: Float32Array;
    rz: Float32Array;
    vrx: Float32Array;
    vry: Float32Array;
    vrz: Float32Array;
    phase: Float32Array;
    baseScale: Float32Array;
    count: number;
    age: number;
    duration: number;
  } | null = null;
  private touchLeafDummy = new THREE.Object3D();

  constructor(container: HTMLElement, initialLevel = 1, isNight = false) {
    this.container = container;
    this.isNightTheme = isNight;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.useComposer = !this.isSoftwareGl;

    this.initScene();
    this.initSkyAndLighting();
    if (this.useComposer) {
      this.initPostProcessing();
    }
    this.buildFloatingIsland();
    this.dragon = new SeamlessEasternDragon(this.scene);

    this.treeRootGroup = new THREE.Group();
    this.treeRootGroup.position.set(0, 0.32, 0);
    this.scene.add(this.treeRootGroup);

    this.setLevel(initialLevel, false);
    this.bindEvents();
    this.animate();
  }

  private getViewportSize() {
    const w = Math.max(100, this.container.clientWidth || window.innerWidth || 800);
    const h = Math.max(100, this.container.clientHeight || window.innerHeight || 600);
    return { w, h };
  }

  private initScene() {
    const { w, h } = this.getViewportSize();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x33244a, 0.012);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 300);
    this.camera.position.set(0.4, 4.3, 12.0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;

    if (!this.isSoftwareGl) {
      try {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
        this.scene.environment = this.envTarget.texture;
        this.scene.environmentIntensity = 0.45;
        pmrem.dispose();
      } catch {
        // Skip PMREM if unsupported
      }
    }

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.animFrame) cancelAnimationFrame(this.animFrame);
    });

    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      if (!this.disposed) this.animate();
    });

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 2.0, 0);
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 36;
    this.controls.maxPolarAngle = Math.PI * 0.72;
    this.controls.addEventListener('start', () => {
      this.camTransition.active = false;
    });
  }

  private initSkyAndLighting() {
    this.skyUniforms = {
      uTime: this.foliageTimeUniform,
      uMode: { value: 0.0 },
      topColor: { value: new THREE.Color(0x1f183d) },
      midColor: { value: new THREE.Color(0x5c3c6e) },
      horizonColor: { value: new THREE.Color(0xf7a889) },
      sunColor: { value: new THREE.Color(0xffe7b8) },
      sunDir: { value: new THREE.Vector3(-0.6, 0.35, -0.7).normalize() },
    };

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uMode;
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPosition;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = clamp(dir.y, -0.35, 1.0);

          vec3 sky = mix(horizonColor, midColor, smoothstep(-0.08, 0.30, h));
          sky = mix(sky, topColor, smoothstep(0.26, 0.86, h));

          if (uMode < 0.5) {
            float sunAmt = max(dot(dir, sunDir), 0.0);
            sky += sunColor * pow(sunAmt, 10.0) * 0.38;
            sky += sunColor * pow(sunAmt, 64.0) * 0.45;
          } else if (uMode < 1.5) {
            vec3 starCell = floor(dir * 270.0);
            float starVal = hash(starCell);
            if (starVal > 0.990 && h > -0.1) {
              float twinkle = 0.55 + 0.45 * sin(uTime * 3.6 + starVal * 120.0);
              vec3 sTint = starVal > 0.996 ? vec3(0.75, 0.96, 1.0) : vec3(0.95, 0.90, 1.0);
              sky += sTint * twinkle * 0.95;
            }
            float milkyBand = exp(-pow((dir.x * 0.62 + dir.y * 0.55 - dir.z * 0.48) * 3.8, 2.0));
            vec3 milkyCol = mix(vec3(0.24, 0.18, 0.52), vec3(0.14, 0.42, 0.58), 0.5 + 0.5 * sin(dir.x * 4.0));
            sky += milkyCol * milkyBand * 0.62 * smoothstep(-0.15, 0.35, h);

            float w1 = sin(dir.x * 6.5 + uTime * 0.55 + sin(dir.z * 5.0 - uTime * 0.35));
            float w2 = cos(dir.z * 7.5 - uTime * 0.45 + sin(dir.x * 4.5 + uTime * 0.3));
            float auroraMask = exp(-pow((h - 0.35 - w1 * 0.085) * 6.8, 2.0));
            vec3 auroraCol = mix(vec3(0.10, 0.95, 0.72), vec3(0.68, 0.28, 0.98), 0.5 + 0.5 * w2);
            sky += auroraCol * auroraMask * 0.54;
          } else {
            float sunAmt = max(dot(dir, sunDir), 0.0);
            sky += vec3(1.0, 0.88, 0.62) * pow(sunAmt, 9.0) * 0.22;
            float wisp1 = sin(dir.x * 5.0 + uTime * 0.10 + cos(dir.z * 4.0));
            float wisp2 = cos(dir.z * 6.0 - uTime * 0.08 + sin(dir.x * 3.5));
            float wispMask = smoothstep(0.15, 0.88, 0.5 + 0.32 * wisp1 + 0.22 * wisp2);
            sky = mix(sky, vec3(0.62, 0.48, 0.78), wispMask * 0.14 * smoothstep(0.05, 0.55, h));
            float horizonBand = exp(-pow((h + 0.03) * 4.2, 2.0));
            sky += vec3(0.95, 0.78, 0.46) * horizonBand * 0.16;
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(145, 40, 32), skyMat));

    this.hemiLight = new THREE.HemisphereLight(0xffd7e4, 0x3b2c59, 1.15);
    this.hemiLight.position.set(0, 22, 0);
    this.scene.add(this.hemiLight);

    const shadowRes = this.isSoftwareGl ? 1024 : 2048;
    this.dirLight = new THREE.DirectionalLight(0xffdfb8, 2.15);
    this.dirLight.position.set(-8, 15, 7);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 45;
    const d = 13;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0x9b8cff, 0.85);
    this.rimLight.position.set(8, 6, -9);
    this.scene.add(this.rimLight);
  }

  updateSkyTheme(isNight: boolean) {
    this.isNightTheme = isNight;
    this.updateAtmosphereForLevel(this.currentLevel);
  }

  private updateAtmosphereForLevel(level: number) {
    if (level <= 7) {
      if (!(this.scene.fog instanceof THREE.FogExp2)) {
        this.scene.fog = new THREE.FogExp2(0x33244a, 0.012);
      }
      const fog = this.scene.fog;
      this.skyUniforms.uMode.value = this.isNightTheme ? 1.0 : 0.0;
      if (this.isNightTheme) {
        this.skyUniforms.topColor.value.setHex(0x091026);
        this.skyUniforms.midColor.value.setHex(0x142248);
        this.skyUniforms.horizonColor.value.setHex(0x1f3a60);
        fog.color.setHex(0x0f1a36);
        fog.density = 0.012;
        this.hemiLight.color.setHex(0x9be2ff);
        this.hemiLight.groundColor.setHex(0x172038);
        this.hemiLight.intensity = 1.05;
        this.dirLight.color.setHex(0xd4e8ff);
        this.dirLight.intensity = 1.85;
        this.rimLight.color.setHex(0x4ade80);
        this.rimLight.intensity = 0.9;
      } else {
        this.skyUniforms.topColor.value.setHex(0x1f183d);
        this.skyUniforms.midColor.value.setHex(0x5c3c6e);
        this.skyUniforms.horizonColor.value.setHex(0xf7a889);
        fog.color.setHex(0x33244a);
        fog.density = 0.012;
        this.hemiLight.color.setHex(0xffd7e4);
        this.hemiLight.groundColor.setHex(0x3b2c59);
        this.hemiLight.intensity = 1.15;
        this.dirLight.color.setHex(0xffdfb8);
        this.dirLight.intensity = 2.15;
        this.rimLight.color.setHex(0x9b8cff);
        this.rimLight.intensity = 0.85;
      }
    } else if (level <= 9) {
      if (!(this.scene.fog instanceof THREE.FogExp2)) {
        this.scene.fog = new THREE.FogExp2(0x121536, 0.011);
      }
      const fog = this.scene.fog;
      this.skyUniforms.uMode.value = 1.0;
      this.skyUniforms.topColor.value.setHex(0x070a1f);
      this.skyUniforms.midColor.value.setHex(0x181c47);
      this.skyUniforms.horizonColor.value.setHex(0x302663);
      fog.color.setHex(0x121536);
      fog.density = 0.01;
      this.hemiLight.color.setHex(0x88d8ff);
      this.hemiLight.groundColor.setHex(0x1f163b);
      this.hemiLight.intensity = 1.05;
      this.dirLight.color.setHex(0xd6e6ff);
      this.dirLight.intensity = 1.95;
      this.rimLight.color.setHex(0xb86bff);
      this.rimLight.intensity = 0.9;
    } else {
      if (!(this.scene.fog instanceof THREE.FogExp2)) {
        this.scene.fog = new THREE.FogExp2(0x28224f, 0.0055);
      }
      const fog = this.scene.fog;
      this.skyUniforms.uMode.value = this.isNightTheme ? 1.0 : 2.0;
      this.skyUniforms.topColor.value.setHex(this.isNightTheme ? 0x08132e : 0x153e7a);
      this.skyUniforms.midColor.value.setHex(this.isNightTheme ? 0x201d4a : 0x4b4682);
      this.skyUniforms.horizonColor.value.setHex(this.isNightTheme ? 0x453263 : 0xd69a63);
      fog.color.setHex(this.isNightTheme ? 0x1f1c45 : 0x494070);
      fog.density = 0.0055;
      this.hemiLight.color.setHex(0xd8ecff);
      this.hemiLight.groundColor.setHex(0x3d305c);
      this.hemiLight.intensity = 0.92;
      this.dirLight.color.setHex(0xffdfa1);
      this.dirLight.intensity = 2.0;
      this.rimLight.color.setHex(0x4bc8f5);
      this.rimLight.intensity = 0.9;
    }
    this.applyWeatherAtmosphereTint(level);
    if (this.bloomPass) {
      this.bloomPass.strength = level >= 10 ? 0.24 : 0.22;
      this.bloomPass.radius = 0.3;
      this.bloomPass.threshold = 0.91;
    }
  }

  private applyWeatherAtmosphereTint(level: number) {
    const fog = this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog : null;
    if (this.activeWeather === 'sunlight') {
      this.dirLight.color.setHex(level >= 8 ? 0xffe29e : 0xffdf91);
      this.dirLight.intensity *= 1.05;
      this.hemiLight.intensity *= 1.02;
      this.rimLight.color.setHex(0xffc966);
      if (!this.isNightTheme && level <= 7) {
        this.skyUniforms.horizonColor.value.lerp(new THREE.Color(0xffd28a), 0.35);
        this.skyUniforms.sunColor.value.setHex(0xfff1b8);
      }
    } else if (this.activeWeather === 'autumn') {
      this.dirLight.color.setHex(0xffcb82);
      this.dirLight.intensity *= 1.04;
      this.rimLight.color.setHex(0xf59e0b);
      this.rimLight.intensity *= 1.1;
      if (!this.isNightTheme && level <= 7) {
        this.skyUniforms.midColor.value.lerp(new THREE.Color(0x7a4854), 0.35);
        this.skyUniforms.horizonColor.value.lerp(new THREE.Color(0xf6ad6e), 0.45);
      }
      if (fog) {
        fog.color.lerp(new THREE.Color(0x472d3c), 0.35);
      }
    } else if (this.activeWeather === 'snow') {
      this.dirLight.color.setHex(0xe0f2fe);
      this.dirLight.intensity *= 0.94;
      this.hemiLight.color.setHex(0xdbeafe);
      this.hemiLight.intensity *= 1.08;
      this.rimLight.color.setHex(0x7dd3fc);
      this.rimLight.intensity *= 1.08;
      if (!this.isNightTheme && level <= 7) {
        this.skyUniforms.topColor.value.lerp(new THREE.Color(0x274066), 0.55);
        this.skyUniforms.midColor.value.lerp(new THREE.Color(0x527194), 0.55);
        this.skyUniforms.horizonColor.value.lerp(new THREE.Color(0xbcd4ea), 0.5);
      }
      if (fog) {
        fog.color.lerp(new THREE.Color(0x3a5273), 0.55);
        fog.density = 0.014;
      }
    } else if (this.activeWeather === 'rain') {
      this.dirLight.color.setHex(0xcbe2f7);
      this.dirLight.intensity *= 0.84;
      this.hemiLight.color.setHex(0x9ec5e6);
      this.rimLight.color.setHex(0x38bdf8);
      if (fog) {
        fog.color.lerp(new THREE.Color(0x1f334d), 0.5);
        fog.density = 0.015;
      }
    }
  }

  private initPostProcessing() {
    try {
      const { w, h } = this.getViewportSize();
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.28, 0.91);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch {
      this.useComposer = false;
    }
  }

  private buildFloatingIsland() {
    this.islandGroup = new THREE.Group();
    this.scene.add(this.islandGroup);

    const rockGeo = new THREE.CylinderGeometry(3.85, 0.25, 4.4, 36, 18, false);
    rockGeo.translate(0, -2.2, 0);
    const rPos = rockGeo.attributes.position;
    const rColors = new Float32Array(rPos.count * 3);
    const cTopRock = new THREE.Color(0x6e5349);
    const cMidRock = new THREE.Color(0x4b3e5e);
    const cBottomRock = new THREE.Color(0x28213b);
    const tempCol = new THREE.Color();

    for (let i = 0; i < rPos.count; i++) {
      let x = rPos.getX(i);
      let y = rPos.getY(i);
      let z = rPos.getZ(i);
      const depthRatio = THREE.MathUtils.clamp(-y / 4.4, 0, 1);
      const angle = Math.atan2(z, x);
      const ridgeNoise =
        Math.sin(angle * 7.0 + y * 1.4) * 0.34 +
        Math.cos(angle * 13.0 - y * 2.1) * 0.18 +
        Math.sin(x * 2.3 + z * 2.1) * 0.22;
      const terrace = Math.sin(y * 4.5) * 0.12 * (1.0 - depthRatio * 0.5);

      if (y < -0.05) {
        const radialScale = 1.0 + (ridgeNoise + terrace) * (0.45 + depthRatio * 0.55);
        x *= radialScale;
        z *= radialScale;
        y += Math.sin(angle * 5.0 + x * 1.8) * 0.25 * depthRatio;
      }
      rPos.setXYZ(i, x, y, z);

      if (depthRatio < 0.45) tempCol.lerpColors(cTopRock, cMidRock, depthRatio / 0.45);
      else tempCol.lerpColors(cMidRock, cBottomRock, (depthRatio - 0.45) / 0.55);
      rColors[i * 3] = tempCol.r;
      rColors[i * 3 + 1] = tempCol.g;
      rColors[i * 3 + 2] = tempCol.b;
    }
    rockGeo.setAttribute('color', new THREE.BufferAttribute(rColors, 3));
    rockGeo.computeVertexNormals();

    const rockMesh = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.05, flatShading: true }),
    );
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    this.islandGroup.add(rockMesh);

    this.grassGeo = new THREE.CylinderGeometry(3.95, 3.72, 0.62, 40, 6);
    const gPos = this.grassGeo.attributes.position;
    const gColors = new Float32Array(gPos.count * 3);

    for (let i = 0; i < gPos.count; i++) {
      let x = gPos.getX(i);
      let y = gPos.getY(i);
      let z = gPos.getZ(i);
      const dist = Math.hypot(x, z);
      const angle = Math.atan2(z, x);
      const edgeWave = Math.sin(angle * 9.0) * 0.14 + Math.cos(angle * 5.0) * 0.12;
      if (dist > 2.2) {
        x *= 1.0 + edgeWave * 0.05;
        z *= 1.0 + edgeWave * 0.05;
      }
      if (y > 0) {
        y += (1.0 - Math.min(dist / 4.0, 1.0)) * 0.22 + Math.sin(x * 1.5) * Math.cos(z * 1.5) * 0.05;
      } else {
        y += edgeWave * 0.35;
      }
      gPos.setXYZ(i, x, y, z);
    }
    this.grassGeo.setAttribute('color', new THREE.BufferAttribute(gColors, 3));
    this.grassGeo.computeVertexNormals();
    this.updateIslandGrassColors(1);

    const grassMesh = new THREE.Mesh(
      this.grassGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.76, metalness: 0.04, flatShading: true }),
    );
    grassMesh.position.y = 0.05;
    grassMesh.receiveShadow = true;
    grassMesh.castShadow = true;
    this.islandGroup.add(grassMesh);

    this.addIslandDecorations();

    [
      { x: -3.6, y: -1.6, z: 1.5, s: 0.42 },
      { x: 3.4, y: -2.1, z: -1.4, s: 0.36 },
      { x: -1.8, y: -3.2, z: -2.6, s: 0.28 },
      { x: 2.1, y: -3.5, z: 2.3, s: 0.32 },
    ].forEach((item, idx) => {
      const sGeo = new THREE.OctahedronGeometry(item.s, 1);
      const sPos = sGeo.attributes.position;
      for (let i = 0; i < sPos.count; i++) {
        sPos.setY(i, sPos.getY(i) * 1.65);
        sPos.setX(i, sPos.getX(i) * (0.85 + Math.sin(i * 2.1) * 0.25));
      }
      sGeo.computeVertexNormals();
      const shard = new THREE.Mesh(
        sGeo,
        new THREE.MeshStandardMaterial({ color: 0x4b3e5e, flatShading: true, roughness: 0.85 }),
      );
      shard.position.set(item.x, item.y, item.z);
      this.islandGroup.add(shard);
      this.floatingRocks.push({ mesh: shard, baseY: item.y, phase: idx * 1.7 });
    });
  }

  private updateIslandGrassColors(level: number) {
    if (!this.grassGeo) return;
    const gPos = this.grassGeo.attributes.position;
    const gColors = this.grassGeo.attributes.color as THREE.BufferAttribute;
    const tempCol = new THREE.Color();

    const cEdge = level <= 7 ? new THREE.Color(0x2b7a4b) : new THREE.Color(0x1f6258);
    const cCenter = level <= 7 ? new THREE.Color(0x6ec94b) : new THREE.Color(0x6bd6b8);

    for (let i = 0; i < gPos.count; i++) {
      const dist = Math.hypot(gPos.getX(i), gPos.getZ(i));
      const radialT = THREE.MathUtils.clamp(1.0 - dist / 4.0, 0, 1);
      tempCol.lerpColors(cEdge, cCenter, radialT);
      gColors.setXYZ(i, tempCol.r, tempCol.g, tempCol.b);
    }
    gColors.needsUpdate = true;
  }

  private addIslandDecorations() {
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.04, 0);
    bladeShape.quadraticCurveTo(-0.02, 0.25, 0.05, 0.42);
    bladeShape.quadraticCurveTo(0.03, 0.2, 0.04, 0);
    const bladeGeo = new THREE.ShapeGeometry(bladeShape, 4);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x57bd46, roughness: 0.7, side: THREE.DoubleSide });

    [
      [-2.3, 1.4],
      [-1.7, 2.4],
      [1.6, 2.7],
      [2.8, 0.6],
      [-2.7, -1.2],
      [1.9, -2.3],
      [0.4, -2.9],
      [-0.9, 2.9],
    ].forEach(([gx, gz], idx) => {
      const tuft = new THREE.Group();
      tuft.position.set(gx, 0.34, gz);
      for (let b = 0; b < 5; b++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.rotation.y = (b / 5) * Math.PI * 2;
        blade.rotation.x = 0.25 + (b % 2) * 0.15;
        blade.scale.setScalar(0.75 + (b % 3) * 0.25);
        tuft.add(blade);
      }
      this.islandGroup.add(tuft);
      this.swayElements.push({ obj: tuft, speed: 2.2, amp: 0.08, phase: idx, isIslandProp: true });
    });

    const capGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.22),
        new THREE.Vector2(0.11, 0.2),
        new THREE.Vector2(0.21, 0.11),
        new THREE.Vector2(0.23, 0.02),
        new THREE.Vector2(0.14, 0.0),
      ],
      16,
    );

    [
      { x: -2.1, z: 0.7, scale: 1.0, color: 0x5ef2ff },
      { x: -2.35, z: 0.92, scale: 0.65, color: 0x5ef2ff },
      { x: 2.45, z: -1.1, scale: 0.9, color: 0xff85e4 },
      { x: 2.25, z: -1.32, scale: 0.58, color: 0xff85e4 },
    ].forEach((m) => {
      const mushGroup = new THREE.Group();
      mushGroup.position.set(m.x, 0.34, m.z);
      mushGroup.scale.setScalar(m.scale);

      const stem = new THREE.Mesh(
        createTaperedTube(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.03, 0.16, 0.02),
            new THREE.Vector3(0, 0.32, 0),
          ]),
          8,
          0.045,
          0.03,
          8,
        ),
        new THREE.MeshStandardMaterial({ color: 0xf4ebd9, roughness: 0.6 }),
      );
      const cap = new THREE.Mesh(
        capGeo,
        new THREE.MeshStandardMaterial({ color: m.color, emissive: m.color, emissiveIntensity: 1.0, roughness: 0.3 }),
      );
      cap.position.y = 0.28;
      mushGroup.add(stem, cap);
      this.islandGroup.add(mushGroup);
    });

    this.islandMysticProps = new THREE.Group();
    this.islandGroup.add(this.islandMysticProps);

    [
      { x: -2.85, z: 0.3, s: 1.0, col: 0x00e5ff },
      { x: 2.75, z: 1.25, s: 0.9, col: 0xffcf56 },
      { x: -1.2, z: -2.75, s: 0.85, col: 0x7df9ff },
      { x: 2.1, z: -2.25, s: 0.95, col: 0xe08aff },
    ].forEach((cc, idx) => {
      const cGroup = new THREE.Group();
      cGroup.position.set(cc.x, 0.34, cc.z);
      cGroup.scale.setScalar(cc.s);
      const cMat = new THREE.MeshStandardMaterial({
        color: cc.col,
        emissive: cc.col,
        emissiveIntensity: 1.1,
        roughness: 0.2,
      });
      for (let k = 0; k < 3; k++) {
        const h = k === 0 ? 0.58 : 0.36;
        const r = k === 0 ? 0.09 : 0.06;
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, r, h, 6), cMat);
        const ang = (k / 3) * Math.PI * 2 + idx;
        spire.position.set(Math.cos(ang) * 0.1, h * 0.45, Math.sin(ang) * 0.1);
        spire.rotation.z = Math.cos(ang) * 0.18;
        spire.rotation.x = Math.sin(ang) * 0.18;
        cGroup.add(spire);
      }
      this.islandMysticProps!.add(cGroup);
    });
  }

  private buildCloudSea() {
    this.cloudSeaGroup = new THREE.Group();
    this.scene.add(this.cloudSeaGroup);
    this.celestialClouds = [];

    const puffGeo = new THREE.IcosahedronGeometry(1.0, 2);
    const pos = puffGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cTop = new THREE.Color(0xfff4df);
    const cMid = new THREE.Color(0xd6c7e8);
    const cBot = new THREE.Color(0x7d76a8);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp((pos.getY(i) + 1.0) * 0.5, 0, 1);
      if (t < 0.45) tmpCol.lerpColors(cBot, cMid, t / 0.45);
      else tmpCol.lerpColors(cMid, cTop, (t - 0.45) / 0.55);
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    puffGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    puffGeo.computeVertexNormals();

    const cloudMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });

    const cloudCount = 26;
    for (let c = 0; c < cloudCount; c++) {
      const cluster = new THREE.Group();
      const angle = (c / cloudCount) * Math.PI * 2 + (c % 3) * 0.2;
      const radius = 6.5 + (c % 5) * 4.5 + Math.random() * 2.5;
      const baseY = -4.4 - (c % 4) * 1.45 + Math.sin(c * 1.7) * 0.9;

      const subPuffs = 4 + (c % 3);
      for (let p = 0; p < subPuffs; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.scale.set(
          (1.6 + Math.random() * 1.4) * (p === 0 ? 1.35 : 0.95),
          (0.62 + Math.random() * 0.4) * (p === 0 ? 1.15 : 0.85),
          (1.4 + Math.random() * 1.4) * (p === 0 ? 1.25 : 0.9),
        );
        puff.position.set(
          (p - subPuffs * 0.5) * 1.35,
          Math.sin(p * 1.5) * 0.26,
          Math.cos(p * 1.8) * 0.72,
        );
        cluster.add(puff);
      }

      cluster.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
      this.cloudSeaGroup.add(cluster);
      this.celestialClouds.push({
        group: cluster,
        angle,
        radius,
        baseY,
        speed: 0.024 + (c % 4) * 0.008,
        phase: c * 0.9,
      });
    }
  }

  private buildCanopyAuraDome(container: THREE.Group, treeHeight: number) {
    const domeGeo = new THREE.SphereGeometry(4.35, 36, 28);
    domeGeo.scale(1.06, 0.72, 1.06);

    const domeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.foliageTimeUniform,
        uRimColor: { value: new THREE.Color(0xffdf73) },
        uInnerColor: { value: new THREE.Color(0x5ef2ff) },
      },
      vertexShader: `
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uRimColor;
        uniform vec3 uInnerColor;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        void main() {
          float fresnel = pow(1.0 - clamp(abs(dot(vNormalView, vViewDir)), 0.0, 1.0), 3.8);
          float shimmer = 0.82 + 0.18 * sin(vLocalPos.y * 4.0 + uTime * 1.5);
          vec3 col = mix(uInnerColor, uRimColor, clamp(vLocalPos.y * 0.25 + 0.5, 0.0, 1.0));
          gl_FragColor = vec4(col, fresnel * shimmer * 0.045);
        }
      `,
    });

    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.set(0, treeHeight * 0.82, 0);
    container.add(domeMesh);
  }

  private buildGodRays(treeHeight: number) {
    this.godRaysGroup = new THREE.Group();
    this.scene.add(this.godRaysGroup);
    this.godRays = [];

    const rayMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.foliageTimeUniform,
        uColor: { value: new THREE.Color(0xffe099) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float edgeFade = pow(abs(dot(vNormalView, viewDir)), 2.5);
          float vFade = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.2, vUv.y);
          float shimmer = 0.8 + 0.2 * sin(vUv.x * 18.84 + uTime * 0.9);
          gl_FragColor = vec4(uColor, edgeFade * vFade * shimmer * 0.032);
        }
      `,
    });

    [
      { x: -1.8, z: -1.2, topR: 0.65, botR: 2.6, rotZ: -0.18, rotX: 0.12 },
      { x: 0.4, z: 0.2, topR: 0.85, botR: 3.1, rotZ: -0.12, rotX: 0.08 },
      { x: 2.2, z: -0.8, topR: 0.6, botR: 2.4, rotZ: -0.22, rotX: 0.15 },
    ].forEach((cfg, idx) => {
      const geo = new THREE.CylinderGeometry(cfg.topR, cfg.botR, 24, 24, 1, true);
      const mesh = new THREE.Mesh(geo, rayMat);
      mesh.position.set(cfg.x, treeHeight + 7.5, cfg.z);
      mesh.rotation.set(cfg.rotX, 0, cfg.rotZ);
      this.godRaysGroup!.add(mesh);
      this.godRays.push({ mesh, baseRotZ: cfg.rotZ, phase: idx * 1.4 });
    });
  }

  private buildTree(level: number, triggerFx = true) {
    this.clearTouchLeaves();
    this.treeMaterials = [];
    while (this.treeRootGroup.children.length > 0) {
      this.treeRootGroup.remove(this.treeRootGroup.children[0]);
    }
    this.swayElements = this.swayElements.filter((item) => item.isIslandProp);
    this.runeRings = [];
    this.treeHeartGroup = null;

    [
      this.petalSystem,
      this.fireflySystem,
      this.risingSpiritSystem,
      this.stardustRainSystem,
      this.rootDropletSystem,
    ].forEach((sys) => {
      if (sys) this.scene.remove(sys.points);
    });
    this.petalSystem = null;
    this.fireflySystem = null;
    this.risingSpiritSystem = null;
    this.stardustRainSystem = null;
    this.rootDropletSystem = null;

    if (this.skyBeamMesh) {
      this.scene.remove(this.skyBeamMesh);
      this.skyBeamMesh = null;
    }
    if (this.summonBeamMesh) {
      this.scene.remove(this.summonBeamMesh);
      this.summonBeamMesh = null;
    }
    if (this.cloudSeaGroup) {
      this.scene.remove(this.cloudSeaGroup);
      this.cloudSeaGroup = null;
      this.celestialClouds = [];
    }
    if (this.godRaysGroup) {
      this.scene.remove(this.godRaysGroup);
      this.godRaysGroup = null;
      this.godRays = [];
    }

    this.orbitingIslets.forEach((item) => this.scene.remove(item.group));
    this.orbitingIslets = [];

    this.updateAtmosphereForLevel(level);
    this.updateIslandGrassColors(level);
    if (this.islandMysticProps) {
      this.islandMysticProps.visible = level >= 8;
    }

    const treeContainer = new THREE.Group();
    this.treeRootGroup.add(treeContainer);

    if (level === 1) {
      const moundGeo = new THREE.SphereGeometry(0.45, 16, 12);
      moundGeo.scale(1.3, 0.35, 1.3);
      treeContainer.add(
        new THREE.Mesh(moundGeo, new THREE.MeshStandardMaterial({ color: 0x4e3b31, roughness: 0.9 })),
      );

      const seedMesh = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0.16, 0.12),
            new THREE.Vector2(0.18, 0.28),
            new THREE.Vector2(0.08, 0.44),
            new THREE.Vector2(0, 0.52),
          ],
          18,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xb8ff9e,
          emissive: 0x52d668,
          emissiveIntensity: 1.15,
          roughness: 0.25,
        }),
      );
      seedMesh.position.y = 0.14;
      treeContainer.add(seedMesh);

      const ringGeo = new THREE.RingGeometry(0.38, 0.44, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0x8aff80, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
      );
      ring.position.y = 0.08;
      treeContainer.add(ring);
      this.runeRings.push({ mesh: ring, speed: 1.2 });
    } else if (level === 2) {
      const sproutCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.06, 0.45, 0.04),
        new THREE.Vector3(-0.04, 0.9, 0.02),
      ]);
      treeContainer.add(
        new THREE.Mesh(
          createTaperedTube(sproutCurve, 14, 0.07, 0.025, 10),
          new THREE.MeshStandardMaterial({ color: 0x69d149, emissive: 0x1d5214, emissiveIntensity: 0.25, roughness: 0.5 }),
        ),
      );
      [
        { pos: [0.02, 0.62, 0.03] as const, rot: [0.4, 0.3, -0.7] as const, scale: 0.85 },
        { pos: [-0.01, 0.76, 0.02] as const, rot: [0.3, 2.4, -0.65] as const, scale: 0.95 },
        { pos: [-0.04, 0.88, 0.02] as const, rot: [0.25, -1.5, -0.45] as const, scale: 0.75 },
      ].forEach((cfg, idx) => {
        const leaf = createSingleLeafMesh(0.7, 0.36, 0x8ef564);
        leaf.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        leaf.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
        leaf.scale.setScalar(cfg.scale);
        treeContainer.add(leaf);
        this.swayElements.push({ obj: leaf, speed: 2.5, amp: 0.09, phase: idx * 1.2 });
      });
    } else if (level <= 7) {
      this.buildWoodyTreeStages(treeContainer, level);
    } else {
      this.buildSupremeWorldTree(treeContainer, level);
    }

    this.dragon.build(level);

    if (level === 10) {
      treeContainer.scale.set(1.12, 1.12, 1.12);
      this.buildCanopyAuraDome(treeContainer, 6.7);
      this.buildCloudSea();
      this.buildGodRays(6.7);
      this.createGoldenStardustRain(180, 8.0);

      // Sculpted Celestial Lotus Spire perched cleanly above the canopy crown
      const crownGroup = new THREE.Group();
      const crownGold = new THREE.MeshStandardMaterial({
        color: 0xf7ca5e,
        emissive: 0x8f560a,
        emissiveIntensity: 0.42,
        metalness: 0.78,
        roughness: 0.2,
      });
      const crownJade = new THREE.MeshStandardMaterial({
        color: 0x5ff0d8,
        emissive: 0x0b7a6b,
        emissiveIntensity: 0.48,
        metalness: 0.35,
        roughness: 0.16,
      });
      const crownCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), crownGold);
      crownCore.position.y = 7.35;
      crownCore.scale.set(0.75, 1.65, 0.75);
      crownGroup.add(crownCore);

      for (let shard = 0; shard < 8; shard++) {
        const a = (shard / 8) * Math.PI * 2;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), shard % 2 ? crownJade : crownGold);
        crystal.position.set(Math.cos(a) * 0.62, 6.85 + (shard % 2) * 0.26, Math.sin(a) * 0.62);
        crystal.scale.set(0.5, 1.75, 0.5);
        crystal.rotation.z = -Math.cos(a) * 0.28;
        crystal.rotation.x = Math.sin(a) * 0.28;
        crownGroup.add(crystal);
      }
      treeContainer.add(crownGroup);
      this.swayElements.push({ obj: crownGroup, speed: 0.45, amp: 0.028, phase: 0.4 });

      // Refined astrolabe halo positioned cleanly behind the tree so it frames without glare
      const eclipse = new THREE.Mesh(
        new THREE.TorusGeometry(4.45, 0.048, 12, 128),
        new THREE.MeshBasicMaterial({ color: 0xf0be59, transparent: true, opacity: 0.46 }),
      );
      eclipse.position.set(0, 4.9, -1.35);
      eclipse.rotation.x = 0.24;
      treeContainer.add(eclipse);
      this.swayElements.push({ obj: eclipse, speed: 0.18, amp: 0.01, phase: 0.2 });

      for (let star = 0; star < 24; star++) {
        const a = (star / 24) * Math.PI * 2;
        const bead = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.055 + (star % 2) * 0.02, 0),
          new THREE.MeshBasicMaterial({
            color: star % 3 === 0 ? 0x7df9ff : 0xffe082,
            transparent: true,
            opacity: 0.75,
          }),
        );
        bead.position.set(Math.cos(a) * 4.45, 4.9 + Math.sin(a) * 4.45, -1.35);
        treeContainer.add(bead);
      }
    }

    this.collectTreeMaterials();
    this.rebuildXpRingForLevel(level);
    this.rebuildWeatherSystems();
    this.updateCameraFraming(level);
    if (triggerFx) this.triggerLevelUpChoreography(level);
  }

  setXpProgress(progress: number, info?: XpProgressMeta, options?: { syncExternalSpring?: boolean }) {
    const clamped = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    this.useExternalXpSpring = Boolean(options?.syncExternalSpring);
    if (!this.useExternalXpSpring) {
      this.targetXpProgress = clamped;
    }
    if (info) {
      this.xpInfo = { ...info };
    }
    this.xpArcUniforms.uIsMax.value = this.xpInfo.isMaxLevel ? 1.0 : 0.0;
    this.updateXpBadgeCanvas();
  }

  setSpringArcProgress(progress: number) {
    this.useExternalXpSpring = true;
    const clamped = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
    this.displayedXpProgress = clamped;
    this.targetXpProgress = clamped;
    this.xpArcUniforms.uProgress.value = clamped;
  }

  triggerXpGainPulse() {
    this.xpRingPulse = { active: true, time: 0, duration: 1.15 };
    this.spawnShockwave(this.xpInfo.isMaxLevel ? 0xffcf56 : 0x38bdf8, 5.8, 0);
  }

  private disposeXpRing() {
    if (this.xpBadgeTexture) {
      this.xpBadgeTexture.dispose();
      this.xpBadgeTexture = null;
    }
    if (this.xpRingGroup) {
      this.scene.remove(this.xpRingGroup);
      this.xpRingGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if ((m as THREE.SpriteMaterial).map) (m as THREE.SpriteMaterial).map?.dispose();
            m.dispose();
          });
        } else if (mat) {
          if ((mat as THREE.SpriteMaterial).map) (mat as THREE.SpriteMaterial).map?.dispose();
          mat.dispose();
        }
      });
      this.xpRingGroup = null;
    }
    this.xpLeadOrb = null;
    this.xpLeadHalo = null;
    this.xpMilestoneNodes = [];
  }

  private rebuildXpRingForLevel(level: number) {
    this.disposeXpRing();

    const radius = level >= 8 ? 4.38 : 4.1;
    this.xpRingRadius = radius;

    const group = new THREE.Group();
    group.position.set(0, 0.54 + this.islandGroup.position.y, 0);
    this.scene.add(group);
    this.xpRingGroup = group;

    // 1. Dark metallic obsidian track bezel encircling the island rim
    const trackGeo = new THREE.TorusGeometry(radius, 0.056, 16, 144);
    trackGeo.rotateX(Math.PI / 2);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x131d33,
      metalness: 0.78,
      roughness: 0.3,
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    group.add(trackMesh);

    // Dual sculpted metallic bevel trim rails
    const railMat = new THREE.MeshStandardMaterial({
      color: level >= 8 ? 0xc49c48 : 0x4b638f,
      metalness: 0.86,
      roughness: 0.24,
    });
    [radius - 0.08, radius + 0.08].forEach((r) => {
      const railGeo = new THREE.TorusGeometry(r, 0.013, 8, 144);
      railGeo.rotateX(Math.PI / 2);
      group.add(new THREE.Mesh(railGeo, railMat));
    });

    // Subtle translucent base groove so full 360° circle stays legible at low XP
    const grooveGeo = new THREE.TorusGeometry(radius, 0.032, 10, 144);
    grooveGeo.rotateX(Math.PI / 2);
    const grooveMesh = new THREE.Mesh(
      grooveGeo,
      new THREE.MeshBasicMaterial({
        color: level >= 8 ? 0xffcf56 : 0x38bdf8,
        transparent: true,
        opacity: 0.16,
      }),
    );
    grooveMesh.position.y = 0.01;
    group.add(grooveMesh);

    // 2. Luminous 3D Aurora XP Progress Arc (clockwise from front +Z)
    const arcGeo = new THREE.TorusGeometry(radius, 0.072, 20, 160);
    arcGeo.rotateX(Math.PI / 2);
    const arcMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: this.xpArcUniforms,
      vertexShader: `
        varying vec3 vLocalPos;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vLocalPos = position;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uProgress;
        uniform float uTime;
        uniform float uIsMax;
        uniform float uPulseBoost;
        varying vec3 vLocalPos;
        varying vec3 vNormalView;
        varying vec3 vViewPos;

        void main() {
          if (uProgress <= 0.002) discard;

          float rawAngle = atan(vLocalPos.z, vLocalPos.x);
          float t = fract((rawAngle - 1.5707963) / 6.2831853);

          float fillMask = uProgress >= 0.998
            ? 1.0
            : (1.0 - smoothstep(uProgress - 0.0045, uProgress + 0.0045, t));
          if (fillMask <= 0.01) discard;

          vec3 cEmerald = vec3(0.08, 0.82, 0.56);
          vec3 cCyan = vec3(0.16, 0.86, 0.96);
          vec3 cIndigo = vec3(0.50, 0.44, 0.98);
          vec3 cGold = vec3(1.0, 0.82, 0.30);

          vec3 col;
          if (uIsMax > 0.5) {
            float waveMix = 0.5 + 0.5 * sin(t * 12.56637 - uTime * 1.6);
            col = mix(vec3(0.95, 0.68, 0.18), vec3(1.0, 0.90, 0.48), waveMix);
            col = mix(col, vec3(0.45, 0.95, 0.86), 0.16 * pow(waveMix, 3.0));
          } else {
            if (t < 0.38) {
              col = mix(cEmerald, cCyan, t / 0.38);
            } else if (t < 0.76) {
              col = mix(cCyan, cIndigo, (t - 0.38) / 0.38);
            } else {
              col = mix(cIndigo, cGold, (t - 0.76) / 0.24);
            }
          }

          vec3 viewDir = normalize(vViewPos);
          float fresnel = pow(1.0 - clamp(abs(dot(normalize(vNormalView), viewDir)), 0.0, 1.0), 1.8);
          float pulse = 0.88 + 0.12 * sin(t * 25.1327 - uTime * 3.2);
          float headGlow = uProgress < 0.998 ? exp(-abs(t - uProgress) * 42.0) * 0.42 : 0.0;

          vec3 finalCol = col * (0.88 + fresnel * 0.35 + uPulseBoost * 0.55) * pulse
            + vec3(0.75, 0.95, 1.0) * (headGlow + uPulseBoost * 0.25);
          gl_FragColor = vec4(finalCol, fillMask * 0.96);
        }
      `,
    });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.position.y = 0.015;
    group.add(arcMesh);

    // 3. Radial milestone ticks (12 steps; cardinal 0/25/50/75% have gemstone prisms)
    const tickGeo = new THREE.BoxGeometry(0.032, 0.038, 0.145);
    const tickMat = new THREE.MeshStandardMaterial({
      color: 0x8ea4cc,
      metalness: 0.75,
      roughness: 0.28,
    });
    const jewelGeo = new THREE.OctahedronGeometry(0.095, 0);

    for (let i = 0; i < 12; i++) {
      const frac = i / 12;
      const theta = Math.PI / 2 + frac * Math.PI * 2;
      const px = Math.cos(theta) * radius;
      const pz = Math.sin(theta) * radius;

      if (i % 3 === 0) {
        const jMat = new THREE.MeshStandardMaterial({
          color: 0x3b4d70,
          emissive: 0x10b981,
          emissiveIntensity: 0.1,
          metalness: 0.65,
          roughness: 0.22,
        });
        const jewel = new THREE.Mesh(jewelGeo, jMat);
        jewel.position.set(px, 0.052, pz);
        jewel.scale.set(0.95, 0.75, 0.95);
        jewel.rotation.y = -theta;
        group.add(jewel);
        this.xpMilestoneNodes.push({ mesh: jewel, threshold: frac, mat: jMat });
      } else {
        const tick = new THREE.Mesh(tickGeo, tickMat);
        tick.position.set(px, 0.048, pz);
        tick.rotation.y = -theta + Math.PI / 2;
        group.add(tick);
      }
    }

    // 4. Orbiting Lead Energy Orb at the exact active tip of XP progress
    const orbGroup = new THREE.Group();
    const orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xe0fbff,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.45,
        roughness: 0.15,
      }),
    );
    orbGroup.add(orbCore);

    const orbHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.145, 0.016, 8, 28),
      new THREE.MeshBasicMaterial({
        color: 0x7df9ff,
        transparent: true,
        opacity: 0.85,
      }),
    );
    orbGroup.add(orbHalo);
    this.xpLeadHalo = orbHalo;

    const orbGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSoftGlowTexture('#7df9ff', 'rgba(16,185,129,0)'),
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    orbGlow.scale.set(0.62, 0.62, 1);
    orbGroup.add(orbGlow);

    group.add(orbGroup);
    this.xpLeadOrb = orbGroup;

    // 5. Crisp Front 3D XP Holographic Nameplate Plaque
    if (!this.xpBadgeCanvas) {
      this.xpBadgeCanvas = document.createElement('canvas');
      this.xpBadgeCanvas.width = 640;
      this.xpBadgeCanvas.height = 192;
      this.xpBadgeCtx = this.xpBadgeCanvas.getContext('2d');
    }
    this.xpBadgeTexture = new THREE.CanvasTexture(this.xpBadgeCanvas);
    this.xpBadgeTexture.colorSpace = THREE.SRGBColorSpace;
    this.xpBadgeTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0, 0.08, radius + 0.44);
    badgeGroup.rotation.x = -0.4;

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(2.04, 0.66, 0.055),
      new THREE.MeshStandardMaterial({
        color: 0x111a2e,
        metalness: 0.8,
        roughness: 0.28,
      }),
    );
    housing.position.z = -0.032;
    badgeGroup.add(housing);

    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.94, 0.58),
      new THREE.MeshBasicMaterial({
        map: this.xpBadgeTexture,
        transparent: true,
      }),
    );
    badgeGroup.add(plaque);
    group.add(badgeGroup);

    this.updateXpBadgeCanvas();
  }

  private updateXpBadgeCanvas() {
    if (!this.xpBadgeCanvas || !this.xpBadgeCtx || !this.xpBadgeTexture) return;
    const ctx = this.xpBadgeCtx;
    const w = this.xpBadgeCanvas.width;
    const h = this.xpBadgeCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Rounded glass-obsidian plate
    const r = 24;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, 'rgba(13, 21, 38, 0.96)');
    bgGrad.addColorStop(1, 'rgba(20, 31, 56, 0.96)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Aurora top trim bar
    ctx.save();
    ctx.clip();
    const accentGrad = ctx.createLinearGradient(0, 0, w, 0);
    if (this.xpInfo.isMaxLevel) {
      accentGrad.addColorStop(0, '#f59e0b');
      accentGrad.addColorStop(0.5, '#fde047');
      accentGrad.addColorStop(1, '#34d399');
    } else {
      accentGrad.addColorStop(0, '#10b981');
      accentGrad.addColorStop(0.5, '#22d3ee');
      accentGrad.addColorStop(1, '#818cf8');
    }
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, w, 10);
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = this.xpInfo.isMaxLevel ? 'rgba(251, 191, 36, 0.65)' : 'rgba(56, 189, 248, 0.5)';
    ctx.stroke();

    // Mini circular percentage gauge on the left
    const cx = 96;
    const cy = 100;
    const cr = 54;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    const pctVal = Math.round(this.targetXpProgress * 100);
    if (this.targetXpProgress > 0.005) {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.targetXpProgress);
      ctx.lineCap = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = this.xpInfo.isMaxLevel ? '#fbbf24' : '#34d399';
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 32px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.xpInfo.isMaxLevel ? 'MAX' : `${pctVal}%`, cx, cy + 1);

    // Right side status text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const lvl = Math.max(1, Math.min(10, Math.round(this.xpInfo.level || 1)));
    let titleLine = `TIẾN TRÌNH XP · CẤP ${lvl} → ${lvl + 1}`;
    let subLine = `${Math.round(this.xpInfo.currentXp).toLocaleString('vi-VN')} / ${Math.round(
      this.xpInfo.maxXp,
    ).toLocaleString('vi-VN')} XP`;

    if (this.xpInfo.isMaxLevel) {
      titleLine = 'ĐỈNH CAO VIÊN MÃN · CẤP 10/10';
      subLine = 'Thần Thụ Kim Quang Thiên Giới';
    } else if (this.xpInfo.isCompletedStage) {
      titleLine = `ĐÃ HOÀN THÀNH CẤP ${lvl}`;
      subLine = `${Math.round(this.xpInfo.maxXp).toLocaleString('vi-VN')} XP · Mở khóa hoàn tất`;
    }

    ctx.fillStyle = this.xpInfo.isMaxLevel ? '#fde047' : '#6ee7b7';
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(titleLine, 178, 82);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 28px Inter, system-ui, sans-serif';
    ctx.fillText(subLine, 178, 132);

    this.xpBadgeTexture.needsUpdate = true;
  }

  private triggerLevelUpChoreography(level: number) {
    this.levelUpSeq = { active: true, level, time: 0, duration: 2.8 };
    if (this.bloomPass) {
      this.bloomPass.strength = level >= 10 ? 0.36 : level >= 8 ? 0.3 : 0.24;
    }

    if (level === 8) {
      this.treeBounce = { active: false, time: 0 };
      this.cameraShake = { active: true, time: 0, intensity: 0.16 };
      this.spawnSummoningPillar(4.9, 0xb85cff);
      this.spawnShockwave(0xb85cff, 10.5, 0.0);
      this.spawnShockwave(0x5ef2ff, 8.2, 0.16);
      this.spawnUpgradeBurst(8);
      this.dragon.triggerCelebrationSwoop();
    } else if (level === 9) {
      this.treeBounce = { active: true, time: 0 };
      this.cameraShake = { active: true, time: 0, intensity: 0.2 };
      this.spawnSummoningPillar(5.4, 0x7df9ff);
      this.spawnShockwave(0x7df9ff, 11.5, 0.0);
      this.spawnShockwave(0xd580ff, 9.0, 0.18);
      this.spawnUpgradeBurst(9);
      this.dragon.triggerCelebrationSwoop();
      this.camTransition.tiltOffset = 0.22;
    } else if (level === 10) {
      this.treeBounce = { active: true, time: 0 };
      this.cameraShake = { active: true, time: 0, intensity: 0.26 };
      this.spawnSummoningPillar(7.2, 0xffe082);
      this.spawnShockwave(0xf5b027, 18.0, 0.0);
      this.spawnShockwave(0x5ef2ff, 14.5, 0.18);
      this.spawnUpgradeBurst(10);
      this.dragon.triggerCelebrationSwoop();
      this.camTransition.tiltOffset = -0.18;
    } else {
      this.treeBounce = { active: true, time: 0 };
      this.spawnUpgradeBurst(level);
    }
  }

  private getResponsiveDistance(baseDist: number) {
    const { w, h } = this.getViewportSize();
    const aspect = w / Math.max(1, h);
    if (aspect < 1.0) {
      return baseDist / Math.max(0.64, Math.min(1.0, aspect * 1.18));
    }
    return baseDist;
  }

  private updateCameraFraming(level: number) {
    if (level === 10) {
      this.camTransition = {
        active: true,
        targetY: 3.4,
        idealDistance: this.getResponsiveDistance(18.6),
        tiltOffset: this.camTransition.tiltOffset,
      };
    } else if (level >= 8) {
      this.camTransition = {
        active: true,
        targetY: 2.9,
        idealDistance: this.getResponsiveDistance(17.6),
        tiltOffset: this.camTransition.tiltOffset,
      };
    } else {
      this.camTransition = {
        active: true,
        targetY: 1.85,
        idealDistance: this.getResponsiveDistance(12.2),
        tiltOffset: 0,
      };
    }
  }

  setCameraPreset(preset: 'canopy' | 'reset') {
    if (preset === 'canopy') {
      const canopyY = this.currentLevel >= 8 ? 5.0 : 3.1;
      const dist = this.getResponsiveDistance(this.currentLevel >= 8 ? 10.6 : 7.8);
      this.camTransition = { active: true, targetY: canopyY, idealDistance: dist, tiltOffset: 0.35 };
    } else {
      this.updateCameraFraming(this.currentLevel);
    }
  }

  adjustZoom(deltaFactor: number) {
    this.camTransition.active = false;
    this.tmpOffset.copy(this.camera.position).sub(this.controls.target);
    const currentDist = this.tmpOffset.length();
    const nextDist = THREE.MathUtils.clamp(
      currentDist * (1 + deltaFactor),
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    this.tmpOffset.setLength(nextDist);
    this.camera.position.copy(this.controls.target).add(this.tmpOffset);
  }

  triggerRainShower() {
    if (this.rainShowerSystem) {
      this.scene.remove(this.rainShowerSystem.points);
      this.rainShowerSystem.points.geometry.dispose();
    }
    const count = 240;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 4.5;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 2.0 + Math.random() * 11.0;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      speeds[i] = 7.5 + Math.random() * 5.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.22,
        map: createSoftGlowTexture('#7dd3fc', 'rgba(56,189,248,0)'),
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.rainShowerSystem = { points, count, speeds, age: 0, duration: 4.2 };
    this.spawnShockwave(0x38bdf8, 8.5, 0);
  }

  setWeather(weather: WeatherEffect) {
    if (this.activeWeather === weather) return;
    this.activeWeather = weather;
    this.updateAtmosphereForLevel(this.currentLevel);
    this.rebuildWeatherSystems();
  }

  private getWeatherVolumeForLevel(level: number) {
    const treeHeight =
      level === 1
        ? 1.5
        : level === 2
          ? 2.2
          : level <= 7
            ? THREE.MathUtils.lerp(2.8, 5.4, (level - 3) / 4)
            : level === 8
              ? 5.9
              : level === 9
                ? 6.4
                : 7.4;
    const radius = level <= 2 ? 4.3 : level <= 7 ? THREE.MathUtils.lerp(4.7, 6.2, (level - 3) / 4) : 7.2;
    const densityScale = 0.65 + (level / 10) * 0.7;
    return { maxY: treeHeight + 3.4, radius, densityScale, treeHeight };
  }

  private clearWeatherSystems() {
    if (this.weatherSnowSystem) {
      this.scene.remove(this.weatherSnowSystem.points);
      this.weatherSnowSystem.points.geometry.dispose();
      const mat = this.weatherSnowSystem.points.material as THREE.PointsMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.weatherSnowSystem = null;
    }
    if (this.weatherRainSystem) {
      this.scene.remove(this.weatherRainSystem.points);
      this.weatherRainSystem.points.geometry.dispose();
      const mat = this.weatherRainSystem.points.material as THREE.PointsMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.weatherRainSystem = null;
    }
    if (this.weatherLeafMesh) {
      this.scene.remove(this.weatherLeafMesh);
      this.weatherLeafMesh.geometry.dispose();
      (this.weatherLeafMesh.material as THREE.Material).dispose();
      this.weatherLeafMesh = null;
      this.weatherLeafData = null;
    }
    if (this.weatherSunGroup) {
      this.scene.remove(this.weatherSunGroup);
      this.weatherSunGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else if (mat) {
          if ((mat as THREE.PointsMaterial).map) {
            (mat as THREE.PointsMaterial).map?.dispose();
          }
          mat.dispose();
        }
      });
      this.weatherSunGroup = null;
      this.weatherSunRays = [];
      this.weatherSunMotes = null;
    }
  }

  private rebuildWeatherSystems() {
    this.clearWeatherSystems();
    if (this.activeWeather === 'clear') return;

    const { maxY, radius, densityScale, treeHeight } = this.getWeatherVolumeForLevel(this.currentLevel);

    if (this.activeWeather === 'snow') {
      this.buildSnowWeather(maxY, radius, densityScale);
    } else if (this.activeWeather === 'autumn') {
      this.buildAutumnLeafWeather(maxY, radius, densityScale);
    } else if (this.activeWeather === 'sunlight') {
      this.buildSunlightWeather(maxY, radius, densityScale, treeHeight);
    } else if (this.activeWeather === 'rain') {
      this.buildRainWeather(maxY, radius, densityScale);
    }
  }

  private buildSnowWeather(maxY: number, radius: number, densityScale: number) {
    const baseCount = this.isSoftwareGl ? 130 : 220;
    const count = Math.round(baseCount * densityScale);
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const swayPhases = new Float32Array(count);
    const swayAmps = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.45 + Math.random() * maxY;
      positions[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 0.55 + Math.random() * 0.75;
      swayPhases[i] = Math.random() * Math.PI * 2;
      swayAmps[i] = 0.25 + Math.random() * 0.45;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.26,
        map: createSnowflakeTexture(),
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.weatherSnowSystem = { points, count, speeds, swayPhases, swayAmps, maxY, radius };
  }

  private buildRainWeather(maxY: number, radius: number, densityScale: number) {
    const baseCount = this.isSoftwareGl ? 140 : 230;
    const count = Math.round(baseCount * densityScale);
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.5 + Math.random() * (maxY + 2.0);
      positions[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 6.2 + Math.random() * 4.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.2,
        map: createSoftGlowTexture('#bae6fd', 'rgba(56,189,248,0)'),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.weatherRainSystem = { points, count, speeds, maxY: maxY + 2.0, radius };
  }

  private buildAutumnLeafWeather(maxY: number, radius: number, densityScale: number) {
    const baseCount = this.isSoftwareGl ? 65 : 115;
    const count = Math.round(baseCount * densityScale);
    const leafGeo = createAutumnLeafGeometry();
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(leafGeo, leafMat, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const z = new Float32Array(count);
    const vy = new Float32Array(count);
    const rx = new Float32Array(count);
    const ry = new Float32Array(count);
    const rz = new Float32Array(count);
    const vrx = new Float32Array(count);
    const vry = new Float32Array(count);
    const vrz = new Float32Array(count);
    const phase = new Float32Array(count);
    const scale = new Float32Array(count);

    const palette = [
      new THREE.Color(0xffd54f),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0xf97316),
      new THREE.Color(0xeab308),
      new THREE.Color(0xfb923c),
    ];

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.sqrt(Math.random()) * radius;
      x[i] = Math.cos(a) * r;
      y[i] = 0.55 + Math.random() * maxY;
      z[i] = Math.sin(a) * r;
      vy[i] = 0.52 + Math.random() * 0.65;
      rx[i] = Math.random() * Math.PI * 2;
      ry[i] = Math.random() * Math.PI * 2;
      rz[i] = Math.random() * Math.PI * 2;
      vrx[i] = (Math.random() - 0.5) * 2.4;
      vry[i] = (Math.random() - 0.5) * 2.8;
      vrz[i] = (Math.random() - 0.5) * 2.2;
      phase[i] = Math.random() * Math.PI * 2;
      scale[i] = 0.72 + Math.random() * 0.68;

      this.weatherDummy.position.set(x[i], y[i], z[i]);
      this.weatherDummy.rotation.set(rx[i], ry[i], rz[i]);
      this.weatherDummy.scale.setScalar(scale[i]);
      this.weatherDummy.updateMatrix();
      mesh.setMatrixAt(i, this.weatherDummy.matrix);
      mesh.setColorAt(i, palette[i % palette.length]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.weatherLeafMesh = mesh;
    this.weatherLeafData = { x, y, z, vy, rx, ry, rz, vrx, vry, vrz, phase, scale, count, maxY, radius };
  }

  private buildSunlightWeather(maxY: number, radius: number, densityScale: number, treeHeight: number) {
    const group = new THREE.Group();
    this.scene.add(group);
    this.weatherSunGroup = group;
    this.weatherSunRays = [];

    const rayMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.foliageTimeUniform,
        uColor: { value: new THREE.Color(0xffe184) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float edgeFade = pow(abs(dot(vNormalView, viewDir)), 2.3);
          float vFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
          float shimmer = 0.82 + 0.18 * sin(vUv.x * 15.7 + uTime * 1.1);
          gl_FragColor = vec4(uColor, edgeFade * vFade * shimmer * 0.038);
        }
      `,
    });

    const rayConfigs = [
      { x: -2.1, z: 0.6, topR: 0.55, botR: 2.1, rotZ: -0.36, rotX: 0.14 },
      { x: -0.4, z: -0.7, topR: 0.72, botR: 2.55, rotZ: -0.32, rotX: 0.1 },
      { x: 1.5, z: 0.8, topR: 0.5, botR: 1.9, rotZ: -0.38, rotX: 0.16 },
    ];
    rayConfigs.forEach((cfg, idx) => {
      const geo = new THREE.CylinderGeometry(cfg.topR, cfg.botR, 20, 20, 1, true);
      const mesh = new THREE.Mesh(geo, rayMat);
      mesh.position.set(cfg.x, treeHeight + 4.8, cfg.z);
      mesh.rotation.set(cfg.rotX, 0, cfg.rotZ);
      group.add(mesh);
      this.weatherSunRays.push({ mesh, baseRotZ: cfg.rotZ, phase: idx * 1.3 });
    });

    const moteCount = Math.round((this.isSoftwareGl ? 75 : 130) * densityScale);
    const positions = new Float32Array(moteCount * 3);
    const phases = new Float32Array(moteCount);
    const speeds = new Float32Array(moteCount);

    for (let i = 0; i < moteCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.sqrt(Math.random()) * (radius * 0.85);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.5 + Math.random() * maxY;
      positions[i * 3 + 2] = Math.sin(a) * r;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.18 + Math.random() * 0.32;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const motePoints = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        size: 0.22,
        map: createSoftGlowTexture('#ffe894', 'rgba(255,215,96,0)'),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(motePoints);
    this.weatherSunMotes = { points: motePoints, count: moteCount, phases, speeds, maxY, radius: radius * 0.85 };
  }

  private buildWoodyTreeStages(container: THREE.Group, level: number) {
    const progress = (level - 3) / 6;
    const treeHeight = THREE.MathUtils.lerp(2.1, 4.6, progress);
    const baseRadius = THREE.MathUtils.lerp(0.16, 0.44, progress);
    const topRadius = baseRadius * 0.22;

    const barkMat = new THREE.MeshStandardMaterial({
      color: level === 7 ? 0x593d34 : 0x6e4e3a,
      roughness: 0.86,
      metalness: 0.05,
    });

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3(0.18 * (0.6 + progress), treeHeight * 0.32, 0.12),
      new THREE.Vector3(-0.16 * (0.6 + progress), treeHeight * 0.68, -0.1),
      new THREE.Vector3(0.05, treeHeight, 0.04),
    ]);
    const trunkMesh = new THREE.Mesh(
      createTaperedTube(trunkCurve, 26, baseRadius, topRadius, 14, 0.85),
      barkMat,
    );
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    container.add(trunkMesh);

    if (level >= 4) {
      const rootCount = level === 7 ? 5 : 4;
      for (let r = 0; r < rootCount; r++) {
        const angle = (r / rootCount) * Math.PI * 2 + 0.3;
        const rootReach = baseRadius * 2.5 + 0.35;
        const rootCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(angle) * baseRadius * 0.5, treeHeight * 0.14, Math.sin(angle) * baseRadius * 0.5),
          new THREE.Vector3(Math.cos(angle) * (rootReach * 0.65), 0.14, Math.sin(angle) * (rootReach * 0.65)),
          new THREE.Vector3(Math.cos(angle) * rootReach, -0.08, Math.sin(angle) * rootReach),
        ]);
        const rootMesh = new THREE.Mesh(createTaperedTube(rootCurve, 12, baseRadius * 0.42, 0.03, 8), barkMat);
        rootMesh.castShadow = true;
        container.add(rootMesh);
      }
    }

    const branchCount = Math.min(2 + Math.floor((level - 2) * 1.1), 8);
    const foliageAnchors = [{ pos: trunkCurve.getPointAt(1.0).clone(), scale: 1.18 }];

    for (let b = 0; b < branchCount; b++) {
      const tAttach = THREE.MathUtils.lerp(0.42, 0.92, b / Math.max(branchCount - 1, 1));
      const startPt = trunkCurve.getPointAt(tAttach);
      const azimuth = b * 2.39996;
      const reach = THREE.MathUtils.lerp(0.75, 2.25, progress) * (1.15 - tAttach * 0.45);
      const rise = reach * THREE.MathUtils.lerp(0.55, 0.85, tAttach);
      const midPt = new THREE.Vector3(
        startPt.x + Math.cos(azimuth) * reach * 0.55,
        startPt.y + rise * 0.45,
        startPt.z + Math.sin(azimuth) * reach * 0.55,
      );
      const endPt = new THREE.Vector3(
        startPt.x + Math.cos(azimuth) * reach,
        startPt.y + rise,
        startPt.z + Math.sin(azimuth) * reach,
      );

      const bStartR = baseRadius * THREE.MathUtils.lerp(0.45, 0.25, tAttach);
      const bMesh = new THREE.Mesh(
        createTaperedTube(new THREE.CatmullRomCurve3([startPt, midPt, endPt]), 12, bStartR, bStartR * 0.24, 8),
        barkMat,
      );
      bMesh.castShadow = true;
      container.add(bMesh);

      foliageAnchors.push({ pos: endPt, scale: 1.0 });
      if (level >= 5) foliageAnchors.push({ pos: midPt, scale: 0.78 });
    }

    const palette =
      level <= 4
        ? [
            { bottom: 0x267339, top: 0x7be052 },
            { bottom: 0x2f8540, top: 0x98f065 },
          ]
        : level <= 6
          ? [
              { bottom: 0x1d633b, top: 0x5ec956 },
              { bottom: 0x2a7a3e, top: 0x9ae354 },
              { bottom: 0x3b873e, top: 0xc9eb59 },
            ]
          : [
              { bottom: 0xb83b6e, top: 0xffb7d5 },
              { bottom: 0xc94b7c, top: 0xffd6e7 },
              { bottom: 0xd46a7e, top: 0xffe8b8 },
            ];

    const puffsPerAnchor = level <= 4 ? 3 : level <= 6 ? 4 : 5;
    const baseClusterRadius = THREE.MathUtils.lerp(0.46, 0.82, progress);

    foliageAnchors.forEach((anchor, aIdx) => {
      const clusterGroup = new THREE.Group();
      clusterGroup.position.copy(anchor.pos);
      for (let p = 0; p < puffsPerAnchor; p++) {
        const pAngle = (p / puffsPerAnchor) * Math.PI * 2 + aIdx;
        const spread = p === 0 ? 0 : baseClusterRadius * 0.65;
        const yOffset = p === 0 ? baseClusterRadius * 0.25 : (p % 2) * 0.18 - 0.06;
        const colors = palette[(aIdx + p) % palette.length];
        const radius = baseClusterRadius * anchor.scale * (p === 0 ? 1.05 : 0.72 + (p % 2) * 0.15);
        const puff = createStylizedFoliageCluster(radius, colors.bottom, colors.top, aIdx * 10 + p);
        puff.position.set(Math.cos(pAngle) * spread, yOffset, Math.sin(pAngle) * spread);
        clusterGroup.add(puff);
      }
      container.add(clusterGroup);
      this.swayElements.push({ obj: clusterGroup, speed: 1.6 + (aIdx % 3) * 0.3, amp: 0.045, phase: aIdx * 0.9 });
    });

    if (level === 7) this.createFallingPetals(75, treeHeight);
  }

  private buildSupremeWorldTree(container: THREE.Group, level: number) {
    const isLevel10 = level === 10;
    const isLevel9 = level === 9;
    const treeHeight = isLevel10 ? 5.9 : isLevel9 ? 5.4 : 4.9;
    const baseRadius = isLevel10 ? 0.68 : isLevel9 ? 0.6 : 0.54;
    const topRadius = baseRadius * 0.18;

    const barkMat = new THREE.MeshStandardMaterial({
      color: isLevel10 ? 0x613a12 : 0x3b2954,
      emissive: isLevel10 ? 0x361d03 : 0x160d26,
      emissiveIntensity: isLevel10 ? 0.24 : 0.15,
      roughness: isLevel10 ? 0.55 : 0.82,
      metalness: isLevel10 ? 0.36 : 0.08,
    });

    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3(0.26, treeHeight * 0.28, 0.18),
      new THREE.Vector3(-0.24, treeHeight * 0.62, -0.15),
      new THREE.Vector3(0.07, treeHeight * 0.88, 0.05),
      new THREE.Vector3(0, treeHeight, 0),
    ]);
    const trunkMesh = new THREE.Mesh(
      createTaperedTube(trunkCurve, 34, baseRadius, topRadius, 16, 0.8),
      barkMat,
    );
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    container.add(trunkMesh);

    const veinPrimaryMat = new THREE.MeshStandardMaterial({
      color: isLevel10 ? 0xffcf56 : 0x3dffb8,
      emissive: isLevel10 ? 0xd98a1c : 0x24f5a8,
      emissiveIntensity: 1.25,
      roughness: 0.22,
    });
    const veinSecondaryMat = new THREE.MeshStandardMaterial({
      color: isLevel10 ? 0x5ef2ff : 0xffe484,
      emissive: isLevel10 ? 0x0097a7 : 0xffc847,
      emissiveIntensity: 1.15,
      roughness: 0.22,
    });

    const rootCount = 6;
    const underRootTips: THREE.Vector3[] = [];
    for (let r = 0; r < rootCount; r++) {
      const angle = (r / rootCount) * Math.PI * 2 + 0.25;
      const surfaceReach = baseRadius * 2.7 + 0.65;
      const p0 = new THREE.Vector3(Math.cos(angle) * baseRadius * 0.45, treeHeight * 0.16, Math.sin(angle) * baseRadius * 0.45);
      const p1 = new THREE.Vector3(Math.cos(angle) * (surfaceReach * 0.62), 0.18, Math.sin(angle) * (surfaceReach * 0.62));
      const p2 = new THREE.Vector3(Math.cos(angle) * surfaceReach, -0.08, Math.sin(angle) * surfaceReach);

      const rootMesh = new THREE.Mesh(
        createTaperedTube(new THREE.CatmullRomCurve3([p0, p1, p2]), 14, baseRadius * 0.44, 0.04, 8),
        barkMat,
      );
      rootMesh.castShadow = true;
      container.add(rootMesh);

      const pierceOutR = 2.4 + (r % 2) * 0.55;
      const pierceMidY = -2.8 - (r % 3) * 0.45;
      const pierceTipY = -4.9 - (r % 3) * 0.65;
      const pierceTipPos = new THREE.Vector3(
        Math.cos(angle + 0.18) * (pierceOutR * 0.55),
        pierceTipY,
        Math.sin(angle + 0.18) * (pierceOutR * 0.55),
      );
      underRootTips.push(pierceTipPos);

      container.add(
        new THREE.Mesh(
          createTaperedTube(
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(Math.cos(angle) * 0.4, -0.4, Math.sin(angle) * 0.4),
              new THREE.Vector3(Math.cos(angle + 0.1) * pierceOutR, pierceMidY, Math.sin(angle + 0.1) * pierceOutR),
              pierceTipPos,
            ]),
            16,
            baseRadius * 0.36,
            0.025,
            8,
          ),
          barkMat,
        ),
      );

      const vinePts = [
        pierceTipPos.clone(),
        new THREE.Vector3(Math.cos(angle + 0.1) * pierceOutR, pierceMidY, Math.sin(angle + 0.1) * pierceOutR),
        new THREE.Vector3(p2.x, 0.02, p2.z),
        new THREE.Vector3(p1.x, 0.25, p1.z),
      ];
      for (let s = 0; s <= 16; s++) {
        const t = s / 16;
        const c = trunkCurve.getPointAt(t);
        const rad = THREE.MathUtils.lerp(baseRadius, topRadius, Math.pow(t, 0.8)) * 1.018;
        const spiral = angle + t * Math.PI * 2.5;
        vinePts.push(new THREE.Vector3(c.x + Math.cos(spiral) * rad, c.y, c.z + Math.sin(spiral) * rad));
      }
      container.add(
        new THREE.Mesh(
          createTaperedTube(new THREE.CatmullRomCurve3(vinePts), 36, 0.028, 0.008, 6),
          r % 2 === 0 ? veinPrimaryMat : veinSecondaryMat,
        ),
      );
    }

    this.createRootEssenceDroplets(underRootTips, isLevel10);

    const mainBranchCount = isLevel10 ? 10 : isLevel9 ? 9 : 7;
    const canopyZones: { center: THREE.Vector3; rx: number; ry: number; rz: number }[] = [];
    const hangingAnchorPoints: THREE.Vector3[] = [];

    canopyZones.push({ center: trunkCurve.getPointAt(1.0).clone().add(new THREE.Vector3(0, 0.55, 0)), rx: 2.0, ry: 1.0, rz: 2.0 });

    for (let b = 0; b < mainBranchCount; b++) {
      const tAttach = THREE.MathUtils.lerp(0.44, 0.92, b / (mainBranchCount - 1));
      const startPt = trunkCurve.getPointAt(tAttach);
      const azimuth = b * 2.39996;
      const reach = THREE.MathUtils.lerp(3.15, 1.65, (tAttach - 0.44) / 0.48) * (isLevel10 ? 1.15 : 1.04);
      const rise = reach * THREE.MathUtils.lerp(0.42, 0.76, tAttach);

      const midPt = new THREE.Vector3(
        startPt.x + Math.cos(azimuth) * reach * 0.55,
        startPt.y + rise * 0.56,
        startPt.z + Math.sin(azimuth) * reach * 0.55,
      );
      const endPt = new THREE.Vector3(
        startPt.x + Math.cos(azimuth) * reach,
        startPt.y + rise * 0.84,
        startPt.z + Math.sin(azimuth) * reach,
      );

      const bStartR = baseRadius * THREE.MathUtils.lerp(0.38, 0.22, tAttach);
      const bMesh = new THREE.Mesh(
        createTaperedTube(new THREE.CatmullRomCurve3([startPt, midPt, endPt]), 14, bStartR, bStartR * 0.2, 8),
        barkMat,
      );
      bMesh.castShadow = true;
      container.add(bMesh);

      const bVeinCurve = new THREE.CatmullRomCurve3([
        startPt.clone(),
        midPt.clone().add(new THREE.Vector3(0, bStartR * 0.65, 0)),
        endPt.clone(),
      ]);
      container.add(
        new THREE.Mesh(
          createTaperedTube(bVeinCurve, 12, 0.022, 0.005, 6),
          b % 2 === 0 ? veinPrimaryMat : veinSecondaryMat,
        ),
      );

      canopyZones.push({ center: endPt, rx: 1.5, ry: 0.85, rz: 1.5 });
      canopyZones.push({ center: midPt, rx: 1.2, ry: 0.7, rz: 1.2 });
      hangingAnchorPoints.push(endPt.clone(), midPt.clone());
    }

    this.buildInstancedMythicCanopy(container, canopyZones, treeHeight, level);
    this.buildHangingLightVines(container, hangingAnchorPoints, isLevel10);
    this.buildHeartOfWorldTree(container, trunkCurve.getPointAt(0.75), level);
    this.buildSupremeMagicCircles(container, treeHeight, level);
    this.buildCelestialSkyBeam(treeHeight, level);
    this.spawnOrbitingCrystalIslets(5, isLevel10);
    this.createRisingSpirits(isLevel10 ? 130 : isLevel9 ? 95 : 70, treeHeight, isLevel10);
    this.createFireflies(isLevel10 ? 90 : 70, treeHeight + 1.5, isLevel10);
  }

  private buildInstancedMythicCanopy(
    container: THREE.Group,
    canopyZones: { center: THREE.Vector3; rx: number; ry: number; rz: number }[],
    treeHeight: number,
    level: number,
  ) {
    const isLevel10 = level === 10;
    const strandGeo = createWillowStrandGeometry();
    const strandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: isLevel10 ? 0x451f02 : 0x241445,
      emissiveIntensity: isLevel10 ? 0.12 : 0.35,
      roughness: isLevel10 ? 0.44 : 0.48,
      metalness: isLevel10 ? 0.3 : 0.05,
      side: THREE.DoubleSide,
    });

    strandMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.foliageTimeUniform;
      shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec4 worldOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float tipFactor = 1.0 - uv.y;
        float waveX = sin(uTime * 1.9 + worldOrigin.x * 1.4 + worldOrigin.z * 1.2) * 0.17;
        float waveZ = cos(uTime * 1.6 + worldOrigin.z * 1.5 - worldOrigin.x * 1.1) * 0.17;
        transformed.x += waveX * tipFactor * tipFactor;
        transformed.z += waveZ * tipFactor * tipFactor;
        `,
      );
    };

    const strandsPerZone = isLevel10 ? 105 : level === 9 ? 88 : 74;
    const instancedLeaves = new THREE.InstancedMesh(strandGeo, strandMat, canopyZones.length * strandsPerZone);
    instancedLeaves.castShadow = true;
    instancedLeaves.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const cDeepBlue = new THREE.Color(0x1e6bff);
    const cNebulaPurple = new THREE.Color(0xb85cff);
    const cTipGold = new THREE.Color(0xf5b027);
    const cDeepAmber = new THREE.Color(0x733205);
    const cRichGold = new THREE.Color(0xcc7a10);
    const cSunlitGold = new THREE.Color(0xffcd45);

    let idx = 0;
    const maxRadius = 4.1;
    canopyZones.forEach((zone) => {
      for (let i = 0; i < strandsPerZone; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        const rNorm = Math.pow(Math.random(), 0.45);

        const lx = zone.center.x + Math.sin(phi) * Math.cos(theta) * zone.rx * rNorm;
        const ly = zone.center.y + Math.cos(phi) * zone.ry * rNorm * 0.85;
        const lz = zone.center.z + Math.sin(phi) * Math.sin(theta) * zone.rz * rNorm;

        dummy.position.set(lx, ly, lz);
        dummy.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35);
        dummy.scale.setScalar(THREE.MathUtils.lerp(0.88, 1.5, Math.random()) * (isLevel10 ? 1.12 : 1.0));
        dummy.updateMatrix();
        instancedLeaves.setMatrixAt(idx, dummy.matrix);

        const radialDist = THREE.MathUtils.clamp(Math.hypot(lx, lz) / maxRadius, 0, 1);
        const heightNorm = THREE.MathUtils.clamp((ly - 2.2) / (treeHeight - 1.5), 0, 1);
        const blendT = THREE.MathUtils.clamp(radialDist * 0.58 + heightNorm * 0.42, 0, 1);

        if (isLevel10) {
          if (blendT < 0.45) color.lerpColors(cDeepAmber, cRichGold, blendT / 0.45);
          else color.lerpColors(cRichGold, cSunlitGold, (blendT - 0.45) / 0.55);
        } else {
          if (blendT < 0.45) color.lerpColors(cDeepBlue, cNebulaPurple, blendT / 0.45);
          else color.lerpColors(cNebulaPurple, cTipGold, (blendT - 0.45) / 0.55);
        }
        instancedLeaves.setColorAt(idx, color);
        idx++;
      }
    });

    instancedLeaves.instanceMatrix.needsUpdate = true;
    if (instancedLeaves.instanceColor) instancedLeaves.instanceColor.needsUpdate = true;
    container.add(instancedLeaves);
  }

  private buildHangingLightVines(container: THREE.Group, anchorPoints: THREE.Vector3[], isLevel10: boolean) {
    const vineCount = isLevel10 ? 40 : 30;
    const beadGeo = new THREE.OctahedronGeometry(0.052, 0);
    beadGeo.scale(0.6, 1.8, 0.6);

    const mats = isLevel10
      ? [
          new THREE.MeshStandardMaterial({ color: 0xffcf56, emissive: 0xc97b10, emissiveIntensity: 1.15 }),
          new THREE.MeshStandardMaterial({ color: 0xffe082, emissive: 0xd98a1c, emissiveIntensity: 1.05 }),
        ]
      : [
          new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x00b8d4, emissiveIntensity: 1.35 }),
          new THREE.MeshStandardMaterial({ color: 0xe699ff, emissive: 0x9c27b0, emissiveIntensity: 1.3 }),
          new THREE.MeshStandardMaterial({ color: 0xffe57f, emissive: 0xd98a1c, emissiveIntensity: 1.3 }),
        ];

    for (let v = 0; v < vineCount; v++) {
      const anchor = anchorPoints[v % anchorPoints.length];
      const angle = (v * 2.39996) % (Math.PI * 2);
      const offsetR = 0.25 + (v % 4) * 0.28;
      const length = 1.25 + (v % 5) * 0.35;

      const vineGroup = new THREE.Group();
      vineGroup.position.set(anchor.x + Math.cos(angle) * offsetR, anchor.y - 0.15, anchor.z + Math.sin(angle) * offsetR);
      const mat = mats[v % mats.length];
      vineGroup.add(
        new THREE.Mesh(
          createTaperedTube(
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0.04, -length * 0.5, 0.03),
              new THREE.Vector3(-0.02, -length, 0),
            ]),
            8,
            0.011,
            0.004,
            5,
          ),
          mat,
        ),
      );

      const beadCount = isLevel10 ? 5 : 4;
      for (let b = 1; b <= beadCount; b++) {
        const t = b / beadCount;
        const bead = new THREE.Mesh(beadGeo, mat);
        bead.position.set(Math.sin(t * 3.0) * 0.03, -t * length, Math.cos(t * 3.0) * 0.03);
        bead.scale.setScalar(b === beadCount ? 1.3 : 0.82);
        vineGroup.add(bead);
      }

      container.add(vineGroup);
      this.swayElements.push({ obj: vineGroup, speed: 1.7 + (v % 4) * 0.25, amp: 0.09, phase: v * 0.85 });
    }
  }

  private buildHeartOfWorldTree(container: THREE.Group, centerPos: THREE.Vector3, level: number) {
    const isLevel10 = level === 10;
    const heartGroup = new THREE.Group();
    heartGroup.position.copy(centerPos).add(new THREE.Vector3(0, 0.3, 0.25));
    container.add(heartGroup);
    this.treeHeartGroup = heartGroup;

    heartGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(isLevel10 ? 0.38 : 0.34, 24, 24),
        new THREE.MeshStandardMaterial({
          color: isLevel10 ? 0xffdf73 : 0xe0f7fa,
          emissive: isLevel10 ? 0xd98a1c : 0x26c6da,
          emissiveIntensity: 1.35,
          roughness: 0.15,
        }),
      ),
    );

    const petalGeo = new THREE.ConeGeometry(0.16, 0.56, 5);
    petalGeo.translate(0, 0.28, 0);
    const petalMat = new THREE.MeshStandardMaterial({
      color: isLevel10 ? 0xffcf56 : 0xe6b8ff,
      emissive: isLevel10 ? 0xc97b10 : 0xab47bc,
      emissiveIntensity: 1.15,
      roughness: 0.25,
      transparent: true,
      opacity: 0.92,
    });

    for (let i = 0; i < 8; i++) {
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.rotation.y = (i / 8) * Math.PI * 2;
      petal.rotation.z = 0.68;
      heartGroup.add(petal);
    }
  }

  private buildSupremeMagicCircles(container: THREE.Group, treeHeight: number, level: number) {
    const isLevel10 = level === 10;
    const texMain = createRuneCircleTexture(
      isLevel10 ? '#ffcf56' : '#6ef7ff',
      isLevel10 ? '#d98a1c' : '#d580ff',
      isLevel10,
    );
    const texSub = createRuneCircleTexture(
      isLevel10 ? '#ffe082' : '#ff9ce6',
      isLevel10 ? '#b86b00' : '#7df9ff',
      false,
    );

    const makeCircleMat = (tex: THREE.CanvasTexture, opacity = 0.85) =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

    const groundCircle = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 5.0), makeCircleMat(texMain, 0.65));
    groundCircle.rotation.x = -Math.PI / 2;
    groundCircle.position.y = 0.08;
    container.add(groundCircle);
    this.runeRings.push({ mesh: groundCircle, speed: 0.35 });

    const topY = treeHeight + 1.45;
    [
      { size: isLevel10 ? 6.8 : 6.0, speed: 0.42, tex: texMain, tiltX: -Math.PI / 2 },
      { size: isLevel10 ? 5.0 : 4.4, speed: -0.68, tex: texSub, tiltX: -Math.PI / 2 + 0.08 },
      { size: isLevel10 ? 3.4 : 3.0, speed: 0.95, tex: texMain, tiltX: -Math.PI / 2 - 0.08 },
    ].forEach((cfg, idx) => {
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size, cfg.size), makeCircleMat(cfg.tex, 0.45));
      halo.rotation.x = cfg.tiltX;
      halo.position.y = topY + idx * 0.22;
      container.add(halo);
      this.runeRings.push({ mesh: halo, speed: cfg.speed });
    });
  }

  private buildCelestialSkyBeam(treeHeight: number, level: number) {
    const isLevel10 = level === 10;
    const beamGeo = new THREE.CylinderGeometry(isLevel10 ? 1.15 : 1.05, isLevel10 ? 2.35 : 2.15, 20, 32, 1, true);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.foliageTimeUniform,
        uColorTop: { value: new THREE.Color(isLevel10 ? 0xffd54f : 0x7df9ff) },
        uColorBottom: { value: new THREE.Color(isLevel10 ? 0xd98a1c : 0xd580ff) },
        uAlpha: { value: isLevel10 ? 0.055 : 0.09 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormalView = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorTop;
        uniform vec3 uColorBottom;
        uniform float uAlpha;
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float edgeFade = pow(abs(dot(vNormalView, viewDir)), 2.0);
          float verticalFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
          float rays = 0.78 + 0.22 * sin(vUv.x * 37.699 + uTime * 1.3);
          vec3 col = mix(uColorBottom, uColorTop, vUv.y);
          gl_FragColor = vec4(col, edgeFade * verticalFade * rays * uAlpha);
        }
      `,
    });

    this.skyBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.skyBeamMesh.position.set(0, treeHeight + 7.2, 0);
    this.scene.add(this.skyBeamMesh);
  }

  private spawnSummoningPillar(treeHeight: number, colorHex = 0x9ef8ff) {
    const geo = new THREE.CylinderGeometry(0.65, 2.3, 22, 32, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.summonBeamMesh = new THREE.Mesh(geo, mat);
    this.summonBeamMesh.position.set(0, treeHeight + 6.0, 0);
    this.scene.add(this.summonBeamMesh);
  }

  private spawnOrbitingCrystalIslets(count: number, isLevel10: boolean) {
    const stoneMat = new THREE.MeshStandardMaterial({
      color: isLevel10 ? 0x5c4866 : 0x4b3e5e,
      roughness: 0.85,
      flatShading: true,
    });
    const topMat = new THREE.MeshStandardMaterial({
      color: isLevel10 ? 0x3b947c : 0x3b7a6b,
      roughness: 0.72,
      flatShading: true,
    });
    const crystalMats = isLevel10
      ? [
          new THREE.MeshStandardMaterial({ color: 0xffcf56, emissive: 0xc97b10, emissiveIntensity: 1.15, roughness: 0.2 }),
          new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00838f, emissiveIntensity: 1.15, roughness: 0.2 }),
        ]
      : [
          new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x00acc1, emissiveIntensity: 1.35, roughness: 0.2 }),
          new THREE.MeshStandardMaterial({ color: 0xdf80ff, emissive: 0x8e24aa, emissiveIntensity: 1.35, roughness: 0.2 }),
        ];

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.92, 6), stoneMat);
      base.rotation.x = Math.PI;
      base.position.y = -0.46;
      group.add(base);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.44, 0.14, 6), topMat);
      cap.position.y = 0.05;
      group.add(cap);

      const cMat = crystalMats[i % crystalMats.length];
      for (let k = 0; k < 3; k++) {
        const h = k === 0 ? 0.56 : 0.34;
        const r = k === 0 ? 0.085 : 0.055;
        const crystal = new THREE.Mesh(new THREE.CylinderGeometry(0.01, r, h, 5), cMat);
        const ang = (k / 3) * Math.PI * 2;
        crystal.position.set(Math.cos(ang) * 0.12, 0.12 + h * 0.45, Math.sin(ang) * 0.12);
        crystal.rotation.z = Math.cos(ang) * 0.2;
        crystal.rotation.x = Math.sin(ang) * 0.2;
        group.add(crystal);
      }

      const orbitR = 5.3 + (i % 3) * 0.65;
      const baseY = 1.6 + i * 0.85;
      const angle = (i / count) * Math.PI * 2;
      group.position.set(Math.cos(angle) * orbitR, baseY, Math.sin(angle) * orbitR);
      this.scene.add(group);
      this.orbitingIslets.push({ group, orbitR, baseY, angle, speed: 0.2 + (i % 2) * 0.08, bobPhase: i * 1.4 });
    }
  }

  private createRootEssenceDroplets(tipPositions: THREE.Vector3[], isLevel10: boolean) {
    if (!tipPositions.length) return;
    const count = 40;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const tip = tipPositions[i % tipPositions.length];
      positions[i * 3] = tip.x + (Math.random() - 0.5) * 0.25;
      positions[i * 3 + 1] = tip.y - Math.random() * 2.5;
      positions[i * 3 + 2] = tip.z + (Math.random() - 0.5) * 0.25;
      phases[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.2,
        map: createSoftGlowTexture(isLevel10 ? '#ffcf56' : '#5ef2ff', 'rgba(255,255,255,0)'),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.rootDropletSystem = { points, count, tipPositions, phases };
  }

  private createGoldenStardustRain(count: number, treeHeight: number) {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 5.2;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 0.6 + Math.random() * (treeHeight + 3.2);
      positions[i * 3 + 2] = Math.sin(angle) * r;
      speeds[i] = 0.45 + Math.random() * 0.65;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.24,
        map: createSoftGlowTexture('#ffe57f', 'rgba(255,215,64,0)'),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.stardustRainSystem = { points, count, speeds, phases, maxY: treeHeight + 3.4 };
  }

  private createFallingPetals(count: number, maxHeight: number) {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 3.0;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 1.2 + Math.random() * maxHeight;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      speeds[i] = 0.35 + Math.random() * 0.45;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.22,
        map: createSoftGlowTexture('#ffcce0', 'rgba(255,182,193,0)'),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.petalSystem = { points, count, speeds, maxHeight };
  }

  private createRisingSpirits(count: number, maxHeight: number, isLevel10: boolean) {
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      angles[i] = Math.random() * Math.PI * 2;
      radii[i] = 0.8 + Math.random() * 3.6;
      positions[i * 3] = Math.cos(angles[i]) * radii[i];
      positions[i * 3 + 1] = 0.4 + Math.random() * (maxHeight + 2.5);
      positions[i * 3 + 2] = Math.sin(angles[i]) * radii[i];
      speeds[i] = 0.65 + Math.random() * 0.95;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: isLevel10 ? 0.25 : 0.22,
        map: createSoftGlowTexture(isLevel10 ? '#5ef2ff' : '#9cf8ff', 'rgba(125,249,255,0)'),
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.risingSpiritSystem = { points, count, radii, angles, speeds, maxY: maxHeight + 3.0 };
  }

  private createFireflies(count: number, maxHeight: number, isLevel10: boolean) {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1.0 + Math.random() * 3.6;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 0.6 + Math.random() * maxHeight;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.24,
        map: createSoftGlowTexture(isLevel10 ? '#ffcf56' : '#ffe47a', 'rgba(255,215,0,0)'),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.fireflySystem = { points, count, phases };
  }

  private spawnShockwave(colorHex = 0x7df9ff, maxScale = 9.5, delay = 0) {
    const ringGeo = new THREE.RingGeometry(0.4, 0.72, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: delay > 0 ? 0.0 : 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(0, 0.45, 0);
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, age: -delay, maxAge: 1.35, maxScale });
  }

  private spawnUpgradeBurst(level: number) {
    const count = level >= 8 ? 160 : 90;
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = level >= 8 ? 2.8 : 1.5;
      positions[i * 3 + 2] = 0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.75;
      const speed = (level >= 8 ? 3.5 : 2.2) + Math.random() * 4.5;
      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed + 2.0,
          Math.sin(phi) * Math.sin(theta) * speed,
        ),
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const burstColor = level === 10 ? '#ffd54f' : level >= 8 ? '#8ef8ff' : '#a8ff78';
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: level >= 8 ? 0.34 : 0.28,
        map: createSoftGlowTexture(burstColor, 'rgba(255,255,255,0)'),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(points);
    this.burstSystems.push({ points, velocities, age: 0, maxAge: 1.5 });
  }

  setLevel(newLevel: number, withEffect = true) {
    const clamped = THREE.MathUtils.clamp(Math.round(newLevel), 1, 10);
    if (clamped === this.currentLevel && this.treeRootGroup.children.length > 0 && !withEffect) return;
    this.currentLevel = clamped;
    this.buildTree(this.currentLevel, withEffect);
  }

  setOnTreeTouch(cb?: (payload: TreeTouchPayload) => void) {
    this.onTreeTouch = cb;
  }

  setPostDeepWorkBlessing(active: boolean) {
    this.postDeepWorkBlessing = active;
  }

  private collectTreeMaterials() {
    this.treeMaterials = [];
    const seen = new Set<THREE.MeshStandardMaterial>();
    this.treeRootGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial && !seen.has(m)) {
            seen.add(m);
            this.treeMaterials.push({
              mat: m,
              baseEmissive: m.emissive.clone(),
              baseIntensity: m.emissiveIntensity,
            });
          }
        });
      } else if (mat instanceof THREE.MeshStandardMaterial && !seen.has(mat)) {
        seen.add(mat);
        this.treeMaterials.push({
          mat,
          baseEmissive: mat.emissive.clone(),
          baseIntensity: mat.emissiveIntensity,
        });
      }
    });
  }

  private clearTouchLeaves() {
    if (this.touchLeafMesh) {
      this.scene.remove(this.touchLeafMesh);
      this.touchLeafMesh.geometry.dispose();
      (this.touchLeafMesh.material as THREE.Material).dispose();
      this.touchLeafMesh = null;
      this.touchLeafData = null;
    }
  }

  private spawnTouchLeaves(hitPoint: THREE.Vector3 | undefined, boosted: boolean) {
    this.clearTouchLeaves();

    const lvl = this.currentLevel;
    const canopyY =
      lvl === 1
        ? 0.9
        : lvl === 2
          ? 1.15
          : lvl <= 7
            ? THREE.MathUtils.lerp(2.15, 4.35, (lvl - 3) / 4)
            : lvl === 10
              ? 5.6
              : 4.85;
    const canopyRadius =
      lvl <= 2 ? 0.72 : lvl <= 7 ? THREE.MathUtils.lerp(1.25, 2.45, (lvl - 3) / 4) : 3.35;

    const count = boosted ? (this.isSoftwareGl ? 28 : 48) : this.isSoftwareGl ? 16 : 26;
    const leafGeo = createAutumnLeafGeometry();
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: boosted ? 0xf59e0b : lvl === 7 ? 0xf472b6 : 0x10b981,
      emissiveIntensity: boosted ? 0.58 : 0.32,
      roughness: 0.4,
      metalness: 0.06,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
    });

    const mesh = new THREE.InstancedMesh(leafGeo, leafMat, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const z = new Float32Array(count);
    const vx = new Float32Array(count);
    const vy = new Float32Array(count);
    const vz = new Float32Array(count);
    const rx = new Float32Array(count);
    const ry = new Float32Array(count);
    const rz = new Float32Array(count);
    const vrx = new Float32Array(count);
    const vry = new Float32Array(count);
    const vrz = new Float32Array(count);
    const phase = new Float32Array(count);
    const baseScale = new Float32Array(count);

    const palette = boosted
      ? [
          new THREE.Color(0xffe066),
          new THREE.Color(0xfbbf24),
          new THREE.Color(0x6ee7b7),
          new THREE.Color(0x34d399),
          new THREE.Color(0xfde047),
        ]
      : lvl === 7
        ? [
            new THREE.Color(0xffb7d5),
            new THREE.Color(0xffd6e7),
            new THREE.Color(0xf9a8d4),
            new THREE.Color(0xfff1f2),
          ]
        : lvl >= 8
          ? [
              new THREE.Color(0x7df9ff),
              new THREE.Color(0xffcf56),
              new THREE.Color(0x6ee7b7),
              new THREE.Color(0xd8b4fe),
            ]
          : [
              new THREE.Color(0x8ef564),
              new THREE.Color(0x4ade80),
              new THREE.Color(0xbef264),
              new THREE.Color(0x34d399),
            ];

    const anchorX = hitPoint ? THREE.MathUtils.clamp(hitPoint.x * 0.45, -1.2, 1.2) : 0;
    const anchorZ = hitPoint ? THREE.MathUtils.clamp(hitPoint.z * 0.45, -1.2, 1.2) : 0;
    const anchorY = hitPoint ? THREE.MathUtils.lerp(canopyY, Math.max(1.0, hitPoint.y), 0.35) : canopyY;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = (0.18 + Math.sqrt(Math.random()) * 0.85) * canopyRadius;
      x[i] = anchorX + Math.cos(angle) * r;
      y[i] = anchorY + (Math.random() - 0.38) * (lvl <= 2 ? 0.6 : 1.7);
      z[i] = anchorZ + Math.sin(angle) * r;

      const outSpeed = (boosted ? 0.85 : 0.55) + Math.random() * 0.95;
      vx[i] = Math.cos(angle) * outSpeed;
      vy[i] = (boosted ? 0.55 : 0.3) + Math.random() * 0.9;
      vz[i] = Math.sin(angle) * outSpeed;

      rx[i] = Math.random() * Math.PI * 2;
      ry[i] = Math.random() * Math.PI * 2;
      rz[i] = Math.random() * Math.PI * 2;
      vrx[i] = (Math.random() - 0.5) * 3.8;
      vry[i] = (Math.random() - 0.5) * 4.2;
      vrz[i] = (Math.random() - 0.5) * 3.4;
      phase[i] = Math.random() * Math.PI * 2;
      baseScale[i] = (boosted ? 0.95 : 0.78) + Math.random() * 0.65;

      this.touchLeafDummy.position.set(x[i], y[i], z[i]);
      this.touchLeafDummy.rotation.set(rx[i], ry[i], rz[i]);
      this.touchLeafDummy.scale.setScalar(baseScale[i]);
      this.touchLeafDummy.updateMatrix();
      mesh.setMatrixAt(i, this.touchLeafDummy.matrix);
      mesh.setColorAt(i, palette[i % palette.length]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.touchLeafMesh = mesh;
    this.touchLeafData = {
      x,
      y,
      z,
      vx,
      vy,
      vz,
      rx,
      ry,
      rz,
      vrx,
      vry,
      vrz,
      phase,
      baseScale,
      count,
      age: 0,
      duration: boosted ? 4.2 : 3.2,
    };
  }

  triggerTreeTouchEffect(hitPoint?: THREE.Vector3) {
    if (this.disposed) return;
    const boosted = this.postDeepWorkBlessing;
    if (boosted) {
      this.postDeepWorkBlessing = false;
    }

    const pt = hitPoint || new THREE.Vector3(0, this.currentLevel >= 8 ? 3.8 : 2.2, 0.35);
    const dirLen = Math.hypot(pt.x, pt.z) || 1;
    this.treeTouchEffect = {
      active: true,
      time: 0,
      duration: boosted ? 2.6 : 1.9,
      boosted,
      dirX: pt.x / dirLen,
      dirZ: pt.z / dirLen,
    };

    if (boosted) {
      this.treeBounce = { active: true, time: 0 };
      this.xpArcUniforms.uPulseBoost.value = 0.85;
      this.spawnShockwave(0xfbbf24, 8.6, 0);
      this.spawnShockwave(0x34d399, 6.2, 0.14);
      this.dragon.triggerCelebrationSwoop();
    } else {
      const waveColor = this.currentLevel === 7 ? 0xf9a8d4 : this.currentLevel >= 8 ? 0x7df9ff : 0x34d399;
      this.spawnShockwave(waveColor, 5.6, 0);
    }

    this.spawnTouchLeaves(pt, boosted);
    this.onTreeTouch?.({
      boosted,
      level: this.currentLevel,
      hitPoint: { x: pt.x, y: pt.y, z: pt.z },
    });
  }

  private updatePointerNdc(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (this.disposed || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointerDownState = {
      active: true,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.disposed || e.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - this.lastHoverRaycast < 65) return;
    this.lastHoverRaycast = now;
    if (!this.updatePointerNdc(e.clientX, e.clientY)) return;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.treeRootGroup.children, true);
    this.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : '';
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.disposed || !this.pointerDownState.active) return;
    if (e.pointerId !== this.pointerDownState.pointerId) return;
    const dist = Math.hypot(e.clientX - this.pointerDownState.x, e.clientY - this.pointerDownState.y);
    const elapsedMs = performance.now() - this.pointerDownState.time;
    this.pointerDownState.active = false;

    if (dist < 9 && elapsedMs < 500 && this.updatePointerNdc(e.clientX, e.clientY)) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hits = this.raycaster.intersectObjects(this.treeRootGroup.children, true);
      if (hits.length > 0) {
        this.triggerTreeTouchEffect(hits[0].point);
      }
    }
  };

  private handlePointerCancel = () => {
    this.pointerDownState.active = false;
  };

  resize() {
    if (this.disposed) return;
    const { w, h } = this.getViewportSize();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
  }

  private bindEvents() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
  }

  private animate = () => {
    if (this.disposed) return;
    this.animFrame = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();
    this.foliageTimeUniform.value = elapsed;

    this.islandGroup.position.y = Math.sin(elapsed * 1.1) * 0.14;
    this.islandGroup.rotation.y = Math.sin(elapsed * 0.35) * 0.03;

    if (this.treeHeartGroup) {
      this.treeHeartGroup.rotation.y += dt * 0.95;
      this.treeHeartGroup.scale.setScalar(1.0 + Math.sin(elapsed * 3.4) * 0.08);
    }

    if (this.levelUpSeq.active) {
      this.levelUpSeq.time += dt;
      const p = Math.min(this.levelUpSeq.time / this.levelUpSeq.duration, 1.0);
      if (this.levelUpSeq.level === 8) {
        const easeOut = 1.0 - Math.pow(1.0 - Math.min(p / 0.55, 1.0), 3.0);
        this.treeRootGroup.scale.set(
          THREE.MathUtils.lerp(0.32, 1.0, easeOut),
          THREE.MathUtils.lerp(0.18, 1.0, easeOut),
          THREE.MathUtils.lerp(0.32, 1.0, easeOut),
        );
      }
      if (this.bloomPass) {
        this.bloomPass.strength = THREE.MathUtils.lerp(this.levelUpSeq.level >= 8 ? 0.34 : 0.26, 0.22, p);
      }
      if (p >= 1.0) {
        this.levelUpSeq.active = false;
        this.treeRootGroup.scale.setScalar(1.0);
      }
    }

    if (this.treeBounce.active) {
      this.treeBounce.time += dt;
      const t = this.treeBounce.time;
      if (t < 0.75) {
        const s = 1 + Math.sin(t * Math.PI * 4) * Math.exp(-t * 4.5) * 0.14;
        this.treeRootGroup.scale.set(s, 2 - s, s);
      } else {
        this.treeRootGroup.scale.setScalar(1);
        this.treeBounce.active = false;
      }
    }

    // Tree touch sway recoil + bioluminescent glow pulse (plus post-Deep Work shimmer)
    let touchGlowWeight = 0;
    let touchGlowBoosted = false;
    if (this.treeTouchEffect.active) {
      this.treeTouchEffect.time += dt;
      const t = this.treeTouchEffect.time;
      const p = Math.min(t / this.treeTouchEffect.duration, 1);
      const swayAmp = (this.treeTouchEffect.boosted ? 0.085 : 0.052) * Math.sin(t * 11.5) * Math.exp(-t * 3.1);
      this.treeRootGroup.rotation.z = -this.treeTouchEffect.dirX * swayAmp;
      this.treeRootGroup.rotation.x = this.treeTouchEffect.dirZ * swayAmp;

      touchGlowWeight = Math.sin(Math.min(p * 1.15, 1) * Math.PI) * Math.exp(-p * 1.35);
      touchGlowBoosted = this.treeTouchEffect.boosted;

      if (this.bloomPass && !this.levelUpSeq.active) {
        const baseBloom = this.currentLevel >= 10 ? 0.24 : 0.22;
        this.bloomPass.strength = baseBloom + touchGlowWeight * (touchGlowBoosted ? 0.22 : 0.11);
      }

      if (p >= 1) {
        this.treeTouchEffect.active = false;
        this.treeRootGroup.rotation.set(0, 0, 0);
        if (this.bloomPass && !this.levelUpSeq.active) {
          this.bloomPass.strength = this.currentLevel >= 10 ? 0.24 : 0.22;
        }
      }
    } else if (this.treeRootGroup.rotation.x !== 0 || this.treeRootGroup.rotation.z !== 0) {
      this.treeRootGroup.rotation.set(0, 0, 0);
    }

    const blessingIdleGlow = this.postDeepWorkBlessing ? 0.16 + 0.14 * (0.5 + 0.5 * Math.sin(elapsed * 2.6)) : 0;
    const totalGlowWeight = Math.max(touchGlowWeight, blessingIdleGlow);
    if (this.treeMaterials.length > 0 && (totalGlowWeight > 0.002 || this.treeTouchEffect.active || this.postDeepWorkBlessing)) {
      if (touchGlowBoosted || this.postDeepWorkBlessing || this.currentLevel === 10) {
        this.touchGlowTarget.setHex(0xfbbf24);
      } else if (this.currentLevel === 7) {
        this.touchGlowTarget.setHex(0xf9a8d4);
      } else if (this.currentLevel >= 8) {
        this.touchGlowTarget.setHex(0x67e8f9);
      } else {
        this.touchGlowTarget.setHex(0x4ade80);
      }
      const boostMultiplier = touchGlowBoosted ? 1.15 : 0.72;
      for (let i = 0; i < this.treeMaterials.length; i++) {
        const entry = this.treeMaterials[i];
        entry.mat.emissive.lerpColors(entry.baseEmissive, this.touchGlowTarget, Math.min(0.85, totalGlowWeight * 0.85));
        entry.mat.emissiveIntensity = entry.baseIntensity + totalGlowWeight * boostMultiplier;
      }
    } else if (this.treeMaterials.length > 0) {
      for (let i = 0; i < this.treeMaterials.length; i++) {
        const entry = this.treeMaterials[i];
        if (entry.mat.emissiveIntensity !== entry.baseIntensity) {
          entry.mat.emissive.copy(entry.baseEmissive);
          entry.mat.emissiveIntensity = entry.baseIntensity;
        }
      }
    }

    if (this.summonBeamMesh) {
      const mat = this.summonBeamMesh.material as THREE.MeshBasicMaterial;
      mat.opacity -= dt * 0.32;
      this.summonBeamMesh.scale.x += dt * 0.65;
      this.summonBeamMesh.scale.z += dt * 0.65;
      if (mat.opacity <= 0) {
        this.scene.remove(this.summonBeamMesh);
        this.summonBeamMesh = null;
      }
    }

    if (this.camTransition.active) {
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.camTransition.targetY, 4.0, dt);
      this.tmpOffset.copy(this.camera.position).sub(this.controls.target);
      const currentDist = this.tmpOffset.length();
      if (Math.abs(currentDist - this.camTransition.idealDistance) > 0.05) {
        this.tmpOffset.setLength(THREE.MathUtils.damp(currentDist, this.camTransition.idealDistance, 3.6, dt));
      }
      if (Math.abs(this.camTransition.tiltOffset) > 0.002) {
        const stepRot = this.camTransition.tiltOffset * dt * 2.5;
        this.tmpOffset.applyAxisAngle(this.tmpUpAxis, stepRot);
        this.camTransition.tiltOffset -= stepRot;
      }
      this.camera.position.copy(this.controls.target).add(this.tmpOffset);
      if (
        Math.abs(currentDist - this.camTransition.idealDistance) <= 0.05 &&
        Math.abs(this.camTransition.tiltOffset) <= 0.002 &&
        Math.abs(this.controls.target.y - this.camTransition.targetY) <= 0.02
      ) {
        this.camTransition.active = false;
      }
    }

    if (this.cameraShake.active) {
      this.cameraShake.time += dt;
      if (this.cameraShake.time < 0.6) {
        const decay = Math.exp(-this.cameraShake.time * 5.0) * this.cameraShake.intensity;
        this.camera.position.x += (Math.random() - 0.5) * decay;
        this.camera.position.y += (Math.random() - 0.5) * decay;
      } else {
        this.cameraShake.active = false;
      }
    }

    this.dragon.update(dt, elapsed);

    this.floatingRocks.forEach((item) => {
      item.mesh.position.y = item.baseY + Math.sin(elapsed * 1.8 + item.phase) * 0.22;
      item.mesh.rotation.y += dt * 0.35;
    });

    this.orbitingIslets.forEach((item) => {
      item.angle += dt * item.speed;
      item.group.position.x = Math.cos(item.angle) * item.orbitR;
      item.group.position.z = Math.sin(item.angle) * item.orbitR;
      item.group.position.y = item.baseY + Math.sin(elapsed * 1.6 + item.bobPhase) * 0.24;
      item.group.rotation.y += dt * 0.4;
    });

    this.celestialClouds.forEach((c) => {
      c.angle += dt * c.speed;
      c.group.position.x = Math.cos(c.angle) * c.radius;
      c.group.position.z = Math.sin(c.angle) * c.radius;
      c.group.position.y = c.baseY + Math.sin(elapsed * 0.8 + c.phase) * 0.28;
    });

    this.godRays.forEach((ray) => {
      ray.mesh.rotation.z = ray.baseRotZ + Math.sin(elapsed * 0.4 + ray.phase) * 0.03;
    });

    this.swayElements.forEach((item) => {
      item.obj.rotation.z = Math.sin(elapsed * item.speed + item.phase) * item.amp;
      item.obj.rotation.x = Math.cos(elapsed * item.speed * 0.8 + item.phase) * (item.amp * 0.6);
    });

    this.runeRings.forEach((r) => {
      r.mesh.rotation.z += dt * r.speed;
    });

    if (this.xpRingGroup) {
      let pulseLiftY = 0;
      if (this.xpRingPulse.active) {
        this.xpRingPulse.time += dt;
        const p = Math.min(this.xpRingPulse.time / this.xpRingPulse.duration, 1);
        const springWave = Math.sin(p * Math.PI * 3.5) * Math.exp(-p * 3.8);
        const ringScale = 1 + springWave * 0.052;
        this.xpRingGroup.scale.set(ringScale, 1, ringScale);
        pulseLiftY = Math.sin(p * Math.PI) * 0.08 * Math.exp(-p * 1.6);
        this.xpArcUniforms.uPulseBoost.value = Math.sin(p * Math.PI) * Math.exp(-p * 1.4);
        if (p >= 1) {
          this.xpRingPulse.active = false;
          this.xpRingGroup.scale.set(1, 1, 1);
          this.xpArcUniforms.uPulseBoost.value = 0;
        }
      }

      this.xpRingGroup.position.y = 0.54 + this.islandGroup.position.y + pulseLiftY;
      if (!this.useExternalXpSpring) {
        this.displayedXpProgress = THREE.MathUtils.damp(this.displayedXpProgress, this.targetXpProgress, 5.5, dt);
        this.xpArcUniforms.uProgress.value = this.displayedXpProgress;
      }

      if (this.xpLeadOrb) {
        const showOrb = this.displayedXpProgress > 0.008 && this.displayedXpProgress < 0.996;
        this.xpLeadOrb.visible = showOrb;
        if (showOrb) {
          const theta = Math.PI / 2 + this.displayedXpProgress * Math.PI * 2;
          this.xpLeadOrb.position.set(
            Math.cos(theta) * this.xpRingRadius,
            0.015,
            Math.sin(theta) * this.xpRingRadius,
          );
          this.xpLeadOrb.scale.setScalar(1 + this.xpArcUniforms.uPulseBoost.value * 0.35);
          if (this.xpLeadHalo) {
            this.xpLeadHalo.rotation.x = elapsed * 2.2;
            this.xpLeadHalo.rotation.y = elapsed * 1.6;
          }
        }
      }

      for (let m = 0; m < this.xpMilestoneNodes.length; m++) {
        const node = this.xpMilestoneNodes[m];
        const reached =
          this.displayedXpProgress >= node.threshold + 0.01 ||
          (node.threshold === 0 && this.displayedXpProgress > 0.008);
        if (reached) {
          node.mat.color.setHex(this.xpInfo.isMaxLevel ? 0xffe082 : 0x6ee7b7);
          node.mat.emissive.setHex(this.xpInfo.isMaxLevel ? 0xf59e0b : 0x10b981);
          node.mat.emissiveIntensity = 1.05 + this.xpArcUniforms.uPulseBoost.value * 0.7;
        } else {
          node.mat.color.setHex(0x3b4d70);
          node.mat.emissive.setHex(0x0f172a);
          node.mat.emissiveIntensity = 0.12;
        }
      }
    }

    if (this.rootDropletSystem) {
      const pos = this.rootDropletSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      const tips = this.rootDropletSystem.tipPositions;
      for (let i = 0; i < this.rootDropletSystem.count; i++) {
        this.rootDropletSystem.phases[i] += dt * 0.38;
        if (this.rootDropletSystem.phases[i] >= 1.0) this.rootDropletSystem.phases[i] = 0;
        const p = this.rootDropletSystem.phases[i];
        const tip = tips[i % tips.length];
        pos.setXYZ(
          i,
          tip.x + Math.sin(elapsed * 2.0 + i) * 0.12,
          tip.y - p * 3.2,
          tip.z + Math.cos(elapsed * 2.0 + i) * 0.12,
        );
      }
      pos.needsUpdate = true;
    }

    if (this.stardustRainSystem) {
      const pos = this.stardustRainSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.stardustRainSystem.count; i++) {
        let y = pos.getY(i) - this.stardustRainSystem.speeds[i] * dt;
        const ph = this.stardustRainSystem.phases[i];
        let x = pos.getX(i) + Math.sin(elapsed * 1.4 + ph) * 0.25 * dt;
        let z = pos.getZ(i) + Math.cos(elapsed * 1.2 + ph) * 0.25 * dt;
        if (y < 0.38) {
          const angle = Math.random() * Math.PI * 2;
          const r = 0.6 + Math.random() * 5.2;
          x = Math.cos(angle) * r;
          z = Math.sin(angle) * r;
          y = this.stardustRainSystem.maxY;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    if (this.petalSystem) {
      const pos = this.petalSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.petalSystem.count; i++) {
        let y = pos.getY(i) - this.petalSystem.speeds[i] * dt;
        let x = pos.getX(i) + Math.sin(elapsed * 1.8 + i) * 0.35 * dt;
        let z = pos.getZ(i) + Math.cos(elapsed * 1.5 + i) * 0.35 * dt;
        if (y < 0.38) {
          y = this.petalSystem.maxHeight + 0.6;
          const a = Math.random() * Math.PI * 2;
          const r = 0.5 + Math.random() * 2.6;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    if (this.risingSpiritSystem) {
      const pos = this.risingSpiritSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.risingSpiritSystem.count; i++) {
        let y = pos.getY(i) + this.risingSpiritSystem.speeds[i] * dt;
        this.risingSpiritSystem.angles[i] += dt * 0.45;
        if (y > this.risingSpiritSystem.maxY) y = 0.4;
        const r = this.risingSpiritSystem.radii[i] * (1.0 - (y / this.risingSpiritSystem.maxY) * 0.28);
        pos.setXYZ(
          i,
          Math.cos(this.risingSpiritSystem.angles[i]) * r,
          y,
          Math.sin(this.risingSpiritSystem.angles[i]) * r,
        );
      }
      pos.needsUpdate = true;
    }

    if (this.fireflySystem) {
      const pos = this.fireflySystem.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.fireflySystem.count; i++) {
        const ph = this.fireflySystem.phases[i];
        pos.setXYZ(
          i,
          pos.getX(i) + Math.sin(elapsed * 1.2 + ph) * 0.3 * dt,
          pos.getY(i) + Math.cos(elapsed * 1.6 + ph) * 0.25 * dt,
          pos.getZ(i) + Math.sin(elapsed * 1.4 + ph * 1.3) * 0.3 * dt,
        );
      }
      pos.needsUpdate = true;
    }

    if (this.rainShowerSystem) {
      this.rainShowerSystem.age += dt;
      const pos = this.rainShowerSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      const mat = this.rainShowerSystem.points.material as THREE.PointsMaterial;
      for (let i = 0; i < this.rainShowerSystem.count; i++) {
        let y = pos.getY(i) - this.rainShowerSystem.speeds[i] * dt;
        if (y < 0.35) y = 12.5;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      const progress = this.rainShowerSystem.age / this.rainShowerSystem.duration;
      if (progress > 0.7) {
        mat.opacity = Math.max(0, (1 - progress) / 0.3) * 0.9;
      }
      if (progress >= 1.0) {
        this.scene.remove(this.rainShowerSystem.points);
        this.rainShowerSystem.points.geometry.dispose();
        mat.dispose();
        this.rainShowerSystem = null;
      }
    }

    if (this.weatherSnowSystem) {
      const pos = this.weatherSnowSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      const { count, speeds, swayPhases, swayAmps, maxY, radius } = this.weatherSnowSystem;
      for (let i = 0; i < count; i++) {
        let y = pos.getY(i) - speeds[i] * dt;
        const ph = swayPhases[i];
        let x = pos.getX(i) + Math.sin(elapsed * 1.15 + ph) * swayAmps[i] * dt;
        let z = pos.getZ(i) + Math.cos(elapsed * 0.95 + ph * 1.2) * swayAmps[i] * dt;
        if (y < 0.38) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * radius;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
          y = maxY;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    if (this.weatherRainSystem) {
      const pos = this.weatherRainSystem.points.geometry.attributes.position as THREE.BufferAttribute;
      const { count, speeds, maxY, radius } = this.weatherRainSystem;
      for (let i = 0; i < count; i++) {
        let y = pos.getY(i) - speeds[i] * dt;
        let x = pos.getX(i) + 0.45 * dt;
        let z = pos.getZ(i);
        if (y < 0.35) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * radius;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
          y = maxY;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    if (this.weatherLeafMesh && this.weatherLeafData) {
      const d = this.weatherLeafData;
      for (let i = 0; i < d.count; i++) {
        d.y[i] -= d.vy[i] * dt;
        const ph = d.phase[i];
        d.x[i] += Math.sin(elapsed * 1.35 + ph) * 0.65 * dt;
        d.z[i] += Math.cos(elapsed * 1.05 + ph * 1.1) * 0.55 * dt;
        d.rx[i] += d.vrx[i] * dt;
        d.ry[i] += d.vry[i] * dt;
        d.rz[i] += d.vrz[i] * dt;

        if (d.y[i] < 0.42) {
          const a = Math.random() * Math.PI * 2;
          const r = 0.35 + Math.sqrt(Math.random()) * d.radius;
          d.x[i] = Math.cos(a) * r;
          d.z[i] = Math.sin(a) * r;
          d.y[i] = d.maxY;
        }

        this.weatherDummy.position.set(d.x[i], d.y[i], d.z[i]);
        this.weatherDummy.rotation.set(d.rx[i], d.ry[i], d.rz[i]);
        this.weatherDummy.scale.setScalar(d.scale[i]);
        this.weatherDummy.updateMatrix();
        this.weatherLeafMesh.setMatrixAt(i, this.weatherDummy.matrix);
      }
      this.weatherLeafMesh.instanceMatrix.needsUpdate = true;
    }

    if (this.weatherSunRays.length > 0) {
      for (let i = 0; i < this.weatherSunRays.length; i++) {
        const ray = this.weatherSunRays[i];
        ray.mesh.rotation.z = ray.baseRotZ + Math.sin(elapsed * 0.45 + ray.phase) * 0.035;
      }
    }

    if (this.weatherSunMotes) {
      const pos = this.weatherSunMotes.points.geometry.attributes.position as THREE.BufferAttribute;
      const { count, phases, speeds, maxY, radius } = this.weatherSunMotes;
      for (let i = 0; i < count; i++) {
        const ph = phases[i];
        let y = pos.getY(i) + speeds[i] * dt;
        let x = pos.getX(i) + Math.sin(elapsed * 1.1 + ph) * 0.22 * dt;
        let z = pos.getZ(i) + Math.cos(elapsed * 0.9 + ph) * 0.22 * dt;
        if (y > maxY) {
          const a = Math.random() * Math.PI * 2;
          const r = 0.4 + Math.sqrt(Math.random()) * radius;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
          y = 0.45;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    for (let w = this.shockwaves.length - 1; w >= 0; w--) {
      const sw = this.shockwaves[w];
      sw.age += dt;
      if (sw.age < 0) continue;
      const prog = sw.age / sw.maxAge;
      if (prog >= 1) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(w, 1);
      } else {
        const scale = THREE.MathUtils.lerp(1.0, sw.maxScale, 1 - Math.pow(1 - prog, 3));
        sw.mesh.scale.set(scale, scale, 1);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - prog) * 0.9;
      }
    }

    for (let b = this.burstSystems.length - 1; b >= 0; b--) {
      const burst = this.burstSystems[b];
      burst.age += dt;
      if (burst.age >= burst.maxAge) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        (burst.points.material as THREE.Material).dispose();
        this.burstSystems.splice(b, 1);
        continue;
      }
      const pos = burst.points.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < burst.velocities.length; i++) {
        const v = burst.velocities[i];
        v.y -= 4.5 * dt;
        pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt);
      }
      pos.needsUpdate = true;
      (burst.points.material as THREE.PointsMaterial).opacity = 1 - burst.age / burst.maxAge;
    }

    if (this.touchLeafMesh && this.touchLeafData) {
      const ld = this.touchLeafData;
      ld.age += dt;
      const lifeProg = ld.age / ld.duration;
      if (lifeProg >= 1) {
        this.clearTouchLeaves();
      } else {
        const mat = this.touchLeafMesh.material as THREE.MeshStandardMaterial;
        mat.opacity = lifeProg > 0.65 ? Math.max(0, (1 - lifeProg) / 0.35) * 0.96 : 0.96;
        const fadeScale = lifeProg > 0.7 ? Math.max(0.01, (1 - lifeProg) / 0.3) : 1;

        for (let i = 0; i < ld.count; i++) {
          ld.vy[i] = Math.max(-1.45, ld.vy[i] - 1.25 * dt);
          ld.vx[i] *= Math.max(0, 1 - 0.85 * dt);
          ld.vz[i] *= Math.max(0, 1 - 0.85 * dt);

          const ph = ld.phase[i];
          ld.x[i] += (ld.vx[i] + Math.sin(elapsed * 2.4 + ph) * 0.42) * dt;
          ld.y[i] += ld.vy[i] * dt;
          ld.z[i] += (ld.vz[i] + Math.cos(elapsed * 2.0 + ph * 1.1) * 0.38) * dt;

          if (ld.y[i] < 0.38) {
            ld.y[i] = 0.38;
            ld.vx[i] *= 0.5;
            ld.vz[i] *= 0.5;
          } else {
            ld.rx[i] += ld.vrx[i] * dt;
            ld.ry[i] += ld.vry[i] * dt;
            ld.rz[i] += ld.vrz[i] * dt;
          }

          this.touchLeafDummy.position.set(ld.x[i], ld.y[i], ld.z[i]);
          this.touchLeafDummy.rotation.set(ld.rx[i], ld.ry[i], ld.rz[i]);
          this.touchLeafDummy.scale.setScalar(ld.baseScale[i] * fadeScale);
          this.touchLeafDummy.updateMatrix();
          this.touchLeafMesh.setMatrixAt(i, this.touchLeafDummy.matrix);
        }
        this.touchLeafMesh.instanceMatrix.needsUpdate = true;
      }
    }

    this.controls.update();
    if (this.useComposer && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    canvas.style.cursor = '';

    this.clearTouchLeaves();
    this.disposeXpRing();
    this.clearWeatherSystems();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.resizeObserver?.disconnect();
    this.controls.dispose();
    this.envTarget?.dispose();
    if (this.composer && this.composer.dispose) this.composer.dispose();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
