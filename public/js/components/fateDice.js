import * as THREE from '../../vendor/three/three.module.js';

const DIE_HEIGHT = 1.15;
const RING_HEIGHT = DIE_HEIGHT * ((1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5)));
const MIN_ROLL_MS = 750;
const SETTLE_MS = 1050;
const POST_SETTLE_HOLD_MS = 350;
const DEFAULT_STAGE_WIDTH = 420;
const DEFAULT_STAGE_HEIGHT = 240;
const TABLE_Y = -0.32;
const SHADOW_Y = -1.18;
const TENS_LABELS = ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'];
const ONES_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DIE_STYLES = {
  tens: { body: '#5a1d24', edge: '#2c0d11', ink: '#f0cf8a' },
  ones: { body: '#e7dcc4', edge: '#a8987a', ink: '#2a2118' }
};

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function buildKiteFaces() {
  const top = new THREE.Vector3(0, DIE_HEIGHT, 0);
  const bottom = new THREE.Vector3(0, -DIE_HEIGHT, 0);
  const upper = [];
  const lower = [];
  for (let index = 0; index < 5; index += 1) {
    const upperAngle = (index * 2 * Math.PI) / 5;
    const lowerAngle = upperAngle + Math.PI / 5;
    upper.push(new THREE.Vector3(Math.cos(upperAngle), RING_HEIGHT, Math.sin(upperAngle)));
    lower.push(new THREE.Vector3(Math.cos(lowerAngle), -RING_HEIGHT, Math.sin(lowerAngle)));
  }
  const faces = [];
  for (let index = 0; index < 5; index += 1) {
    const next = (index + 1) % 5;
    faces.push({ apex: top, sideA: upper[index], far: lower[index], sideB: upper[next] });
    faces.push({ apex: bottom, sideA: lower[index], far: upper[next], sideB: lower[next] });
  }
  return faces;
}

function buildDieGeometry() {
  const kites = buildKiteFaces();
  const positions = [];
  const uvs = [];
  const geometry = new THREE.BufferGeometry();
  const faces = [];
  kites.forEach((kite, faceIndex) => {
    const points = [kite.apex, kite.sideA, kite.far, kite.sideB];
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(0.25);
    const normal = new THREE.Vector3().subVectors(kite.sideA, kite.apex).cross(new THREE.Vector3().subVectors(kite.sideB, kite.apex)).normalize();
    if (normal.dot(center) < 0) normal.negate();
    const up = new THREE.Vector3().subVectors(kite.apex, center);
    up.sub(normal.clone().multiplyScalar(up.dot(normal))).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const local = points.map((point) => {
      const offset = new THREE.Vector3().subVectors(point, center);
      return { x: offset.dot(right), y: offset.dot(up) };
    });
    const span = Math.max(...local.map((point) => Math.max(Math.abs(point.x), Math.abs(point.y)))) * 1.08;
    const uv = local.map((point) => ({ u: 0.5 + point.x / (2 * span), v: 0.5 + point.y / (2 * span) }));
    const triangles = [[0, 1, 2], [0, 2, 3]];
    const start = positions.length / 3;
    triangles.forEach((triangle) => {
      const [a, b, c] = triangle.map((index) => points[index]);
      const triangleNormal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const order = triangleNormal.dot(normal) >= 0 ? triangle : [triangle[0], triangle[2], triangle[1]];
      order.forEach((index) => {
        positions.push(points[index].x, points[index].y, points[index].z);
        uvs.push(uv[index].u, uv[index].v);
      });
    });
    geometry.addGroup(start, 6, faceIndex);
    const labelUv = uv.reduce((sum, point) => ({ u: sum.u + point.u / 4, v: sum.v + point.v / 4 }), { u: 0, v: 0 });
    faces.push({ normal, up, right, labelUv });
  });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return { geometry, faces };
}

function buildFaceTexture(label, labelUv, style) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = style.body;
  context.fillRect(0, 0, size, size);
  const x = labelUv.u * size;
  const y = (1 - labelUv.v) * size;
  context.fillStyle = style.ink;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${label.length > 1 ? 74 : 92}px Marcellus, Georgia, serif`;
  context.fillText(label, x, y);
  if (label === '6' || label === '9' || label === '60' || label === '90') {
    const width = context.measureText(label).width;
    context.fillRect(x - width / 2, y + 40, width, 7);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function buildShadowMesh() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(2.1, 2.1);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SHADOW_Y;
  return mesh;
}

function buildDie(labels, style) {
  const { geometry, faces } = buildDieGeometry();
  const materials = faces.map((face, index) => new THREE.MeshStandardMaterial({
    map: buildFaceTexture(labels[index], face.labelUv, style),
    roughness: 0.42,
    metalness: 0.08,
    flatShading: true
  }));
  const mesh = new THREE.Mesh(geometry, materials);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({ color: style.edge }));
  mesh.add(edges);
  const shadow = buildShadowMesh();
  return { mesh, shadow, faces, labels };
}

function targetQuaternion(face, toCamera) {
  const worldZ = toCamera.clone().normalize();
  const worldY = new THREE.Vector3(0, 1, 0).sub(worldZ.clone().multiplyScalar(worldZ.y)).normalize();
  const worldX = new THREE.Vector3().crossVectors(worldY, worldZ).normalize();
  const worldBasis = new THREE.Matrix4().makeBasis(worldX, worldY, worldZ);
  const localBasis = new THREE.Matrix4().makeBasis(face.right, face.up, face.normal).transpose();
  return new THREE.Quaternion().setFromRotationMatrix(worldBasis.multiply(localBasis));
}

function computeRollPosition(die, elapsed) {
  const swayX = Math.sin(elapsed * 5.6 + die.phase) * 0.48;
  const bounceY = Math.abs(Math.sin(elapsed * 7.2 + die.phase)) * 0.95 + TABLE_Y;
  const swayZ = Math.cos(elapsed * 4.4 + die.phase) * 0.42;
  return new THREE.Vector3(die.base.x + swayX, bounceY, die.base.z + swayZ);
}

function syncShadow(die) {
  if (!die.shadow) return;
  const height = Math.max(0, die.mesh.position.y - TABLE_Y);
  const scale = Math.max(0.55, 1 - height * 0.28);
  die.shadow.position.x = die.mesh.position.x;
  die.shadow.position.z = die.mesh.position.z;
  die.shadow.scale.set(scale, scale, 1);
  die.shadow.material.opacity = Math.max(0.25, 0.85 - height * 0.42);
}

export function splitPercentileRoll(roll) {
  const value = Number(roll);
  if (value === 100) return { tens: 0, ones: 0 };
  return { tens: Math.floor(value / 10), ones: value % 10 };
}

export function createFateDice(container) {
  if (!container) return null;
  const stage = container.querySelector('[data-fate-dice-canvas]');
  const hud = container.querySelector('[data-fate-dice-hud]');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, DEFAULT_STAGE_WIDTH / DEFAULT_STAGE_HEIGHT, 0.1, 100);
  camera.position.set(0, 1.6, 6.4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
  keyLight.position.set(3, 6, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x8fb4ff, 0.65);
  rimLight.position.set(-4, 2, -3);
  scene.add(rimLight);

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const tempBaseQuaternion = new THREE.Quaternion();
  const tempSpinQuaternion = new THREE.Quaternion();
  const tempEuler = new THREE.Euler();

  const dice = [
    {
      ...buildDie(TENS_LABELS, DIE_STYLES.tens),
      base: new THREE.Vector3(-1.35, 0, 0),
      spin: new THREE.Vector3(),
      spinDir: 1,
      phase: 0,
      fromQuaternion: new THREE.Quaternion(),
      toQuaternion: new THREE.Quaternion(),
      fromPosition: new THREE.Vector3()
    },
    {
      ...buildDie(ONES_LABELS, DIE_STYLES.ones),
      base: new THREE.Vector3(1.35, 0, 0),
      spin: new THREE.Vector3(),
      spinDir: -1,
      phase: 1.65,
      fromQuaternion: new THREE.Quaternion(),
      toQuaternion: new THREE.Quaternion(),
      fromPosition: new THREE.Vector3()
    }
  ];
  dice.forEach((die) => {
    die.mesh.position.copy(die.base);
    syncShadow(die);
    scene.add(die.shadow);
    scene.add(die.mesh);
  });

  let frameId = null;
  let settleTimerId = null;
  let holdTimerId = null;
  let mode = 'idle';
  let startedAt = 0;
  let lastTickAt = 0;
  let settleStart = 0;
  let settleResolve = null;
  let lastWidth = 0;
  let lastHeight = 0;

  const resize = () => {
    const width = stage.clientWidth || DEFAULT_STAGE_WIDTH;
    const height = stage.clientHeight || DEFAULT_STAGE_HEIGHT;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(stage);

  const beginSettling = (fateCheck, onSettled) => {
    const { tens, ones } = splitPercentileRoll(fateCheck.roll);
    const targets = [tens, ones];
    dice.forEach((die, index) => {
      const face = die.faces[targets[index]] || die.faces[0];
      const toCamera = new THREE.Vector3().subVectors(camera.position, die.base);
      die.fromQuaternion.copy(die.mesh.quaternion);
      die.toQuaternion.copy(targetQuaternion(face, toCamera));
      die.fromPosition.copy(die.mesh.position);
    });
    settleStart = performance.now();
    settleResolve = onSettled;
    mode = 'settling';
  };

  const tick = (now) => {
    if (mode === 'hidden') {
      frameId = null;
      return;
    }
    resize();
    const dt = Math.min(0.05, Math.max(0.008, (now - (lastTickAt || now)) / 1000));
    lastTickAt = now;
    const elapsed = (now - startedAt) / 1000;

    if (mode === 'rolling') {
      dice.forEach((die) => {
        die.mesh.rotateOnAxis(axisX, die.spin.x * dt);
        die.mesh.rotateOnAxis(axisY, die.spin.y * dt);
        die.mesh.rotateOnAxis(axisZ, die.spin.z * dt);
        die.mesh.position.copy(computeRollPosition(die, elapsed));
        syncShadow(die);
      });
    } else if (mode === 'settling') {
      const progress = Math.min(1, (now - settleStart) / SETTLE_MS);
      const eased = easeOutCubic(progress);
      const remaining = 1 - eased;
      const damping = (1 - progress) ** 2;
      dice.forEach((die) => {
        tempBaseQuaternion.slerpQuaternions(die.fromQuaternion, die.toQuaternion, eased);
        tempEuler.set(4 * Math.PI * remaining, 2 * Math.PI * remaining * die.spinDir, 0);
        tempSpinQuaternion.setFromEuler(tempEuler);
        die.mesh.quaternion.copy(tempBaseQuaternion).multiply(tempSpinQuaternion);

        die.mesh.position.lerpVectors(die.fromPosition, die.base, eased);
        die.mesh.position.x += Math.sin(progress * Math.PI * 2 + die.phase) * 0.22 * damping;
        die.mesh.position.y += Math.abs(Math.sin(progress * Math.PI * 3)) * 0.68 * damping;
        die.mesh.position.z += Math.cos(progress * Math.PI * 2 + die.phase) * 0.18 * damping;
        syncShadow(die);
      });
      if (progress >= 1) {
        dice.forEach((die) => {
          die.mesh.quaternion.copy(die.toQuaternion);
          die.mesh.position.copy(die.base);
          syncShadow(die);
        });
        mode = 'settled';
        const callback = settleResolve;
        settleResolve = null;
        callback?.();
      }
    }
    renderer.render(scene, camera);
    frameId = mode === 'hidden' ? null : requestAnimationFrame(tick);
  };

  const ensureLoop = () => {
    if (frameId === null) {
      lastTickAt = performance.now();
      frameId = requestAnimationFrame(tick);
    }
  };

  const clearTimers = () => {
    if (settleTimerId !== null) {
      clearTimeout(settleTimerId);
      settleTimerId = null;
    }
    if (holdTimerId !== null) {
      clearTimeout(holdTimerId);
      holdTimerId = null;
    }
  };

  const renderHud = (fateCheck) => {
    hud.replaceChildren();
    if (!fateCheck) return;
    const resultClass = String(fateCheck.result || '').toLowerCase().replace(/_/g, '-');
    const total = document.createElement('p');
    total.className = 'fate-dice-total';
    total.textContent = String(fateCheck.roll);
    const verdict = document.createElement('p');
    verdict.className = `fate-dice-verdict is-${resultClass}`;
    verdict.textContent = fateCheck.resultLabel;
    const meta = document.createElement('p');
    meta.className = 'fate-dice-meta';
    meta.textContent = `${fateCheck.oddsLabel} · Chaos ${fateCheck.chaosFactor} · Yes on ${fateCheck.thresholds?.yes ?? '?'} or less`;
    const question = document.createElement('p');
    question.className = 'fate-dice-question';
    question.textContent = `“${fateCheck.question}”`;
    hud.append(question, total, verdict, meta);
    if (fateCheck.randomEvent) {
      const event = document.createElement('p');
      event.className = 'fate-dice-event';
      event.textContent = `Random event · ${fateCheck.randomEvent.label}${fateCheck.randomEvent.threadScene ? ` → ${fateCheck.randomEvent.threadScene.scene_goal}` : ''}`;
      hud.append(event);
    }
  };

  return {
    start(question = '') {
      clearTimers();
      settleResolve = null;
      container.hidden = false;
      container.classList.remove('is-settled', 'is-error');
      container.classList.add('is-rolling');
      hud.replaceChildren();
      const pending = document.createElement('p');
      pending.className = 'fate-dice-question';
      pending.textContent = question ? `“${question}”` : 'Consulting fate…';
      const hint = document.createElement('p');
      hint.className = 'fate-dice-meta';
      hint.textContent = 'The oracle casts the dice…';
      hud.append(pending, hint);
      lastWidth = 0;
      lastHeight = 0;
      resize();
      startedAt = performance.now();
      lastTickAt = startedAt;
      dice.forEach((die) => {
        die.spin.set(9 + Math.random() * 5, (8 + Math.random() * 5) * die.spinDir, 7 + Math.random() * 4);
        die.mesh.quaternion.setFromEuler(new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2));
        die.mesh.position.copy(computeRollPosition(die, 0));
        syncShadow(die);
      });
      mode = 'rolling';
      renderer.render(scene, camera);
      ensureLoop();
    },
    settle(fateCheck) {
      clearTimers();
      const elapsed = performance.now() - startedAt;
      const waitMs = Math.max(0, MIN_ROLL_MS - elapsed);
      return new Promise((resolve) => {
        const startSettlePhase = () => {
          settleTimerId = null;
          beginSettling(fateCheck, () => {
            container.classList.remove('is-rolling');
            container.classList.add('is-settled');
            renderHud(fateCheck);
            holdTimerId = setTimeout(() => {
              holdTimerId = null;
              resolve();
            }, POST_SETTLE_HOLD_MS);
          });
          ensureLoop();
        };
        if (waitMs > 0) {
          settleTimerId = setTimeout(startSettlePhase, waitMs);
        } else {
          startSettlePhase();
        }
      });
    },
    fail(message) {
      clearTimers();
      settleResolve = null;
      container.classList.remove('is-rolling');
      container.classList.add('is-error');
      hud.replaceChildren();
      const text = document.createElement('p');
      text.className = 'fate-dice-meta';
      text.textContent = message || 'The dice slipped from your hand.';
      hud.append(text);
      mode = 'settled';
    },
    hide() {
      clearTimers();
      settleResolve = null;
      container.hidden = true;
      container.classList.remove('is-rolling', 'is-settled', 'is-error');
      mode = 'hidden';
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
    isVisible() {
      return !container.hidden;
    }
  };
}
