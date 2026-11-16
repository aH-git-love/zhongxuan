/* ============================================================
 * 中玄 · 推演台 —— 紫微斗数排盘（零依赖纯算法）
 *
 * 口径（《紫微斗数全书》）：
 *   命宫 = 寅起正月顺数生月，再从该宫起子时逆数生时
 *   五行局 = 命宫干支纳音（水二木三金四土五火六）
 *   紫微落宫 = 商余法（生日÷局数，余奇逆行、余偶顺行）
 *   十四主星 = 紫微六星（逆布）+ 天府八星（顺布）
 *   四化 = 年干定禄权科忌；大限 = 阳男阴女顺行、起限岁=局数
 * ============================================================ */

const ZIWEI = (function(){
  const BASE = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑']; /* 寅起十二支 */
  const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const PALACE = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','交友','官禄','田宅','福德','父母'];
  const JU_N = { 水:2, 木:3, 金:4, 土:5, 火:6 };
  /* 60 甲子纳音五行（每两甲子一组，标准顺序 甲子金…癸亥水） */
  const NAYIN_WX = ['金','火','木','土','金','火','水','土','金','木','水','土','火','木','水','金','火','木','土','金','火','水','土','金','木','水','土','火','木','水'];
  /* 五虎遁：年干 → 寅宫天干索引 */
  const WUHU = { 甲:2, 己:2, 乙:4, 庚:4, 丙:6, 辛:6, 丁:8, 壬:8, 戊:0, 癸:0 };
  /* 年干四化（通行口诀表） */
  const SIHUA = {
    甲: { 禄:'廉贞', 权:'破军', 科:'武曲', 忌:'太阳' },
    乙: { 禄:'天机', 权:'天梁', 科:'紫微', 忌:'太阴' },
    丙: { 禄:'天同', 权:'天机', 科:'文昌', 忌:'廉贞' },
    丁: { 禄:'太阴', 权:'天同', 科:'天机', 忌:'巨门' },
    戊: { 禄:'贪狼', 权:'太阴', 科:'右弼', 忌:'天机' },
    己: { 禄:'武曲', 权:'贪狼', 科:'天梁', 忌:'文曲' },
    庚: { 禄:'太阳', 权:'武曲', 科:'太阴', 忌:'天同' },
    辛: { 禄:'巨门', 权:'太阳', 科:'文曲', 忌:'文昌' },
    壬: { 禄:'天梁', 权:'紫微', 科:'左辅', 忌:'武曲' },
    癸: { 禄:'破军', 权:'巨门', 科:'太阴', 忌:'贪狼' }
  };

  /* 60 甲子序：干支 → 索引 */
  function gz60(ganIdx, zhiSub){
    for (let i = 0; i < 60; i++) if (i % 10 === ganIdx && i % 12 === zhiSub) return i;
    return -1;
  }
  /* 纳音五行（输入寅起支索引） */
  function nayinWx(ganIdx, tyIdx){
    const zhiSub = (tyIdx + 2) % 12; /* 转子起 */
    return NAYIN_WX[Math.floor(gz60(ganIdx, zhiSub) / 2)];
  }
  const mod12 = n => ((n % 12) + 12) % 12;
  const hourZhiIdx = h => Math.floor((h + 1) / 2) % 12; /* 23-0:59 子… */

  /* 十四主星庙旺利陷（通行简表，按 BASE 寅起十二支顺序；不同派别略有差异，仅作参考）
   * 六档：庙(6) > 旺(5) > 得(4) > 利(3) > 平(2) > 陷(1) */
  const MIAO = {
    紫微: ['庙','旺','得','得','庙','庙','旺','平','得','旺','平','庙'],
    天机: ['得','旺','利','平','陷','利','得','旺','庙','庙','平','庙'],
    太阳: ['旺','庙','旺','旺','庙','得','得','平','陷','陷','陷','陷'],
    武曲: ['得','得','平','平','旺','庙','得','得','平','平','旺','庙'],
    天同: ['利','平','平','平','陷','陷','旺','平','庙','庙','旺','陷'],
    廉贞: ['庙','平','利','陷','平','陷','利','平','利','陷','平','陷'],
    天府: ['得','得','庙','平','旺','得','得','旺','庙','得','庙','庙'],
    太阴: ['陷','陷','平','陷','陷','平','得','得','庙','庙','庙','庙'],
    贪狼: ['平','利','庙','陷','旺','陷','平','利','庙','陷','旺','陷'],
    巨门: ['得','庙','利','平','旺','陷','得','庙','利','平','旺','陷'],
    天相: ['平','陷','得','得','平','庙','庙','得','得','平','庙','庙'],
    天梁: ['得','庙','庙','平','庙','旺','平','利','得','陷','庙','旺'],
    七杀: ['平','利','庙','平','旺','平','利','平','庙','平','旺','平'],
    破军: ['得','利','庙','平','旺','陷','得','利','庙','平','旺','陷']
  };
  const BR_RANK = { 庙: 6, 旺: 5, 得: 4, 利: 3, 平: 2, 陷: 1 };
  function brightnessOf(star, tyIdx){
    const arr = MIAO[star];
    if (!arr) return null;
    const level = arr[mod12(tyIdx)];
    return { level, rank: BR_RANK[level] || 0 };
  }

  /* ---------- 核心：排盘 ---------- */
  function pai(input){
    const { lunarMonth, lunarDay, yearGan, hour, gender } = input;
    if (!lunarMonth || !lunarDay || yearGan == null || hour == null) return null;
    const g = (typeof yearGan === 'number') ? yearGan : GAN.indexOf(yearGan);
    if (g < 0) return null;
    const ygName = GAN[g];
    const hz = hourZhiIdx(hour);            /* 0 子 … 11 亥 */
    const yangGan = g % 2 === 0;            /* 年干阴阳 */

    /* 命宫 / 身宫（寅起索引） */
    const monthBase = lunarMonth - 1;
    const mingIdx = mod12(monthBase - hz);
    const shenIdx = mod12(monthBase + hz);

    /* 命宫天干：五虎遁定寅宫干，再顺推 */
    const yinGan = WUHU[ygName];
    const mingGan = (yinGan + mingIdx) % 10;

    /* 五行局：命宫干支纳音 */
    const wx = nayinWx(mingGan, mingIdx);
    const ju = JU_N[wx];

    /* 紫微落宫：商余法 */
    const q = Math.ceil(lunarDay / ju);
    const r = q * ju - lunarDay;
    const qBase = mod12(q - 1);
    const zwIdx = r === 0 ? qBase : (r % 2 === 0 ? mod12(qBase + r) : mod12(qBase - r));

    /* 十四主星布星（全部寅起索引） */
    const tfIdx = mod12(12 - zwIdx);        /* 天府：与紫微关于寅申轴对称 */
    const stars = [
      ['紫微', zwIdx], ['天机', mod12(zwIdx - 1)], ['太阳', mod12(zwIdx - 3)],
      ['武曲', mod12(zwIdx - 4)], ['天同', mod12(zwIdx - 5)], ['廉贞', mod12(zwIdx - 8)],
      ['天府', tfIdx], ['太阴', mod12(tfIdx + 1)], ['贪狼', mod12(tfIdx + 2)],
      ['巨门', mod12(tfIdx + 3)], ['天相', mod12(tfIdx + 4)], ['天梁', mod12(tfIdx + 5)],
      ['七杀', mod12(tfIdx + 6)], ['破军', mod12(tfIdx + 10)]
    ];
    /* 年干四化标记 */
    const sh = SIHUA[ygName] || {};
    const shTag = {};
    for (const k of ['禄','权','科','忌']) if (sh[k]) shTag[sh[k]] = k;

    /* 十二宫：命宫起逆布 */
    const palaces = PALACE.map((name, i) => {
      const idx = mod12(mingIdx - i);
      return {
        name, idx, zhi: BASE[idx], gan: GAN[(yinGan + idx) % 10],
        stars: stars.filter(s => s[1] === idx)
          .map(s => ({ name: s[0], sihua: shTag[s[0]] || null, brightness: brightnessOf(s[0], s[1]) }))
          .sort((a, b) => a.name.localeCompare(b.name))
      };
    });

    /* 大限：阳男阴女顺行，起限岁 = 局数 */
    const forward = yangGan === (gender === '男');
    const dayun = palaces.map((p, i) => {
      const dIdx = forward ? mod12(mingIdx + i) : mod12(mingIdx - i);
      return {
        palace: PALACE[i], idx: dIdx, zhi: BASE[dIdx],
        start: ju + i * 10, end: ju + i * 10 + 9
      };
    });

    return {
      mingGong: { idx: mingIdx, zhi: BASE[mingIdx], gz: GAN[mingGan] + BASE[mingIdx] },
      shenGong: { idx: shenIdx, zhi: BASE[shenIdx] },
      ju: { wx, n: ju },
      yearGan, yangGan, gender, forward,
      zwIdx, zwZhi: BASE[zwIdx], tfIdx, tfZhi: BASE[tfIdx],
      sihua: sh, palaces, dayun
    };
  }

  return { pai, BASE, PALACE, SIHUA, hourZhiIdx, nayinWx, MIAO, brightnessOf, BR_RANK };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { ZIWEI };
