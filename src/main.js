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

const VFX = {
  maxPaintMarks: 140,
  burstParticleCount: 13,
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
const dummyImageInputEl = document.getElementById("dummyImageInput");
const clearImageBtnEl = document.getElementById("clearImageBtn");
const imageNameEl = document.getElementById("imageName");
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

const textureLoader = new THREE.TextureLoader();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function random(min, max) {
  return Math.random() * (max - min) + min;
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

function makeSplatTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  const cx = 128;
  const cy = 128;
  const grad = ctx.createRadialGradient(cx, cy, 22, cx, cy, 120);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 32; i += 1) {
    const angle = random(0, Math.PI * 2);
    const dist = random(70, 118);
    const r = random(6, 18);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
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
  const photoFrameMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.82, metalness: 0.18 });
  const photoMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
  });
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

  const photoFrame = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.42), photoFrameMat);
  photoFrame.position.set(0, 2.66, 0.248);
  photoFrame.castShadow = true;
  photoFrame.visible = false;
  group.add(photoFrame);

  const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), photoMat);
  photoMesh.position.set(0, 2.66, 0.252);
  photoMesh.scale.set(0.3, 0.36, 1);
  photoMesh.visible = false;
  group.add(photoMesh);

  const ringOuter = new THREE.Mesh(new THREE.CircleGeometry(0.26, 40), ringRedMat);
  ringOuter.position.set(0, 1.95, 0.472);
  ringOuter.castShadow = true;

  const ringMid = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), ringWhiteMat);
  ringMid.position.set(0, 1.95, 0.474);

  const ringCenter = new THREE.Mesh(new THREE.CircleGeometry(0.09, 40), ringCenterMat);
  ringCenter.position.set(0, 1.95, 0.476);

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
    photoMesh,
    photoFrame,
    photoMat,
    photoBaseWidth: 0.3,
    photoBaseHeight: 0.36,
    bullseyeMeshes: [ringOuter, ringMid, ringCenter],
  };
}

const dummyTarget = createDummyTarget();
let activeDummyTexture = null;
let activeDummyImageUrl = null;
let imageLoadRequestId = 0;
const splatTexture = makeSplatTexture();

const projectiles = [];
const burstParticles = [];
const paintMarks = [];
const tmpV1 = new THREE.Vector3();
const tmpMoveDir = new THREE.Vector3();
const tmpMoveForward = new THREE.Vector3();
const tmpMoveRight = new THREE.Vector3();
const tmpZoneWorld = new THREE.Vector3();
const tmpZoomTarget = new THREE.Vector3();
const tmpZoomProjected = new THREE.Vector3();
const tmpHitNormal = new THREE.Vector3();
const tmpPaintHit = new THREE.Vector3();
const SURFACE_NORMAL_AXIS = new THREE.Vector3(0, 0, 1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

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
  "Dan ban la chat long: trung dich se vang mau len hinh nom.",
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

function createLiquidColor() {
  return new THREE.Color().setHSL(random(0.0, 0.08), random(0.75, 0.92), random(0.46, 0.58));
}

function removeOldestPaintMark() {
  const mark = paintMarks.shift();
  if (!mark) return;
  scene.remove(mark.mesh);
  mark.mesh.geometry.dispose();
  mark.mesh.material.dispose();
}

function addPaintMark(worldHit, zone, color) {
  tmpZoneWorld.copy(zone.offset);
  dummyTarget.group.localToWorld(tmpZoneWorld);

  tmpHitNormal.subVectors(worldHit, tmpZoneWorld);
  if (tmpHitNormal.lengthSq() < 0.00001) {
    tmpHitNormal.set(0, 0, 1);
  } else {
    tmpHitNormal.normalize();
  }

  const sizeByZone = zone.label === "head" ? random(0.09, 0.16) : zone.label === "chest" ? random(0.11, 0.2) : random(0.1, 0.17);
  const mark = new THREE.Mesh(
    new THREE.CircleGeometry(sizeByZone, 18),
    new THREE.MeshBasicMaterial({
      map: splatTexture,
      color: color.clone().offsetHSL(random(-0.02, 0.02), random(-0.04, 0.04), random(-0.06, 0.05)),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: random(0.82, 0.97),
    }),
  );

  tmpPaintHit.copy(tmpZoneWorld).addScaledVector(tmpHitNormal, zone.radius + 0.018);
  mark.position.copy(tmpPaintHit);
  mark.quaternion.setFromUnitVectors(SURFACE_NORMAL_AXIS, tmpHitNormal);
  mark.rotateZ(random(-Math.PI, Math.PI));
  mark.renderOrder = 6;
  scene.add(mark);
  paintMarks.push({ mesh: mark });

  while (paintMarks.length > VFX.maxPaintMarks) {
    removeOldestPaintMark();
  }

  return tmpPaintHit;
}

function spawnLiquidBurst(worldHit, color) {
  for (let i = 0; i < VFX.burstParticleCount; i += 1) {
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(random(0.02, 0.045), 10, 10),
      new THREE.MeshStandardMaterial({
        color: color.clone().offsetHSL(random(-0.03, 0.03), random(-0.04, 0.03), random(-0.06, 0.03)),
        roughness: 0.34,
        metalness: 0.0,
        transparent: true,
        opacity: 0.94,
      }),
    );
    drop.position.copy(worldHit);
    scene.add(drop);

    const speed = random(1.5, 6.2);
    const theta = random(0, Math.PI * 2);
    const yVel = random(0.6, 2.7);
    const velocity = new THREE.Vector3(Math.cos(theta) * speed, yVel, Math.sin(theta) * speed);

    burstParticles.push({
      mesh: drop,
      velocity,
      life: random(0.28, 0.62),
      maxLife: 0.62,
    });
  }
}

function clearImpactVfx() {
  for (const particle of burstParticles) {
    scene.remove(particle.mesh);
    particle.mesh.geometry.dispose();
    particle.mesh.material.dispose();
  }
  burstParticles.length = 0;

  for (const mark of paintMarks) {
    scene.remove(mark.mesh);
    mark.mesh.geometry.dispose();
    mark.mesh.material.dispose();
  }
  paintMarks.length = 0;
}

function cleanupAllResources() {
  disposeActiveDummyImage();
  clearImpactVfx();
  splatTexture.dispose();
}

function setBullseyeVisible(visible) {
  for (const mesh of dummyTarget.bullseyeMeshes) {
    mesh.visible = visible;
  }
}

function disposeActiveDummyImage() {
  if (activeDummyTexture) {
    activeDummyTexture.dispose();
    activeDummyTexture = null;
  }

  if (activeDummyImageUrl) {
    URL.revokeObjectURL(activeDummyImageUrl);
    activeDummyImageUrl = null;
  }
}

function clearDummyImage() {
  imageLoadRequestId += 1;
  disposeActiveDummyImage();
  dummyTarget.photoMat.map = null;
  dummyTarget.photoMat.needsUpdate = true;
  dummyTarget.photoMesh.visible = false;
  dummyTarget.photoFrame.visible = false;
  setBullseyeVisible(true);
  imageNameEl.textContent = "Anh hinh nom: mac dinh";
  dummyImageInputEl.value = "";
}

function applyDummyImage(texture, fileName, imageUrl) {
  disposeActiveDummyImage();
  activeDummyTexture = texture;
  activeDummyImageUrl = imageUrl;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  const img = texture.image;
  const aspect = img && img.width > 0 && img.height > 0 ? img.width / img.height : 1;
  const baseW = dummyTarget.photoBaseWidth;
  const baseH = dummyTarget.photoBaseHeight;

  let fitW = baseW;
  let fitH = baseH;
  if (aspect > baseW / baseH) {
    fitH = baseW / aspect;
  } else {
    fitW = baseH * aspect;
  }

  dummyTarget.photoMesh.scale.set(fitW, fitH, 1);
  dummyTarget.photoMat.map = texture;
  dummyTarget.photoMat.needsUpdate = true;
  dummyTarget.photoMesh.visible = true;
  dummyTarget.photoFrame.visible = true;
  setBullseyeVisible(true);
  imageNameEl.textContent = `Anh hinh nom: ${fileName}`;
}

function handleDummyImageSelection(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    imageNameEl.textContent = "Anh hinh nom: file khong hop le";
    dummyImageInputEl.value = "";
    return;
  }

  const requestId = imageLoadRequestId + 1;
  imageLoadRequestId = requestId;

  const objectUrl = URL.createObjectURL(file);
  imageNameEl.textContent = "Anh hinh nom: dang tai...";

  textureLoader.load(
    objectUrl,
    (texture) => {
      if (requestId !== imageLoadRequestId) {
        texture.dispose();
        URL.revokeObjectURL(objectUrl);
        return;
      }

      applyDummyImage(texture, file.name, objectUrl);
    },
    undefined,
    () => {
      URL.revokeObjectURL(objectUrl);
      if (requestId === imageLoadRequestId) {
        imageNameEl.textContent = "Anh hinh nom: tai that bai";
        dummyImageInputEl.value = "";
      }
    },
  );
}

updateZoomViewportSize();
updateZoomCameraPose();

function createProjectile(origin, velocity, color) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(PHYSICS.projectileRadius, 14, 14),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color.clone().multiplyScalar(0.28),
      roughness: 0.22,
      metalness: 0.02,
      transparent: true,
      opacity: 0.9,
    }),
  );
  mesh.castShadow = true;
  mesh.scale.set(1.08, 0.9, 1.08);
  mesh.position.copy(origin);
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity,
    color,
    age: 0,
    wobblePhase: random(0, Math.PI * 2),
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
  const liquidColor = createLiquidColor();

  createProjectile(muzzle, velocity, liquidColor);
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
  tmpMoveDir.set(0, 0, 0);

  camera.getWorldDirection(tmpMoveForward);
  tmpMoveForward.y = 0;

  if (tmpMoveForward.lengthSq() > 0.000001) {
    tmpMoveForward.normalize();
  } else {
    tmpMoveForward.set(0, 0, -1);
  }

  tmpMoveRight.crossVectors(tmpMoveForward, WORLD_UP).normalize();

  if (keys.has("KeyW")) tmpMoveDir.add(tmpMoveForward);
  if (keys.has("KeyS")) tmpMoveDir.sub(tmpMoveForward);
  if (keys.has("KeyD")) tmpMoveDir.add(tmpMoveRight);
  if (keys.has("KeyA")) tmpMoveDir.sub(tmpMoveRight);

  let speed = 6;
  if (keys.has("ShiftLeft") || keys.has("ShiftRight")) {
    speed = 9;
  }

  if (tmpMoveDir.lengthSq() > 0.0001) {
    tmpMoveDir.normalize();
    camera.position.addScaledVector(tmpMoveDir, speed * dt);
  }

  camera.position.x = clamp(camera.position.x, WORLD.minX, WORLD.maxX);
  camera.position.z = clamp(camera.position.z, WORLD.minZ, WORLD.maxZ);

  const bob = tmpMoveDir.lengthSq() > 0.0001 ? Math.sin(elapsedTime * 10.5) * 0.028 : 0;
  camera.position.y = WORLD.cameraHeight + bob;
}

function updateCharging(nowMs) {
  if (!isCharging) {
    return;
  }

  const elapsed = nowMs - chargeStartedAt;
  chargeRatio = clamp(elapsed / PHYSICS.chargeTimeMs, 0, 1);
}

function registerHit(zone, hitPosition, shotColor) {
  score += zone.points;
  hitCount += 1;
  scoreEl.textContent = String(score);
  hitsEl.textContent = String(hitCount);
  dummyTarget.flashTime = 0.16;
  const surfaceHit = addPaintMark(hitPosition, zone, shotColor);
  spawnLiquidBurst(surfaceHit, shotColor);
  zoomHitTextEl.textContent = `Vung trung: ${HIT_LABEL[zone.label]} (+${zone.points})`;

  tmpZoomProjected.copy(surfaceHit).project(zoomCamera);
  const markerX = clamp(((tmpZoomProjected.x + 1) * 0.5) * 100, 3, 97);
  const markerY = clamp(((1 - tmpZoomProjected.y) * 0.5) * 100, 3, 97);
  zoomMarkerEl.style.left = `${markerX.toFixed(2)}%`;
  zoomMarkerEl.style.top = `${markerY.toFixed(2)}%`;
  zoomMarkerEl.style.opacity = "1";
  lastHitMarkerLife = 0.85;
}

function isHittingDummy(projectilePosition, shotColor) {
  for (const zone of dummyTarget.hitZones) {
    tmpZoneWorld.copy(zone.offset);
    dummyTarget.group.localToWorld(tmpZoneWorld);

    const hitRadius = zone.radius + PHYSICS.projectileRadius;
    if (projectilePosition.distanceToSquared(tmpZoneWorld) <= hitRadius * hitRadius) {
      registerHit(zone, projectilePosition, shotColor);
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
    const wobble = Math.sin(shot.age * 22 + shot.wobblePhase) * 0.08;
    shot.mesh.scale.set(1.06 + wobble, 0.9 - wobble * 0.6, 1.06 + wobble);
    shot.mesh.rotation.x += dt * 8;
    shot.mesh.rotation.z += dt * 6;

    if (isHittingDummy(shot.mesh.position, shot.color)) {
      scene.remove(shot.mesh);
      shot.mesh.geometry.dispose();
      shot.mesh.material.dispose();
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
      shot.mesh.geometry.dispose();
      shot.mesh.material.dispose();
      projectiles.splice(i, 1);
    }
  }
}

function updateBurstParticles(dt) {
  for (let i = burstParticles.length - 1; i >= 0; i -= 1) {
    const particle = burstParticles[i];
    particle.life -= dt;

    particle.velocity.y -= 9.81 * dt * 0.72;
    particle.velocity.multiplyScalar(Math.exp(-dt * 4.3));
    particle.mesh.position.addScaledVector(particle.velocity, dt);

    if (particle.mesh.position.y < 0.015) {
      particle.mesh.position.y = 0.015;
      if (particle.velocity.y < 0) {
        particle.velocity.y *= -0.18;
      }
      particle.velocity.x *= 0.82;
      particle.velocity.z *= 0.82;
    }

    particle.mesh.material.opacity = clamp(particle.life / particle.maxLife, 0, 1);
    particle.mesh.scale.multiplyScalar(0.99);

    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
      burstParticles.splice(i, 1);
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
    shot.mesh.geometry.dispose();
    shot.mesh.material.dispose();
  }
  projectiles.length = 0;
  clearImpactVfx();

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
    "Nhan ESC de mo chuot va doi anh cho hinh nom.",
  ]);
}

renderer.domElement.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

dummyImageInputEl.addEventListener("change", handleDummyImageSelection);
clearImageBtnEl.addEventListener("click", clearDummyImage);

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
      "Dan chat long se no giot va bam mau vao bia.",
      "Nhan ESC neu muon doi anh cho hinh nom.",
    ]);
  } else {
    releaseShot();
    setTips([
      "Da thoat pointer lock.",
      "Ban co the Chon anh de dan len mat truoc hinh nom.",
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

window.addEventListener("beforeunload", cleanupAllResources);

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
  updateCameraRotation();
  updateMovement(dt, elapsed);
  updateTrajectoryPreview();
  updateProjectiles(dt);
  updateBurstParticles(dt);
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
