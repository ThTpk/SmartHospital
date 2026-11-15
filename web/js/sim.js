/* =====================================================================
 * SmartHospital — Discrete-Event Simulation (DES) ของการไหลของผู้ป่วย
 *  - ผู้ป่วยแต่ละ process เข้ามาแบบ Poisson (inter-arrival ~ Exponential(λ))
 *  - service time ~ Exponential(mean) (ตรงกับสมมติฐาน M/M/c) หรือ Erlang-4 (แปรปรวนน้อย)
 *  - เก็บสถิติ: เวลารอเฉลี่ย, คิวยาวสุด, คิวเฉลี่ยเชิงเวลา, utilization
 * ===================================================================== */
(function (root) {
  'use strict';
  const L = root.LAYOUT || (typeof require !== 'undefined' ? require('./layout.js') : null);

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(e) { const a = this.a; a.push(e); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].t <= a[i].t) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].t < a[m].t) m = l; if (r < a.length && a[r].t < a[m].t) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  }

  class Sim {
    /** H = HOSP data, cfg = shared config (อ่านค่าสด: stations[id].svc/c, processes[id].lambda, load, hours) */
    constructor(H, cfg, opts = {}) {
      this.H = H; this.cfg = cfg;
      this.stationDef = {}; H.STATIONS.forEach(s => this.stationDef[s.id] = s);
      this.procDef = {}; H.PROCESSES.forEach(p => this.procDef[p.id] = p);
      this.onEvent = opts.onEvent || null;
      this.reset(opts.seed ?? 42);
    }

    reset(seed = 42) {
      this.rand = mulberry32(seed);
      this.time = 0; this.seq = 0;
      this.events = new Heap();
      this.patients = new Map();
      this.done = []; this.nextId = 1;
      this.st = {};
      this.H.STATIONS.forEach(s => {
        this.st[s.id] = { id: s.id, servers: new Array(this.cfg.stations[s.id].c).fill(null), queue: [], retire: 0,
          lastT: 0, busyArea: 0, qArea: 0, capArea: 0, served: 0, waitSum: 0, waitMax: 0, maxQ: 0, arrivals: 0 };
      });
      this.background = true;
      this.scheduleAllArrivals();
    }

    exp(mean) { return -Math.log(1 - this.rand()) * mean; }
    svcSample(mean, dist) {
      if (dist === 'det') return mean;
      if (dist === 'erlang4') { let s = 0; for (let i = 0; i < 4; i++) s += this.exp(mean / 4); return s; }
      return this.exp(mean);
    }
    push(t, type, data) { this.events.push({ t, seq: this.seq++, type, ...data }); }

    scheduleAllArrivals() {
      this.arrivalToken = (this.arrivalToken || 0) + 1;
      if (!this.background) return;
      this.H.PROCESSES.forEach(p => this.scheduleArrival(p.id, this.time));
    }
    rateOf(pid) { return (this.cfg.processes[pid]?.lambda ?? 0) * (this.cfg.load ?? 1) / 60; } // ราย/นาที
    scheduleArrival(pid, from) {
      const r = this.rateOf(pid); if (r <= 0) return;
      this.push(from + this.exp(1 / r), 'arrive', { pid, token: this.arrivalToken });
    }
    setBackground(on) { this.background = on; this.scheduleAllArrivals(); }
    /** เรียกเมื่อผู้ใช้ปรับ λ/load → สุ่มเวลามาถึงใหม่ตามอัตราใหม่ */
    ratesChanged() { this.scheduleAllArrivals(); }
    arrivalsOpen() { return !this.cfg.closeAfter || this.time < (this.cfg.hours ?? 8) * 60; }

    /** ปรับจำนวน service slot ระหว่างจำลอง */
    setServers(id, n) {
      const st = this.st[id]; this.touch(st);
      const active = st.servers.length - st.retire;
      if (n > active) {
        let add = n - active;
        const cancel = Math.min(add, st.retire); st.retire -= cancel; add -= cancel;
        for (let i = 0; i < add; i++) st.servers.push(null);
        this.pull(st);
      } else if (n < active) {
        let rem = active - n;
        for (let i = st.servers.length - 1; i >= 0 && rem > 0; i--) if (st.servers[i] === null) { st.servers.splice(i, 1); rem--; }
        st.retire += rem;
      }
      this.reindex(st);
    }
    reindex(st) { st.servers.forEach((p, i) => { if (p) p.server = i; }); }

    touch(st) {
      const dt = this.time - st.lastT;
      if (dt > 0) {
        st.busyArea += dt * st.servers.filter(Boolean).length;
        st.capArea += dt * (st.servers.length - st.retire);
        st.qArea += dt * st.queue.length;
        st.lastT = this.time;
      }
    }

    /** สร้างผู้ป่วยใหม่ (tracked = ผู้ป่วยที่ผู้ใช้ติดตาม) */
    spawn(pid, tracked = false) {
      const proc = this.procDef[pid];
      const e = L.entryPoint(proc.entry);
      const p = { id: this.nextId++, pid, proc, idx: 0, tracked, state: 'walk', pos: { ...e.pos }, lane: e.lane,
        tIn: this.time, log: [], walk: null, station: null, server: -1, qArrive: 0, alpha: 1 };
      this.patients.set(p.id, p);
      this.walkToStation(p);
      return p;
    }

    walkToStation(p) {
      const sid = p.proc.route[p.idx];
      const s = this.stationDef[sid];
      const st = this.st[sid];
      const target = L.seat(s, st.queue.length);
      const pts = L.pathTo(p.pos, p.lane, s, target);
      const dur = L.length(pts) / L.WALK_SPEED;
      p.state = 'walk'; p.station = sid; p.walk = { pts, t0: this.time, t1: this.time + dur };
      this.push(this.time + dur, 'reach', { pid: p.id });
    }

    walkOut(p) {
      const pts = L.pathExit(p.pos, p.lane, p.proc.exit);
      const dur = L.length(pts) / L.WALK_SPEED;
      p.state = 'walk'; p.station = null; p.walk = { pts, t0: this.time, t1: this.time + dur };
      this.push(this.time + dur, 'exit', { pid: p.id });
    }

    pull(st) {
      for (let i = 0; i < st.servers.length && st.queue.length; i++) {
        if (st.servers[i] === null) this.startService(st.queue.shift(), st, i);
      }
    }

    startService(p, st, i) {
      this.touch(st);
      const wait = this.time - p.qArrive;
      st.served++; st.waitSum += wait; st.waitMax = Math.max(st.waitMax, wait);
      st.servers[i] = p; p.server = i; p.state = 'serve';
      const s = this.stationDef[st.id];
      const pos = L.server(s, i, st.servers.length); p.pos = { x: pos.x, z: pos.z };
      p.log.push({ sid: st.id, tArrive: p.qArrive, tStart: this.time, tEnd: null, wait });
      const sc = this.cfg.stations[st.id];
      const dur = this.svcSample(sc.svc, sc.dist || 'exp');
      this.push(this.time + dur, 'done', { pid: p.id, sid: st.id });
      if (this.onEvent && p.tracked) this.onEvent('start', p);
    }

    handle(e) {
      if (e.type === 'arrive') {
        if (e.token !== this.arrivalToken || !this.background) return;
        if (this.arrivalsOpen()) this.spawn(e.pid);
        this.scheduleArrival(e.pid, this.time);
        return;
      }
      const p = this.patients.get(e.pid); if (!p) return;
      if (e.type === 'reach') {
        const st = this.st[p.station]; this.touch(st);
        const s = this.stationDef[p.station];
        p.walk = null; p.lane = L.room(s).lane; p.qArrive = this.time; st.arrivals++;
        const free = st.servers.indexOf(null);
        if (free >= 0 && st.queue.length === 0) this.startService(p, st, free);
        else { p.state = 'wait'; st.queue.push(p); st.maxQ = Math.max(st.maxQ, st.queue.length); if (this.onEvent && p.tracked) this.onEvent('wait', p); }
      } else if (e.type === 'done') {
        const st = this.st[e.sid]; this.touch(st);
        const i = st.servers.indexOf(p);
        const rec = p.log[p.log.length - 1]; if (rec) rec.tEnd = this.time;
        if (st.retire > 0) { st.servers.splice(i, 1); st.retire--; this.reindex(st); }
        else st.servers[i] = null;
        const s = this.stationDef[e.sid];
        p.pos = { x: L.room(s).door.x, z: L.room(s).door.z }; p.lane = L.room(s).lane;
        p.idx++;
        if (p.idx < p.proc.route.length) this.walkToStation(p);
        else if (p.proc.exit === 'ward') { p.state = 'admitted'; p.pos = L.server(s, Math.max(0, i), Math.max(1, st.servers.length)); this.push(this.time + 3, 'exit', { pid: p.id }); }
        else this.walkOut(p);
        this.pull(st);
        if (this.onEvent && p.tracked) this.onEvent('done', p);
      } else if (e.type === 'exit') {
        p.state = 'gone'; p.tOut = this.time;
        this.patients.delete(p.id);
        this.done.push({ pid: p.pid, tIn: p.tIn, tOut: this.time, wait: p.log.reduce((a, r) => a + r.wait, 0) });
        if (this.done.length > 5000) this.done.shift();
        if (this.onEvent && p.tracked) this.onEvent('exit', p);
      }
    }

    /** เดินเวลาจำลองไปข้างหน้า dt นาที */
    step(dt) {
      const end = this.time + dt;
      while (this.events.size && this.events.peek().t <= end) { const e = this.events.pop(); this.time = e.t; this.handle(e); }
      this.time = end;
      Object.values(this.st).forEach(st => this.touch(st));
    }

    /** ตำแหน่งปัจจุบันของผู้ป่วยสำหรับการแสดงผล */
    positionOf(p) {
      if (p.state === 'walk' && p.walk) {
        const f = (this.time - p.walk.t0) / Math.max(1e-6, p.walk.t1 - p.walk.t0);
        const q = L.along(p.walk.pts, f); return { x: q.x, z: q.z, dir: q.dir, moving: true, seated: false };
      }
      if (p.state === 'wait') {
        const st = this.st[p.station]; const idx = st.queue.indexOf(p);
        const s = L.seat(this.stationDef[p.station], idx); return { x: s.x, z: s.z, dir: L.room(this.stationDef[p.station]).lane > L.room(this.stationDef[p.station]).door.z ? Math.PI : 0, moving: false, seated: s.seated };
      }
      if (p.state === 'serve') {
        const st = this.st[p.station]; const s = L.server(this.stationDef[p.station], p.server, st.servers.length);
        return { x: s.x, z: s.z, dir: 0, moving: false, seated: true };
      }
      return { x: p.pos.x, z: p.pos.z, dir: 0, moving: false, seated: true };
    }

    /** สถิติจาก DES ต่อหน่วยบริการ */
    stats() {
      const out = {};
      Object.values(this.st).forEach(st => {
        const T = Math.max(1e-6, this.time);
        out[st.id] = {
          queue: st.queue.length, busy: st.servers.filter(Boolean).length, c: st.servers.length - st.retire,
          util: st.capArea > 0 ? st.busyArea / st.capArea : 0,
          avgWq: st.served ? st.waitSum / st.served : 0, maxWq: st.waitMax, maxQ: st.maxQ,
          avgLq: st.qArea / T, served: st.served, arrivals: st.arrivals,
          oldestWait: st.queue.length ? this.time - st.queue[0].qArrive : 0
        };
      });
      return out;
    }
  }

  root.HospitalSim = Sim;
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
