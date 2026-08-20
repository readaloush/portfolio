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

  /* ============================================ surface and light

     Everything here is generated in the browser: no texture files to
     download, nothing to 404. Three things separate a scene that looks
     modelled from one that looks rendered, and none of them are the
     shapes:

       - an environment to reflect. Bare metal with nothing around it
         is just a grey blob; give it something to mirror and it reads
         as metal instantly.
       - a surface that is not perfectly uniform. Real brushed
         aluminium scatters light in streaks.
       - light that is graded, not clipped. sRGB output and a filmic
         curve are the difference between "washed out" and "shot".
  */

  /** Brushed metal: fine horizontal streaks, used for roughness and bump. */
  function brushedTexture(T) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#7a7a7a';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      const y = Math.random() * 256;
      const bright = Math.random() < 0.5;
      x.strokeStyle = bright
        ? `rgba(255,255,255,${Math.random() * 0.07})`
        : `rgba(0,0,0,${Math.random() * 0.07})`;
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(256, y + (Math.random() - 0.5) * 1.5);
      x.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }

  /** A soft round falloff, for glows and for the contact shadow. */
  function blobTexture(T, inner, outer) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }

  let GLOW_TEX = null;
  /** Additive halo. Cheaper and steadier than a full bloom pass, and it
      cannot be broken by a CDN that does not ship the post-processing
      files. */
  function glow(T, color, size) {
    if (!GLOW_TEX) GLOW_TEX = blobTexture(T, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0.25)');
    const sp = new T.Sprite(new T.SpriteMaterial({
      map: GLOW_TEX, color, transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, opacity: 0.85
    }));
    sp.scale.setScalar(size);
    return sp;
  }

  /** Three softboxes in an otherwise dark room, baked into a reflection
      probe. This is what the metal sees when it looks around. */
  function buildEnvironment(T, renderer, accent) {
    const pmrem = new T.PMREMGenerator(renderer);
    const room = new T.Scene();
    room.background = new T.Color(0x0A0A0C);

    const panel = (w, h, color, intensity, pos, rot) => {
      const m = new T.Mesh(
        new T.PlaneGeometry(w, h),
        new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(intensity) })
      );
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      room.add(m);
    };

    panel(14, 9, 0xFFFFFF, 3.0, [5, 7, 5], [-Math.PI / 3, 0.6, 0]);      // key
    panel(10, 10, 0x9FB6D8, 1.1, [-9, 3, -2], [0, Math.PI / 2, 0]);      // cool fill
    panel(9, 5, accent, 1.6, [-4, 2, -8], [0, 0, 0]);                    // accent kick
    panel(20, 20, 0x2A2C34, 1, [0, -3, 0], [-Math.PI / 2, 0, 0]);        // floor bounce

    const tex = pmrem.fromScene(room, 0.06).texture;
    pmrem.dispose();
    return tex;
  }

  /* ====================================================== materials */
  let M = null;
  function materials(T) {
    const css = getComputedStyle(document.documentElement);
    const dark = document.documentElement.dataset.theme !== 'light';
    const accent = new T.Color(css.getPropertyValue('--accent').trim() || '#E0553B');
    const brushed = brushedTexture(T);

    M = {
      // Painted composite, not bare metal: low metalness with a tight
      // roughness is what makes a moulded white panel read as moulded
      // white panel instead of as aluminium.
      white: new T.MeshStandardMaterial({
        color: 0xF0F1F4, metalness: 0.12, roughness: 0.24,
        roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.0025, envMapIntensity: 0.85
      }),
      navy: new T.MeshStandardMaterial({
        color: 0x2E4270, metalness: 0.25, roughness: 0.3, envMapIntensity: 1
      }),
      visor: new T.MeshStandardMaterial({
        color: 0x0B0D12, metalness: 0.6, roughness: 0.06, envMapIntensity: 2.2
      }),
      shell: new T.MeshStandardMaterial({
        color: dark ? 0x6A6156 : 0xA9A296, metalness: 0.92, roughness: 0.34,
        roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.006, envMapIntensity: 1.25
      }),
      dark: new T.MeshStandardMaterial({
        color: dark ? 0x1B1D22 : 0x24262C, metalness: 0.5, roughness: 0.42,
        roughnessMap: brushed, envMapIntensity: 0.8
      }),
      joint: new T.MeshStandardMaterial({
        color: 0x8E949E, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.5
      }),
      hot: new T.MeshStandardMaterial({
        color: accent, emissive: accent, emissiveIntensity: 2.4,
        metalness: 0.1, roughness: 0.35
      }),
      glass: new T.MeshStandardMaterial({
        color: 0xAEC6DA, metalness: 0.05, roughness: 0.08,
        transparent: true, opacity: 0.28, envMapIntensity: 2
      }),
      brushed,
      accent
    };
  }

  /* ========================================================= the body
     A hierarchy of groups, so the joints actually turn: rotating a hip
     carries the shin and the foot with it, which is what makes a walk
     cycle four lines of maths instead of forty. */

  const PARTS = [];
  let COLLECT = true;      // is the body being built the one that assembles?

  function box(T, w, h, d, mat, x, y, z, keep) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (keep !== false && COLLECT) PARTS.push(m);
    return m;
  }
  function tube(T, r, h, mat, x, y, z, keep) {
    const m = new T.Mesh(new T.CylinderGeometry(r, r * 0.92, h, 16), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (keep !== false && COLLECT) PARTS.push(m);
    return m;
  }
  function ball(T, r, mat, x, y, z, keep) {
    const m = new T.Mesh(new T.SphereGeometry(r, 20, 14), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (keep !== false && COLLECT) PARTS.push(m);
    return m;
  }

  /** Cylinder with a dome on each end: a limb segment, not a stick. */
  function capsule(T, r, len, mat, x, y, z) {
    const g = new T.Group();
    const cyl = new T.Mesh(new T.CylinderGeometry(r, r, len, 20), mat);
    cyl.castShadow = true;
    g.add(cyl);
    [len / 2, -len / 2].forEach((yy) => {
      const cap = new T.Mesh(new T.SphereGeometry(r, 20, 12), mat);
      cap.position.y = yy;
      cap.castShadow = true;
      g.add(cap);
    });
    g.position.set(x, y, z);
    if (COLLECT) PARTS.push(g);
    return g;
  }

  /** A squashed sphere — the shape most of this body is actually made of. */
  function shellForm(T, r, mat, sx, sy, sz, x, y, z) {
    const m = new T.Mesh(new T.SphereGeometry(r, 26, 18), mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (COLLECT) PARTS.push(m);
    return m;
  }

  /** A band wrapped round a form: visors, collars, crests. */
  function band(T, radius, thick, mat, arc, x, y, z) {
    const m = new T.Mesh(new T.TorusGeometry(radius, thick, 14, 28, arc), mat);
    m.castShadow = true;
    m.position.set(x, y, z);
    if (COLLECT) PARTS.push(m);
    return m;
  }

  /* ------------------------------------------------------------------
     The figure.

     Everything hangs off groups placed AT the joints, so a rotation
     carries the rest of the limb with it. Proportions are human — head
     about a seventh of the height, elbow at the waist — because that is
     what makes a machine read as a person rather than as furniture.
     ------------------------------------------------------------------ */
  function buildRobot(T) {
    const root = new T.Group();
    const rig = {};

    /* ---------------------------------------------------------- legs */
    const leg = (side) => {
      const hip = new T.Group();
      hip.position.set(0.135 * side, 0.95, 0);
      hip.add(shellForm(T, 0.088, M.navy, 1, 1, 1, 0, 0, 0));
      hip.add(capsule(T, 0.082, 0.3, M.white, 0, -0.24, 0));
      hip.add(shellForm(T, 0.085, M.navy, 1.05, 0.6, 1.05, 0, -0.09, 0));   // thigh cap

      const knee = new T.Group();
      knee.position.set(0, -0.45, 0);
      knee.add(shellForm(T, 0.072, M.joint, 1, 1, 1, 0, 0, 0));
      knee.add(shellForm(T, 0.08, M.navy, 1, 0.9, 0.55, 0, 0.01, 0.03));    // knee pad
      knee.add(capsule(T, 0.06, 0.28, M.white, 0, -0.22, 0));
      // the hazard flashes from the reference, in the site's red
      knee.add(shellForm(T, 0.02, M.hot, 0.6, 2.4, 0.5, 0.045 * side, -0.16, 0.052));

      const ankle = new T.Group();
      ankle.position.set(0, -0.4, 0);
      ankle.add(shellForm(T, 0.05, M.joint, 1, 1, 1, 0, 0, 0));
      // the shoe: a wedge with a rounded toe
      ankle.add(shellForm(T, 0.09, M.navy, 0.85, 0.42, 1.7, 0, -0.045, 0.05));
      ankle.add(shellForm(T, 0.07, M.navy, 0.85, 0.5, 0.9, 0, -0.04, 0.16));
      knee.add(ankle);
      hip.add(knee);
      root.add(hip);
      return { hip, knee, ankle };
    };
    rig.legL = leg(1);
    rig.legR = leg(-1);

    /* ------------------------------------------------- pelvis, torso */
    root.add(shellForm(T, 0.17, M.white, 1.15, 0.62, 0.86, 0, 1.0, 0));
    root.add(band(T, 0.15, 0.022, M.navy, Math.PI * 2, 0, 1.02, 0));
    root.add(capsule(T, 0.075, 0.06, M.joint, 0, 1.12, 0));

    const torso = new T.Group();
    torso.position.set(0, 1.16, 0);
    // chest: wide at the shoulders, narrow at the waist
    torso.add(shellForm(T, 0.235, M.white, 1.12, 1.22, 0.8, 0, 0.28, 0));
    torso.add(shellForm(T, 0.17, M.white, 1, 0.7, 0.8, 0, 0.06, 0));
    // the navy yoke over the shoulders
    torso.add(shellForm(T, 0.2, M.navy, 1.3, 0.42, 0.85, 0, 0.44, -0.02));
    // side vents
    [-1, 1].forEach((sx) => {
      for (let i = 0; i < 3; i++) {
        torso.add(shellForm(T, 0.02, M.dark, 0.35, 0.9, 2.2, 0.2 * sx, 0.24 - i * 0.05, 0.06));
      }
    });
    // the emblem: a rounded triangle in red, like the reference
    const emblem = band(T, 0.055, 0.011, M.hot, Math.PI * 2, 0, 0.34, 0.185);
    emblem.scale.set(1, 0.85, 1);
    torso.add(emblem);
    rig.emblem = emblem;
    const coreGlow = glow(T, M.accent, 0.4);
    coreGlow.position.set(0, 0.34, 0.24);
    torso.add(coreGlow);
    rig.coreGlow = coreGlow;

    root.add(torso);
    rig.torso = torso;

    /* ------------------------------------------------------ the arms */
    const arm = (side) => {
      const shoulder = new T.Group();
      shoulder.position.set(0.245 * side, 0.44, 0);
      // pauldron
      shoulder.add(shellForm(T, 0.105, M.navy, 1, 1, 1, 0, 0, 0));
      shoulder.add(shellForm(T, 0.075, M.white, 1, 1.1, 1, 0, -0.02, 0));
      shoulder.add(capsule(T, 0.055, 0.2, M.white, 0, -0.17, 0));

      const elbow = new T.Group();
      elbow.position.set(0, -0.3, 0);
      elbow.add(shellForm(T, 0.058, M.joint, 1, 1, 1, 0, 0, 0));
      elbow.add(shellForm(T, 0.062, M.dark, 0.55, 1, 1, 0.045 * side, 0, 0));
      elbow.add(capsule(T, 0.048, 0.18, M.white, 0, -0.15, 0));

      const wrist = new T.Group();
      wrist.position.set(0, -0.27, 0);
      wrist.add(shellForm(T, 0.04, M.joint, 1, 1, 1, 0, 0, 0));
      // palm and fingers, so a point actually looks like a point
      wrist.add(shellForm(T, 0.045, M.dark, 0.85, 1.05, 0.55, 0, -0.05, 0));
      const fingers = new T.Group();
      fingers.position.set(0, -0.095, 0);
      for (let i = -1; i <= 1; i++) {
        fingers.add(capsule(T, 0.013, 0.045, M.dark, i * 0.025, -0.025, 0.008));
      }
      wrist.add(fingers);
      wrist.add(capsule(T, 0.014, 0.04, M.dark, 0.042 * side, -0.055, 0.02));  // thumb
      elbow.add(wrist);
      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow, wrist, fingers };
    };
    rig.armL = arm(1);
    rig.armR = arm(-1);

    /* ------------------------------------------------ neck and head */
    torso.add(capsule(T, 0.045, 0.06, M.joint, 0, 0.55, 0));

    const head = new T.Group();
    head.position.set(0, 0.6, 0);
    // skull
    head.add(shellForm(T, 0.125, M.white, 1, 1.14, 1.08, 0, 0.1, 0));
    // jaw, tapered forward
    head.add(shellForm(T, 0.088, M.white, 1, 0.8, 1.15, 0, 0.045, 0.012));
    // navy crest over the crown
    const crest = band(T, 0.108, 0.026, M.navy, Math.PI * 1.15, 0, 0.135, 0);
    crest.rotation.set(0, Math.PI / 2, Math.PI * 0.42);
    head.add(crest);
    // the visor: one dark wraparound band, the single strongest cue
    // that this thing has a face
    const visor = band(T, 0.104, 0.032, M.visor, Math.PI * 1.05, 0, 0.115, 0.012);
    visor.rotation.set(0.06, 0, Math.PI * 0.98);
    visor.scale.set(1, 1, 0.72);
    head.add(visor);
    rig.visor = visor;
    // the eyes live inside the visor and shine through it
    rig.eyeGlow = [];
    [-0.052, 0.052].forEach((x) => {
      head.add(shellForm(T, 0.02, M.hot, 1, 0.7, 0.6, x, 0.115, 0.096));
      const gl = glow(T, M.accent, 0.17);
      gl.position.set(x, 0.115, 0.115);
      head.add(gl);
      rig.eyeGlow.push(gl);
    });
    // ear discs
    [-1, 1].forEach((sx) => {
      head.add(shellForm(T, 0.042, M.navy, 0.45, 1, 1, 0.115 * sx, 0.1, -0.005));
      head.add(shellForm(T, 0.022, M.joint, 0.6, 1, 1, 0.126 * sx, 0.1, -0.005));
    });
    // a small comm fin instead of a wire antenna — closer to the
    // reference, and it reads at small sizes
    const antenna = new T.Group();
    antenna.position.set(0, 0.19, -0.03);
    antenna.add(shellForm(T, 0.03, M.navy, 0.35, 1.1, 1.6, 0, 0.03, 0));
    const tipGlow = glow(T, M.accent, 0.14);
    tipGlow.position.set(0, 0.07, 0);
    antenna.add(tipGlow);
    head.add(antenna);
    rig.antenna = antenna;

    // the mouth vent, which lights up while it talks
    rig.mouth = [];
    for (let i = -2; i <= 2; i++) {
      const b = shellForm(T, 0.012, M.dark, 0.75, 1, 0.5, i * 0.022, 0.042, 0.088);
      head.add(b);
      rig.mouth.push(b);
    }

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
      document.querySelectorAll('.neuro-flashsheet').forEach((n) => n.remove());
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
    renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    // The three lines that do more for how this looks than any amount
    // of extra geometry. Without sRGB output every colour is written
    // to the screen in the wrong space and the whole image reads flat
    // and muddy; without a filmic curve the bright parts clip to a
    // flat patch instead of rolling off.
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
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
    let contentFrac = 0.62;                    // section width / window width
    const measureContent = () => {
      const sec = document.querySelector('main .section');
      contentFrac = sec ? sec.getBoundingClientRect().width / innerWidth : 0.82;
    };

    /* Where the edge of the picture actually is.

       This has to be recomputed every frame, not once on resize. Each
       station pulls the camera to its own distance — 5.2 for one, 6.4
       for another — and how much world fits across the screen depends
       entirely on that distance. Measuring it once at a nominal 6.2 and
       reusing the answer is why the figure was being cut in half by the
       right edge whenever a station brought the camera closer in. */
    const layout = () => {
      const halfW = Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z * camera.aspect;
      const contentHalf = contentFrac * halfW;
      const margin = Math.max(0.3, halfW - contentHalf);
      const WIDEST = 0.95;                     // half-width of the widest built scene
      sideScale = Math.max(0.42, Math.min(1, (margin - 0.12) / WIDEST));
      sideX = halfW - WIDEST * sideScale - 0.18;
    };

    const resize = () => {
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      measureContent();
      layout();
    };

    scene.environment = buildEnvironment(T, renderer, M.accent);
    scene.fog = new T.Fog(0x0E0D0C, 9, 26);

    scene.add(new T.HemisphereLight(0xF1EEE7, 0x100E0C, 0.55));
    const key = new T.DirectionalLight(0xFFF2E4, 1.5);
    key.position.set(3.4, 6.2, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const rim = new T.DirectionalLight(M.accent, 0.8);
    rim.position.set(-4, 2.4, -3);
    scene.add(rim);

    const glow = new T.PointLight(M.accent, 1.4, 3.2);
    glow.position.set(0, 1.43, 0.4);
    scene.add(glow);

    const floor = new T.Mesh(new T.PlaneGeometry(50, 50), new T.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    /* A shadow map alone leaves the feet looking like they hover: the
       darkest part of a real contact shadow is right where the object
       meets the ground, and no 2048px map is that sharp. This blob is
       painted under the feet to close that gap. */
    const contact = new T.Mesh(
      new T.PlaneGeometry(2.6, 2.6),
      new T.MeshBasicMaterial({
        map: blobTexture(T, 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.22)'),
        transparent: true, depthWrite: false, color: 0x000000
      })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.012;
    scene.add(contact);

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

    /* ================================================== THE DIVE

       Clicking a section in the menu does not jump the page. The camera
       flies into the part of the robot that section is about — the hand
       for what he can do, the shoulder for where he has worked, the
       visor for what he has built — the screen blows out at the moment
       of contact, and the page is already at the new section when it
       comes back. Every section enters through a different part of the
       body, so the move never feels like the same trick twice.

       Styles are set here rather than in the stylesheet: this sheet is
       the one piece that must exist the instant the effect fires, and
       inlining it means the effect can never arrive before its CSS. */
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'fixed', inset: '0', zIndex: '9600', opacity: '0',
      pointerEvents: 'none', transition: 'none',
      background: 'radial-gradient(circle at 50% 45%, ' +
        `#${M.accent.getHexString()} 0%, ` +
        `#${M.accent.clone().multiplyScalar(0.35).getHexString()} 45%, ` +
        'rgba(0,0,0,0) 100%)'
    });
    flash.className = 'neuro-flashsheet';
    document.body.appendChild(flash);

    let DIVE = {};
    const setDiveTargets = () => {
      DIVE = {
        '#about': rig.emblem,          // the badge on its chest: who it is
        '#skills': rig.armL.wrist,     // the hand: what it can do
        '#experience': rig.armR.shoulder, // the joint that has done the work
        '#projects': rig.visor,        // the eyes: what it has seen and built
        '#education': rig.antenna,     // the comm fin: what it has taken in
        '#contact': rig.armR.wrist     // the other hand, offered
      };
    };

    setDiveTargets();          // defined just above; the rig already exists

    let dive = null;
    const DIVE_MS = 1850;
    const diveFrom = new T.Vector3();
    const diveTo = new T.Vector3();

    function startDive(sel) {
      const obj = DIVE[sel];
      if (!obj || dive) return;
      dive = { t0: performance.now(), obj, sel, jumped: false, fov: camera.fov };
      diveFrom.copy(camera.position);
      blip(220, 0.5, 0.05, 'sine');
      blip(880, 0.18, 0.03, 'triangle');
    }

    // capture phase: beat the page's own smooth-scroll handler to it
    document.addEventListener('click', (e) => {
      if (phase !== 'bg' || dive) return;
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const sel = a.getAttribute('href');
      if (!DIVE[sel]) return;
      e.preventDefault();
      e.stopPropagation();
      startDive(sel);
    }, true);

    /* --------------------------------------------- reading the page */
    const SECTIONS = ['#about', '#skills', '#experience', '#projects', '#education', '#contact'];
    // how the camera feels about each station, in order
    // The camera's opinion of each station. Kept modest on the x axis:
    // swinging sideways moves everything across the frame, and the two
    // things that must stay in the margins are the first to fall out.
    const SHOTS = [
      { x: 0.05, y: 1.75, z: 6.4, lx: 0.15, ly: 1.4 },
      { x: -0.25, y: 2.05, z: 6.2, lx: 0.1, ly: 1.5 },
      { x: 0.3, y: 1.5, z: 6.0, lx: 0.0, ly: 1.25 },
      { x: -0.15, y: 2.3, z: 6.2, lx: 0.05, ly: 1.5 },
      { x: 0.25, y: 1.9, z: 5.9, lx: -0.05, ly: 1.4 },
      { x: 0.0, y: 1.7, z: 6.3, lx: 0.15, ly: 1.35 }
    ];

    let lastY = scrollY;
    let speed = 0;
    let gait = 0;
    let point = 0;
    let section = -1;
    let pointUntil = 0;

    /* The presenter. Arriving at a section it points at what it built,
       then turns a palm towards the writing, then nods — the three
       things a person does when showing you something. Weights rather
       than poses, so one can start before the last has finished. */
    const G = { point: 0, present: 0, nod: 0 };
    let script = [];
    const runScript = (now) => {
      const want = { point: 0, present: 0, nod: 0 };
      script = script.filter((step) => now < step.end);
      script.forEach((step) => {
        const p = clamp01((now - step.start) / (step.end - step.start));
        // ease in and back out again within the step
        want[step.name] = Math.sin(p * Math.PI);
      });
      Object.keys(G).forEach((k) => { G[k] = lerp(G[k], want[k], 0.09); });
    };
    const cueSection = (now) => {
      script = [
        { name: 'point', start: now + 150, end: now + 2100 },
        { name: 'present', start: now + 2000, end: now + 4200 },
        { name: 'nod', start: now + 4100, end: now + 5200 }
      ];
    };
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
          if (s !== -1) { pointUntil = now + 2100; cueSection(now); blip(660, 0.09, 0.03, 'sine'); }
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

      runScript(now);

      const wave = speaking && phase !== 'bg' ? Math.sin(now / 220) * 0.5 : 0;
      const greetRaise = phase === 'greet' || phase === 'build' ? 0.9 : 0;
      const rest = swing * 0.7;

      // right arm just swings, unless it is offering a handshake
      rig.armR.shoulder.rotation.x = -swing * 0.7;
      rig.armR.elbow.rotation.x = -0.3 - Math.abs(swing) * 0.3;

      /* Left arm: three gestures added on top of the walk, each with
         its own weight, so pointing can begin while presenting is
         still fading out. */
      const pointW = Math.max(G.point, greetRaise);
      let sx = lerp(rest, -1.95, pointW);          // shoulder pitch
      let sz = lerp(0, -0.42, pointW) + wave;      // shoulder roll
      let ex = lerp(-0.3 - Math.abs(swing) * 0.3, -0.18, pointW);

      // palm turned towards the writing: arm out sideways, elbow bent
      sx = lerp(sx, -0.5, G.present);
      sz = lerp(sz, -1.15, G.present);
      ex = lerp(ex, -0.85, G.present);

      rig.armL.shoulder.rotation.x = sx;
      rig.armL.shoulder.rotation.z = sz;
      rig.armL.elbow.rotation.x = ex;
      rig.armL.wrist.rotation.z = lerp(0, 1.15, G.present);
      rig.armL.wrist.rotation.x = lerp(0, -0.35, G.point);
      // fingers straighten to point, curl to present
      rig.armL.fingers.rotation.x = lerp(-0.25, 0.05, G.point) + G.present * 0.4;

      root.position.y = Math.abs(Math.sin(gait)) * 0.045 * speed;
      rig.torso.rotation.y = Math.sin(gait) * 0.09 * speed;
      rig.torso.scale.y = 1 + Math.sin(t * 0.7) * 0.006 * idle;

      const look = Math.max(G.point, G.present);
      const wantHeadY = lerp(mouse.x * 0.5, -0.9, look);
      const wantHeadX = lerp(mouse.y * 0.28, 0.08, look) + Math.sin(now / 150) * 0.16 * G.nod;
      rig.head.rotation.y = lerp(rig.head.rotation.y, wantHeadY, 0.07);
      rig.head.rotation.x = lerp(rig.head.rotation.x, wantHeadX, 0.12);
      rig.head.rotation.z = lerp(rig.head.rotation.z, G.present * 0.12, 0.06);

      const lit = speaking ? 0.5 + Math.random() * 0.5 : 0;
      rig.mouth.forEach((b, i) => {
        b.scale.y = 0.25 + (speaking ? Math.abs(Math.sin(now / 90 + i)) * lit : 0.05);
      });
      // the antenna lags behind the head, then springs back
      if (rig.antenna) {
        rig.antenna.rotation.z = lerp(rig.antenna.rotation.z, -rig.head.rotation.y * 0.55 - swing * 0.25, 0.08);
        rig.antenna.rotation.x = lerp(rig.antenna.rotation.x, Math.sin(t * 1.7) * 0.05 - speed * 0.2, 0.08);
      }

      // the haloes breathe with the emitters they sit on
      const hotPulse = 1 + Math.sin(t * 2) * 0.22 + (speaking ? 0.35 : 0);
      if (rig.coreGlow) rig.coreGlow.scale.setScalar(0.62 * hotPulse);
      if (rig.eyeGlow) rig.eyeGlow.forEach((gl) => gl.scale.setScalar(0.3 * (0.9 + hotPulse * 0.15)));

      // the contact shadow tracks the feet and tightens when they land
      contact.position.x = root.position.x;
      contact.scale.setScalar(root.scale.x * (1 - Math.abs(Math.sin(gait)) * 0.06 * speed));
      contact.material.opacity = 0.85 - Math.abs(Math.sin(gait)) * 0.18 * speed;

      M.hot.emissiveIntensity = 2.0 + Math.sin(t * 2) * 0.5 + (speaking ? 0.9 : 0);
      glow.intensity = 1.2 + Math.sin(t * 2) * 0.4;
      glow.position.set(root.position.x, 1.43, 0.4);

      root.position.x = lerp(root.position.x, lerp(0, sideX, bgP), 0.05);
      // the guide is deliberately smaller than the figure that
      // introduced itself: a presenter beside the work, not a statue
      root.scale.setScalar(lerp(root.scale.x, lerp(1, sideScale * 0.66, bgP), 0.05));
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

      if (dive) {
        const p = clamp01((now - dive.t0) / DIVE_MS);
        dive.obj.getWorldPosition(diveTo);
        if (p < 0.5) {
          // in: towards the part, narrowing, blowing out
          const k = easeInOut(p / 0.5);
          camera.position.lerpVectors(diveFrom, diveTo, k * 0.98);
          camera.fov = lerp(dive.fov, 14, k);
          camera.updateProjectionMatrix();
          camera.lookAt(diveTo);
          flash.style.opacity = String(Math.pow(k, 2.2));
        } else {
          // the page changes underneath, hidden by the blow-out
          if (!dive.jumped) {
            dive.jumped = true;
            const el = document.querySelector(dive.sel);
            if (el) el.scrollIntoView({ block: 'start' });
            lastY = scrollY;
          }
          const k = easeOut((p - 0.5) / 0.5);
          camera.fov = lerp(14, 38, k);
          camera.updateProjectionMatrix();
          const px = lerp(diveTo.x, cam.x + mouse.x * 0.3, k);
          const py = lerp(diveTo.y, cam.y - mouse.y * 0.16, k);
          const pz = lerp(diveTo.z, cam.z, k);
          camera.position.set(px, py, pz);
          camera.lookAt(lerp(diveTo.x, cam.lx, k), lerp(diveTo.y, cam.ly, k), 0);
          flash.style.opacity = String(1 - k);
        }
        if (p >= 1) {
          dive = null;
          flash.style.opacity = '0';
          camera.fov = 38;
          camera.updateProjectionMatrix();
        }
      } else {
        camera.position.set(cam.x + mouse.x * 0.3, cam.y - mouse.y * 0.16, cam.z);
        camera.lookAt(cam.lx, cam.ly, 0);
      }
      layout();                 // the frame is only known once the camera is placed

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
      // the figure keeps its own livery in both themes; only the room
      // around it changes
      floor.material.opacity = dark ? 0.34 : 0.22;
      contact.material.color.setHex(dark ? 0x000000 : 0x2A2620);
      scene.fog.color.setHex(dark ? 0x0E0D0C : 0xF1EEE7);
      renderer.toneMappingExposure = dark ? 1.15 : 1.0;
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  window.NEURO = API;
})();
