/* ============================================================
 * 中玄 · 推演台 —— 天文算法
 * 儒略日 / 太阳视黄经 / 节气定气 / 朔日定朔
 * 精度：节气约 1 分钟级，朔日约 1 分钟级
 * ============================================================ */

const ASTRO = (function(){
  const RAD = Math.PI / 180;
  const sin = d => Math.sin(d * RAD);
  const cos = d => Math.cos(d * RAD);

  function norm360(x){ x = x % 360; return x < 0 ? x + 360 : x; }

  /* ---- 公历日期 → 儒略日（0h UT 对应 xx.5） ---- */
  function toJD(y, m, d, h = 0, mi = 0, s = 0){
    if (m <= 2){ y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1))
         + d + B - 1524.5 + (h + mi / 60 + s / 3600) / 24;
  }
  /* JD(UT) → 公历日期（返回 {year,month,day} + 小数天） */
  function fromJD(jd){
    let z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let a = z;
    if (z >= 2299161){
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const dayF = b - d - Math.floor(30.6001 * e) + f;
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    return { year, month, day: Math.floor(dayF), frac: dayF - Math.floor(dayF) };
  }
  /* 儒略日数 JDN（当日正午为整数，用于日柱） */
  function jdn(y, m, d){ return Math.floor(toJD(y, m, d, 12, 0, 0)); }
  function jdnToYMD(jdnVal){
    return fromJD(jdnVal - 0.5 + 0.5); /* jdn 正午为整数 → 该日 0h 为 jdn-0.5 */
  }

  /* ---- ΔT(TD-UT) 秒，Espenak-Meeus 近似 ---- */
  function deltaT(year){
    const y = year;
    let t;
    if (y < 1900){ t = (y - 1900) / 100; return -2.79 + 149.4119 * t - 5989.39 * t * t + 6196.6 * t * t * t - 197.0 * Math.pow(t, 4); }
    if (y < 1920){ t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t * t * t; }
    if (y < 1941){ t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + Math.pow(t, 3) / 2547; }
    if (y < 1961){ t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - Math.pow(t, 3) / 718; }
    if (y < 1986){ t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - Math.pow(t, 3) / 718; }
    if (y < 2005){ t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * Math.pow(t, 3) + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5); }
    if (y < 2050){ t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (y < 2150){ return -20 + 32 * Math.pow((y - 1820) / 100, 2) - 0.5628 * (2150 - y); }
    return 200 + 0.5 * (y - 2150);
  }


  /* ---- 太阳视黄经（Meeus 低精度 + 章动/光行差修正） ---- */
  function sunLongitude(jd){
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M)
            + (0.019993 - 0.000101 * T) * sin(2 * M)
            + 0.000289 * sin(3 * M);
    const trueL = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    return norm360(trueL - 0.00569 - 0.00478 * sin(omega));
  }

  /* ---- 24 节气（黄经 0/15/.../345） 名称与黄经 ---- */
  const TERM_NAMES = ['春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露',
                      '秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒','立春','雨水','惊蛰'];
  const TERM_LONG = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165,
                     180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];
  const TERM_LUNAR_MONTH = [2,2,3,4,4,5,6,7,7,8,9,10,10,11,12,1,2,3,4,4,5,6,7,7]; /* 中气所属农历月（1..12 为正月..） */

  /* 由黄经求时刻（北京时间），牛顿迭代 */
  function longitudeToJD(target, guessUT){
    let jd = guessUT;
    for (let i = 0; i < 20; i++){
      let diff = norm360(target - sunLongitude(jd));
      if (diff > 180) diff -= 360;
      if (Math.abs(diff) < 1e-7) break;
      jd += diff * 365.2422 / 360;
    }
    return jd;
  }
  /* 求某公历年内的节气时刻（返回北京时间 JD） */
  function solarTermJD(year, longitude){
    const base = toJD(year, 1, 1, 0, 0);
    let doy = 79 + longitude / 360 * 365.2422;
    doy = ((doy % 365.2422) + 365.2422) % 365.2422;
    const guessUT = base + doy - 8 / 24; /* 转 UT 猜测值 */
    const ut = longitudeToJD(longitude, guessUT);
    return ut + 8 / 24; /* 返回北京时间 JD */
  }
  /* 某公历年全部 24 节气（含跨年，共 26 个，索引对应黄经 315..345） */
  function solarTermsOfYear(year){
    const arr = [];
    for (let li = 21; li < 24; li++) arr.push(termOf(year - 1, li));
    for (let li = 0; li < 24; li++) arr.push(termOf(year, li));
    return arr; /* 24项：从上一年立春(黄经315)到本年大寒 */
  }
  function termOf(year, li){
    /* li: 0..23 对应 TERM_LONG 索引 */
    const jd = solarTermJD(year, TERM_LONG[li]);
    return { name: TERM_NAMES[li], longitude: TERM_LONG[li], jd };
  }

  /* ---- 朔日（Meeus 49，含完整修正项） ---- */
  function newMoonJDE(k){
    const T = k / 1236.85;
    const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    let JDE = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    const M = norm360(2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3);
    const Mp = norm360(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
    const F = norm360(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
    const Om = norm360(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    let c = 0;
    c += -0.40720 * sin(Mp);
    c += 0.17241 * sin(M) * E;
    c += 0.01608 * sin(2 * Mp);
    c += 0.01039 * sin(2 * F);
    c += 0.00739 * sin(Mp - M);
    c += -0.00514 * sin(Mp + M);
    c += 0.00208 * sin(2 * M) * E * E;
    c += -0.00111 * sin(Mp - 2 * F);
    c += -0.00057 * sin(Mp + 2 * F);
    c += 0.00056 * sin(2 * Mp + M);
    c += -0.00042 * sin(3 * Mp);
    c += 0.00042 * sin(M + 2 * F);
    c += 0.00038 * sin(M - 2 * F);
    c += -0.00024 * sin(2 * Mp - M);
    c += -0.00017 * sin(Om);
    c += -0.00007 * sin(Mp + 2 * M);
    c += 0.00004 * sin(2 * Mp - 2 * F);
    c += 0.00004 * sin(3 * M);
    c += 0.00003 * sin(Mp + M - 2 * F);
    c += 0.00003 * sin(2 * Mp + 2 * F);
    c += -0.00003 * sin(Mp + M + 2 * F);
    c += 0.00003 * sin(Mp - M + 2 * F);
    c += -0.00002 * sin(Mp - M - 2 * F);
    c += -0.00002 * sin(3 * Mp + M);
    c += 0.00002 * sin(4 * Mp);
    JDE += c;
    /* 行星摄动 */
    const A1 = norm360(299.77 + 0.107408 * k - 0.009173 * T2); JDE += 0.000325 * sin(A1);
    const A2 = norm360(251.88 + 0.016321 * k);                 JDE += 0.000165 * sin(A2);
    const A3 = norm360(251.83 + 26.651886 * k);                JDE += 0.000164 * sin(A3);
    const A4 = norm360(349.42 + 36.412478 * k);                JDE += 0.000126 * sin(A4);
    const A5 = norm360(84.66 + 18.206239 * k);                 JDE += 0.000110 * sin(A5);
    const A6 = norm360(141.74 + 53.303771 * k);                JDE += 0.000062 * sin(A6);
    const A7 = norm360(207.14 + 2.453732 * k);                 JDE += 0.000060 * sin(A7);
    const A8 = norm360(154.84 + 7.306860 * k);                 JDE += 0.000056 * sin(A8);
    const A9 = norm360(34.52 + 27.261239 * k);                 JDE += 0.000047 * sin(A9);
    const A10= norm360(207.19 + 0.121824 * k);                 JDE += 0.000042 * sin(A10);
    const A11= norm360(291.34 + 1.844379 * k);                 JDE += 0.000040 * sin(A11);
    const A12= norm360(161.72 + 24.198154 * k);                JDE += 0.000037 * sin(A12);
    const A13= norm360(239.56 + 25.513099 * k);                JDE += 0.000035 * sin(A13);
    const A14= norm360(331.55 + 3.592518 * k);                 JDE += 0.000023 * sin(A14);
    return JDE; /* TD */
  }
  /* 朔 → 北京时间日期（返回该日 JDN 与时刻） */
  function newMoonDay(k, year){
    const jde = newMoonJDE(k);
    const dt = deltaT(year) / 86400;
    const jdUT = jde - dt;
    const jdLocal = jdUT + 8 / 24;
    return { jdn: Math.floor(jdLocal + 0.5), jd: jdLocal, k };
  }
  /* 找指定 JDN 之前最近（含当日）的朔日；若当日即朔日则返回该朔日，
     保证「朔 <= jdnTarget < 下一朔」这一包含关系成立 */
  function newMoonBefore(jdnTarget, year){
    let k = Math.floor((jdnTarget - 2451550.1) / 29.530588861);
    let m = newMoonDay(k, year);
    let guard = 0;
    while (m.jdn > jdnTarget && guard++ < 400){ k--; m = newMoonDay(k, year); }
    guard = 0;
    let nx = newMoonDay(k + 1, year);
    while (nx.jdn <= jdnTarget && guard++ < 400){ k++; m = nx; nx = newMoonDay(k + 1, year); }
    return nx.jdn <= jdnTarget ? nx : m;
  }

  /* ---- 闰月与农历月表（定气定朔） ---- */
  /* 构造农历年 year（公历年份）的月表：从冬至所属月为十一月 */
  function buildLunarYear(year){
    /* 该年冬至时刻（北京时间） */
    const wsJd = solarTermJD(year, 270);
    const wsJdn = Math.floor(wsJd + 0.5);
    /* 冬至所在月的朔日 = 农历十一月初一 */
    let k0 = newMoonBefore(wsJdn, year).k;
    /* 下一冬至 */
    const ws2Jd = solarTermJD(year + 1, 270);
    const ws2Jdn = Math.floor(ws2Jd + 0.5);
    /* 列出从 k0 起连续 16 个月的朔日（覆盖本农历年全部月 + 安全余量） */
    const starts = [];
    {
      const kk = newMoonBefore(wsJdn, year).k;
      for (let i = 0; i < 16; i++) starts.push(newMoonDay(kk + i, year).jdn);
    }
    /* 中气表：本年及前后年，12 中气（黄经 0,30,…,330） */
    const ZQ_LONG = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    const zqList = [];
    for (let yy = year - 1; yy <= year + 1; yy++){
      for (const L of ZQ_LONG) zqList.push(Math.floor(solarTermJD(yy, L) + 0.5));
    }
    zqList.sort((a, b) => a - b);
    /* 每月是否无中气 */
    const noZq = [];
    for (let i = 0; i < starts.length; i++){
      const s = starts[i], e = starts[i + 1] - 1;
      noZq.push(!zqList.some(z => z >= s && z <= e));
    }
    /* 下一冬至所在月索引 */
    let iws2 = -1;
    for (let i = 0; i < starts.length; i++){
      const s = starts[i], e = starts[i + 1] - 1;
      if (ws2Jdn >= s && ws2Jdn <= e){ iws2 = i; break; }
    }
    const N = iws2;              /* 本期月数（不含下一冬月）：12 或 13 */
    const count13 = N === 13;
    const LUNAR_NAMES = ['十一','十二','正','二','三','四','五','六','七','八','九','十'];
    let nameIdx = 0, leapAssigned = false;
    const out = [];
    for (let i = 0; i < N; i++){
      let name, isLeap = false;
      if (count13 && !leapAssigned && noZq[i]){
        const prevName = out[out.length - 1].name.replace('闰','');
        name = '闰' + prevName; isLeap = true; leapAssigned = true;
      } else {
        name = LUNAR_NAMES[nameIdx++ % 12];
      }
      out.push({ name, isLeap, start: starts[i], next: starts[i + 1], end: starts[i + 1] - 1 });
    }
    return { year, months: out, wsJdn, ws2Jdn, count13 };
  }

  /* 公历 → 农历 */
  function solarToLunar(y, m, d){
    const jdnTarget = jdn(y, m, d);
    for (const lyr of [y - 1, y, y + 1]){
      const info = buildLunarYear(lyr);
      const m2 = info.months.find(mo => jdnTarget >= mo.start && jdnTarget <= mo.end);
      if (m2){
        /* buildLunarYear(lyr) 的月表以农历 lyr 年十一月为第一月，
           故「十一/十二」属农历 lyr 年，「正..十」属农历 lyr+1 年 */
        const bare = m2.name.replace('闰','');
        const lunarYear = ['十一','十二'].includes(bare) ? lyr : lyr + 1;
        return { lunarYear, month: bare, isLeap: m2.isLeap, day: jdnTarget - m2.start + 1, jdn: jdnTarget };
      }
    }
    return null;
  }
  /* 农历 → 公历 */
  function lunarToSolar(lunarYear, monthName, day, isLeap){
    const name = isLeap ? '闰' + monthName : monthName;
    const bare = monthName.replace('闰','');
    const order = ['十一','十二'].includes(bare) ? [lunarYear] : [lunarYear - 1];
    for (const lyr of order){
      const info = buildLunarYear(lyr);
      const target = info.months.find(mo => mo.name === name);
      if (target){
        const jdnVal = target.start + day - 1;
        const ymd = jdnToYMD(jdnVal);
        return { year: ymd.year, month: ymd.month, day: ymd.day, jdn: jdnVal };
      }
    }
    return null;
  }

  return { toJD, fromJD, jdn, jdnToYMD, deltaT, sunLongitude, TERM_NAMES, TERM_LONG,
    solarTermJD, solarTermsOfYear, newMoonJDE, newMoonDay, newMoonBefore, buildLunarYear,
    solarToLunar, lunarToSolar };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { ASTRO };
