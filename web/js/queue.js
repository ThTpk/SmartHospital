/* =====================================================================
 * SmartHospital — Queueing Theory Engine (ข้อ 6, 7)
 *
 * แต่ละหน่วยบริการถูกจำลองเป็นคิว M/M/c
 *   λ  = อัตราผู้ป่วยเข้าหน่วย (ราย/นาที)  = Σ_process λ_p × จำนวนครั้งที่ process ผ่านหน่วยนั้น
 *   μ  = 1 / service time                  ; c = จำนวน service slot
 *   ρ  = λ / (cμ)   (utilization)          ; ถ้า ρ ≥ 1 คิวยาวขึ้นเรื่อยๆ (ไม่เสถียร)
 *   P_wait = Erlang-C(c, a=λ/μ)
 *   Lq = P_wait · ρ / (1-ρ)   ; Wq = Lq / λ   ; W = Wq + 1/μ   (Little's law: L = λW)
 *   P(Nq ≥ n) = P_wait · ρ^n            → ความยาวคิวที่ 95th percentile
 *   P(Wq > t) = P_wait · e^{-(cμ-λ)t}    → เวลารอที่ 95th percentile
 * service time ไม่ใช่ exponential → ใช้ M/G/c (Allen–Cunneen):  Wq ≈ Wq(M/M/c) × (1 + CV²) / 2
 *   exp: CV²=1 , erlang4: CV²=0.25 , det (คงที่): CV²=0
 * โครงข่าย (Jackson network): ถ้าหน่วยต้นทางรับไม่ไหว (ρ≥1) อัตราที่ไหลไปหน่วยถัดไปถูกจำกัดที่ cμ
 * ===================================================================== */
(function (root) {
  'use strict';

  /** Erlang-C: ความน่าจะเป็นที่ผู้มาใหม่ต้องรอคิว (a = λ/μ, ต้อง a < c) */
  function erlangC(c, a) {
    if (a <= 0) return 0;
    let B = 1; // Erlang-B recursion — เสถียรเชิงตัวเลขแม้ c ใหญ่
    for (let k = 1; k <= c; k++) B = (a * B) / (k + a * B);
    const rho = a / c;
    return B / (1 - rho * (1 - B));
  }

  const CV2 = { exp: 1, erlang4: 0.25, det: 0 };
  const DIST_TH = { exp: 'แปรปรวนสูง (Exponential)', erlang4: 'แปรปรวนปานกลาง (Erlang-4)', det: 'คงที่ (Deterministic)' };

  /** วิเคราะห์คิว M/G/c ; lambdaH = ราย/ชั่วโมง, svc = นาที, hours = ชั่วโมงเปิดให้บริการ, cv2 = CV² ของ service time */
  function mmc(lambdaH, svc, c, hours, cv2 = 1) {
    const k = (1 + cv2) / 2; // Allen–Cunneen factor
    const lam = lambdaH / 60;           // ราย/นาที
    const mu = 1 / svc;
    const capH = c * mu * 60;           // capacity ราย/ชั่วโมง
    const a = lam * svc;
    const rho = c > 0 ? a / c : Infinity;
    const r = { lambdaH, svc, c, rho, capH, stable: rho < 1, hours };
    if (lam <= 0) return Object.assign(r, { Pw: 0, Lq: 0, Wq: 0, W: svc, L: 0, q95: 0, wq95: 0, stable: true, rho: 0 });
    if (rho >= 1) {
      // fluid approximation: คิวโตด้วยอัตรา (λ - cμ) ตลอดช่วงเปิดให้บริการ
      const growH = lambdaH - capH;
      const qEnd = growH * hours;                  // ความยาวคิว ณ สิ้นวัน
      const wEnd = capH > 0 ? (qEnd / capH) * 60 : Infinity; // นาทีที่คนสุดท้ายต้องรอ
      return Object.assign(r, { Pw: 1, Lq: qEnd / 2, Wq: wEnd / 2, W: wEnd / 2 + svc, L: qEnd / 2 + c, q95: Math.ceil(qEnd), wq95: wEnd, growH, qEnd, wEnd });
    }
    const Pw = erlangC(c, a);
    const Lq = k * (Pw * rho) / (1 - rho);
    const Wq = Lq / lam;
    const W = Wq + svc;
    const L = lam * W;
    const q95 = Pw <= 0.05 ? 0 : Math.ceil(k * Math.log(0.05 / Pw) / Math.log(rho));
    const wq95 = Pw <= 0.05 ? 0 : k * Math.log(Pw / 0.05) / (c * mu - lam);
    return Object.assign(r, { Pw, Lq, Wq, W, L, q95, wq95 });
  }

  /**
   * วิเคราะห์ทั้งโครงข่าย
   * cfg = { stations:{id:{svc,c,max}}, processes:{id:{lambda}}, load: ตัวคูณภาระ, hours, targetWq }
   */
  function analyze(H, cfg) {
    const load = cfg.load ?? 1;
    const hours = cfg.hours ?? 8;
    const st = {};
    H.STATIONS.forEach(s => { st[s.id] = { offered: 0, visits: [] }; });
    const procs = H.PROCESSES.map(p => ({ id: p.id, route: p.route, lam: (cfg.processes[p.id]?.lambda ?? p.lambda) * load }));

    // fixed-point: throttle downstream flow by upstream capacity
    let factor = {}; H.STATIONS.forEach(s => factor[s.id] = 1);
    for (let it = 0; it < 30; it++) {
      H.STATIONS.forEach(s => st[s.id].offered = 0);
      procs.forEach(p => {
        let rate = p.lam;
        p.route.forEach(id => { st[id].offered += rate; rate *= factor[id]; });
      });
      H.STATIONS.forEach(s => {
        const c = cfg.stations[s.id];
        const cap = c.c * 60 / c.svc;
        factor[s.id] = st[s.id].offered > cap ? cap / st[s.id].offered : 1;
      });
    }
    // offered demand without throttling (สิ่งที่จะเกิดถ้าต้นทางไม่ติดคอขวด)
    const raw = {}; H.STATIONS.forEach(s => raw[s.id] = 0);
    procs.forEach(p => p.route.forEach(id => raw[id] += p.lam));

    const result = {};
    H.STATIONS.forEach(s => {
      const c = cfg.stations[s.id];
      const m = mmc(st[s.id].offered, c.svc, c.c, hours, cv2Of(c));
      m.rawLambdaH = raw[s.id];
      m.throttled = raw[s.id] - st[s.id].offered > 0.05;
      m.status = status(m, cfg.targetWq ?? 15);
      result[s.id] = m;
    });

    // เวลาเฉลี่ยทั้งกระบวนการ
    const procResult = {};
    procs.forEach(p => {
      let total = 0, wait = 0, svc = 0;
      const steps = p.route.map(id => { const m = result[id]; total += m.W; wait += m.Wq; svc += m.svc; return { id, Wq: m.Wq, svc: m.svc, status: m.status }; });
      procResult[p.id] = { total, wait, svc, steps, lambdaH: p.lam };
    });

    // คอขวด = ρ สูงสุด
    let bottleneck = null;
    H.STATIONS.forEach(s => { const m = result[s.id]; if (m.lambdaH > 0 && (!bottleneck || m.rho > result[bottleneck].rho)) bottleneck = s.id; });
    return { stations: result, processes: procResult, bottleneck, load, hours };
  }

  function cv2Of(c) { return CV2[c.dist || 'exp'] ?? 1; }

  function status(m, targetWq) {
    if (m.lambdaH <= 0) return 'idle';
    if (!m.stable) return 'critical';
    if (m.rho >= 0.85 || m.Wq > targetWq) return 'warn';
    return 'ok';
  }

  /** หา slot ขั้นต่ำที่ทำให้ ρ ≤ rhoMax และ Wq ≤ target */
  function requiredServers(lambdaH, svc, c0, target, rhoMax, hours, cv2 = 1) {
    for (let c = Math.max(1, c0); c <= 200; c++) {
      const m = mmc(lambdaH, svc, c, hours, cv2);
      if (m.stable && m.rho <= rhoMax && m.Wq <= target) return { c, m };
    }
    return null;
  }

  /** หา service time สูงสุดที่ยังทำให้ผ่านเป้าหมายได้ด้วย c slot (binary search) */
  function requiredSvc(lambdaH, c, target, rhoMax, hours, svcNow, cv2 = 1) {
    let lo = 0.05, hi = svcNow;
    const ok = s => { const m = mmc(lambdaH, s, c, hours, cv2); return m.stable && m.rho <= rhoMax && m.Wq <= target; };
    if (ok(hi)) return { svc: hi, m: mmc(lambdaH, hi, c, hours, cv2) };
    if (!ok(lo)) return null;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    return { svc: lo, m: mmc(lambdaH, lo, c, hours, cv2) };
  }

  /**
   * สร้างคำแนะนำต่อหน่วยบริการ (ข้อ 7)
   * - ถ้าเพิ่ม slot ได้ภายใน max  → แนะนำจำนวน slot ใหม่ + ผลลัพธ์หลังปรับ
   * - ถ้าเกิน max                → แนะนำลด service time + ประเมินแถวคอยสูงสุดเมื่อแก้ไม่ได้
   */
  function suggest(H, cfg, analysis) {
    const target = cfg.targetWq ?? 15;
    const rhoMax = cfg.rhoMax ?? 0.85;
    const hours = cfg.hours ?? 8;
    const out = [];
    H.STATIONS.forEach(s => {
      const m = analysis.stations[s.id];
      if (m.status === 'ok' || m.status === 'idle') return;
      const c = cfg.stations[s.id];
      // ใช้ demand ที่แท้จริง (ไม่ถูกบีบจากคอขวดต้นทาง) เพราะเมื่อแก้ต้นทางแล้วผู้ป่วยจะไหลมาถึง
      const lam = Math.max(m.lambdaH, m.rawLambdaH);
      const cv2 = cv2Of(c);
      const req = requiredServers(lam, c.svc, c.c, target, rhoMax, hours, cv2);
      const item = { id: s.id, name: s.name, now: m, c: c.c, max: c.max, svc: c.svc, lambdaH: lam, ideas: H.IDEAS[s.id] || [] };
      const ifUnfixed = mmc(lam, c.svc, c.c, hours, cv2);        // แถวคอยถ้าไม่ทำอะไรเลย
      item.unfixed = ifUnfixed;
      if (req && req.c <= c.max) {
        item.kind = 'add';
        item.newC = req.c; item.after = req.m;
      } else {
        item.kind = 'limit';
        const atMax = mmc(lam, c.svc, c.max, hours, cv2);
        item.atMax = atMax;
        const sv = requiredSvc(lam, c.max, target, rhoMax, hours, c.svc, cv2);
        item.svcNeeded = sv ? sv.svc : null; item.svcAfter = sv ? sv.m : null;
        item.maxSustainH = c.max * 60 / c.svc * rhoMax;   // ราย/ชม. ที่รองรับได้เมื่อใช้ slot เต็มที่
        item.shiftH = Math.max(0, lam - item.maxSustainH);  // ต้องกระจาย/นัดหมายออกไป
      }
      out.push(item);
    });
    // เรียงตามความรุนแรง
    out.sort((a, b) => (b.now.rho || 0) - (a.now.rho || 0));
    return out;
  }

  const api = { erlangC, mmc, analyze, suggest, requiredServers, requiredSvc, CV2, DIST_TH };
  root.QUEUE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
