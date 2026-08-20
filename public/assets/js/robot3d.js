/* ==================================================================
   THE ROBOT — a real one, in three dimensions, that builds the page
   ------------------------------------------------------------------
   The heavy half of neural mode.

   Act one: a network trains in 3D space. Its nodes were sampled from
   the surface of a robot that does not exist yet, so when training
   ends they fall home and the robot condenses out of the network
   rather than being switched on beside it.

   Act two: it greets you, then stands to the right of the page and
   works. As you scroll it builds the scene for whatever you are
   reading — pieces fly out of its chest and assemble in front of it:
   a conveyor with a sorting arm for the internships, a drone with
   four turning rotors for the TÜBİTAK project, a scanned brain for
   the degrees. It walks, it turns, it points at what it made.

   The camera has its own idea about each station, so the view drifts
   as you move down the page. A field of loose blocks floats through
   the whole thing and gets shoved out of the way by your cursor.

   Only fetched on a machine that can carry it. Phones load neural.js,
   which tells the same story in two dimensions for a fraction of the
   cost. Both expose the same window.NEURO, so whatever starts the
   scene never learns which one it got.

   Three.js r128 from cdnjs. If that fetch fails the fallback runs, so
   a blocked CDN costs an effect, never the site.
   ================================================================== */
(() => {
  'use strict';

  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const SEEN_KEY = 'rp_neuro_seen';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let wanted = false;

  function fallback() {
    if (document.getElementById('neuroFallback')) return;
    const s = document.createElement('script');
    s.id = 'neuroFallback';
    s.src = '/assets/js/neural.js';
    s.addEventListener('load', () => { if (wanted) window.NEURO?.start(); });
    document.head.appendChild(s);
  }

  /* ========================================================== maths */
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ====================================================== materials */
  let M = null;
  function materials(T) {
    const css = getComputedStyle(document.documentElement);
    const dark = document.documentElement.dataset.theme !== 'light';
    const accent = new T.Color(css.getPropertyValue('--accent').trim() || '#E0553B');

    M = {
      shell: new T.MeshStandardMaterial({ color: dark ? 0x4E463C : 0x8F8A81, metalness: 0.78, roughness: 0.42 }),
      dark: new T.MeshStandardMaterial({ color: dark ? 0x1A1815 : 0x2C2823, metalness: 0.6, roughness: 0.55 }),
      joint: new T.MeshStandardMaterial({ color: dark ? 0x59524A : 0x6E675E, metalness: 0.9, roughness: 0.3 }),
      hot: new T.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.4 }),
      glass: new T.MeshStandardMaterial({ color: 0x9FB6C9, metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.35 }),
      accent
    };
  }

  /* ========================================================= the body
     A hierarchy of groups, so the joints actually turn: rotating a hip
     carries the shin and the foot with it, which is what makes a walk
     cycle four lines of maths instead of forty. */

  const PARTS = [];

  function box(T, w, h, d, mat, x, y, z, keep) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (keep !== false) PARTS.push(m);
    return m;
  }
  function tube(T, r, h, mat, x, y, z, keep) {
    const m = new T.Mesh(new T.CylinderGeometry(r, r * 0.92, h, 16), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (keep !== false) PARTS.push(m);
    return m;
  }
  function ball(T, r, mat, x, y, z, keep) {
    const m = new T.Mesh(new T.SphereGeometry(r, 20, 14), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (keep !== false) PARTS.push(m);
    return m;
  }

  function buildRobot(T) {
    const root = new T.Group();
    const rig = {};

    const leg = (side) => {
      const hip = new T.Group();
      hip.position.set(0.17 * side, 1.0, 0);
      hip.add(ball(T, 0.11, M.joint, 0, 0, 0));
      hip.add(tube(T, 0.105, 0.42, M.shell, 0, -0.23, 0));

      const knee = new T.Group();
      knee.position.set(0, -0.46, 0);
      knee.add(ball(T, 0.095, M.joint, 0, 0, 0));
      knee.add(tube(T, 0.09, 0.4, M.shell, 0, -0.22, 0));

      const ankle = new T.Group();
      ankle.position.set(0, -0.44, 0);
      ankle.add(box(T, 0.19, 0.1, 0.34, M.dark, 0, -0.05, 0.06));
      knee.add(ankle);
      hip.add(knee);
      root.add(hip);
      return { hip, knee, ankle };
    };
    rig.legL = leg(1);
    rig.legR = leg(-1);

    root.add(box(T, 0.46, 0.18, 0.3, M.dark, 0, 1.06, 0));

    const torso = new T.Group();
    torso.position.set(0, 1.16, 0);
    torso.add(box(T, 0.62, 0.5, 0.34, M.shell, 0, 0.25, 0));
    torso.add(box(T, 0.5, 0.1, 0.36, M.dark, 0, 0.03, 0));
    const ring = new T.Mesh(new T.TorusGeometry(0.1, 0.026, 12, 26), M.joint);
    ring.position.set(0, 0.27, 0.18);
    ring.castShadow = true;
    PARTS.push(ring);
    torso.add(ring);
    torso.add(ball(T, 0.06, M.hot, 0, 0.27, 0.185));
    root.add(torso);
    rig.torso = torso;

    const arm = (side) => {
      const shoulder = new T.Group();
      shoulder.position.set(0.38 * side, 0.46, 0);
      shoulder.add(ball(T, 0.115, M.joint, 0, 0, 0));
      shoulder.add(tube(T, 0.085, 0.34, M.shell, 0, -0.2, 0));
      const elbow = new T.Group();
      elbow.position.set(0, -0.38, 0);
      elbow.add(ball(T, 0.08, M.joint, 0, 0, 0));
      elbow.add(tube(T, 0.072, 0.3, M.shell, 0, -0.18, 0));
      elbow.add(box(T, 0.13, 0.15, 0.1, M.dark, 0, -0.38, 0));
      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow };
    };
    rig.armL = arm(1);
    rig.armR = arm(-1);

    torso.add(tube(T, 0.07, 0.12, M.joint, 0, 0.56, 0));

    const head = new T.Group();
    head.position.set(0, 0.66, 0);
    head.add(box(T, 0.44, 0.36, 0.38, M.shell, 0, 0.18, 0));
    head.add(box(T, 0.34, 0.14, 0.02, M.dark, 0, 0.2, 0.195));
    head.add(ball(T, 0.042, M.hot, -0.085, 0.2, 0.205));
    head.add(ball(T, 0.042, M.hot, 0.085, 0.2, 0.205));
    rig.mouth = [];
    for (let i = -2; i <= 2; i++) {
      const b = box(T, 0.026, 0.05, 0.02, M.dark, i * 0.038, 0.075, 0.196);
      head.add(b);
      rig.mouth.push(b);
    }
    head.add(tube(T, 0.014, 0.16, M.joint, 0, 0.44, 0));
    head.add(ball(T, 0.035, M.hot, 0, 0.54, 0));
    torso.add(head);
    rig.head = head;

    return { root, rig };
  }

  /* ================================================= the training cloud */
  function cloud(T, root, count) {
    root.updateMatrixWorld(true);
    const meshes = [];
    root.traverse((o) => { if (o.isMesh) meshes.push(o); });

    const home = new Float32Array(count * 3);
    const start = new Float32Array(count * 3);
    const pos = new Float32Array(count * 3);
    const v = new T.Vector3();
    const LAYERS = 5;

    for (let i = 0; i < count; i++) {
      const m = meshes[Math.floor(Math.random() * meshes.length)];
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox;
      v.set(
        b.min.x + Math.random() * (b.max.x - b.min.x),
        b.min.y + Math.random() * (b.max.y - b.min.y),
        b.min.z + Math.random() * (b.max.z - b.min.z)
      );
      m.localToWorld(v);
      home[i * 3] = v.x; home[i * 3 + 1] = v.y; home[i * 3 + 2] = v.z;

      const l = i % LAYERS;
      start[i * 3] = -1.9 + (l * 3.8) / (LAYERS - 1);
      start[i * 3 + 1] = 0.35 + Math.random() * 2.1;
      start[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      pos[i * 3] = start[i * 3];
      pos[i * 3 + 1] = start[i * 3 + 1];
      pos[i * 3 + 2] = start[i * 3 + 2];
    }

    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const points = new T.Points(geo, new T.PointsMaterial({
      color: M.accent, size: 0.035, transparent: true, opacity: 0.9, sizeAttenuation: true
    }));

    // A point's layer is (index % LAYERS), so index + 1 is always in
    // the next layer and stepping by LAYERS from there picks a
    // different partner within it.
    const li = [];
    for (let i = 0; i < count; i++) {
      if (i % LAYERS === LAYERS - 1) continue;
      for (let k = 0; k < 2; k++) {
        const j = i + 1 + LAYERS * Math.floor(Math.random() * 8);
        if (j < count) li.push(i, j);
      }
    }
    const lgeo = new T.BufferGeometry();
    lgeo.setAttribute('position', new T.BufferAttribute(new Float32Array(li.length * 3), 3));
    const lines = new T.LineSegments(lgeo, new T.LineBasicMaterial({
      color: M.accent, transparent: true, opacity: 0.16
    }));

    return { points, lines, home, start, count, geo, lgeo, li };
  }

  /* ==================================================== the stations
     One built scene per section of the page. Each is a group of
     primitives whose resting positions are recorded up front; the
     assembly animation flies them out from the robot's chest to those
     positions, so it looks like the robot is making the thing rather
     than a thing appearing next to the robot. */

  function makeStation(T, key, build) {
    const g = new T.Group();
    const parts = [];
    const S = {
      key, g, parts, a: 0, spin: null,
      add(mesh) {
        mesh.castShadow = true;
        mesh.userData.home = mesh.position.clone();
        parts.push(mesh);
        return mesh;
      }
    };
    build(S, g, T);
    g.visible = false;
    return S;
  }

  function buildStations(T) {
    const list = [];

    /* ---- about: the network itself, a lit lattice ---- */
    list.push(makeStation(T, 'about', (S, g) => {
      const shell = new T.Mesh(new T.IcosahedronGeometry(0.62, 1),
        new T.MeshStandardMaterial({ color: M.joint.color, metalness: 0.85, roughness: 0.35, wireframe: true }));
      g.add(S.add(shell));
      const core = new T.Mesh(new T.IcosahedronGeometry(0.2, 1), M.hot);
      g.add(S.add(core));
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const n = new T.Mesh(new T.SphereGeometry(0.055, 12, 10), M.shell);
        n.position.set(Math.cos(a) * 0.78, Math.sin(a * 2) * 0.34, Math.sin(a) * 0.78);
        g.add(S.add(n));
      }
      S.spin = (t) => { shell.rotation.y = t * 0.3; shell.rotation.x = t * 0.16; g.rotation.y = t * 0.1; };
    }));

    /* ---- skills: a gyroscope, one ring per discipline ---- */
    list.push(makeStation(T, 'skills', (S, g) => {
      const rings = [];
      [[0.78, 0, 0], [0.62, Math.PI / 2, 0], [0.46, 0, Math.PI / 2]].forEach(([r, rx, rz], i) => {
        const m = new T.Mesh(new T.TorusGeometry(r, 0.022, 10, 44), i === 1 ? M.hot : M.joint);
        m.rotation.set(rx, 0, rz);
        g.add(S.add(m));
        rings.push(m);
      });
      const hub = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), M.shell);
      g.add(S.add(hub));
      S.spin = (t) => {
        rings[0].rotation.z = t * 0.5;
        rings[1].rotation.x = t * 0.8;
        rings[2].rotation.y = t * 0.65;
      };
    }));

    /* ---- experience: the conveyor and the sorting arm ----
       This is the internship, modelled: a belt carrying waste past a
       camera, an arm that reaches down, takes a piece and drops it in
       the right bin. */
    list.push(makeStation(T, 'experience', (S, g, TT) => {
      const belt = new TT.Mesh(new TT.BoxGeometry(1.9, 0.07, 0.5), M.dark);
      belt.position.set(0, -0.45, 0);
      g.add(S.add(belt));
      for (let i = 0; i < 6; i++) {
        const r = new TT.Mesh(new TT.CylinderGeometry(0.07, 0.07, 0.52, 12), M.joint);
        r.rotation.x = Math.PI / 2;
        r.position.set(-0.8 + i * 0.32, -0.55, 0);
        g.add(S.add(r));
      }
      // the camera that classifies
      const cam = new TT.Mesh(new TT.BoxGeometry(0.2, 0.16, 0.2), M.shell);
      cam.position.set(0, 0.34, 0);
      g.add(S.add(cam));
      const lens = new TT.Mesh(new TT.CylinderGeometry(0.05, 0.06, 0.06, 14), M.hot);
      lens.position.set(0, 0.24, 0);
      g.add(S.add(lens));
      // the arm
      const base = new TT.Mesh(new TT.CylinderGeometry(0.12, 0.15, 0.1, 14), M.joint);
      base.position.set(0.72, -0.36, 0.34);
      g.add(S.add(base));
      const seg1 = new TT.Group();
      seg1.position.set(0.72, -0.3, 0.34);
      const up = new TT.Mesh(new TT.BoxGeometry(0.08, 0.44, 0.08), M.shell);
      up.position.y = 0.22;
      up.castShadow = true;
      seg1.add(up);
      const seg2 = new TT.Group();
      seg2.position.y = 0.44;
      const fore = new TT.Mesh(new TT.BoxGeometry(0.07, 0.4, 0.07), M.shell);
      fore.position.y = 0.2;
      fore.castShadow = true;
      seg2.add(fore);
      const grip = new TT.Mesh(new TT.BoxGeometry(0.12, 0.08, 0.12), M.hot);
      grip.position.y = 0.42;
      seg2.add(grip);
      seg1.add(seg2);
      g.add(seg1);

      const bits = [];
      for (let i = 0; i < 5; i++) {
        const c = new TT.Mesh(new TT.BoxGeometry(0.12, 0.12, 0.12), i % 2 ? M.shell : M.joint);
        c.position.set(-0.9 + i * 0.42, -0.35, 0);
        c.castShadow = true;
        g.add(c);
        bits.push(c);
      }

      S.spin = (t) => {
        bits.forEach((c, i) => {
          c.position.x = -0.95 + (((t * 0.42 + i * 0.42) % 1.9));
          c.rotation.y = t * 0.6 + i;
        });
        const cyc = (Math.sin(t * 1.6) + 1) / 2;
        seg1.rotation.x = -0.4 + cyc * 0.55;
        seg2.rotation.x = 0.9 - cyc * 0.8;
        seg1.rotation.y = Math.sin(t * 0.8) * 0.5;
        lens.material.emissiveIntensity = 1 + Math.sin(t * 8) * 0.6;
      };
    }));

    /* ---- projects: the drone ---- */
    list.push(makeStation(T, 'projects', (S, g, TT) => {
      const body = new TT.Mesh(new TT.BoxGeometry(0.42, 0.14, 0.42), M.shell);
      g.add(S.add(body));
      const dome = new TT.Mesh(new TT.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
      dome.position.y = 0.06;
      g.add(S.add(dome));
      const eye = new TT.Mesh(new TT.SphereGeometry(0.05, 12, 10), M.hot);
      eye.position.set(0, -0.09, 0.16);
      g.add(S.add(eye));

      const props = [];
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const boom = new TT.Mesh(new TT.BoxGeometry(0.5, 0.045, 0.045), M.dark);
        boom.position.set(sx * 0.3, 0, sz * 0.3);
        boom.rotation.y = sx * sz > 0 ? Math.PI / 4 : -Math.PI / 4;
        g.add(S.add(boom));
        const pod = new TT.Mesh(new TT.CylinderGeometry(0.05, 0.06, 0.07, 12), M.joint);
        pod.position.set(sx * 0.52, 0.03, sz * 0.52);
        g.add(S.add(pod));
        const p = new TT.Group();
        p.position.set(sx * 0.52, 0.09, sz * 0.52);
        for (let b = 0; b < 2; b++) {
          const blade = new TT.Mesh(new TT.BoxGeometry(0.4, 0.008, 0.05), M.dark);
          blade.rotation.y = b * Math.PI / 2;
          blade.castShadow = true;
          p.add(blade);
        }
        g.add(p);
        props.push(p);
      });

      S.spin = (t, dt) => {
        props.forEach((p, i) => { p.rotation.y += dt * (34 + i); });
        g.position.y = Math.sin(t * 1.4) * 0.07;
        g.rotation.z = Math.sin(t * 0.9) * 0.07;
        g.rotation.x = Math.cos(t * 0.7) * 0.05;
        g.rotation.y = t * 0.25;
      };
    }));

    /* ---- education: the scanned brain ---- */
    list.push(makeStation(T, 'education', (S, g, TT) => {
      const skull = new TT.Mesh(new TT.SphereGeometry(0.5, 22, 16), new TT.MeshStandardMaterial({
        color: M.glass.color, transparent: true, opacity: 0.22, metalness: 0.1, roughness: 0.2
      }));
      g.add(S.add(skull));
      // slices through it, the way an MRI stack is read
      const slices = [];
      for (let i = 0; i < 7; i++) {
        const r = Math.sqrt(Math.max(0.01, 0.25 - Math.pow((i - 3) * 0.14, 2)));
        const s = new TT.Mesh(new TT.RingGeometry(r * 0.3, r, 26), new TT.MeshBasicMaterial({
          color: M.accent, transparent: true, opacity: 0.3, side: TT.DoubleSide
        }));
        s.rotation.x = Math.PI / 2;
        s.position.y = (i - 3) * 0.14;
        g.add(S.add(s));
        slices.push(s);
      }
      const beam = new TT.Mesh(new TT.CylinderGeometry(0.56, 0.56, 0.012, 30), new TT.MeshBasicMaterial({
        color: M.accent, transparent: true, opacity: 0.6
      }));
      g.add(S.add(beam));
      S.spin = (t) => {
        g.rotation.y = t * 0.35;
        beam.position.y = Math.sin(t * 1.1) * 0.46;
        slices.forEach((s, i) => {
          s.material.opacity = 0.12 + 0.4 * Math.max(0, 1 - Math.abs(beam.position.y - s.position.y) * 6);
        });
      };
    }));

    /* ---- contact: an open hand and a slow pulse ---- */
    list.push(makeStation(T, 'contact', (S, g, TT) => {
      const plate = new TT.Mesh(new TT.TorusGeometry(0.5, 0.03, 10, 40), M.joint);
      plate.rotation.x = Math.PI / 2;
      g.add(S.add(plate));
      const pulse = new TT.Mesh(new TT.TorusGeometry(0.5, 0.02, 8, 40), new TT.MeshBasicMaterial({
        color: M.accent, transparent: true, opacity: 0.7
      }));
      pulse.rotation.x = Math.PI / 2;
      g.add(S.add(pulse));
      const dot = new TT.Mesh(new TT.SphereGeometry(0.1, 16, 12), M.hot);
      g.add(S.add(dot));
      S.spin = (t) => {
        const k = (t * 0.5) % 1;
        pulse.scale.setScalar(0.6 + k * 1.5);
        pulse.material.opacity = 0.7 * (1 - k);
        plate.rotation.z = t * 0.4;
        dot.position.y = Math.sin(t * 1.6) * 0.06;
      };
    }));

    return list;
  }

  /* =============================================== the loose blocks
     A field of small blocks drifting through the scene. They have
     momentum and they are pushed away from wherever the cursor is
     pointing, so the space around the robot is something you can
     disturb rather than only look at. */
  function debris(T, n) {
    const g = new T.Group();
    const items = [];
    for (let i = 0; i < n; i++) {
      const s = 0.05 + Math.random() * 0.09;
      const m = new T.Mesh(new T.BoxGeometry(s, s, s), Math.random() < 0.18 ? M.hot : M.joint);
      const home = new T.Vector3(
        (Math.random() - 0.5) * 6.4,
        0.4 + Math.random() * 2.6,
        (Math.random() - 0.5) * 2.6
      );
      m.position.copy(home);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      g.add(m);
      items.push({
        m, home,
        v: new T.Vector3(),
        spin: new T.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0)
      });
    }
    return { g, items };
  }

  /* ======================================================== the HUD */
  function buildStage() {
    const el = document.createElement('div');
    el.className = 'neuro robo3d';
    el.id = 'neuroStage';
    el.innerHTML = `
      <div class="neuro-ui">
        <div class="neuro-hud" id="neuroHud">
          <span class="nh-row"><b>epoch</b><i id="nhEpoch">000/060</i></span>
          <span class="nh-row"><b>loss</b><i id="nhLoss">2.9814</i></span>
          <span class="nh-row"><b>acc</b><i id="nhAcc">0.0000</i></span>
          <span class="nh-bar"><u id="nhBar"></u></span>
        </div>
        <p class="neuro-say" id="neuroSay" role="status" aria-live="polite"></p>
        <button class="neuro-go" id="neuroGo" type="button" hidden>
          <span>scroll down</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
        </button>
        <button class="neuro-skip" id="neuroSkip" type="button">skip intro</button>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  /* ======================================================== sound */
  let actx = null;
  function blip(freq = 880, dur = 0.05, gain = 0.04, type = 'square') {
    if (window.SFX && window.SFX.enabled === false) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      const t = actx.currentTime;
      const o = actx.createOscillator();
      const g = actx.createGain();
      const f = actx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 2600;
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* decoration only */ }
  }

  /* ============================================================ run */
  const API = {
    started: false,
    raf: 0,
    start() {
      wanted = true;
      if (this.started) return;
      this.started = true;
      if (window.THREE) { boot(); return; }
      const s = document.createElement('script');
      s.src = THREE_URL;
      s.addEventListener('load', () => { if (window.THREE) boot(); else fallback(); });
      s.addEventListener('error', () => { API.started = false; fallback(); });
      document.head.appendChild(s);
    },
    stop() {
      wanted = false;
      cancelAnimationFrame(this.raf);
      document.getElementById('neuroStage')?.remove();
      document.body.classList.remove('neuro-intro', 'neuro-bg');
      this.started = false;
    }
  };

  function boot() {
    const T = window.THREE;
    materials(T);

    const short = (() => {
      try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
    })();
    const D = reduced
      ? { train: 200, build: 300, greet: 200, hold: 500 }
      : short
        ? { train: 1500, build: 1200, greet: 1600, hold: 2800 }
        : { train: 5000, build: 2400, greet: 3400, hold: 7000 };

    const stage = buildStage();
    document.body.classList.add('neuro-intro');

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.className = 'neuro-canvas';
    stage.insertBefore(renderer.domElement, stage.firstChild);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(38, 1, 0.1, 60);
    /* How far out of the way the figure and the built scenes have to
       stand. Hard-coded numbers put both of them on top of the text on
       every screen but the one they were guessed on, so the offset is
       measured: convert the real width of a section, in pixels, into
       world units at the working distance, and stand just outside it.
       On a narrow window there is no margin to stand in, so the whole
       scene shrinks rather than climbing over the writing. */
    let sideX = 3.2;
    let sideScale = 1;
    const layout = () => {
      const halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * 6.2;
      const halfW = halfH * camera.aspect;
      const sec = document.querySelector('main .section');
      const contentPx = sec ? sec.getBoundingClientRect().width : innerWidth * 0.82;
      const contentHalf = (contentPx / innerWidth) * halfW;

      // The free strip beside the text, in world units. Everything is
      // sized to fit that strip and then pushed hard against the outer
      // edge — trying to place it at a fixed distance from the middle
      // was what put it on top of the writing on narrower windows.
      const margin = Math.max(0.35, halfW - contentHalf);
      const WIDEST = 0.95;                     // half-width of the widest built scene
      sideScale = Math.max(0.42, Math.min(1, (margin - 0.12) / WIDEST));
      sideX = halfW - WIDEST * sideScale - 0.1;
    };

    const resize = () => {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      layout();
    };

    scene.add(new T.HemisphereLight(0xF1EEE7, 0x100E0C, 0.95));
    const key = new T.DirectionalLight(0xFFF2E4, 2.1);
    key.position.set(3.4, 6.2, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0016;
    scene.add(key);

    const rim = new T.DirectionalLight(M.accent, 1.1);
    rim.position.set(-4, 2.4, -3);
    scene.add(rim);

    const glow = new T.PointLight(M.accent, 1.4, 3.2);
    glow.position.set(0, 1.43, 0.4);
    scene.add(glow);

    const floor = new T.Mesh(new T.PlaneGeometry(50, 50), new T.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    PARTS.length = 0;
    const { root, rig } = buildRobot(T);
    scene.add(root);
    PARTS.forEach((m) => { m.userData.s = m.scale.x; m.scale.setScalar(0.001); });

    const net = cloud(T, root, 320);
    scene.add(net.points, net.lines);

    const stations = buildStations(T);
    const bench = new T.Group();          // where built things stand
    bench.position.set(-3.2, 1.15, 0);
    stations.forEach((s) => bench.add(s.g));
    scene.add(bench);

    const dust = debris(T, 26);
    scene.add(dust.g);

    resize();
    addEventListener('resize', resize);

    const mouse = { x: 0, y: 0 };
    const mouseWorld = new T.Vector3();
    addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / innerWidth) * 2 - 1;
      mouse.y = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });

    /* ----------------------------------------------------- read-out */
    const hud = stage.querySelector('#neuroHud');
    const say = stage.querySelector('#neuroSay');
    const go = stage.querySelector('#neuroGo');
    const nhEpoch = stage.querySelector('#nhEpoch');
    const nhLoss = stage.querySelector('#nhLoss');
    const nhAcc = stage.querySelector('#nhAcc');
    const nhBar = stage.querySelector('#nhBar');

    const LINE1 = 'HELLO. WELCOME TO MY WORLD.';
    const LINE2 = 'I am the network Read trained. Scroll, and I will build his work in front of you.';

    let phase = 'train';
    let typed = 0;
    let lastEpoch = -1;
    let lastTick = 0;
    let invited = false;
    let built = false;
    let bgAt = 0;
    const t0 = performance.now();

    const finish = () => {
      if (phase === 'bg') return;
      phase = 'bg';
      bgAt = performance.now();
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
      stage.classList.add('done');
      document.body.classList.remove('neuro-intro');
      document.body.classList.add('neuro-bg');
      blip(520, 0.12, 0.05, 'sine');
      document.dispatchEvent(new CustomEvent('neuro:done'));
    };

    stage.querySelector('#neuroSkip').addEventListener('click', finish);
    go.addEventListener('click', () => {
      finish();
      setTimeout(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }), 300);
    });
    addEventListener('wheel', finish, { passive: true });
    addEventListener('touchmove', finish, { passive: true });
    addEventListener('keydown', (e) => {
      if (['Escape', 'Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) finish();
    });

    /* --------------------------------------------- reading the page */
    const SECTIONS = ['#about', '#skills', '#experience', '#projects', '#education', '#contact'];
    // how the camera feels about each station, in order
    const SHOTS = [
      { x: 0.1, y: 1.75, z: 6.2, lx: 0.4, ly: 1.4 },
      { x: -0.7, y: 2.1, z: 5.8, lx: 0.2, ly: 1.5 },
      { x: 0.9, y: 1.5, z: 5.4, lx: 0.0, ly: 1.25 },
      { x: -0.4, y: 2.4, z: 5.6, lx: 0.1, ly: 1.5 },
      { x: 0.6, y: 1.9, z: 5.2, lx: -0.1, ly: 1.4 },
      { x: 0.0, y: 1.7, z: 6.0, lx: 0.3, ly: 1.35 }
    ];

    let lastY = scrollY;
    let speed = 0;
    let gait = 0;
    let point = 0;
    let section = -1;
    let pointUntil = 0;
    const cam = { x: 0, y: 1.45, z: 4.9, lx: 0, ly: 1.15 };

    const activeSection = () => {
      let best = -1;
      SECTIONS.forEach((sel, i) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.25) best = i;
      });
      return best;
    };

    /* ---------------------------------------------------- the frame */
    let last = 0;
    const tick = (now) => {
      API.raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const el = now - t0;
      const t = now / 1000;

      const trainP = clamp01(el / D.train);
      const buildP = clamp01((el - D.train) / D.build);

      if (phase === 'train') {
        const epoch = Math.floor(trainP * 60);
        if (epoch !== lastEpoch) {
          lastEpoch = epoch;
          nhEpoch.textContent = String(epoch).padStart(3, '0') + '/060';
          nhLoss.textContent = (2.98 * Math.exp(-3.1 * trainP) + 0.06 + Math.random() * 0.03).toFixed(4);
          nhAcc.textContent = (clamp01(1 - Math.exp(-3.4 * trainP)) * 0.9843).toFixed(4);
          nhBar.style.width = (trainP * 100).toFixed(1) + '%';
          if (epoch % 6 === 0) blip(300 + trainP * 700, 0.03, 0.024);
        }
        if (buildP > 0) {
          phase = 'build';
          hud.classList.add('out');
          nhEpoch.textContent = '060/060';
          nhLoss.textContent = '0.0614';
          nhAcc.textContent = '0.9843';
        }
      }

      /* ---- the cloud drifts, then falls onto the body ---- */
      if (net.points.visible) {
        const pos = net.geo.attributes.position.array;
        const e = easeInOut(buildP);
        for (let i = 0; i < net.count; i++) {
          const k = i * 3;
          const drift = phase === 'train' ? Math.sin(t + i) * 0.04 : 0;
          pos[k] = lerp(net.start[k], net.home[k], e);
          pos[k + 1] = lerp(net.start[k + 1] + drift, net.home[k + 1], e);
          pos[k + 2] = lerp(net.start[k + 2], net.home[k + 2], e);
        }
        net.geo.attributes.position.needsUpdate = true;
        net.points.material.opacity = 0.9 * (1 - easeOut(buildP));
        net.lines.material.opacity = 0.16 * (1 - easeOut(buildP));
        const lp = net.lgeo.attributes.position.array;
        for (let i = 0; i < net.li.length; i++) {
          const a = net.li[i] * 3;
          lp[i * 3] = pos[a]; lp[i * 3 + 1] = pos[a + 1]; lp[i * 3 + 2] = pos[a + 2];
        }
        net.lgeo.attributes.position.needsUpdate = true;
        if (net.points.material.opacity <= 0.01) { net.points.visible = false; net.lines.visible = false; }
      }

      /* ---- the body scales in, then the pose code takes over ---- */
      if (buildP > 0 && !built) {
        for (let i = 0; i < PARTS.length; i++) {
          const m = PARTS[i];
          const d = clamp01((buildP - (i / PARTS.length) * 0.55) / 0.45);
          m.scale.setScalar(Math.max(0.001, m.userData.s * easeOut(d)));
        }
        if (buildP >= 1) {
          PARTS.forEach((m) => m.scale.setScalar(m.userData.s));
          built = true;
        }
      }
      if (phase === 'build' && buildP >= 1) phase = 'greet';

      /* ---- it speaks ---- */
      if (phase !== 'train' && phase !== 'build') {
        const total = LINE1.length + LINE2.length + 1;
        if (typed < total) {
          const want = Math.floor((el - D.train - D.build) / (D.greet / total));
          if (want > typed) {
            typed = Math.min(want, total);
            const a = LINE1.slice(0, Math.min(typed, LINE1.length));
            const b = typed > LINE1.length ? LINE2.slice(0, typed - LINE1.length - 1) : '';
            say.classList.add('show');
            say.innerHTML = `<b>${a}</b>${b ? '<span>' + b + '</span>' : ''}`;
            if (now - lastTick > 30) { lastTick = now; blip(1400 + Math.random() * 500, 0.018, 0.016); }
          }
        }
        if (!invited && el > D.train + D.build + D.greet) {
          invited = true;
          go.hidden = false;
          requestAnimationFrame(() => go.classList.add('show'));
        }
        if (invited && phase !== 'bg' && el > D.train + D.build + D.greet + D.hold) finish();
      }

      const speaking = typed > 0 && typed < LINE1.length + LINE2.length;
      const bgP = phase === 'bg' ? easeOut(clamp01((now - bgAt) / 1400)) : 0;

      /* ---- gait comes from how fast the page is really moving ---- */
      const dy = scrollY - lastY;
      lastY = scrollY;
      speed = lerp(speed, Math.min(1, Math.abs(dy) / 26), 0.12);
      gait += speed * dt * 9;

      /* ---- which station is being built ---- */
      if (phase === 'bg') {
        const s = activeSection();
        if (s !== section) {
          section = s;
          if (s !== -1) { pointUntil = now + 2100; blip(660, 0.09, 0.03, 'sine'); }
        }
        point = lerp(point, now < pointUntil ? 1 : 0, 0.06);
      }

      stations.forEach((s, i) => {
        const want = i === section ? 1 : 0;
        s.a = lerp(s.a, want, want ? 0.045 : 0.09);
        const on = s.a > 0.004;
        if (s.g.visible !== on) s.g.visible = on;
        if (!on) return;

        const e = easeOut(clamp01(s.a));
        // pieces fly out of the chest and settle into place
        s.parts.forEach((m, k) => {
          const d = clamp01((e - (k / s.parts.length) * 0.4) / 0.6);
          const q = easeOut(d);
          m.scale.setScalar(Math.max(0.0001, q));
          const h = m.userData.home;
          // the chest, expressed in the bench's own coordinates. Both
          // the figure and the bench move with the window now, so this
          // cannot be a constant.
          const cxb = (root.position.x - bench.position.x) / (bench.scale.x || 1);
          const cyb = (1.43 - bench.position.y) / (bench.scale.x || 1);
          m.position.set(
            lerp(cxb, h.x, q),
            lerp(cyb, h.y, q),
            lerp(0.2, h.z, q)
          );
        });
        if (s.spin) s.spin(t, dt);
      });

      /* ---- the pose ---- */
      const idle = 1 - speed;
      const swing = Math.sin(gait) * 0.55 * speed;
      rig.legL.hip.rotation.x = swing + Math.sin(t) * 0.02 * idle;
      rig.legR.hip.rotation.x = -swing - Math.sin(t) * 0.02 * idle;
      rig.legL.knee.rotation.x = -Math.max(0, Math.sin(gait + 0.5)) * 0.85 * speed;
      rig.legR.knee.rotation.x = -Math.max(0, Math.sin(gait + Math.PI + 0.5)) * 0.85 * speed;
      rig.legL.ankle.rotation.x = -rig.legL.knee.rotation.x * 0.4;
      rig.legR.ankle.rotation.x = -rig.legR.knee.rotation.x * 0.4;

      const wave = speaking && phase !== 'bg' ? Math.sin(now / 220) * 0.5 : 0;
      const greetRaise = phase === 'greet' || phase === 'build' ? 0.9 : 0;
      rig.armR.shoulder.rotation.x = -swing * 0.7;
      rig.armR.elbow.rotation.x = -0.25 - Math.abs(swing) * 0.3;
      const rest = swing * 0.7;
      rig.armL.shoulder.rotation.x = lerp(rest, -2.1, Math.max(point, greetRaise));
      rig.armL.shoulder.rotation.z = lerp(0, -0.5, Math.max(point, greetRaise * 0.6)) + wave;
      rig.armL.elbow.rotation.x = lerp(-0.25 - Math.abs(swing) * 0.3, -0.35, point);

      root.position.y = Math.abs(Math.sin(gait)) * 0.045 * speed;
      rig.torso.rotation.y = Math.sin(gait) * 0.09 * speed;
      rig.torso.scale.y = 1 + Math.sin(t * 0.7) * 0.006 * idle;

      const wantHeadY = lerp(mouse.x * 0.5, -0.85, point);
      const wantHeadX = lerp(mouse.y * 0.28, 0.06, point);
      rig.head.rotation.y = lerp(rig.head.rotation.y, wantHeadY, 0.07);
      rig.head.rotation.x = lerp(rig.head.rotation.x, wantHeadX, 0.07);

      const lit = speaking ? 0.5 + Math.random() * 0.5 : 0;
      rig.mouth.forEach((b, i) => {
        b.scale.y = 0.25 + (speaking ? Math.abs(Math.sin(now / 90 + i)) * lit : 0.05);
      });
      M.hot.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.3 + (speaking ? 0.5 : 0);
      glow.intensity = 1.2 + Math.sin(t * 2) * 0.4;
      glow.position.set(root.position.x, 1.43, 0.4);

      root.position.x = lerp(root.position.x, lerp(0, sideX, bgP), 0.05);
      root.scale.setScalar(lerp(root.scale.x, lerp(1, sideScale * 0.92, bgP), 0.05));
      bench.position.x = lerp(bench.position.x, -sideX, 0.05);
      bench.scale.setScalar(lerp(bench.scale.x, sideScale * 0.9, 0.05));
      root.rotation.y = lerp(root.rotation.y, lerp(0, -0.45, bgP) + point * -0.55 + mouse.x * 0.12 * (1 - bgP), 0.06);

      /* ---- the camera has an opinion about each station ---- */
      const shot = section >= 0 && bgP > 0.2 ? SHOTS[section] : { x: 0, y: 1.45, z: 4.9, lx: 0, ly: 1.15 };
      const k2 = bgP > 0.2 ? 0.022 : 0.06;
      cam.x = lerp(cam.x, shot.x, k2);
      cam.y = lerp(cam.y, shot.y, k2);
      cam.z = lerp(cam.z, shot.z, k2);
      cam.lx = lerp(cam.lx, shot.lx, k2);
      cam.ly = lerp(cam.ly, shot.ly, k2);
      camera.position.set(cam.x + mouse.x * 0.3, cam.y - mouse.y * 0.16, cam.z);
      camera.lookAt(cam.lx, cam.ly, 0);

      /* ---- the blocks, and the cursor shoving them ---- */
      mouseWorld.set(mouse.x, -mouse.y, 0.5).unproject(camera);
      mouseWorld.sub(camera.position).normalize();
      const dist = (1.4 - camera.position.z) / mouseWorld.z;
      mouseWorld.multiplyScalar(dist).add(camera.position);

      dust.items.forEach((d) => {
        const p = d.m.position;
        const dx = p.x - mouseWorld.x;
        const dy2 = p.y - mouseWorld.y;
        const dz = p.z - mouseWorld.z;
        const r2 = dx * dx + dy2 * dy2 + dz * dz;
        if (r2 < 1.6) {
          const f = (1.6 - r2) * 0.9 * dt / Math.max(0.25, Math.sqrt(r2));
          d.v.x += dx * f; d.v.y += dy2 * f; d.v.z += dz * f;
        }
        // a soft spring home, so they drift back instead of escaping
        d.v.x += (d.home.x - p.x) * 0.5 * dt;
        d.v.y += (d.home.y - p.y) * 0.5 * dt;
        d.v.z += (d.home.z - p.z) * 0.5 * dt;
        d.v.multiplyScalar(0.965);
        p.addScaledVector(d.v, dt * 8);
        d.m.rotation.x += d.spin.x * dt + d.v.length() * dt;
        d.m.rotation.y += d.spin.y * dt;
      });
      dust.g.visible = bgP > 0.05 || phase !== 'train';

      renderer.render(scene, camera);
    };

    API.raf = requestAnimationFrame(tick);
    if (reduced) setTimeout(finish, 600);

    new MutationObserver(() => {
      const dark = document.documentElement.dataset.theme !== 'light';
      M.shell.color.setHex(dark ? 0x4E463C : 0x8F8A81);
      M.dark.color.setHex(dark ? 0x1A1815 : 0x2C2823);
      M.joint.color.setHex(dark ? 0x59524A : 0x6E675E);
      floor.material.opacity = dark ? 0.34 : 0.22;
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  window.NEURO = API;
})();
