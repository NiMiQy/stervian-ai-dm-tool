import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COLORS = { panel: 0x232731, panelHover: 0x2c313d, danger: 0x2b2226, gold: 0xd4ab5f, ember: 0xd9785f, text: '#e8e1d2', ash: '#9c968a', goldCss: '#d4ab5f', emberCss: '#d9785f' };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

function makeLabelTexture(spec, width, height, align) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const accent = spec.danger ? COLORS.emberCss : COLORS.goldCss;
  ctx.textBaseline = 'middle';
  if (align === 'row') {
    const pad = height * 0.32;
    let x = pad;
    if (spec.icon) {
      ctx.fillStyle = accent;
      ctx.font = `${Math.round(height * 0.42)}px "Lusitana", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(spec.icon, x + height * 0.22, height / 2);
      x += height * 0.62;
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = `${Math.round(height * 0.36)}px "Outfit", system-ui, sans-serif`;
    ctx.fillText(spec.title, x, spec.sub ? height * 0.4 : height / 2, width - x - pad);
    if (spec.sub) {
      ctx.fillStyle = COLORS.ash;
      ctx.font = `${Math.round(height * 0.22)}px "Outfit", system-ui, sans-serif`;
      ctx.fillText(spec.sub, x, height * 0.72, width - x - pad);
    }
  } else {
    ctx.textAlign = 'center';
    const hasIcon = Boolean(spec.icon);
    if (hasIcon) {
      ctx.fillStyle = accent;
      ctx.font = `${Math.round(height * 0.28)}px "Lusitana", Georgia, serif`;
      ctx.fillText(spec.icon, width / 2, height * 0.27);
    }
    ctx.fillStyle = COLORS.text;
    ctx.font = `${Math.round(height * (spec.sub ? 0.2 : 0.22))}px "Lusitana", Georgia, serif`;
    ctx.fillText(spec.title, width / 2, hasIcon ? height * 0.58 : (spec.sub ? height * 0.4 : height / 2), width * 0.9);
    if (spec.sub) {
      ctx.fillStyle = COLORS.ash;
      ctx.font = `${Math.round(height * 0.13)}px "Outfit", system-ui, sans-serif`;
      ctx.fillText(spec.sub, width / 2, hasIcon ? height * 0.8 : height * 0.68, width * 0.9);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class ThreeButtonDock {
  constructor(host, { getSpecs, columns = (width, count) => Math.min(count, width < 520 ? 3 : 6), cellWidth = [1.1, 2.4], align = 'stack', gap = 0.14, onLayout = null } = {}) {
    this.host = host;
    this.getSpecs = getSpecs;
    this.columnsFor = columns;
    this.cellWidth = cellWidth;
    this.align = align;
    this.gap = gap;
    this.onLayout = onLayout;
    this.signature = '';
    this.buttons = [];
    this.ripples = [];
    this.hovered = null;
    this.focused = null;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.className = 'three-dock-canvas';
    host.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(16, 1, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight(0xf4ead8, 0x0d0f14, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-3, 5, 8);
    this.scene.add(key);
    this.pointerLight = new THREE.PointLight(COLORS.gold, 0, 6, 1.6);
    this.scene.add(this.pointerLight);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.timer = new THREE.Timer();

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    canvas.addEventListener('pointerleave', () => this.setHovered(null));
    canvas.addEventListener('pointerdown', (event) => { this.onPointerMove(event); if (this.hovered) this.press(this.hovered); });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    this.sync();
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  sync() {
    const specs = this.getSpecs() || [];
    const signature = specs.map((spec) => `${spec.key}|${spec.title}|${spec.sub || ''}`).join('\n');
    if (signature !== this.signature) {
      this.signature = signature;
      this.build(specs);
    } else {
      specs.forEach((spec, index) => { if (this.buttons[index]) this.buttons[index].spec = spec; });
    }
  }

  clear() {
    this.buttons.forEach((button) => {
      this.group.remove(button.root);
      button.root.traverse((node) => { node.geometry?.dispose(); node.material?.map?.dispose(); node.material?.dispose(); });
    });
    this.buttons = [];
    this.hovered = null;
  }

  build(specs) {
    this.clear();
    specs.forEach((spec, index) => {
      const root = new THREE.Group();
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(1, 1, 0.22, 4, 0.07),
        new THREE.MeshStandardMaterial({ color: spec.danger ? COLORS.danger : COLORS.panel, roughness: 0.55, metalness: 0.35, emissive: COLORS.gold, emissiveIntensity: 0, transparent: true })
      );
      const rim = new THREE.Mesh(
        new RoundedBoxGeometry(1, 1, 0.12, 4, 0.08),
        new THREE.MeshBasicMaterial({ color: spec.danger ? COLORS.ember : COLORS.gold, transparent: true, opacity: 0.18 })
      );
      rim.position.z = -0.06;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true }));
      label.position.z = 0.115;
      root.add(rim, body, label);
      const button = { spec, root, body, rim, label, index, hover: 0, press: 0, intro: reduceMotion ? 1 : 0, introDelay: index * 0.05, tilt: new THREE.Vector2(), home: new THREE.Vector3() };
      body.userData.button = button;
      this.group.add(root);
      this.buttons.push(button);
    });
    this.layout();
  }

  setFocusedTarget(element) {
    this.focused = this.buttons.find((button) => button.spec.target && button.spec.target === element) || null;
  }

  layout() {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    const count = this.buttons.length;
    if (!count) return;
    const columns = Math.max(1, this.columnsFor(width, count));
    const rows = Math.ceil(count / columns);
    const cellH = 1;
    const gap = this.gap;
    const aspectTarget = (width / columns) / (height / rows);
    const cellW = Math.max(this.cellWidth[0], Math.min(this.cellWidth[1], aspectTarget * cellH));
    const totalW = columns * cellW + (columns - 1) * gap;
    const totalH = rows * cellH + (rows - 1) * gap;
    this.buttons.forEach((button) => {
      const col = button.index % columns;
      const row = Math.floor(button.index / columns);
      button.home.set(-totalW / 2 + cellW / 2 + col * (cellW + gap), totalH / 2 - cellH / 2 - row * (cellH + gap), 0);
      button.root.scale.set(cellW, cellH, 1);
      const aspectKey = Math.round(cellW * 10);
      if (button.labelAspect !== aspectKey) {
        button.labelAspect = aspectKey;
        button.label.material.map?.dispose();
        button.label.material.map = makeLabelTexture(button.spec, Math.round(256 * cellW), 256, this.align);
        button.label.material.needsUpdate = true;
      }
    });
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distH = (totalH / 2 + 0.25) / Math.tan(fov / 2);
    const distW = (totalW / 2 + 0.25) / (Math.tan(fov / 2) * this.camera.aspect);
    const dist = Math.max(distH, distW);
    this.camera.position.set(0, -dist * 0.12, dist);
    this.camera.lookAt(0, 0, 0);
    this.onLayout?.({ columns, rows });
  }

  resize() {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.layout();
  }

  onPointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.buttons.map((button) => button.body), false)[0];
    const button = hit?.object.userData.button || null;
    this.setHovered(button && !button.spec.disabled ? button : null);
    if (this.hovered) {
      const local = hit.object.worldToLocal(hit.point.clone());
      this.hovered.tilt.set(local.x, local.y);
    }
  }

  setHovered(button) {
    if (this.hovered === button) return;
    this.hovered = button;
    this.renderer.domElement.style.cursor = button ? 'pointer' : 'default';
  }

  press(button) {
    if (button.spec.disabled) return;
    button.press = 1;
    this.spawnRipple(button);
    window.setTimeout(() => button.spec.onPress?.(), reduceMotion ? 0 : 120);
  }

  spawnRipple(button) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.26, 48),
      new THREE.MeshBasicMaterial({ color: button.spec.danger ? COLORS.ember : COLORS.gold, transparent: true, opacity: 0.9, depthWrite: false })
    );
    ring.position.set(button.root.position.x, button.root.position.y, 0.2);
    this.scene.add(ring);
    this.ripples.push({ mesh: ring, age: 0 });
  }

  tick() {
    if (document.hidden) return;
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    const time = this.timer.getElapsed();
    const ease = (current, target, speed) => current + (target - current) * (1 - Math.exp(-speed * dt));
    const active = this.hovered || (this.focused && !this.focused.spec.disabled ? this.focused : null);
    this.buttons.forEach((button) => {
      const { spec } = button;
      const isActive = button === active;
      const selected = Boolean(spec.selected);
      button.hover = ease(button.hover, isActive ? 1 : 0, 12);
      button.press = ease(button.press, 0, 9);
      if (button.introDelay > 0) button.introDelay -= dt;
      else button.intro = ease(button.intro, 1, 8);
      const idle = reduceMotion || spec.disabled ? 0 : Math.sin(time * 1.6 + button.index * 0.7) * 0.012;
      const lift = button.hover * 0.22 + (selected ? 0.1 : 0) - button.press * 0.28 + idle - (spec.disabled ? 0.08 : 0);
      button.root.position.set(button.home.x, button.home.y - (1 - button.intro) * 0.6, lift - (1 - button.intro) * 1.2);
      button.root.rotation.x = ease(button.root.rotation.x, reduceMotion ? 0 : -button.tilt.y * 0.35 * button.hover, 10);
      button.root.rotation.y = ease(button.root.rotation.y, reduceMotion ? 0 : button.tilt.x * 0.35 * button.hover, 10);
      button.body.material.emissiveIntensity = button.hover * 0.08 + button.press * 0.25 + (selected ? 0.06 : 0);
      button.body.material.color.setHex(isActive ? COLORS.panelHover : (spec.danger ? COLORS.danger : COLORS.panel));
      button.body.material.opacity = spec.disabled ? 0.55 : 1;
      button.rim.material.opacity = spec.disabled ? 0.05 : 0.14 + button.hover * 0.6 + button.press * 0.3 + (selected ? 0.45 : 0);
      const rimScale = 1 + button.hover * 0.035 + button.press * 0.05 + (selected ? 0.025 : 0);
      button.rim.scale.set(rimScale, 1 + (rimScale - 1) * 2.2, 1);
      button.label.material.opacity = button.intro * (spec.disabled ? 0.4 : 1);
    });
    this.pointerLight.intensity = ease(this.pointerLight.intensity, active ? 4 : 0, 8);
    if (active) this.pointerLight.position.set(active.root.position.x + active.tilt.x * active.root.scale.x, active.root.position.y + active.tilt.y, 1.4);
    this.ripples = this.ripples.filter((ripple) => {
      ripple.age += dt;
      const t = ripple.age / 0.55;
      ripple.mesh.scale.setScalar(1 + t * 5);
      ripple.mesh.material.opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) { this.scene.remove(ripple.mesh); ripple.mesh.geometry.dispose(); ripple.mesh.material.dispose(); return false; }
      return true;
    });
    this.renderer.render(this.scene, this.camera);
  }
}

export function proxyButtonDock(host, { root, collect, observeTargets = [root], ...options }) {
  const dock = new ThreeButtonDock(host, { ...options, getSpecs: () => collect().map((spec) => ({ ...spec, disabled: spec.target ? spec.target.disabled : spec.disabled, onPress: spec.onPress || (() => spec.target?.click()) })) });
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; dock.sync(); });
  };
  const observer = new MutationObserver(schedule);
  observeTargets.filter(Boolean).forEach((target) => observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['class', 'disabled', 'hidden'] }));
  root.addEventListener('focusin', (event) => dock.setFocusedTarget(event.target.closest('button')));
  root.addEventListener('focusout', () => dock.setFocusedTarget(null));
  return dock;
}
