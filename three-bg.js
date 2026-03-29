
(function initThreeBg() {
  if (typeof THREE === 'undefined') return;

  
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    zIndex: '0', pointerEvents: 'none',
  });
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
  camera.position.z = 7;

  
  const COLORS = [0x38bdf8, 0xa78bfa, 0x10b981, 0x60a5fa, 0xe879f9];

  
  const STAR_N = 220;
  const starPts = Array.from({ length: STAR_N }, () => ({
    x: (Math.random() - 0.5) * 36,
    y: (Math.random() - 0.5) * 22,
    z: (Math.random() - 0.5) * 8 - 2,
    vx: (Math.random() - 0.5) * 0.0012,
    vy: (Math.random() - 0.5) * 0.0012,
    phase: Math.random() * Math.PI * 2,
  }));
  const starPos = new Float32Array(STAR_N * 3);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.03, transparent: true, opacity: 0.5 });
  scene.add(new THREE.Points(starGeo, starMat));

  
  const N = 80;
  const pts = Array.from({ length: N }, () => ({
    x:  (Math.random() - 0.5) * 26,
    y:  (Math.random() - 0.5) * 18,
    z:  (Math.random() - 0.5) * 3,
    vx: (Math.random() - 0.5) * 0.004,
    vy: (Math.random() - 0.5) * 0.004,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 0.04 + Math.random() * 0.09,
    phase: Math.random() * Math.PI * 2,
    pulse: 0.4 + Math.random() * 0.8,
  }));

  
  const colorGroups = {};
  COLORS.forEach(c => { colorGroups[c] = []; });
  pts.forEach((p, i) => colorGroups[p.color].push(i));

  const dotMeshes = {};
  COLORS.forEach(c => {
    const n = colorGroups[c].length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ color: c, size: 0.1, transparent: true, opacity: 0.92, sizeAttenuation: true });
    const mesh = new THREE.Points(geo, mat);
    scene.add(mesh);
    dotMeshes[c] = { mesh, geo, indices: colorGroups[c] };
  });

  
  const NODE_N = 8;
  const nodes = Array.from({ length: NODE_N }, () => ({
    x: (Math.random() - 0.5) * 20,
    y: (Math.random() - 0.5) * 12,
    z: (Math.random() - 0.5) * 2,
    vx: (Math.random() - 0.5) * 0.002,
    vy: (Math.random() - 0.5) * 0.002,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    phase: Math.random() * Math.PI * 2,
  }));
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NODE_N * 3), 3));
  const nodeMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.26, transparent: true, opacity: 0.6 });
  scene.add(new THREE.Points(nodeGeo, nodeMat));


  const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.07 });
  const lineMat2 = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.05 });
  let lineMesh1 = null, lineMesh2 = null;
  const MAX_D = 3.8;

  function rebuildLines() {
    if (lineMesh1) { scene.remove(lineMesh1); lineMesh1.geometry.dispose(); }
    if (lineMesh2) { scene.remove(lineMesh2); lineMesh2.geometry.dispose(); }
    const buf1 = [], buf2 = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MAX_D * MAX_D) {
          const target = pts[i].color === pts[j].color ? buf1 : buf2;
          target.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
        }
      }
    }
    const g1 = new THREE.BufferGeometry();
    g1.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf1), 3));
    lineMesh1 = new THREE.LineSegments(g1, lineMat); scene.add(lineMesh1);
    if (buf2.length) {
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf2), 3));
      lineMesh2 = new THREE.LineSegments(g2, lineMat2); scene.add(lineMesh2);
    }
  }

  
  let mx = 0, my = 0, targetCamX = 0, targetCamY = 0;
  addEventListener('mousemove', e => {
    mx =  (e.clientX / innerWidth  - 0.5) * 26;
    my = -(e.clientY / innerHeight - 0.5) * 18;
    targetCamX = (e.clientX / innerWidth  - 0.5) * 0.4;
    targetCamY = (e.clientY / innerHeight - 0.5) * -0.25;
  });

  
  let frame = 0;
  const camDrift = { x: 0, y: 0 };

  (function tick() {
    requestAnimationFrame(tick);
    frame++;
    const t = frame * 0.008;

    
    camDrift.x += 0.0004 * Math.sin(t * 0.3);
    camDrift.y += 0.0003 * Math.cos(t * 0.2);
    camera.position.x += (targetCamX + camDrift.x - camera.position.x) * 0.02;
    camera.position.y += (targetCamY + camDrift.y - camera.position.y) * 0.02;

    
    const sa = starGeo.attributes.position;
    for (let i = 0; i < STAR_N; i++) {
      const p = starPts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x >  18) p.x = -18; if (p.x < -18) p.x =  18;
      if (p.y >  11) p.y = -11; if (p.y < -11) p.y =  11;
      sa.array[i*3]   = p.x;
      sa.array[i*3+1] = p.y;
      sa.array[i*3+2] = p.z;
    }
    sa.needsUpdate = true;
    starMat.opacity = 0.3 + 0.2 * Math.sin(t * 0.5);

    
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x >  13) p.x = -13; if (p.x < -13) p.x =  13;
      if (p.y >   9) p.y =  -9; if (p.y <  -9) p.y =   9;
      /* Mouse repulsion */
      const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 6 && d2 > 0.01) { const d = Math.sqrt(d2); p.x += dx/d * 0.03; p.y += dy/d * 0.03; }
    }

    
    COLORS.forEach(c => {
      const { mesh, geo, indices } = dotMeshes[c];
      const attr = geo.attributes.position;
      indices.forEach((pi, li) => {
        const p = pts[pi];
        attr.array[li*3]   = p.x;
        attr.array[li*3+1] = p.y;
        attr.array[li*3+2] = p.z;
      });
      attr.needsUpdate = true;
      /* Pulse opacity */
      mesh.material.opacity = 0.6 + 0.35 * Math.sin(t * 1.2 + indices[0] * 0.3);
    });

    /* Energy nodes */
    const na = nodeGeo.attributes.position;
    for (let i = 0; i < NODE_N; i++) {
      const p = nodes[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x >  10) p.x = -10; if (p.x < -10) p.x =  10;
      if (p.y >   6) p.y =  -6; if (p.y <  -6) p.y =   6;
      na.array[i*3]   = p.x;
      na.array[i*3+1] = p.y;
      na.array[i*3+2] = p.z;
    }
    na.needsUpdate = true;
    nodeMat.opacity = 0.4 + 0.3 * Math.sin(t * 0.7);
    nodeMat.size    = 0.22 + 0.1 * Math.sin(t * 1.1);

    if (frame % 3 === 0) rebuildLines();
    renderer.render(scene, camera);
  }());

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}());