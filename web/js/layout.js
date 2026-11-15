/* =====================================================================
 * SmartHospital — แผนผังพื้นที่ภายในโรงพยาบาล (ใช้ร่วมกันระหว่าง DES และฉาก 3D)
 *
 *            ┌───────── แถวหลัง B (ทันตกรรม กายภาพ ผ่าตัด พักฟื้น Admit Ward) ─────────┐
 *   z=-10    ═══════════════ ทางเดิน B ═══════════════════════════════════════
 *            ┌───────── แถวกลาง M (ห้องตรวจ Lab X-ray EKG หัตถการ ER) ──────────────┐
 *   z=+10    ═══════════════ ทางเดิน A (ทางเดินหลัก) ═════════════════════  ◄ ทางเข้า ER (ตะวันออก)
 *            ┌───────── แถวหน้า F (ลงทะเบียน คัดกรอง การเงิน ห้องยา ER Triage) ─────┐
 *   z=+28                       ▲ ทางเข้าหลัก (x=-1)
 *   ทางเชื่อมระหว่างทางเดิน A–B อยู่ที่ x = -1
 * ===================================================================== */
(function (root) {
  'use strict';

  const ROWS = {
    F: { z: 18, d: 8,  door: 14,  lane: 10,  seatDir: -1 },  // ประตูหันไปทางเหนือ (z ลดลง)
    M: { z: 0,  d: 12, door: 6,   lane: 10,  seatDir: +1 },
    B: { z: -18, d: 8, door: -14, lane: -10, seatDir: +1 }
  };
  const CONNECTOR_X = -1;
  const ENTRY = { main: { x: -1, z: 30 }, er: { x: 48, z: 10 } };
  const FLOOR = { x0: -42, x1: 50, z0: -26, z1: 32 };
  const WALK_SPEED = 60; // เมตร / นาที (เวลาจำลอง)

  function room(s) {
    const r = ROWS[s.row];
    return { x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2, cx: s.x, cz: r.z, w: s.w, d: r.d, door: { x: s.x, z: r.door }, lane: r.lane, row: s.row };
  }

  /** ตำแหน่งเก้าอี้รอคิวลำดับ idx (0 = คิวแรก) หน้าห้อง */
  function seat(s, idx) {
    const r = ROWS[s.row];
    const perRow = Math.max(4, Math.floor(s.w - 1));
    const sign = r.lane > r.door ? 1 : -1; // จากประตูไปทางเดิน
    if (idx < perRow * 2) {
      const rowI = Math.floor(idx / perRow), col = idx % perRow;
      return { x: s.x - (perRow - 1) / 2 + col, z: r.door + sign * (1.4 + rowI * 1.0), seated: true };
    }
    // ล้นเก้าอี้ → ยืนรอเป็นแถวในทางเดิน
    const k = idx - perRow * 2;
    const per = Math.max(6, Math.floor(s.w * 1.4));
    const rowI = Math.floor(k / per), col = k % per;
    return { x: s.x - (per - 1) * 0.35 + col * 0.7, z: r.door + sign * (3.4 + rowI * 0.7), seated: false };
  }

  function seatCount(s) { return Math.max(4, Math.floor(s.w - 1)) * 2; }

  /** ตำแหน่งจุดให้บริการ (เคาน์เตอร์/เตียง/ห้องตรวจ) ลำดับ idx จาก c จุด */
  function server(s, idx, c) {
    const rm = room(s);
    const iw = rm.w - 1.6, id = rm.d - 2.4;
    const cols = Math.max(1, Math.min(c, Math.ceil(Math.sqrt(c * iw / id))));
    const rows = Math.ceil(c / cols);
    const col = idx % cols, row = Math.floor(idx / cols);
    const sign = rm.lane > rm.door.z ? -1 : 1; // จากประตูเข้าไปในห้อง
    const x = rm.x0 + 0.8 + iw * (col + 0.5) / cols;
    const zFromDoor = 1.6 + id * (row + 0.5) / rows;
    return { x, z: rm.door.z + sign * zFromDoor };
  }

  /** เส้นทางเดินจากจุด p (อยู่ที่ห้อง/ทางเข้า) ไปยังจุดเป้าหมาย (ห้อง s) */
  function pathTo(from, fromLane, s, target) {
    const rm = room(s);
    const pts = [{ x: from.x, z: from.z }];
    pts.push({ x: from.x, z: fromLane });
    if (fromLane !== rm.lane) {
      pts.push({ x: CONNECTOR_X, z: fromLane });
      pts.push({ x: CONNECTOR_X, z: rm.lane });
    }
    pts.push({ x: rm.door.x, z: rm.lane });
    pts.push({ x: rm.door.x, z: rm.door.z + (rm.lane > rm.door.z ? 0.6 : -0.6) });
    pts.push({ x: target.x, z: target.z });
    return simplify(pts);
  }

  function pathExit(from, fromLane, kind) {
    const e = ENTRY[kind === 'er' ? 'er' : 'main'];
    const pts = [{ x: from.x, z: from.z }, { x: from.x, z: fromLane }];
    if (kind === 'er') {
      if (fromLane !== 10) { pts.push({ x: CONNECTOR_X, z: fromLane }, { x: CONNECTOR_X, z: 10 }); }
      pts.push({ x: e.x, z: 10 });
    } else {
      pts.push({ x: CONNECTOR_X, z: fromLane });
      pts.push({ x: CONNECTOR_X, z: e.z });
    }
    return simplify(pts);
  }

  function entryPoint(kind) { const e = ENTRY[kind === 'er' ? 'er' : 'main']; return { pos: { x: e.x, z: e.z }, lane: 10 }; }

  function simplify(pts) {
    const out = [];
    pts.forEach(p => { const q = out[out.length - 1]; if (!q || Math.abs(q.x - p.x) > 1e-6 || Math.abs(q.z - p.z) > 1e-6) out.push(p); });
    return out;
  }

  function length(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return L; }

  function along(pts, f) {
    const L = length(pts); if (L === 0) return { x: pts[0].x, z: pts[0].z, dir: 0 };
    let d = Math.max(0, Math.min(1, f)) * L;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; const seg = Math.hypot(b.x - a.x, b.z - a.z);
      if (d <= seg || i === pts.length - 1) { const t = seg ? Math.min(1, d / seg) : 1; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dir: Math.atan2(b.x - a.x, b.z - a.z) }; }
      d -= seg;
    }
  }

  const api = { ROWS, CONNECTOR_X, ENTRY, FLOOR, WALK_SPEED, room, seat, seatCount, server, pathTo, pathExit, entryPoint, length, along };
  root.LAYOUT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
