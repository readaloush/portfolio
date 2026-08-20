/* ==================================================================
   THE ROBOT — a real one, in three dimensions, that builds the page
   ------------------------------------------------------------------
   The heavy half of neural mode.

   Act one: a network trains in 3D space. Its nodes are sampled from
   the surface of the model, so when training ends they fall home and
   the robot condenses out of the network rather than being switched
   on beside it.

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

   The figure itself is Quaternius's robot, released CC0 and shipped
   with three.js: a rigged, animated model with fourteen baked clips.
   It is not built out of primitives here, because primitives have a
   ceiling and a model that an animator actually animated does not.

   Three.js r128 from cdnjs, the loader and the model from jsDelivr. If
   any of those fetches fails the two-dimensional fallback runs, so a
   blocked CDN costs an effect, never the site.
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
        color: 0xDFE2E8, metalness: 0.14, roughness: 0.26,
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

  /* ==================================================================
     THE FIGURE — a real model, not something assembled out of spheres

     Everything before this was primitives glued together in code, and
     that approach has a ceiling: a sculpted, rigged, animated model is
     simply a different kind of object. This one is Quaternius's robot,
     released CC0 and shipped with three.js, carrying fourteen baked
     animations — idle, walking, running, jumping, waving, yes, no,
     thumbs up. It moves like something that was animated, because it
     was, by an animator.

     453 KB over the wire, fetched once and cached.
     ================================================================== */

  const MODEL_URL =
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/RobotExpressive/RobotExpressive.glb';
  const LOADER_URL =
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';

  /** Fetch a script and wait for it. */
  function grab(src) {
    return new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = src;
      el.addEventListener('load', res);
      el.addEventListener('error', rej);
      document.head.appendChild(el);
    });
  }

  /**
   * Stand the model on the floor at a known height, whatever units it
   * happens to have been authored in. Measuring beats assuming: a model
   * that arrives at a tenth of the expected scale is invisible, and one
   * that arrives ten times too big fills the screen with an elbow.
   */
  function fitToHeight(T, model, targetHeight) {
    const box = new T.Box3().setFromObject(model);
    const size = new T.Vector3();
    box.getSize(size);
    const k = targetHeight / (size.y || 1);
    model.scale.setScalar(k);

    // re-measure after scaling and drop it onto y = 0
    const box2 = new T.Box3().setFromObject(model);
    model.position.y -= box2.min.y;
    return k;
  }

  /**
   * The rig, described by where things are rather than by what the
   * bones are called. Bone names differ between exports and a typo in
   * one would be a silent failure; a bounding box is always there.
   */
  function readAnatomy(T, model) {
    const box = new T.Box3().setFromObject(model);
    const size = new T.Vector3();
    const mid = new T.Vector3();
    box.getSize(size);
    box.getCenter(mid);

    return {
      head: new T.Vector3(mid.x, box.max.y - size.y * 0.11, mid.z + size.z * 0.22),
      chest: new T.Vector3(mid.x, box.min.y + size.y * 0.62, mid.z + size.z * 0.3),
      handL: new T.Vector3(mid.x + size.x * 0.42, box.min.y + size.y * 0.45, mid.z + size.z * 0.1),
      handR: new T.Vector3(mid.x - size.x * 0.42, box.min.y + size.y * 0.45, mid.z + size.z * 0.1),
      shoulder: new T.Vector3(mid.x - size.x * 0.3, box.min.y + size.y * 0.75, mid.z),
      crown: new T.Vector3(mid.x, box.max.y - size.y * 0.02, mid.z),
      size, box
    };
  }

  /** Find the animation clip whose name matches, whatever the casing. */
  function findClip(clips, name) {
    const want = name.toLowerCase();
    return clips.find((c) => c.name.toLowerCase() === want)
        || clips.find((c) => c.name.toLowerCase().includes(want))
        || null;
  }

  /**
   * The animation desk. Locomotion clips cross-fade into one another and
   * loop; reactions play once over the top and hand control back.
   */
  function makeAnimator(T, model, clips) {
    const mixer = new T.AnimationMixer(model);
    const actions = {};
    clips.forEach((c) => {
      const a = mixer.clipAction(c);
      actions[c.name] = a;
    });

    const pick = (...names) => {
      for (const n of names) {
        const c = findClip(clips, n);
        if (c && actions[c.name]) return actions[c.name];
      }
      return null;
    };

    const move = {
      idle: pick('Idle'),
      walk: pick('Walking', 'Walk'),
      run: pick('Running', 'Run'),
      dance: pick('Dance')
    };
    const react = {
      wave: pick('Wave'),
      yes: pick('Yes'),
      no: pick('No'),
      thumbs: pick('ThumbsUp', 'Thumbs'),
      jump: pick('Jump'),
      punch: pick('Punch')
    };

    Object.values(react).forEach((a) => {
      if (!a) return;
      a.setLoop(T.LoopOnce, 1);
      a.clampWhenFinished = true;
    });

    let current = move.idle;
    if (current) current.play();

    let busy = null;
    mixer.addEventListener('finished', (e) => {
      if (busy && e.action === busy) {
        busy.fadeOut(0.28);
        busy = null;
        if (current) current.reset().setEffectiveWeight(1).fadeIn(0.28).play();
      }
    });

    return {
      mixer,
      have: (k) => !!react[k],
      /** Cross-fade the looping clip underneath. */
      locomote(name, dur = 0.35) {
        const next = move[name] || move.idle;
        if (!next || next === current) return;
        if (current) current.fadeOut(dur);
        next.reset().setEffectiveWeight(1).fadeIn(dur).play();
        current = next;
      },
      /** Play a one-shot reaction over the top. */
      react(name) {
        const a = react[name];
        if (!a || busy) return false;
        busy = a;
        if (current) current.fadeOut(0.2);
        a.reset().setEffectiveWeight(1).fadeIn(0.2).play();
        return true;
      },
      get reacting() { return !!busy; },
      update(dt) { mixer.update(dt); }
    };
  }

  /**
   * The face. The model carries three expression morphs; nudging them is
   * cheaper and reads better than any amount of head-turning.
   */
  function findFace(model) {
    let face = null;
    model.traverse((o) => {
      if (!face && o.morphTargetDictionary && o.morphTargetInfluences) face = o;
    });
    return face;
  }

  /* ==================================================== the voice

     A real voice, from the browser's own speech engine, dropped an
     octave and slowed a little so it reads as a machine rather than as
     a narrator. Nothing is downloaded and nothing is recorded; if the
     visitor has muted the site, or the engine has no voice installed,
     the line simply is not spoken and the captions carry it alone.
  */
  const VOICE = {
    ready: false,
    pick: null,

    load() {
      if (!('speechSynthesis' in window)) return;
      const choose = () => {
        const all = speechSynthesis.getVoices();
        if (!all.length) return;
        // prefer the flatter, more synthetic voices when they exist
        const score = (v) => {
          const n = (v.name + ' ' + v.voiceURI).toLowerCase();
          let s = 0;
          if (/en[-_]/i.test(v.lang)) s += 4;
          if (n.includes('male')) s += 2;
          if (/zarvox|trinoids|cellos|google uk english male|daniel|alex|fred/.test(n)) s += 5;
          if (n.includes('natural') || n.includes('neural')) s -= 2;   // too human
          return s;
        };
        this.pick = all.slice().sort((a, b) => score(b) - score(a))[0] || null;
        this.ready = true;
      };
      choose();
      speechSynthesis.addEventListener('voiceschanged', choose);
    },

    say(text, onDone) {
      if (window.SFX && window.SFX.enabled === false) { if (onDone) onDone(); return false; }
      if (!('speechSynthesis' in window)) { if (onDone) onDone(); return false; }
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (this.pick) u.voice = this.pick;
        u.pitch = 0.35;      // down an octave: the single most robotic knob
        u.rate = 0.92;
        u.volume = 0.9;
        u.addEventListener('end', () => { if (onDone) onDone(); });
        u.addEventListener('error', () => { if (onDone) onDone(); });
        speechSynthesis.speak(u);
        return true;
      } catch {
        if (onDone) onDone();
        return false;
      }
    },

    stop() {
      try { speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  };
  VOICE.load();

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
    stop() {
      wanted = false;
      cancelAnimationFrame(this.raf);
      VOICE.stop();
      document.getElementById('neuroStage')?.remove();
      document.querySelectorAll('.neuro-flashsheet').forEach((n) => n.remove());
      document.body.classList.remove('neuro-intro', 'neuro-bg');
      this.started = false;
    },

    async start() {
      wanted = true;
      if (this.started) return;
      this.started = true;
      try {
        if (!window.THREE) await grab(THREE_URL);
        if (!window.THREE) throw new Error('three missing');
        if (!window.THREE.GLTFLoader) await grab(LOADER_URL);
        const gltf = await new Promise((res, rej) => {
          new window.THREE.GLTFLoader().load(MODEL_URL, res, undefined, rej);
        });
        boot(gltf);
      } catch (err) {
        // A blocked CDN, a slow network, a browser without WebGL — any
        // of them costs the visitor an effect, never the site.
        API.started = false;
        fallback();
      }
    }
  };

  function boot(gltf) {
    const T = window.THREE;
    materials(T);

    const short = (() => {
      try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
    })();
    const D = reduced
      ? { train: 200, build: 300, greet: 400, hold: 300 }
      : short
        ? { train: 1500, build: 1100, greet: 3200, hold: 900 }
        : { train: 4600, build: 1800, greet: 6200, hold: 1400 };

    const stage = buildStage();
    document.body.classList.add('neuro-intro');

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.className = 'neuro-canvas';
    stage.insertBefore(renderer.domElement, stage.firstChild);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(38, 1, 0.1, 60);

    scene.environment = buildEnvironment(T, renderer, M.accent);
    scene.fog = new T.Fog(0x0E0D0C, 9, 26);
    scene.add(new T.HemisphereLight(0xF1EEE7, 0x100E0C, 0.6));

    const key = new T.DirectionalLight(0xFFF2E4, 1.7);
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

    const rim = new T.DirectionalLight(M.accent, 0.9);
    rim.position.set(-4, 2.4, -3);
    scene.add(rim);

    const glow2 = new T.PointLight(M.accent, 1.3, 3.4);
    scene.add(glow2);

    const floor = new T.Mesh(new T.PlaneGeometry(50, 50), new T.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

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

    /* ------------------------------------------------- the figure */
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    });
    fitToHeight(T, model, 1.85);
    const anat = readAnatomy(T, model);
    const face = findFace(model);

    const root = new T.Group();
    root.add(model);
    scene.add(root);

    const anim = makeAnimator(T, model, gltf.animations || []);

    // it condenses out of the training cloud, so start it invisible
    model.visible = false;

    const net = cloud(T, model, 340);
    scene.add(net.points, net.lines);

    const stations = buildStations(T);
    const bench = new T.Group();
    bench.position.set(-3.2, 1.15, 0);
    stations.forEach((s) => bench.add(s.g));
    scene.add(bench);

    const dust = debris(T, 26);
    scene.add(dust.g);

    /* ------------------------------------------------------ sizing */
    let sideX = 3.2;
    let sideScale = 1;
    let contentFrac = 0.62;
    const measureContent = () => {
      const sec = document.querySelector('main .section');
      contentFrac = sec ? sec.getBoundingClientRect().width / innerWidth : 0.82;
    };
    const layout = () => {
      const halfW = Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z * camera.aspect;
      const contentHalf = contentFrac * halfW;
      const margin = Math.max(0.3, halfW - contentHalf);
      const WIDEST = 0.95;
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
    resize();
    addEventListener('resize', resize);

    const mouse = { x: 0, y: 0 };
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
    const LINE2 = 'I am the network Read trained. Come down with me and I will show you his work.';
    const SPOKEN = 'Hello. Welcome to my world. I am the network Read trained. '
                 + 'Come down with me, and I will show you his work.';

    let phase = 'train';
    let typed = 0;
    let lastEpoch = -1;
    let lastTick = 0;
    let built = false;
    let bgAt = 0;
    let spoke = false;
    let speechDone = false;
    const t0 = performance.now();

    const finish = () => {
      if (phase === 'bg') return;
      phase = 'bg';
      bgAt = performance.now();
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
      VOICE.stop();
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
    // Scrolling is an answer, not an interruption: the moment the
    // visitor reaches for the wheel, the scene steps aside.
    addEventListener('wheel', finish, { passive: true });
    addEventListener('touchmove', finish, { passive: true });
    addEventListener('keydown', (e) => {
      if (['Escape', 'Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) finish();
    });

    /* ================================================== THE DIVE */
    const flash = document.createElement('div');
    flash.className = 'neuro-flashsheet';
    Object.assign(flash.style, {
      position: 'fixed', inset: '0', zIndex: '9600', opacity: '0',
      pointerEvents: 'none',
      background: 'radial-gradient(circle at 50% 45%, ' +
        `#${M.accent.getHexString()} 0%, ` +
        `#${M.accent.clone().multiplyScalar(0.35).getHexString()} 45%, ` +
        'rgba(0,0,0,0) 100%)'
    });
    document.body.appendChild(flash);

    // Each section enters through a different part of the body, so the
    // move never feels like the same trick twice. Positions are local to
    // the model and are lifted into world space at the moment of use.
    const DIVE_AT = {
      '#about': anat.chest,
      '#skills': anat.handL,
      '#experience': anat.shoulder,
      '#projects': anat.head,
      '#education': anat.crown,
      '#contact': anat.handR
    };

    let dive = null;
    const DIVE_MS = 1850;
    const diveFrom = new T.Vector3();
    const diveTo = new T.Vector3();

    function startDive(sel) {
      if (!DIVE_AT[sel] || dive) return;
      dive = { t0: performance.now(), local: DIVE_AT[sel], sel, jumped: false, fov: camera.fov };
      diveFrom.copy(camera.position);
      blip(220, 0.5, 0.05, 'sine');
      blip(880, 0.18, 0.03, 'triangle');
      anim.react('jump');
    }

    document.addEventListener('click', (e) => {
      if (phase !== 'bg' || dive) return;
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const sel = a.getAttribute('href');
      if (!DIVE_AT[sel]) return;
      e.preventDefault();
      e.stopPropagation();
      startDive(sel);
    }, true);

    /* --------------------------------------------- reading the page */
    const SECTIONS = ['#about', '#skills', '#experience', '#projects', '#education', '#contact'];
    const REACTION = ['wave', 'thumbs', 'punch', 'jump', 'yes', 'wave'];
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
    let section = -1;
    let hover = 0;                       // how far off the ground it is
    let hoverUntil = 0;
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
    const worldTo = new T.Vector3();
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

      /* ---- the cloud falls onto the body it was sampled from ---- */
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

      /* ---- the body appears as the cloud gives up its points ---- */
      if (buildP > 0 && !built) {
        model.visible = true;
        const q = easeOut(buildP);
        root.scale.setScalar(Math.max(0.001, q));
        if (buildP >= 1) {
          built = true;
          root.scale.setScalar(1);
          anim.react('wave');
        }
      }
      if (phase === 'build' && buildP >= 1) phase = 'greet';

      /* ---- it speaks, out loud, and does not wait to be asked ---- */
      if (phase === 'greet' || phase === 'invite') {
        if (!spoke) {
          spoke = true;
          VOICE.say(SPOKEN, () => { speechDone = true; });
          // no engine, no voices installed: fall back to the clock
          setTimeout(() => { speechDone = true; }, D.greet + 1200);
        }
        const total = LINE1.length + LINE2.length + 1;
        if (typed < total) {
          const want = Math.floor((el - D.train - D.build) / (D.greet / total));
          if (want > typed) {
            typed = Math.min(want, total);
            const a = LINE1.slice(0, Math.min(typed, LINE1.length));
            const b = typed > LINE1.length ? LINE2.slice(0, typed - LINE1.length - 1) : '';
            say.classList.add('show');
            say.innerHTML = `<b>${a}</b>${b ? '<span>' + b + '</span>' : ''}`;
            if (now - lastTick > 34) { lastTick = now; blip(1500 + Math.random() * 400, 0.014, 0.01); }
          }
        }
        if (phase === 'greet' && typed >= total) {
          phase = 'invite';
          go.hidden = false;
          requestAnimationFrame(() => go.classList.add('show'));
        }
        // Waiting for a click was the wrong instinct. When it has
        // finished its line, it moves aside on its own.
        if (phase === 'invite' && speechDone && el > D.train + D.build + D.greet + D.hold) finish();
      }

      const speaking = phase !== 'bg' && typed > 0 && typed < LINE1.length + LINE2.length;
      const bgP = phase === 'bg' ? easeOut(clamp01((now - bgAt) / 1400)) : 0;

      /* ---- what the page is doing drives what the body is doing ---- */
      const dy = scrollY - lastY;
      lastY = scrollY;
      speed = lerp(speed, Math.min(1, Math.abs(dy) / 26), 0.12);

      if (built) {
        if (phase !== 'bg') anim.locomote('idle');
        else if (speed > 0.55) anim.locomote('run');
        else if (speed > 0.06) anim.locomote('walk');
        else anim.locomote('idle');
        anim.update(dt);
      }

      /* ---- it reacts when you arrive somewhere new ---- */
      if (phase === 'bg') {
        const s = activeSection();
        if (s !== section) {
          section = s;
          if (s !== -1) {
            anim.react(REACTION[s] || 'yes');
            hoverUntil = now + 1500;          // and lifts off the floor
            blip(660, 0.09, 0.03, 'sine');
          }
        }
      }
      hover = lerp(hover, now < hoverUntil ? 1 : 0, 0.06);

      /* ---- the face ---- */
      if (face && face.morphTargetDictionary) {
        const dict = face.morphTargetDictionary;
        const inf = face.morphTargetInfluences;
        const set = (n, v) => { if (dict[n] !== undefined) inf[dict[n]] = lerp(inf[dict[n]] || 0, v, 0.12); };
        set('Surprised', speaking ? 0.45 : hover * 0.5);
        set('Angry', 0);
        set('Sad', 0);
      }

      /* ---- placing it, and letting it fly ---- */
      root.position.x = lerp(root.position.x, lerp(0, sideX, bgP), 0.05);
      root.position.y = lerp(root.position.y, hover * 0.55, 0.07);
      root.rotation.y = lerp(root.rotation.y, lerp(0, -0.3, bgP) + mouse.x * 0.18 * (1 - bgP), 0.06);
      root.rotation.z = lerp(root.rotation.z, hover * -0.12, 0.06);
      root.scale.setScalar(lerp(root.scale.x, built ? lerp(1, sideScale * 0.86, bgP) : root.scale.x, 0.05));

      glow2.position.set(root.position.x, root.position.y + 1.2, 0.4);
      glow2.intensity = 1.1 + Math.sin(t * 2) * 0.4;

      contact.position.x = root.position.x;
      contact.scale.setScalar(root.scale.x * (1 + hover * 0.5));
      contact.material.opacity = 0.85 * (1 - hover * 0.55);

      /* ---- the stations it builds ---- */
      stations.forEach((s, i) => {
        const want = i === section && phase === 'bg' ? 1 : 0;
        s.a = lerp(s.a, want, want ? 0.045 : 0.09);
        const on = s.a > 0.004;
        if (s.g.visible !== on) s.g.visible = on;
        if (!on) return;
        const e = easeOut(clamp01(s.a));
        s.parts.forEach((m, k) => {
          const d = clamp01((e - (k / s.parts.length) * 0.4) / 0.6);
          const q = easeOut(d);
          m.scale.setScalar(Math.max(0.0001, q));
          const h = m.userData.home;
          const cxb = (root.position.x - bench.position.x) / (bench.scale.x || 1);
          const cyb = (root.position.y + 1.2 - bench.position.y) / (bench.scale.x || 1);
          m.position.set(lerp(cxb, h.x, q), lerp(cyb, h.y, q), lerp(0.2, h.z, q));
        });
        if (s.spin) s.spin(t, dt);
      });
      bench.position.x = lerp(bench.position.x, -sideX, 0.05);
      bench.scale.setScalar(lerp(bench.scale.x, sideScale * 0.9, 0.05));

      /* ---- the camera ---- */
      const shot = section >= 0 && bgP > 0.2 ? SHOTS[section] : { x: 0, y: 1.45, z: 4.9, lx: 0, ly: 1.15 };
      const k2 = bgP > 0.2 ? 0.022 : 0.06;
      cam.x = lerp(cam.x, shot.x, k2);
      cam.y = lerp(cam.y, shot.y, k2);
      cam.z = lerp(cam.z, shot.z, k2);
      cam.lx = lerp(cam.lx, shot.lx, k2);
      cam.ly = lerp(cam.ly, shot.ly, k2);

      if (dive) {
        const p = clamp01((now - dive.t0) / DIVE_MS);
        // measured before the model was parented, so these are root-space
        worldTo.copy(dive.local);
        root.localToWorld(worldTo);
        diveTo.copy(worldTo);
        if (p < 0.5) {
          const k = easeInOut(p / 0.5);
          camera.position.lerpVectors(diveFrom, diveTo, k * 0.98);
          camera.fov = lerp(dive.fov, 14, k);
          camera.updateProjectionMatrix();
          camera.lookAt(diveTo);
          flash.style.opacity = String(Math.pow(k, 2.2));
        } else {
          if (!dive.jumped) {
            dive.jumped = true;
            const el2 = document.querySelector(dive.sel);
            if (el2) el2.scrollIntoView({ block: 'start' });
            lastY = scrollY;
          }
          const k = easeOut((p - 0.5) / 0.5);
          camera.fov = lerp(14, 38, k);
          camera.updateProjectionMatrix();
          camera.position.set(
            lerp(diveTo.x, cam.x + mouse.x * 0.3, k),
            lerp(diveTo.y, cam.y - mouse.y * 0.16, k),
            lerp(diveTo.z, cam.z, k)
          );
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
      layout();

      /* ---- the loose blocks, and the cursor shoving them ---- */
      const mw = new T.Vector3(mouse.x, -mouse.y, 0.5).unproject(camera);
      mw.sub(camera.position).normalize();
      const dist = (1.4 - camera.position.z) / mw.z;
      mw.multiplyScalar(dist).add(camera.position);

      dust.items.forEach((d) => {
        const pp = d.m.position;
        const dx = pp.x - mw.x;
        const dy2 = pp.y - mw.y;
        const dz = pp.z - mw.z;
        const r2 = dx * dx + dy2 * dy2 + dz * dz;
        if (r2 < 1.6) {
          const f = (1.6 - r2) * 0.9 * dt / Math.max(0.25, Math.sqrt(r2));
          d.v.x += dx * f; d.v.y += dy2 * f; d.v.z += dz * f;
        }
        d.v.x += (d.home.x - pp.x) * 0.5 * dt;
        d.v.y += (d.home.y - pp.y) * 0.5 * dt;
        d.v.z += (d.home.z - pp.z) * 0.5 * dt;
        d.v.multiplyScalar(0.965);
        pp.addScaledVector(d.v, dt * 8);
        d.m.rotation.x += d.spin.x * dt + d.v.length() * dt;
        d.m.rotation.y += d.spin.y * dt;
      });

      renderer.render(scene, camera);
    };

    API.raf = requestAnimationFrame(tick);
    if (reduced) setTimeout(finish, 600);

    new MutationObserver(() => {
      const dark = document.documentElement.dataset.theme !== 'light';
      floor.material.opacity = dark ? 0.34 : 0.22;
      contact.material.color.setHex(dark ? 0x000000 : 0x2A2620);
      scene.fog.color.setHex(dark ? 0x0E0D0C : 0xF1EEE7);
      renderer.toneMappingExposure = dark ? 1.0 : 0.9;
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  window.NEURO = API;
})();
