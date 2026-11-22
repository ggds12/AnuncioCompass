/* Compasso · alto mar
   Cena 3D do fim da página (three.js r128, carregado só quando a pessoa chega perto).
   - Uma tartaruga marinha feita à mão em código: casco com placas desenhadas numa
     textura, plastrão, cabeça, olhos e nadadeiras que remam como asas.
   - A luz da superfície desenha cáusticas (a rede de luz que dança no fundo do mar)
     sobre o corpo dela enquanto nada.
   - Raios de sol, a superfície vista de baixo, um cardume girando ao fundo,
     neve marinha, bolhas e partículas desfocadas na frente da câmera.
   - Ao rolar, a câmera "mergulha"; o mouse desloca a cena. */
(() => {
  'use strict';
  const THREE = window.THREE;
  const ocean = document.querySelector('[data-ocean]');
  const cv = document.querySelector('[data-ocean-gl]');
  if (!THREE || !ocean || !cv) return;
  const section = cv.parentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  let small = innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1d4176, 8, 32);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
  const uTime = { value: 0 };

  /* ---------------- luz ---------------- */
  scene.add(new THREE.HemisphereLight(0xd2e3ff, 0x0a1730, 1.05));
  const sun = new THREE.DirectionalLight(0xeaf2ff, 1.3);
  sun.position.set(-3, 10, 4);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9cc0ff, 0.7);
  rim.position.set(5, 2, -6);
  scene.add(rim);

  /* cáusticas: a rede de luz que a superfície projeta (função clássica de água) */
  const CAUSTIC = `
    float caustic(vec2 p, float t) {
      vec2 i = p; float c = 1.0; float inten = 0.005;
      for (int n = 0; n < 4; n++) {
        float tt = t * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
      }
      c /= 4.0; c = 1.17 - pow(c, 1.4);
      return clamp(pow(abs(c), 8.0), 0.0, 1.0);
    }`;
  function withCaustics(mat, strength) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'varying vec3 vWPos;\nvarying vec3 vWNorm;\n' + sh.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vWNorm = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;\n' + CAUSTIC + '\n' + sh.fragmentShader.replace(
        '#include <fog_fragment>',
        '  float cs = caustic(mod(vWPos.xz * 1.15, 6.2831) - 250.0, uTime * 0.42);\n' +
        '  gl_FragColor.rgb += vec3(0.6, 0.8, 1.0) * cs * ' + strength.toFixed(2) + ' * smoothstep(-0.2, 0.9, vWNorm.y);\n' +
        '#include <fog_fragment>');
    };
    return mat;
  }

  /* ---------------- texturas desenhadas em canvas ---------------- */
  function canvasTex(w, h, paint, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  }

  // casco visto de cima: frente no topo do canvas. Placas vertebrais no meio,
  // costais dos lados e o anel das marginais na borda.
  const shellTex = canvasTex(512, 640, (g, W, H) => {
    const cx = W / 2, cz = H / 2, rx = W / 2, rz = H / 2, IN = 0.84;
    g.fillStyle = '#263141'; g.fillRect(0, 0, W, H);
    const ellX = (z, k) => rx * k * Math.sqrt(Math.max(0, 1 - ((z - cz) / (rz * k)) ** 2));
    const plate = (pts, light) => {
      const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
      let R = 0; pts.forEach(p => { R = Math.max(R, Math.hypot(p[0] - c[0], p[1] - c[1])); });
      const path = (k) => { g.beginPath(); pts.forEach((p, i) => { const x = c[0] + (p[0] - c[0]) * k, y = c[1] + (p[1] - c[1]) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
      const gr = g.createRadialGradient(c[0] - R * 0.15, c[1] - R * 0.2, R * 0.05, c[0], c[1], R * 1.05);
      gr.addColorStop(0, light ? '#71839d' : '#62738c'); gr.addColorStop(0.6, '#3e4b5f'); gr.addColorStop(1, '#222b38');
      path(1); g.fillStyle = gr; g.fill();
      // anéis de crescimento
      g.lineWidth = 2;
      [0.74, 0.5, 0.28].forEach((k, i) => { path(k); g.strokeStyle = `rgba(200,220,255,${0.07 - i * 0.015})`; g.stroke(); });
      // junta escura e brilho fino por dentro
      path(1); g.lineWidth = 6; g.strokeStyle = '#10161f'; g.stroke();
      path(0.95); g.lineWidth = 1.5; g.strokeStyle = 'rgba(190,212,250,.22)'; g.stroke();
    };
    // marginais
    const N = 24;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      plate([[cx + rx * IN * Math.cos(a0), cz + rz * IN * Math.sin(a0)], [cx + rx * Math.cos(a0), cz + rz * Math.sin(a0)],
             [cx + rx * Math.cos(a1), cz + rz * Math.sin(a1)], [cx + rx * IN * Math.cos(a1), cz + rz * IN * Math.sin(a1)]]);
    }
    // vertebrais
    const hw = rx * 0.25, hh = 47, zc = k => cz + (k - 2) * hh * 2;
    const vert = k => [[cx - hw * 0.55, zc(k) - hh], [cx + hw * 0.55, zc(k) - hh], [cx + hw, zc(k)], [cx + hw * 0.55, zc(k) + hh], [cx - hw * 0.55, zc(k) + hh], [cx - hw, zc(k)]];
    // costais (quatro de cada lado) e as placas da frente (nucal) e de trás (supracaudal)
    const zTop = zc(0) - hh, zBot = zc(4) + hh;
    [-1, 1].forEach(s => {
      for (let k = 0; k < 4; k++) {
        const inner = [];
        if (k === 0) inner.push([cx + s * hw * 0.55, zTop], [cx + s * hw, zc(0)]);
        inner.push([cx + s * hw * 0.55, zc(k) + hh], [cx + s * hw, zc(k + 1)]);
        if (k === 3) inner.push([cx + s * hw * 0.55, zBot]);
        const za = k === 0 ? zTop : zc(k), zb = k === 3 ? zBot : zc(k + 1);
        const outer = [];
        for (let j = 0; j <= 10; j++) { const z = lerp(zb, za, j / 10); outer.push([cx + s * ellX(z, IN), z]); }
        plate(inner.concat(outer));
      }
    });
    const cap = (za, zb) => {
      const pts = [];
      for (let j = 0; j <= 16; j++) { const z = lerp(za, zb, j / 16); pts.push([cx + ellX(z, IN), z]); }
      for (let j = 16; j >= 0; j--) { const z = lerp(za, zb, j / 16); pts.push([cx - ellX(z, IN), z]); }
      return pts;
    };
    plate(cap(cz - rz * IN, zTop));
    plate(cap(zBot, cz + rz * IN));
    for (let k = 0; k < 5; k++) plate(vert(k), true);
    // granulado
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  });

  // pele: escamas irregulares claras sobre um tom mais escuro
  const skinTex = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#3c4a5e'; g.fillRect(0, 0, W, H);
    const r = 21, dx = r * 1.7, dy = r * 1.5;
    for (let j = -1; j < H / dy + 1; j++) for (let i = -1; i < W / dx + 1; i++) {
      const x = i * dx + (j % 2 ? dx / 2 : 0) + rnd(-3, 3), y = j * dy + rnd(-3, 3);
      const rr = r * rnd(0.7, 0.95), l = rnd(0, 1);
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + rnd(-0.2, 0.2); const p = rr * rnd(0.85, 1.1); k ? g.lineTo(x + Math.cos(a) * p, y + Math.sin(a) * p) : g.moveTo(x + Math.cos(a) * p, y + Math.sin(a) * p); }
      g.closePath();
      g.fillStyle = `rgb(${lerp(110, 168, l) | 0},${lerp(124, 182, l) | 0},${lerp(146, 204, l) | 0})`;
      g.fill();
    }
  }, 1.6);

  const dotTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const ringTex = canvasTex(64, 64, (g) => {
    g.strokeStyle = 'rgba(230,240,255,.9)'; g.lineWidth = 3;
    g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(23, 22, 5, 0, Math.PI * 2); g.fill();
  });

  /* ---------------- a tartaruga ---------------- */
  const A = 1, B = 1.32, HS = 0.5;
  const taper = (x, z) => (z < 0 ? x * (1 - 0.3 * Math.pow(-z / B, 1.8)) : x * (1 + 0.03 * (z / B)));

  const shellMat = withCaustics(new THREE.MeshStandardMaterial({ map: shellTex, bumpMap: shellTex, bumpScale: 0.018, roughness: 0.48, metalness: 0.08 }), 0.55);
  const bellyMat = withCaustics(new THREE.MeshStandardMaterial({ color: 0xb9c5d4, roughness: 0.75 }), 0.25);
  const skinMat = withCaustics(new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.62, metalness: 0.04, side: THREE.DoubleSide }), 0.45);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 0.08, metalness: 0.3 });

  const turtle = new THREE.Group();
  const body = new THREE.Group();
  turtle.add(body);
  turtle.rotation.order = 'YXZ';
  scene.add(turtle);

  // carapaça: meia esfera achatada, mais estreita atrás, com a textura projetada de cima
  const cg = new THREE.SphereGeometry(1, 80, 40, 0, Math.PI * 2, 0, Math.PI / 2);
  {
    const p = cg.attributes.position, uv = cg.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      uv.setXY(i, x * 0.5 + 0.5, z * 0.5 + 0.5);
      x *= A; z *= B; y = HS * Math.pow(Math.max(0, y), 0.85);
      p.setXYZ(i, taper(x, z), y, z);
    }
    cg.computeVertexNormals();
  }
  body.add(new THREE.Mesh(cg, shellMat));

  // plastrão (barriga), mais claro
  const pg = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  {
    const p = pg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * A * 0.95, z = p.getZ(i) * B * 0.97;
      p.setXYZ(i, taper(x, z), p.getY(i) * 0.2, z);
    }
    pg.computeVertexNormals();
  }
  body.add(new THREE.Mesh(pg, bellyMat));

  // pescoço, cabeça e olhos
  const neck = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), skinMat);
  neck.scale.set(0.27, 0.2, 0.36); neck.position.set(0, 0.0, B - 0.04);
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.04, B + 0.26);
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), skinMat);
  skull.scale.set(0.3, 0.24, 0.41);
  head.add(skull);
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 12), eyeMat);
    e.position.set(s * 0.205, 0.06, 0.26);
    head.add(e);
  });

  // nadadeiras: forma desenhada em 2D, extrudada e afinada na ponta
  function flipperGeo(pts, len, mirror) {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 3) sh.bezierCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i + 2][0], pts[i + 2][1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 28 });
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.035, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 - 0.72 * clamp(p.getX(i) / len, 0, 1);
      p.setY(i, p.getY(i) * k);
      if (mirror) p.setX(i, -p.getX(i));
    }
    g.computeVertexNormals();
    return g;
  }
  const FRONT = [[0, 0.2], [0.65, 0.34], [1.45, 0.05], [2.05, -0.6], [1.6, -0.42], [0.95, -0.24], [0.04, -0.2]];
  const REAR = [[0, 0.12], [0.3, 0.12], [0.55, -0.1], [0.6, -0.38], [0.36, -0.3], [0.16, -0.16], [0, -0.12]];
  const limbs = {};
  [['fl', FRONT, 2.05, -0.8, B * 0.48], ['fr', FRONT, 2.05, 0.8, B * 0.48], ['rl', REAR, 0.6, -0.52, -B * 0.72], ['rr', REAR, 0.6, 0.52, -B * 0.72]]
    .forEach(([name, shape, len, x, z]) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, -0.03, z);
      // a forma aponta para +x; a nadadeira esquerda (x < 0) é espelhada
      pivot.add(new THREE.Mesh(flipperGeo(shape, len, x < 0), skinMat));
      body.add(pivot);
      limbs[name] = pivot;
    });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 10), skinMat);
  tail.rotation.x = -Math.PI / 2; tail.position.set(0, -0.02, -B - 0.08);
  body.add(tail);

  /* ---------------- superfície vista de baixo ---------------- */
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 1, 1), new THREE.ShaderMaterial({
    uniforms: { uTime },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uTime; varying vec3 vW;\n' + CAUSTIC + `

      void main(){
        float d = length(vW.xz - cameraPosition.xz);
        float c = caustic(mod(vW.xz * 0.32, 6.2831) - 250.0, uTime * 0.28);
        float sunspot = exp(-length(vW.xz - vec2(-6.0, -14.0)) * 0.09);
        vec3 col = mix(vec3(0.24, 0.45, 0.76), vec3(0.86, 0.94, 1.0), c * 0.85 + 0.12) + sunspot * 0.55;
        float fade = smoothstep(70.0, 10.0, d);
        gl_FragColor = vec4(col, (0.3 + c * 0.55 + sunspot * 0.5) * fade);
      }`,
  }));
  surface.rotation.x = Math.PI / 2;
  surface.position.y = 6.2;
  scene.add(surface);

  /* ---------------- raios de sol ---------------- */
  const rayGeo = new THREE.PlaneGeometry(1, 1);
  const rays = [];
  for (let i = 0; i < (small ? 6 : 11); i++) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uSeed: { value: Math.random() }, uInt: { value: rnd(0.12, 0.3) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uSeed; uniform float uInt; varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
          float fall = pow(vUv.y, 1.7);
          float flick = 0.6 + 0.4 * sin(uTime * 0.5 + uSeed * 9.0) * sin(uTime * 0.21 + uSeed * 4.0);
          gl_FragColor = vec4(vec3(0.8, 0.89, 1.0), edge * edge * fall * flick * uInt);
        }`,
    });
    const r = new THREE.Mesh(rayGeo, m);
    const x = rnd(-11, 9), z = rnd(-9, 1);
    r.scale.set(rnd(0.5, 2.4), 20, 1);
    r.position.set(x, -2, z);
    r.userData = { base: -0.2 - x * 0.012, seed: Math.random() * 6.28 };
    r.rotation.z = r.userData.base;
    scene.add(r);
    rays.push(r);
  }

  /* ---------------- cardume girando ao fundo ---------------- */
  const fishGeo = new THREE.BufferGeometry();
  {
    const n = [0, 0, 0.2], t = [0, 0, -0.12], l = [-0.05, 0, 0], r = [0.05, 0, 0], u = [0, 0.045, 0], d = [0, -0.045, 0];
    const tri = [n, u, l, n, r, u, n, d, r, n, l, d, t, l, u, t, u, r, t, r, d, t, d, l,
      [0, 0, -0.1], [0, 0.07, -0.24], [0, -0.07, -0.24]];
    fishGeo.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
    fishGeo.computeVertexNormals();
  }
  const FN = small ? 70 : 160;
  const school = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: 0xd3deee, roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide }), FN);
  school.frustumCulled = false;
  scene.add(school);
  const fish = Array.from({ length: FN }, () => ({ r: rnd(0.7, 2.2), h: rnd(-0.9, 0.9), w: rnd(0.45, 0.75), ph: rnd(0, 6.28), wob: rnd(0, 6.28), s: rnd(0.8, 1.3) }));
  const dummy = new THREE.Object3D();
  const tmpV = new THREE.Vector3();

  /* ---------------- neve marinha, bolhas e partículas desfocadas ---------------- */
  const SN = small ? 600 : 1500;
  const snowPos = new Float32Array(SN * 3), snowSp = new Float32Array(SN);
  for (let i = 0; i < SN; i++) {
    snowPos[i * 3] = rnd(-16, 16); snowPos[i * 3 + 1] = rnd(-7, 8); snowPos[i * 3 + 2] = rnd(-16, 8);
    snowSp[i] = rnd(0.05, 0.22);
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xe2ecff, size: 0.075, map: dotTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(snow);

  const bokeh = [];
  for (let i = 0; i < (small ? 8 : 18); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xcfe0ff, transparent: true, opacity: rnd(0.05, 0.14), depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const k = rnd(0.25, 0.8);
    s.scale.set(k, k, 1);
    s.position.set(rnd(-5, 5), rnd(-2.5, 4), rnd(5, 8));
    s.userData = { v: rnd(0.04, 0.12), ph: rnd(0, 6.28) };
    scene.add(s);
    bokeh.push(s);
  }

  const bubbles = [];
  for (let i = 0; i < (small ? 14 : 30); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0xdde9ff, transparent: true, opacity: 0, depthWrite: false }));
    s.userData = { born: -rnd(0, 9), life: rnd(5, 9), x: 0, z: 0, k: rnd(0.04, 0.11), ph: rnd(0, 6.28) };
    scene.add(s);
    bubbles.push(s);
  }
  // as bolhas saem da tartaruga de vez em quando, em pequenas rajadas
  const turtleNose = new THREE.Vector3();

  /* ---------------- tamanho, rolagem e mouse ---------------- */
  let W = 0, H = 0, pathA = 4.4, turtleScale = 1;
  function resize() {
    W = section.clientWidth; H = section.clientHeight;
    small = innerWidth < 760;
    renderer.setSize(W, H, false);
    const aspect = W / H;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 54 : aspect < 1.2 ? 46 : 40;
    camera.updateProjectionMatrix();
    const halfW = 10.5 * Math.tan((camera.fov * Math.PI) / 360) * aspect;
    pathA = clamp(halfW * 0.72, 1.6, 5.2);
    turtleScale = aspect < 0.8 ? 0.68 : aspect < 1.2 ? 0.85 : 1;
    turtle.scale.setScalar(turtleScale);
  }
  resize();
  new ResizeObserver(resize).observe(section);

  let mx = 0, my = 0, tmx = 0, tmy = 0;
  ocean.addEventListener('pointermove', e => {
    tmx = (e.clientX / innerWidth - 0.5) * 2;
    tmy = (e.clientY / innerHeight - 0.5) * 2;
  });

  /* ---------------- animação ---------------- */
  const OMEGA = 0.075, TH0 = -0.9;
  const pathAt = (th) => new THREE.Vector3(
    pathA * Math.sin(th),
    0.55 + 0.5 * Math.sin(0.6 * th + 1),
    -2.1 + 2.5 * Math.sin(th) * Math.cos(th));
  let bank = 0, lastYaw = null, nextPuff = 4;

  function frame(t, dt) {
    uTime.value = t;
    mx += (tmx - mx) * 0.04; my += (tmy - my) * 0.04;

    // câmera: mergulha conforme a seção entra na tela
    const r = section.getBoundingClientRect();
    const dive = clamp(1 - r.top / (innerHeight * 0.9), 0, 1);
    const e = 1 - Math.pow(1 - dive, 3);
    camera.position.set(mx * 0.8, lerp(3.2, 0.9, e) - my * 0.35, 10.5);
    camera.lookAt(mx * 0.3, lerp(3.8, 1.05, e), 0);

    // tartaruga: percorre um oito largo, inclinando nas curvas
    const th = TH0 + t * OMEGA;
    const p = pathAt(th), q = pathAt(th + 0.01);
    const yaw = Math.atan2(q.x - p.x, q.z - p.z);
    if (lastYaw === null) lastYaw = yaw;
    let dy = yaw - lastYaw; if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
    lastYaw = yaw;
    bank += (clamp(-dy / Math.max(dt, 0.001) * 2.4, -0.55, 0.55) - bank) * 0.03;
    const phi = t * 1.55; // remada (cerca de 4 s)
    turtle.position.copy(p);
    turtle.rotation.y = yaw;
    turtle.rotation.z = bank;
    turtle.rotation.x = -Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z));
    body.position.y = 0.07 * Math.sin(phi - 0.9);
    body.rotation.x = 0.04 * Math.sin(phi - 0.4);
    head.rotation.y = 0.12 * Math.sin(t * 0.37);
    head.rotation.x = 0.06 * Math.sin(phi);

    // nadadeiras da frente: batem como asas (sobe/desce, vai/volta e gira a lâmina)
    const up = 0.12 + 0.6 * Math.sin(phi), sweep = -0.1 + 0.42 * Math.cos(phi), feather = 0.38 * Math.sin(phi + 1.3);
    limbs.fr.rotation.set(feather, sweep, up);
    limbs.fl.rotation.set(feather, -sweep, -up);
    // de trás: leme, com um vai e vem curto
    const rs = 0.18 * Math.sin(phi + 1.6);
    limbs.rr.rotation.set(0, 0.55 + rs, 0.12 * Math.sin(phi));
    limbs.rl.rotation.set(0, -0.55 - rs, -0.12 * Math.sin(phi));

    // raios balançando
    rays.forEach(ray => { ray.rotation.z = ray.userData.base + Math.sin(t * 0.12 + ray.userData.seed) * 0.03; });

    // cardume: um redemoinho que passeia ao fundo
    const c = new THREE.Vector3(-5.5 + 2 * Math.sin(t * 0.05), 2.1 + 0.5 * Math.sin(t * 0.13), -11 + 1.6 * Math.cos(t * 0.07));
    for (let i = 0; i < FN; i++) {
      const f = fish[i];
      const a = f.ph + t * f.w;
      const rr = f.r * (1 + 0.08 * Math.sin(t * 0.6 + f.wob));
      dummy.position.set(c.x + Math.cos(a) * rr, c.y + f.h + 0.22 * Math.sin(t * 0.8 + f.wob), c.z + Math.sin(a) * rr * 0.62);
      tmpV.set(c.x + Math.cos(a + 0.05) * rr, dummy.position.y, c.z + Math.sin(a + 0.05) * rr * 0.62);
      dummy.lookAt(tmpV);
      dummy.rotateY(0.25 * Math.sin(t * 9 + f.wob)); // rabada
      dummy.scale.setScalar(f.s);
      dummy.updateMatrix();
      school.setMatrixAt(i, dummy.matrix);
    }
    school.instanceMatrix.needsUpdate = true;

    // neve marinha descendo devagar
    const sp = snowGeo.attributes.position.array;
    for (let i = 0; i < SN; i++) {
      sp[i * 3 + 1] -= snowSp[i] * dt;
      sp[i * 3] += Math.sin(t * 0.3 + i) * 0.0015;
      if (sp[i * 3 + 1] < -7) sp[i * 3 + 1] = 8;
    }
    snowGeo.attributes.position.needsUpdate = true;

    bokeh.forEach(b => { b.position.y += b.userData.v * dt; b.position.x += Math.sin(t * 0.2 + b.userData.ph) * 0.002; if (b.position.y > 4.5) b.position.y = -3; });

    // bolhas: rajadas curtas saindo da cabeça da tartaruga
    turtleNose.set(0, 0.15, B + 0.55).applyMatrix4(body.matrixWorld);
    if (t > nextPuff) {
      nextPuff = t + rnd(5, 9);
      let n = 0;
      bubbles.forEach(b => { if (n < 7 && t - b.userData.born > b.userData.life) { b.userData.born = t + n * 0.18; b.userData.x = turtleNose.x; b.userData.y = turtleNose.y; b.userData.z = turtleNose.z; n++; } });
    }
    bubbles.forEach(b => {
      const u = b.userData, k = (t - u.born) / u.life;
      if (k < 0 || k > 1 || u.y === undefined) { b.material.opacity = 0; return; }
      b.position.set(u.x + Math.sin(k * 9 + u.ph) * 0.12, u.y + k * 6.5, u.z);
      const s = u.k * (1 + k * 0.8);
      b.scale.set(s, s, 1);
      b.material.opacity = Math.min(1, k * 8) * (1 - k) * 0.8;
    });

    renderer.render(scene, camera);
  }

  /* ---------------- laço: só roda com a seção na tela ---------------- */
  let visible = false, running = false, last = 0, clock = 0;
  function loop(now) {
    if (!visible) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; clock += dt;
    frame(clock, dt);
    requestAnimationFrame(loop);
  }
  if (reduced) {
    frame(14, 0.016);
    ocean.classList.add('is-gl');
    addEventListener('scroll', () => frame(14, 0.016), { passive: true });
    return;
  }
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }, { rootMargin: '100px 0px' }).observe(section);
  frame(0, 0.016);
  requestAnimationFrame(() => ocean.classList.add('is-gl'));
})();
