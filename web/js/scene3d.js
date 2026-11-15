/* =====================================================================
 * SmartHospital — ฉาก 3D ภายในโรงพยาบาล (three.js r147)
 *  ห้อง = พื้นสีตามสถานะคิว + ผนังเตี้ย + เคาน์เตอร์/เตียงตามจำนวน slot + เก้าอี้รอหน้าห้อง
 *  ผู้ป่วย = หุ่นสีตาม process เดินตามทางเดินจริง นั่งรอ/รับบริการตามสถานะใน DES
 * ===================================================================== */
(function (root) {
  'use strict';
  const T = root.THREE;

  const STATUS_COLOR = { ok: 0x7fb77e, warn: 0xf0b44c, critical: 0xe05a4f, idle: 0xc9ced8 };
  const WALL_H = 2.2;

  class Hospital3D {
    constructor(el, H, L) {
      this.el = el; this.H = H; this.L = L;
      this.stations = {}; this.patients = new Map();
      this.routeGroup = null; this.followId = null; this.labelTimer = 0;

      const r = this.renderer = new T.WebGLRenderer({ antialias: true });
      r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
      el.appendChild(r.domElement);

      const sc = this.scene = new T.Scene();
      sc.background = new T.Color(0xe9edf3);
      sc.fog = new T.Fog(0xe9edf3, 140, 260);

      this.camera = new T.PerspectiveCamera(42, 1, 0.5, 600);
      this.camera.position.set(6, 72, 74);
      this.controls = new T.OrbitControls(this.camera, r.domElement);
      this.controls.target.set(4, 0, 0);
      this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.47;
      this.controls.minDistance = 12; this.controls.maxDistance = 200;

      sc.add(new T.HemisphereLight(0xffffff, 0xb8c0cc, 0.75));
      const sun = new T.DirectionalLight(0xffffff, 0.65);
      sun.position.set(-30, 60, 40); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 50, bottom: -50, near: 1, far: 160 });
      sc.add(sun);

      this.geo = {
        body: new T.CylinderGeometry(0.32, 0.38, 1.1, 12),
        head: new T.SphereGeometry(0.27, 14, 10),
        chair: new T.BoxGeometry(0.7, 0.45, 0.7),
        desk: new T.BoxGeometry(1.4, 0.8, 0.7),
        bed: new T.BoxGeometry(1.0, 0.55, 2.0),
        ring: new T.RingGeometry(0.55, 0.75, 28)
      };
      this.mat = {
        floor: new T.MeshLambertMaterial({ color: 0xf7f8fa }),
        corridor: new T.MeshLambertMaterial({ color: 0xdde3ec }),
        wall: new T.MeshLambertMaterial({ color: 0xffffff }),
        chair: new T.MeshLambertMaterial({ color: 0x8a94a8 }),
        desk: new T.MeshLambertMaterial({ color: 0xc8b99a }),
        bed: new T.MeshLambertMaterial({ color: 0xe8eef6 }),
        staff: new T.MeshLambertMaterial({ color: 0x3f8f7a }),
        skin: new T.MeshLambertMaterial({ color: 0xf1c9a5 })
      };
      this.procMat = {};
      H.PROCESSES.forEach(p => { this.procMat[p.id] = new T.MeshLambertMaterial({ color: new T.Color(p.color) }); });

      this.buildFloor();
      H.STATIONS.forEach(s => this.buildStation(s));
      this.buildSigns();

      // คลิกห้องเพื่อเลือกหน่วยบริการ (แยกจากการลากหมุนกล้อง)
      this.onPick = null;
      const ray = new T.Raycaster(), v2 = new T.Vector2(); let down = null;
      r.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
      r.domElement.addEventListener('pointerup', e => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !this.onPick) return;
        const rc = r.domElement.getBoundingClientRect();
        v2.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
        ray.setFromCamera(v2, this.camera);
        const hit = ray.intersectObjects(Object.values(this.stations).map(S => S.g), true)[0];
        let o = hit && hit.object; while (o && !o.userData.sid) o = o.parent;
        if (o) this.onPick(o.userData.sid);
      });
      r.domElement.style.cursor = 'pointer';

      this.resize();
      root.addEventListener('resize', () => this.resize());
      if (root.ResizeObserver) new ResizeObserver(() => this.resize()).observe(el);
    }

    resize() {
      const w = this.el.clientWidth || 800, h = this.el.clientHeight || 600;
      this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }

    box(w, h, d, mat, x, y, z, shadow = true) {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; this.scene.add(m); return m;
    }

    buildFloor() {
      const F = this.L.FLOOR;
      const g = new T.Mesh(new T.PlaneGeometry(F.x1 - F.x0, F.z1 - F.z0), this.mat.floor);
      g.rotation.x = -Math.PI / 2; g.position.set((F.x0 + F.x1) / 2, 0, (F.z0 + F.z1) / 2); g.receiveShadow = true;
      this.scene.add(g);
      // ทางเดิน A, B, ทางเชื่อม, ล็อบบี้
      const strip = (x0, x1, z0, z1) => { const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), this.mat.corridor); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2); m.receiveShadow = true; this.scene.add(m); };
      strip(F.x0 + 2, F.x1, 6, 14); strip(F.x0 + 2, F.x1 - 4, -14, -6); strip(-4, 2, -6, 6); strip(-8, 5, 14, F.z1);
      // ผนังอาคารรอบนอก (เตี้ย)
      const wm = new T.MeshLambertMaterial({ color: 0xb9c2d0 });
      this.box(F.x1 - F.x0, 1.2, 0.4, wm, (F.x0 + F.x1) / 2, 0.6, F.z0);
      this.box(0.4, 1.2, F.z1 - F.z0, wm, F.x0, 0.6, (F.z0 + F.z1) / 2);
      this.box(0.4, 1.2, 6 - F.z0, wm, F.x1, 0.6, (F.z0 + 6) / 2);      // ผนังตะวันออก เว้นประตู ER (z 6–14)
      this.box(0.4, 1.2, F.z1 - 14, wm, F.x1, 0.6, (14 + F.z1) / 2);
      this.box(-8 - F.x0, 1.2, 0.4, wm, (F.x0 - 8) / 2, 0.6, F.z1);
      this.box(F.x1 - 5, 1.2, 0.4, wm, (5 + F.x1) / 2, 0.6, F.z1);
    }

    buildStation(s) {
      const rm = this.L.room(s);
      const g = new T.Group(); g.userData.sid = s.id; this.scene.add(g);
      const plateMat = new T.MeshLambertMaterial({ color: STATUS_COLOR.idle, transparent: true, opacity: 0.55 });
      const plate = new T.Mesh(new T.PlaneGeometry(rm.w - 0.3, rm.d - 0.3), plateMat);
      plate.rotation.x = -Math.PI / 2; plate.position.set(rm.cx, 0.02, rm.cz); plate.receiveShadow = true; g.add(plate);
      // ผนัง 4 ด้าน เว้นช่องประตูด้านทางเดิน
      const wallT = 0.25, doorW = Math.min(3, rm.w * 0.35);
      const add = (w, d, x, z) => { const m = new T.Mesh(new T.BoxGeometry(w, WALL_H, d), this.mat.wall); m.position.set(x, WALL_H / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); };
      const zDoor = rm.door.z, zBack = rm.lane > zDoor ? rm.z0 : rm.z1;
      add(rm.w, wallT, rm.cx, zBack);
      add(wallT, rm.d, rm.x0, rm.cz); add(wallT, rm.d, rm.x1, rm.cz);
      const side = (rm.w - doorW) / 2;
      add(side, wallT, rm.x0 + side / 2, zDoor); add(side, wallT, rm.x1 - side / 2, zDoor);
      // แถบสีหน่วยงานเหนือประตู
      const band = new T.Mesh(new T.BoxGeometry(rm.w, 0.25, wallT + 0.05), new T.MeshLambertMaterial({ color: new T.Color(s.color) }));
      band.position.set(rm.cx, WALL_H + 0.12, zDoor); g.add(band);
      // เก้าอี้รอคิว
      const n = this.L.seatCount(s);
      for (let i = 0; i < n; i++) {
        const p = this.L.seat(s, i);
        const c = new T.Mesh(this.geo.chair, this.mat.chair); c.position.set(p.x, 0.22, p.z); c.castShadow = true; g.add(c);
      }
      const label = this.makeLabel();
      label.position.set(rm.cx, WALL_H + 3.4, rm.cz); g.add(label);
      const stepTag = this.makeTag(); stepTag.position.set(rm.cx - 5.6, WALL_H + 3.6, rm.cz); stepTag.visible = false; g.add(stepTag);
      this.stations[s.id] = { s, rm, g, plate, label, stepTag, servers: new T.Group(), c: -1 };
      g.add(this.stations[s.id].servers);
      this.syncServerCount(s.id, s.c);
    }

    /** วาดเคาน์เตอร์/เตียง + เจ้าหน้าที่ตามจำนวน slot */
    syncServerCount(id, c) {
      const S = this.stations[id]; if (!S || S.c === c) return;
      S.c = c; S.servers.clear();
      const bedLike = ['ER', 'OR', 'PACU', 'WARD', 'PT', 'DEN', 'PRC'].includes(id);
      for (let i = 0; i < c; i++) {
        const p = this.L.server(S.s, i, c);
        const towardBack = S.rm.lane > S.rm.door.z ? -1 : 1;
        if (bedLike) {
          const b = new T.Mesh(this.geo.bed, this.mat.bed); b.position.set(p.x, 0.28, p.z); b.castShadow = true; S.servers.add(b);
          const staff = this.figure(this.mat.staff); staff.position.set(p.x + 0.9, 0, p.z); S.servers.add(staff);
        } else {
          const d = new T.Mesh(this.geo.desk, this.mat.desk); d.position.set(p.x, 0.4, p.z + towardBack * 0.8); d.castShadow = true; S.servers.add(d);
          const staff = this.figure(this.mat.staff); staff.position.set(p.x, 0, p.z + towardBack * 1.5); S.servers.add(staff);
        }
      }
    }

    figure(mat, scale = 1) {
      const g = new T.Group();
      const b = new T.Mesh(this.geo.body, mat); b.position.y = 0.55; b.castShadow = true; g.add(b);
      const h = new T.Mesh(this.geo.head, this.mat.skin); h.position.y = 1.38; h.castShadow = true; g.add(h);
      g.scale.setScalar(scale); return g;
    }

    canvasSprite(w, h, scale) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const tex = new T.CanvasTexture(cv); tex.anisotropy = 4;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      sp.scale.set(scale, scale * h / w, 1); sp.renderOrder = 10; sp.userData = { cv, tex };
      return sp;
    }
    makeLabel() { return this.canvasSprite(512, 176, 9); }
    makeTag() { return this.canvasSprite(128, 128, 3.2); }

    drawLabel(id, info) {
      const S = this.stations[id]; const { cv, tex } = S.label.userData; const x = cv.getContext('2d');
      x.clearRect(0, 0, cv.width, cv.height);
      const col = { ok: '#3f8f5a', warn: '#c98612', critical: '#c8372d', idle: '#7a8399' }[info.status] || '#7a8399';
      round(x, 6, 6, 500, 164, 22); x.fillStyle = 'rgba(255,255,255,0.94)'; x.fill();
      x.lineWidth = 6; x.strokeStyle = col; x.stroke();
      x.fillStyle = '#2d3142'; x.font = '600 50px "IBM Plex Sans Thai", sans-serif'; x.textAlign = 'center';
      x.fillText(S.s.short, 256, 66);
      x.font = '500 38px "IBM Plex Sans Thai", sans-serif'; x.fillStyle = col;
      x.fillText(`คิว ${info.queue} · ${info.busy}/${info.c} slot`, 256, 124);
      tex.needsUpdate = true;
    }

    drawTag(id, text) {
      const S = this.stations[id]; const { cv, tex } = S.stepTag.userData; const x = cv.getContext('2d');
      x.clearRect(0, 0, 128, 128);
      x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fillStyle = '#eb6c36'; x.fill();
      x.lineWidth = 6; x.strokeStyle = '#fff'; x.stroke();
      x.fillStyle = '#fff'; x.font = '700 ' + (text.length > 3 ? 34 : 52) + 'px "IBM Plex Sans Thai", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, 64, 68); tex.needsUpdate = true;
    }

    buildSigns() {
      const sign = (text, x, z, color) => {
        const sp = this.canvasSprite(512, 128, 10); const c = sp.userData.cv.getContext('2d');
        round(c, 4, 4, 504, 120, 20); c.fillStyle = color; c.fill();
        c.fillStyle = '#fff'; c.font = '600 56px "IBM Plex Sans Thai", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 68);
        sp.userData.tex.needsUpdate = true; sp.position.set(x, 4.5, z); this.scene.add(sp);
      };
      sign('ทางเข้าหลัก', -1, 30, '#2e5aa8');
      sign('ทางเข้าฉุกเฉิน', 46, 6, '#eb6c36');
    }

    /** แสดงเส้นทางของ process ที่เลือก (เส้นสีส้ม + หมายเลขลำดับบนห้อง) */
    showRoute(proc) {
      if (this.routeGroup) { this.scene.remove(this.routeGroup); this.routeGroup = null; }
      Object.values(this.stations).forEach(S => { S.stepTag.visible = false; S.g.children.forEach(o => { if (o.material && o.material.opacity !== undefined && o === S.plate) o.material.opacity = 0.55; }); });
      if (!proc) return;
      const g = this.routeGroup = new T.Group(); this.scene.add(g);
      let e = this.L.entryPoint(proc.entry); let pos = e.pos, lane = e.lane;
      const all = [];
      const tags = {};
      proc.route.forEach((sid, i) => {
        const s = this.H.STATIONS.find(x => x.id === sid);
        const tgt = this.L.seat(s, 0);
        const pts = this.L.pathTo(pos, lane, s, tgt);
        all.push(...pts);
        const rm = this.L.room(s); pos = rm.door; lane = rm.lane;
        (tags[sid] = tags[sid] || []).push(i + 1);
      });
      all.push(...this.L.pathExit(pos, lane, proc.exit));
      const v = all.map(p => new T.Vector3(p.x, 0.15, p.z));
      const curve = new T.CatmullRomCurve3(v, false, 'catmullrom', 0.02);
      const tube = new T.Mesh(new T.TubeGeometry(curve, Math.max(64, v.length * 12), 0.18, 6, false),
        new T.MeshBasicMaterial({ color: 0xeb6c36, transparent: true, opacity: 0.85 }));
      g.add(tube); this.routeTube = tube;
      Object.entries(tags).forEach(([sid, nums]) => { const S = this.stations[sid]; S.stepTag.visible = true; this.drawTag(sid, nums.join(',')); });
    }

    focusStation(id) {
      const S = this.stations[id]; if (!S) return;
      this.flyTo(new T.Vector3(S.rm.cx, 0, S.rm.cz), 34);
    }
    overview() { this.flyTo(new T.Vector3(4, 0, 0), 100, new T.Vector3(6, 72, 74)); }
    flyTo(target, dist, camPos) {
      const from = { t: this.controls.target.clone(), c: this.camera.position.clone() };
      const dir = camPos ? camPos.clone().sub(target) : this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(dist);
      const to = { t: target, c: target.clone().add(dir) };
      this.anim = { from, to, t0: performance.now(), dur: 700 };
    }
    follow(id) { this.followId = id; }

    /** อัปเดตทุกเฟรมจากสถานะ DES */
    update(sim, analysis, statsNow) {
      const seen = new Set();
      sim.patients.forEach(p => {
        seen.add(p.id);
        let m = this.patients.get(p.id);
        if (!m) {
          m = this.figure(this.procMat[p.pid], p.tracked ? 1.35 : 1);
          if (p.tracked) {
            const ring = new T.Mesh(this.geo.ring, new T.MeshBasicMaterial({ color: 0xeb6c36, side: T.DoubleSide }));
            ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; m.add(ring);
            const beacon = new T.Mesh(new T.ConeGeometry(0.35, 0.8, 4), new T.MeshBasicMaterial({ color: 0xeb6c36 }));
            beacon.rotation.x = Math.PI; beacon.position.y = 2.6; m.add(beacon); m.userData.beacon = beacon;
          }
          const pos0 = sim.positionOf(p); m.position.set(pos0.x, 0, pos0.z);
          this.scene.add(m); this.patients.set(p.id, m);
        }
        const q = sim.positionOf(p);
        if (q.moving) { m.position.set(q.x, Math.abs(Math.sin(sim.time * 25 + p.id)) * 0.12, q.z); m.rotation.y = q.dir; }
        else { m.position.x += (q.x - m.position.x) * 0.25; m.position.z += (q.z - m.position.z) * 0.25; m.position.y = 0; }
        m.scale.y = (q.seated && !q.moving ? 0.78 : 1) * (p.tracked ? 1.35 : 1);
        if (p.state === 'admitted') m.visible = Math.floor(performance.now() / 200) % 2 === 0;
        if (m.userData.beacon) m.userData.beacon.position.y = 2.6 + Math.sin(performance.now() / 200) * 0.2;
      });
      this.patients.forEach((m, id) => { if (!seen.has(id)) { this.scene.remove(m); this.patients.delete(id); } });

      // ป้ายและสีห้อง (ทุก ~400ms)
      const now = performance.now();
      if (now - this.labelTimer > 400) {
        this.labelTimer = now;
        this.H.STATIONS.forEach(s => {
          const st = statsNow[s.id]; const a = analysis.stations[s.id];
          // สีจากสถานะ: ใช้ทั้งผลทฤษฎีและคิวจริงขณะนั้น
          let status = a.status;
          if (st.queue > this.L.seatCount(s)) status = 'critical';
          this.stations[s.id].plate.material.color.setHex(STATUS_COLOR[status] || STATUS_COLOR.idle);
          this.drawLabel(s.id, { status, queue: st.queue, busy: st.busy, c: st.c });
          this.syncServerCount(s.id, st.c);
        });
      }

      // กล้อง
      if (this.anim) {
        const k = Math.min(1, (now - this.anim.t0) / this.anim.dur); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.controls.target.lerpVectors(this.anim.from.t, this.anim.to.t, e);
        this.camera.position.lerpVectors(this.anim.from.c, this.anim.to.c, e);
        if (k >= 1) this.anim = null;
      } else if (this.followId && this.patients.get(this.followId)) {
        const m = this.patients.get(this.followId);
        const d = m.position.clone().sub(this.controls.target);
        d.y = 0; this.controls.target.add(d.multiplyScalar(0.08)); this.camera.position.add(d);
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
  }

  function round(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  root.Hospital3D = Hospital3D;
})(window);
