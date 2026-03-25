import "./style.css";
import * as THREE from "three";

const PHYSICS = {
  gravity: new THREE.Vector3(0, -9.81, 0),
  drag: 0.08,
  restitution: 0.36,
  floorFriction: 0.82,
  projectileRadius: 0.085,
  minSpeed: 18,
  maxSpeed: 54,
  chargeTimeMs: 1600,
};

const WORLD = {
  minX: -28,
  maxX: 28,
  minZ: -88,
  maxZ: 22,
  cameraHeight: 1.65,
};

const app = document.getElementById("app");
const scoreEl = document.getElementById("score");
const hitsEl = document.getElementById("hits");
const angleEl = document.getElementById("angle");
const forceEl = document.getElementById("force");
const forceBarEl = document.getElementById("forceBar");
const tipsEl = document.getElementById("tips");
const zoomViewportEl = document.getElementById("zoomViewport");
const zoomMarkerEl = document.getElementById("zoomMarker");
const zoomHitTextEl = document.getElementById("zoomHitText");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88c6ff);
scene.fog = new THREE.Fog(0x88c6ff, 34, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, WORLD.cameraHeight, 6);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const zoomRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
zoomRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
zoomRenderer.setClearColor(0x000000, 0);
zoomRenderer.shadowMap.enabled = true;
zoomRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
zoomViewportEl.appendChild(zoomRenderer.domElement);

const zoomCamera = new THREE.PerspectiveCamera(23, 1, 0.1, 200);
scene.add(zoomCamera);

const hemiLight = new THREE.HemisphereLight(0xdaf2ff, 0x4a3f2d, 1.05);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.28);
sunLight.position.set(-22, 28, 12);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
scene.add(sunLight);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#89b972");
  grad.addColorStop(1, "#567f46");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(48, 48);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(340, 340),
  new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.92, metalness: 0.02 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const horizon = new THREE.Mesh(
  new THREE.RingGeometry(80, 140, 64),
  new THREE.MeshBasicMaterial({ color: 0x2f5f84, side: THREE.DoubleSide, transparent: true, opacity: 0.42 }),
);
horizon.position.set(0, 0.06, -22);
horizon.rotation.x = -Math.PI / 2;
scene.add(horizon);

const slingshot = (() => {
  const group = new THREE.Group();
  group.position.set(0.26, -0.3, -0.65);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f4b2f, roughness: 0.92, metalness: 0.05 });
  const bandMat = new THREE.LineBasicMaterial({ color: 0x301f1f });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.35, 12), woodMat);
  handle.rotation.z = Math.PI * 0.08;
  handle.position.set(0, 0.03, 0);
  handle.castShadow = true;
  group.add(handle);

  const leftFork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 10), woodMat);
  leftFork.position.set(-0.08, 0.2, 0.02);
  leftFork.rotation.z = -0.26;
  leftFork.castShadow = true;

  const rightFork = leftFork.clone();
  rightFork.position.x = 0.08;
  rightFork.rotation.z = 0.26;

  group.add(leftFork, rightFork);

  const restPouch = new THREE.Vector3(0, 0.2, 0.06);
  const pouch = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.02, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x2f1d14, roughness: 0.9 }),
  );
  pouch.position.copy(restPouch);
  pouch.castShadow = true;
  group.add(pouch);

  const leftTip = new THREE.Vector3(-0.095, 0.34, 0.04);
  const rightTip = new THREE.Vector3(0.095, 0.34, 0.04);

  const bandGeometry = new THREE.BufferGeometry().setFromPoints([leftTip, restPouch, rightTip]);
  const band = new THREE.Line(bandGeometry, bandMat);
  group.add(band);

  camera.add(group);

  function update(chargeRatio) {
    const pull = clamp(chargeRatio, 0, 1);
    const currentPouch = new THREE.Vector3(0, 0.2 - pull * 0.02, 0.06 + pull * 0.42);
    pouch.position.copy(currentPouch);
    band.geometry.setFromPoints([leftTip, currentPouch, rightTip]);
  }

  return { update };
})();

const previewLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.9 }),
);
previewLine.visible = false;
scene.add(previewLine);

function createDummyTarget() {
  const group = new THREE.Group();
  group.position.set(0, 0, -30);

  const standMat = new THREE.MeshStandardMaterial({ color: 0x564534, roughness: 0.9 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcba474, roughness: 0.8 });
  const ringRedMat = new THREE.MeshStandardMaterial({ color: 0xaa2f2f, emissive: 0x5f1414, emissiveIntensity: 0 });
  const ringWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f0de, roughness: 0.7 });
  const ringCenterMat = new THREE.MeshStandardMaterial({ color: 0xc32f2f, emissive: 0x7f1b1b, emissiveIntensity: 0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.16, 24), standMat);
  base.position.y = 0.08;
  base.receiveShadow = true;
  group.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.35, 14), standMat);
  pole.position.y = 0.83;
  pole.castShadow = true;
  group.add(pole);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.32, 18), bodyMat);
  hips.position.y = 1.36;
  hips.castShadow = true;
  group.add(hips);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.02, 20), bodyMat);
  torso.position.y = 1.93;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), bodyMat);
  head.position.y = 2.66;
  head.castShadow = true;
  group.add(head);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.64, 0.2), bodyMat);
  leftArm.position.set(-0.5, 1.95, 0);
  leftArm.rotation.z = 0.18;
  leftArm.castShadow = true;

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.5;
  rightArm.rotation.z = -0.18;
  group.add(leftArm, rightArm);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.84, 0.22), bodyMat);
  leftLeg.position.set(-0.17, 0.57, 0);
  leftLeg.castShadow = true;

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.17;
  group.add(leftLeg, rightLeg);

  const ringOuter = new THREE.Mesh(new THREE.CircleGeometry(0.26, 40), ringRedMat);
  ringOuter.position.set(0, 1.95, 0.43);
  ringOuter.castShadow = true;

  const ringMid = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), ringWhiteMat);
  ringMid.position.set(0, 1.95, 0.432);

  const ringCenter = new THREE.Mesh(new THREE.CircleGeometry(0.09, 40), ringCenterMat);
  ringCenter.position.set(0, 1.95, 0.434);

  group.add(ringOuter, ringMid, ringCenter);
  scene.add(group);

  return {
    group,
    hitZones: [
      { offset: new THREE.Vector3(0, 2.66, 0), radius: 0.25, points: 3, label: "head" },
      { offset: new THREE.Vector3(0, 1.95, 0.05), radius: 0.48, points: 2, label: "chest" },
      { offset: new THREE.Vector3(0, 0.62, 0), radius: 0.43, points: 1, label: "legs" },
    ],
    flashTime: 0,
    flashMaterials: [ringRedMat, ringCenterMat],
  };
}

const dummyTarget = createDummyTarget();

const projectiles = [];
const tmpV1 = new THREE.Vector3();
const tmpZoneWorld = new THREE.Vector3();
const tmpZoomTarget = new THREE.Vector3();
const tmpZoomProjected = new THREE.Vector3();

let yaw = 0;
let pitch = 0;
const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");

const keys = new Set();
let isCharging = false;
let chargeRatio = 0;
let chargeStartedAt = 0;

let score = 0;
let hitCount = 0;
let lastHitMarkerLife = 0;

const HIT_LABEL = {
  head: "Dau",
  chest: "Than",
  legs: "Chan",
};

function setTips(lines) {
  tipsEl.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
}

setTips([
  "Click vao man hinh de bat dau (Pointer Lock).",
  "Bia hinh nom da duoc dua lai gan hon.",
  "Giu chuot trai de keo na, tha chuot de ban.",
]);

function updateZoomViewportSize() {
  const width = zoomViewportEl.clientWidth || 200;
  const height = zoomViewportEl.clientHeight || 200;
  zoomRenderer.setSize(width, height, false);
  zoomCamera.aspect = width / height;
  zoomCamera.updateProjectionMatrix();
}

function updateZoomCameraPose() {
  tmpZoomTarget.set(dummyTarget.group.position.x, dummyTarget.group.position.y + 1.95, dummyTarget.group.position.z);
  zoomCamera.position.set(dummyTarget.group.position.x + 0.1, dummyTarget.group.position.y + 2.02, dummyTarget.group.position.z + 5.1);
  zoomCamera.lookAt(tmpZoomTarget);
}

updateZoomViewportSize();
updateZoomCameraPose();

function createProjectile(origin, velocity) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(PHYSICS.projectileRadius, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.18 }),
  );
  mesh.castShadow = true;
  mesh.position.copy(origin);
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity,
    age: 0,
  });
}

function shoot() {
  const shootDir = camera.getWorldDirection(tmpV1).clone().normalize();
  const muzzle = camera.position
    .clone()
    .add(shootDir.clone().multiplyScalar(0.72))
    .add(new THREE.Vector3(0, -0.08, 0));

  const speed = THREE.MathUtils.lerp(PHYSICS.minSpeed, PHYSICS.maxSpeed, chargeRatio);
  const velocity = shootDir.multiplyScalar(speed);

  createProjectile(muzzle, velocity);
}

function clearTrajectory() {
  previewLine.visible = false;
  previewLine.geometry.setFromPoints([]);
}

function updateTrajectoryPreview() {
  if (!isCharging) {
    clearTrajectory();
    return;
  }

  const dir = camera.getWorldDirection(tmpV1).clone().normalize();
  const speed = THREE.MathUtils.lerp(PHYSICS.minSpeed, PHYSICS.maxSpeed, chargeRatio);

  const points = [];
  const ghostPos = camera.position
    .clone()
    .add(dir.clone().multiplyScalar(0.72))
    .add(new THREE.Vector3(0, -0.08, 0));
  const ghostVelocity = dir.multiplyScalar(speed);

  const step = 0.08;
  for (let i = 0; i < 28; i += 1) {
    ghostVelocity.addScaledVector(PHYSICS.gravity, step);
    ghostVelocity.multiplyScalar(Math.exp(-PHYSICS.drag * step));
    ghostPos.addScaledVector(ghostVelocity, step);

    if (ghostPos.y < PHYSICS.projectileRadius) {
      ghostPos.y = PHYSICS.projectileRadius;
      if (ghostVelocity.y < 0) {
        ghostVelocity.y = -ghostVelocity.y * PHYSICS.restitution;
      }
    }

    points.push(ghostPos.clone());
  }

  previewLine.visible = true;
  previewLine.geometry.setFromPoints(points);
}

function releaseShot() {
  if (!isCharging) {
    return;
  }

  shoot();
  isCharging = false;
  chargeRatio = 0;
  document.body.classList.remove("charging");
  clearTrajectory();
}

function handleMouseMove(event) {
  if (document.pointerLockElement !== renderer.domElement) {
    return;
  }

  yaw -= event.movementX * 0.0024;
  pitch -= event.movementY * 0.0023;
  pitch = clamp(pitch, -1.2, 0.78);
}

function updateCameraRotation() {
  cameraEuler.x = pitch;
  cameraEuler.y = yaw;
  camera.quaternion.setFromEuler(cameraEuler);
}

function updateMovement(dt, elapsedTime) {
  const moveDir = new THREE.Vector3();
  const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));

  if (keys.has("KeyW")) moveDir.add(forward);
  if (keys.has("KeyS")) moveDir.sub(forward);
  if (keys.has("KeyD")) moveDir.add(right);
  if (keys.has("KeyA")) moveDir.sub(right);

  let speed = 6;
  if (keys.has("ShiftLeft") || keys.has("ShiftRight")) {
    speed = 9;
  }

  if (moveDir.lengthSq() > 0.0001) {
    moveDir.normalize();
    camera.position.addScaledVector(moveDir, speed * dt);
  }

  camera.position.x = clamp(camera.position.x, WORLD.minX, WORLD.maxX);
  camera.position.z = clamp(camera.position.z, WORLD.minZ, WORLD.maxZ);

  const bob = moveDir.lengthSq() > 0.0001 ? Math.sin(elapsedTime * 10.5) * 0.028 : 0;
  camera.position.y = WORLD.cameraHeight + bob;
}

function updateCharging(nowMs) {
  if (!isCharging) {
    return;
  }

  const elapsed = nowMs - chargeStartedAt;
  chargeRatio = clamp(elapsed / PHYSICS.chargeTimeMs, 0, 1);
}

function registerHit(zone, hitPosition) {
  score += zone.points;
  hitCount += 1;
  scoreEl.textContent = String(score);
  hitsEl.textContent = String(hitCount);
  dummyTarget.flashTime = 0.16;
  zoomHitTextEl.textContent = `Vung trung: ${HIT_LABEL[zone.label]} (+${zone.points})`;

  tmpZoomProjected.copy(hitPosition).project(zoomCamera);
  const markerX = clamp(((tmpZoomProjected.x + 1) * 0.5) * 100, 3, 97);
  const markerY = clamp(((1 - tmpZoomProjected.y) * 0.5) * 100, 3, 97);
  zoomMarkerEl.style.left = `${markerX.toFixed(2)}%`;
  zoomMarkerEl.style.top = `${markerY.toFixed(2)}%`;
  zoomMarkerEl.style.opacity = "1";
  lastHitMarkerLife = 0.85;
}

function isHittingDummy(projectilePosition) {
  for (const zone of dummyTarget.hitZones) {
    tmpZoneWorld.copy(zone.offset);
    dummyTarget.group.localToWorld(tmpZoneWorld);

    const hitRadius = zone.radius + PHYSICS.projectileRadius;
    if (projectilePosition.distanceToSquared(tmpZoneWorld) <= hitRadius * hitRadius) {
      registerHit(zone, projectilePosition);
      return true;
    }
  }

  return false;
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const shot = projectiles[i];
    shot.age += dt;

    shot.velocity.addScaledVector(PHYSICS.gravity, dt);
    shot.velocity.multiplyScalar(Math.exp(-PHYSICS.drag * dt));

    shot.mesh.position.addScaledVector(shot.velocity, dt);

    if (isHittingDummy(shot.mesh.position)) {
      scene.remove(shot.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    if (shot.mesh.position.y < PHYSICS.projectileRadius) {
      shot.mesh.position.y = PHYSICS.projectileRadius;
      if (Math.abs(shot.velocity.y) > 0.9) {
        shot.velocity.y = -shot.velocity.y * PHYSICS.restitution;
        shot.velocity.x *= PHYSICS.floorFriction;
        shot.velocity.z *= PHYSICS.floorFriction;
      } else {
        shot.velocity.y = 0;
        shot.velocity.x *= 0.75;
        shot.velocity.z *= 0.75;
      }
    }

    const isStopped = shot.velocity.lengthSq() < 0.65;
    const isOutside =
      shot.mesh.position.z < WORLD.minZ - 35 ||
      shot.mesh.position.z > WORLD.maxZ + 30 ||
      Math.abs(shot.mesh.position.x) > WORLD.maxX + 40;

    if (shot.age > 12 || isOutside || (isStopped && shot.mesh.position.y <= PHYSICS.projectileRadius + 0.01)) {
      scene.remove(shot.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function updateDummyVisual(dt) {
  if (dummyTarget.flashTime > 0) {
    dummyTarget.flashTime = Math.max(0, dummyTarget.flashTime - dt);
  }

  const intensity = dummyTarget.flashTime > 0 ? dummyTarget.flashTime / 0.16 : 0;
  for (const mat of dummyTarget.flashMaterials) {
    mat.emissiveIntensity = intensity;
  }
}

function updateZoomOverlay(dt) {
  if (lastHitMarkerLife > 0) {
    lastHitMarkerLife = Math.max(0, lastHitMarkerLife - dt);
    zoomMarkerEl.style.opacity = String(lastHitMarkerLife / 0.85);
  } else if (zoomMarkerEl.style.opacity !== "0") {
    zoomMarkerEl.style.opacity = "0";
  }
}

function updateHud() {
  const deg = THREE.MathUtils.radToDeg(-pitch);
  angleEl.textContent = `${deg.toFixed(1)} deg`;
  forceEl.textContent = `${Math.round(chargeRatio * 100)}%`;
  forceBarEl.style.width = `${Math.round(chargeRatio * 100)}%`;
}

function resetGame() {
  for (const shot of projectiles) {
    scene.remove(shot.mesh);
  }
  projectiles.length = 0;

  score = 0;
  hitCount = 0;
  scoreEl.textContent = "0";
  hitsEl.textContent = "0";
  zoomHitTextEl.textContent = "Vung trung: -";
  zoomMarkerEl.style.opacity = "0";
  lastHitMarkerLife = 0;

  camera.position.set(0, WORLD.cameraHeight, 6);
  yaw = 0;
  pitch = 0;
  updateCameraRotation();
  chargeRatio = 0;

  setTips([
    "Tran dau da reset.",
    "Bia hinh nom da duoc dua lai gan hon.",
    "Giu chuot trai de keo na, tha chuot de ban.",
  ]);
}

renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  isCharging = true;
  chargeStartedAt = performance.now();
  chargeRatio = 0;
  document.body.classList.add("charging");
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 0) return;
  releaseShot();
});

window.addEventListener("mousemove", handleMouseMove);

window.addEventListener("keydown", (event) => {
  keys.add(event.code);

  if (event.code === "KeyR") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === renderer.domElement;

  if (locked) {
    setTips([
      "Dang trong che do nhin thu nhat.",
      "Xem khung zoom ben phai de biet vung vua ban trung.",
      "Giu chuot trai de keo na, tha chuot de ban.",
    ]);
  } else {
    releaseShot();
    setTips([
      "Da thoat pointer lock.",
      "Click vao man hinh de tiep tuc choi.",
      "Nhan R de reset diem.",
    ]);
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateZoomViewportSize();
  updateZoomCameraPose();
});

if ("ontouchstart" in window) {
  setTips([
    "Ban dang o thiet bi cam ung.",
    "Game nay toi uu cho desktop + chuot (Pointer Lock).",
    "Ban van co the xem scene tren mobile.",
  ]);
}

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  updateCharging(performance.now());
  updateMovement(dt, elapsed);
  updateCameraRotation();
  updateTrajectoryPreview();
  updateProjectiles(dt);
  updateDummyVisual(dt);
  updateZoomOverlay(dt);
  updateHud();
  slingshot.update(chargeRatio);
  updateZoomCameraPose();

  renderer.render(scene, camera);
  zoomRenderer.render(scene, zoomCamera);
  requestAnimationFrame(animate);
}

animate();
