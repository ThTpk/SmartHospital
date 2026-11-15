/* =====================================================================
 * SmartHospital — โปรไฟล์ผู้รับบริการ (patient mix + จำนวนผู้มาใช้บริการรายชั่วโมง)
 *  - mix    : สัดส่วนผู้รับบริการแต่ละประเภท (%), ประเภท = process ใน data.js
 *  - hourly : จำนวนผู้มาใช้บริการในแต่ละชั่วโมง (ราย/ชม.) เริ่ม 08:00
 *  - hours  : จำนวนชั่วโมงเปิดบริการ (= hourly.length)
 * λ ของแต่ละ process = (ค่าเฉลี่ยรายชั่วโมง) × สัดส่วน
 * ตัวคูณรายชั่วโมง  = hourly[h] / ค่าเฉลี่ย → ใช้ทั้งในการจำลอง (non-homogeneous Poisson)
 *                     และการวิเคราะห์คิวรายชั่วโมง (stationary independent period-by-period)
 * ===================================================================== */
(function (root) {
  'use strict';

  const M = (OPD, OPD_LAB, OPD_XRY, PROC, VACC, CHECKUP, DENTAL, REHAB, ER, ADMIT, SURGERY) =>
    ({ OPD, OPD_LAB, OPD_XRY, PROC, VACC, CHECKUP, DENTAL, REHAB, ER, ADMIT, SURGERY });

  const PRESETS = [
    { id: 'normal', icon: '🏥', name: 'วันทำการปกติ',
      desc: 'ผู้ป่วยนอกทั่วไปเป็นหลัก คนมามากช่วง 08–10 น. แล้วลดลงช่วงเที่ยง มีรอบเล็กช่วงบ่าย',
      // = λ เดิม 24/15/8/5/5/4/4/3/4/2/1 จาก 75 ราย/ชม. (เก็บเป็นเศษส่วนเพื่อให้ λ ตรงค่าเดิม)
      mix: M(32, 20, 32 / 3, 20 / 3, 20 / 3, 16 / 3, 16 / 3, 4, 16 / 3, 8 / 3, 4 / 3),
      hourly: [95, 110, 90, 70, 55, 65, 60, 55] },
    { id: 'flu', icon: '🤒', name: 'ฤดูไข้หวัด / โรคระบาด',
      desc: 'ผู้ป่วยทางเดินหายใจเพิ่มขึ้น ส่งเอกซเรย์ปอดและมา ER มากขึ้น งานตรวจสุขภาพและทันตกรรมลดลง',
      mix: M(40, 16, 14, 4, 8, 1, 2, 2, 9, 3.5, 0.5),
      hourly: [115, 130, 110, 85, 70, 80, 70, 60] },
    { id: 'chronic', icon: '👵', name: 'คลินิกโรคเรื้อรัง / ผู้สูงอายุ',
      desc: 'เบาหวาน ความดัน มาเจาะเลือดตอนเช้าตรู่ (งดอาหาร) และทำกายภาพมาก ทำให้คนแน่นช่วง 08–10 น.',
      mix: M(20, 38, 8, 5, 3, 3, 3, 10, 5, 4, 1),
      hourly: [130, 115, 80, 60, 40, 45, 35, 30] },
    { id: 'campaign', icon: '📋', name: 'แคมเปญตรวจสุขภาพ / วัคซีน',
      desc: 'กลุ่มบริษัทและโรงเรียนนัดตรวจสุขภาพและฉีดวัคซีนช่วงเช้า ทำให้ Lab, X-ray และ EKG หนัก',
      mix: M(18, 10, 5, 4, 25, 25, 4, 2, 4, 2, 1),
      hourly: [100, 120, 110, 80, 50, 60, 50, 40] },
    { id: 'festival', icon: '🚑', name: 'ช่วงเทศกาล / อุบัติเหตุ',
      desc: 'สงกรานต์และปีใหม่ ผู้ป่วยนอกน้อยลง แต่ผู้ป่วยอุบัติเหตุเข้า ER มากขึ้นจนถึงช่วงค่ำ เปิด 12 ชม. (08–20 น.)',
      mix: M(38, 8, 12, 14, 1, 0, 1, 1, 14, 6, 5),
      hourly: [45, 50, 45, 40, 40, 45, 50, 55, 65, 75, 80, 70] },
    { id: 'weekend', icon: '🗓️', name: 'วันหยุด / คลินิกนอกเวลา',
      desc: 'ผู้มาใช้บริการน้อย ส่วนใหญ่เป็นโรคทั่วไป ทำแผล และฉุกเฉิน ไม่มีงานตรวจสุขภาพ',
      mix: M(45, 5, 6, 10, 3, 0, 6, 2, 18, 4, 1),
      hourly: [40, 45, 40, 30, 25, 25, 20, 20] }
  ];

  const clone = o => JSON.parse(JSON.stringify(o));
  const sum = a => a.reduce((x, y) => x + y, 0);

  function fromPreset(id) {
    const p = PRESETS.find(x => x.id === id) || PRESETS[0];
    return { id: p.id, mix: clone(p.mix), hourly: p.hourly.slice() };
  }
  /** ค่าเฉลี่ยราย/ชม. ตลอดช่วงเปิดบริการ */
  function mean(prof) { return prof.hourly.length ? sum(prof.hourly) / prof.hourly.length : 0; }
  /** ตัวคูณของชั่วโมง h (0 = 08:00) เทียบกับค่าเฉลี่ย */
  function factorAt(prof, h) { const m = mean(prof); return m > 0 && h >= 0 && h < prof.hourly.length ? prof.hourly[h] / m : 1; }
  function maxFactor(prof) { const m = mean(prof); return m > 0 ? Math.max(1, ...prof.hourly) / m : 1; }
  function peakHour(prof) { let b = 0; prof.hourly.forEach((v, i) => { if (v > prof.hourly[b]) b = i; }); return b; }
  /** สัดส่วนที่ normalize แล้ว (รวม = 1) */
  function shares(prof) {
    const t = sum(Object.values(prof.mix)) || 1;
    const o = {}; Object.keys(prof.mix).forEach(k => o[k] = prof.mix[k] / t); return o;
  }
  /** ปรับความยาว hourly ตามชั่วโมงเปิดบริการ (ชั่วโมงที่เพิ่มใช้ค่าชั่วโมงสุดท้าย) */
  function resize(prof, hours) {
    const h = prof.hourly;
    if (hours < h.length) h.length = hours;
    while (h.length < hours) h.push(h.length ? h[h.length - 1] : 50);
  }
  /** ตรงกับ preset ไหน (ถ้าไม่ตรงเลย = custom) */
  function matchPreset(prof) {
    const close = (a, b) => Math.abs(a - b) < 1e-6;
    const p = PRESETS.find(x => x.hourly.length === prof.hourly.length && x.hourly.every((v, i) => close(v, prof.hourly[i])) &&
      Object.keys(x.mix).every(k => close(x.mix[k], prof.mix[k] ?? 0)));
    return p ? p.id : 'custom';
  }
  /** เขียน λ ของแต่ละ process ลง cfg.processes และตั้ง cfg.hours */
  function apply(cfg) {
    const prof = cfg.profile, m = mean(prof), sh = shares(prof);
    cfg.hours = prof.hourly.length;
    Object.keys(cfg.processes).forEach(pid => { cfg.processes[pid].lambda = Math.round(m * (sh[pid] || 0) * 100) / 100; });
  }
  /** ผู้ใช้แก้ λ รายบริการเอง → แปลงกลับเป็นสัดส่วน และปรับขนาดกราฟรายชั่วโมงให้ค่าเฉลี่ยเท่ากับ Σλ */
  function fromLambdas(cfg) {
    const prof = cfg.profile, tot = sum(Object.values(cfg.processes).map(p => p.lambda)), m = mean(prof);
    Object.keys(cfg.processes).forEach(pid => prof.mix[pid] = tot > 0 ? Math.round(cfg.processes[pid].lambda / tot * 1000) / 10 : 0);
    if (m > 0) prof.hourly = prof.hourly.map(v => Math.round(v * tot / m * 10) / 10);
    prof.id = matchPreset(prof);
  }
  const hourLabel = h => String(8 + h).padStart(2, '0') + ':00';

  const api = { PRESETS, fromPreset, mean, factorAt, maxFactor, peakHour, shares, resize, matchPreset, apply, fromLambdas, hourLabel };
  root.PROFILE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
