/* ============================================================
 * 中玄 · 推演台 —— 择日（良辰吉日）核心
 * 建除十二神 / 黄黑道 / 神煞冲煞 / 时辰吉凶 / 择日评分
 * 依赖：core.js, astro.js, bazi.js
 * ============================================================ */

const ALMANAC = (function(){
  const C = (typeof require !== 'undefined' ? require('./core.js') : CORE);
  const A = (typeof require !== 'undefined' ? require('./astro.js').ASTRO : ASTRO);
  const B = (typeof require !== 'undefined' ? require('./bazi.js').BAZI : BAZI);
  const { GAN, ZHI, SHENGXIAO, JIANCHU, JIANCHU_DESC, isHuangdao, zhishenOfDay,
          ZHISHEN_ORDER, ZHISHEN_HUANGDAO, PENGZU_GAN, PENGZU_ZHI, SHA_FANG, LIUHE, HAI, CHONG } = C;

  /* ---- 事项 ----
   * 每个事项对建除十二神的评分（-2 凶 ~ +2 大吉），键为建除神名 */
  const MATTERS = {
    '嫁娶': { 建:0, 除:1, 满:1, 平:0, 定:2, 执:1, 破:-2, 危:-1, 成:2, 收:-1, 开:2, 闭:-1 },
    '开市': { 建:0, 除:-1, 满:1, 平:0, 定:1, 执:-1, 破:-2, 危:0, 成:2, 收:-1, 开:2, 闭:-2 },
    '出行': { 建:1, 除:1, 满:0, 平:0, 定:-1, 执:-1, 破:-1, 危:-1, 成:1, 收:-1, 开:2, 闭:-2 },
    '入宅': { 建:0, 除:1, 满:0, 平:0, 定:2, 执:0, 破:-2, 危:-1, 成:2, 收:0, 开:1, 闭:-1 },
    '动土': { 建:-2, 除:0, 满:0, 平:1, 定:1, 执:0, 破:-1, 危:0, 成:1, 收:0, 开:0, 闭:1 },
    '安葬': { 建:0, 除:1, 满:-1, 平:0, 定:1, 执:0, 破:-1, 危:0, 成:1, 收:0, 开:-2, 闭:1 },
    '上任': { 建:2, 除:0, 满:0, 平:0, 定:0, 执:0, 破:-2, 危:-1, 成:1, 收:0, 开:1, 闭:-1 },
    '求医': { 建:0, 除:2, 满:-1, 平:0, 定:0, 执:0, 破:1, 危:0, 成:0, 收:0, 开:2, 闭:-2 },
    '签约': { 建:0, 除:0, 满:1, 平:0, 定:1, 执:0, 破:-2, 危:0, 成:2, 收:0, 开:1, 闭:-2 },
    '祭祀': { 建:1, 除:1, 满:2, 平:1, 定:1, 执:1, 破:0, 危:1, 成:1, 收:1, 开:1, 闭:1 },
    '移徙': { 建:0, 除:1, 满:0, 平:0, 定:1, 执:-1, 破:-2, 危:-1, 成:1, 收:0, 开:1, 闭:-1 },
    '求财': { 建:0, 除:-1, 满:1, 平:0, 定:1, 执:0, 破:-1, 危:0, 成:1, 收:2, 开:1, 闭:-1 }
  };
  const MATTER_NAMES = Object.keys(MATTERS);
  /* 事项 ↔ 常见宜忌词映射（用于生成"宜/忌"文本） */
  const YI_TERMS = { 嫁娶:'嫁娶', 开市:'开市交易', 出行:'出行', 入宅:'入宅安床', 动土:'动土修造',
    安葬:'安葬', 上任:'上任赴任', 求医:'求医问药', 签约:'立券签约', 祭祀:'祭祀祈福', 移徙:'移徙搬迁', 求财:'纳财' };

  /* ---- 单日黄历 ---- */
  function dayInfo(y, m, d, opts){
    opts = opts || {};
    const jd = A.toJD(y, m, d, 12, 0, 0);
    const jdnVal = A.jdn(y, m, d);
    const dayIdx = ((jdnVal + 49) % 60 + 60) % 60;
    const dGan = dayIdx % 10, dZhi = dayIdx % 12;
    /* 月建：取当日午时的月柱 */
    const mp = B.monthPillar(jd);
    const monthZhi = mp.zhi;
    const jcIdx = (dZhi - monthZhi + 12) % 12;
    const jc = JIANCHU[jcIdx];
    const huangdao = isHuangdao(jc);
    /* 节气信息 */
    const prevTerm = prevAndNextTerm(jd);
    /* 时辰吉凶 */
    const hours = [];
    for (let hz = 0; hz < 12; hz++){
      const zs = zhishenOfDay(dZhi, hz);
      const good = ZHISHEN_HUANGDAO.includes(zs);
      /* 时辰干支 */
      const hGan = ((dGan % 5) * 2 + hz) % 10;
      hours.push({ zhi: hz, gan: hGan, gz: GAN[hGan] + ZHI[hz], name: ZHI[hz] + '时',
        zhishen: zs, good, range: hourRange(hz),
        chong: SHENGXIAO[(hz + 6) % 12] });
    }
    /* 冲煞 */
    const chongZhi = (dZhi + 6) % 12;
    const sha = SHA_FANG[dZhi];
    /* 宜忌判定：以建除分值为准（>=1 宜，<=-1 忌），黄黑道仅作总评修正 */
    const scores = {};
    for (const mt of MATTER_NAMES) scores[mt] = MATTERS[mt][jc];
    const yi = MATTER_NAMES.filter(mt => scores[mt] >= 2);
    const ji = MATTER_NAMES.filter(mt => scores[mt] <= -1);
    /* 神煞（日家常用） */
    const shensha = [];
    if (huangdao) shensha.push('黄道吉日');
    else shensha.push('黑道日');
    if (jc === '成' || jc === '开') shensha.push('成开大吉');
    if (jc === '破') shensha.push('月破大耗');
    if (jc === '闭') shensha.push('闭日不宜开张');
    /* 十恶大败日（简化：甲辰乙巳壬申丙申丁亥庚辰戊戌辛巳己丑己未） */
    const E10 = ['甲辰','乙巳','壬申','丙申','丁亥','庚辰','戊戌','辛巳','己丑','己未'];
    if (E10.includes(GAN[dGan] + ZHI[dZhi])) shensha.push('十恶大败');
    /* 四离四绝：节气前一日（民俗视为四离/四绝，大事不宜） */
    if (prevTerm.tomorrowIsTerm) shensha.push('明日交节（四离四绝，大事不宜）');
    /* 杨公忌（农历月日，简化跳过） */
    const pengzu = (PENGZU_GAN[GAN[dGan]] || '') + '；' + (PENGZU_ZHI[ZHI[dZhi]] || '');
    /* 建除说明 */
    return {
      y, m, d, jdn: jdnVal, gz: GAN[dGan] + ZHI[dZhi], dayGan: dGan, dayZhi: dZhi,
      monthZhi, jc, jcDesc: JIANCHU_DESC[jc], huangdao, hours, chong: SHENGXIAO[chongZhi], chongZhi, sha,
      yi, ji, scores, shensha, pengzu, monthPillar: GAN[mp.gan] + ZHI[mp.zhi],
      term: prevTerm.name, termDate: prevTerm.dateStr,
      lunar: A.solarToLunar(y, m, d)
    };
  }

  function hourRange(hz){
    /* 子0: 23-01, 丑1: 01-03 ... */
    const start = (hz * 2 + 23) % 24;
    const end = (start + 2) % 24;
    return pad(start) + ':00-' + pad((end === 0 ? 24 : end)) + ':00';
  }
  function pad(n){ return n < 10 ? '0' + n : '' + n; }

  /* 前后节气 */
  function prevAndNextTerm(jd){
    const ymd = A.fromJD(jd);
    const year = ymd.year;
    let cur = null, next = null;
    for (let yy = year - 1; yy <= year + 1; yy++){
      for (let li = 0; li < 24; li++){
        const t = A.solarTermJD(yy, A.TERM_LONG[li]);
        if (t <= jd && (!cur || t > cur.jd)) cur = { name: A.TERM_NAMES[li], jd: t };
        if (t > jd && (!next || t < next.jd)) next = { name: A.TERM_NAMES[li], jd: t };
      }
    }
    const cd = A.fromJD(cur.jd);
    return { name: cur.name, jd: cur.jd, dateStr: `${cd.year}-${pad(cd.month)}-${pad(cd.day)}`,
      tomorrowIsTerm: (next.jd - jd) < 1 };
  }

  /* ---- 择日：按事项在日期范围内打分排序 ---- */
  function pickDays(matter, startY, startM, startD, days, opts){
    opts = opts || {};
    const list = [];
    const baseJdn = A.jdn(startY, startM, startD);
    for (let i = 0; i < days; i++){
      const ymd = A.jdnToYMD(baseJdn + i);
      const info = dayInfo(ymd.year, ymd.month, ymd.day);
      let score = info.scores[matter] * 10 + (info.huangdao ? 5 : -5);
      const reasons = [];
      reasons.push(`建除${info.jc}（${info.scores[matter] > 0 ? '宜' : info.scores[matter] < 0 ? '忌' : '平'}）`);
      reasons.push(info.huangdao ? '黄道日' : '黑道日');
      /* 主事人生肖冲避 */
      if (opts.zodiac && info.chong === opts.zodiac){
        score -= 40; reasons.push(`冲${opts.zodiac}`);
      }
      /* 主事人日主喜用（可选） */
      if (opts.favorWuxing && opts.favorWuxing.length){
        const dayWx = C.GAN_WUXING[info.dayGan];
        if (opts.favorWuxing.includes(dayWx)){ score += 6; reasons.push(`日干${C.GAN[info.dayGan]}(${dayWx})合喜用`); }
      }
      /* 黑道大忌 */
      if (info.jc === '破'){ score -= 20; reasons.push('月破'); }
      if (info.jc === '闭' && matter === '开市'){ score -= 15; reasons.push('闭日忌开市'); }
      /* 吉时 */
      const goodHours = info.hours.filter(h => h.good && !(opts.zodiac && h.chong === opts.zodiac));
      score += Math.min(goodHours.length, 6);
      list.push({ info, score, reasons, goodHours });
    }
    list.sort((a, b) => b.score - a.score);
    return list;
  }

  /* ---- 择时：某日 12 时辰吉凶排序 ---- */
  function pickHours(y, m, d, matter, zodiac){
    const info = dayInfo(y, m, d);
    const arr = info.hours.map(h => {
      let s = h.good ? 10 : 0;
      const r = [h.zhishen + (h.good ? '（黄道）' : '（黑道）')];
      if (zodiac && h.chong === zodiac){ s -= 30; r.push('冲' + zodiac); }
      /* 时辰与建除的关系：建除神与时辰无关，这里用黄黑道 + 冲 */
      if (matter && MATTERS[matter]){ s += info.scores[matter]; }
      return { ...h, score: s, reasons: r };
    });
    arr.sort((a, b) => b.score - a.score);
    return arr;
  }

  return { MATTERS, MATTER_NAMES, YI_TERMS, dayInfo, pickDays, pickHours, prevAndNextTerm, hourRange };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { ALMANAC };
