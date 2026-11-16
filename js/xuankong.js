/* ============================================================
 * 中玄 · 推演台 —— 玄空飞星宅命盘（下卦，零依赖纯算法）
 *
 * 口径（三元九运 · 下卦排盘）：
 *   元运：1864 起三元九运，每运 20 年
 *   运星：运数入中，按洛书数序顺飞九宫
 *   山星/向星：坐山宫 / 向首宫的运星入中，依坐向三元龙阴阳定顺逆（阳顺阴逆）
 *   三元龙：地元（壬甲丙庚阳 / 丑辰未戌阴）· 天元（乾艮巽坤阳 / 子午卯酉阴）·
 *           人元（寅申巳亥阳 / 癸丁乙辛阴）
 *   二十四山顺时针：子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬
 * ============================================================ */

const XUANKONG = (function(){
  const SEQ = [5, 6, 7, 8, 9, 1, 2, 3, 4]; /* 飞泊路径：中→乾→兑→艮→离→坎→坤→震→巽 */
  const PALACE_NAMES = { 1:'坎', 2:'坤', 3:'震', 4:'巽', 5:'中', 6:'乾', 7:'兑', 8:'艮', 9:'离' };
  const MOUNTAINS = {
    1: ['壬','子','癸'], 2: ['未','坤','申'], 3: ['甲','卯','乙'], 4: ['辰','巽','巳'],
    5: [],              6: ['戌','乾','亥'], 7: ['庚','酉','辛'], 8: ['丑','艮','寅'],
    9: ['丙','午','丁']
  };
  /* 二十四山（顺时针，子山起） */
  const M24 = ['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙','午','丁',
               '未','坤','申','庚','酉','辛','戌','乾','亥','壬'];
  /* 三元龙阴阳 */
  const DI_YANG = ['壬','甲','丙','庚'], DI_YIN = ['丑','辰','未','戌'];
  const TIAN_YANG = ['乾','艮','巽','坤'], TIAN_YIN = ['子','午','卯','酉'];
  const REN_YANG = ['寅','申','巳','亥'], REN_YIN = ['癸','丁','乙','辛'];

  function yuanLong(name){
    if (DI_YANG.indexOf(name) >= 0 || DI_YIN.indexOf(name) >= 0) return '地';
    if (TIAN_YANG.indexOf(name) >= 0 || TIAN_YIN.indexOf(name) >= 0) return '天';
    if (REN_YANG.indexOf(name) >= 0 || REN_YIN.indexOf(name) >= 0) return '人';
    return null;
  }
  function isYin(name){
    return DI_YIN.indexOf(name) >= 0 || TIAN_YIN.indexOf(name) >= 0 || REN_YIN.indexOf(name) >= 0;
  }
  function mountainInfo(name){
    const yuan = yuanLong(name);
    if (!yuan) return null;
    const palace = MOUNTAINS[1].indexOf(name) >= 0 ? 1
      : MOUNTAINS[2].indexOf(name) >= 0 ? 2
      : MOUNTAINS[3].indexOf(name) >= 0 ? 3
      : MOUNTAINS[4].indexOf(name) >= 0 ? 4
      : MOUNTAINS[6].indexOf(name) >= 0 ? 6
      : MOUNTAINS[7].indexOf(name) >= 0 ? 7
      : MOUNTAINS[8].indexOf(name) >= 0 ? 8
      : MOUNTAINS[9].indexOf(name) >= 0 ? 9 : 5;
    return { name, palace, yuan, yin: isYin(name) };
  }
  /* 元运：1864 起三元九运，每运 20 年，循环 */
  function yunOf(year){
    let idx = Math.floor((year - 1864) / 20);
    if (idx < 0) idx = ((idx % 9) + 9) % 9;
    return (idx % 9) + 1;
  }
  /* 入中飞星：startNum 入中宫，forward 决定数序顺逆，返回 {宫洛书数: 星} */
  function feipan(startNum, forward){
    const map = {};
    let n = startNum;
    for (let i = 0; i < 9; i++){
      map[SEQ[i]] = n;
      n = forward ? (n % 9) + 1 : ((n + 7) % 9) + 1;
    }
    return map;
  }

  /* ---------- 年紫白（2000-2099 口径：9 − 年份后两位数字根） ---------- */
  function digitRoot(n){
    n = Math.abs(n);
    while (n >= 10) n = String(n).split('').reduce((s, c) => s + (+c), 0);
    return n;
  }
  function yearZibai(year){
    if (year < 2000 || year > 2099) return null;
    let n = 9 - digitRoot(year % 100);
    if (n <= 0) n += 9;
    return n;
  }
  /* ---------- 月紫白：年支三合定正月入中，逐月逆退一位 ---------- */
  const MONTH_BASE = { 子:8, 午:8, 卯:8, 酉:8, 辰:5, 戌:5, 丑:5, 未:5, 寅:2, 申:2, 巳:2, 亥:2 };
  function monthZibai(yearZhi, month){
    const base = MONTH_BASE[yearZhi];
    if (!base) return null;
    let n = base - (month - 1);
    while (n <= 0) n += 9;
    while (n > 9) n -= 9;
    return n;
  }
  /* 吉凶：1/6/8 为吉（一白六白八白），2/5/7 为凶（二黑五黄七赤），3/4/9 平 */
  function zibaiLuck(n){
    if (n === 1 || n === 6 || n === 8) return '吉';
    if (n === 2 || n === 5 || n === 7) return '凶';
    return '平';
  }
  function zibaiOf(year, yearZhi, month){
    const y = yearZibai(year);
    const m = month ? monthZibai(yearZhi, month) : null;
    return {
      year: y, month: m,
      yearPan: y ? feipan(y, true) : null,
      monthPan: m ? feipan(m, true) : null,
      yearLuck: y ? zibaiLuck(y) : null,
      monthLuck: m ? zibaiLuck(m) : null,
      monthStar: m, yearStar: y
    };
  }

  function pai(opts){
    if (!opts || !opts.mountain) return null;
    const yun = opts.yun || yunOf(opts.year);
    if (!(yun >= 1 && yun <= 9)) return null;
    const mIdx = M24.indexOf(opts.mountain);
    if (mIdx < 0) return null;
    const fIdx = (mIdx + 12) % 24;          /* 向首 = 坐山对面 */
    const facing = M24[fIdx];
    const mi = mountainInfo(opts.mountain);
    const fi = mountainInfo(facing);
    const yunPan = feipan(yun, true);        /* 运星入中一律顺飞 */
    const shanStart = yunPan[mi.palace];     /* 坐山运星入中为山星 */
    const xiangStart = yunPan[fi.palace];    /* 向首运星入中为向星 */
    const shanPan = feipan(shanStart, !mi.yin);   /* 阳顺阴逆 */
    const xiangPan = feipan(xiangStart, !fi.yin);

    /* 旺衰判局：旺星 = 运数 */
    let judge;
    const atShan = shanPan[mi.palace] === yun, atXiang = xiangPan[fi.palace] === yun;
    const toXiang = shanPan[fi.palace] === yun, toShan = xiangPan[mi.palace] === yun;
    if (atShan && atXiang) judge = '旺山旺向';
    else if (toXiang && toShan) judge = '上山下水';
    else if (toXiang && atXiang) judge = '双星到向';
    else if (atShan && toShan) judge = '双星到坐';
    else judge = '杂局（旺星未到山到向）';

    const grid = [1,2,3,4,5,6,7,8,9].map(p => ({
      palace: p, name: PALACE_NAMES[p],
      xiang: xiangPan[p], yun: yunPan[p], shan: shanPan[p],
      mountains: MOUNTAINS[p], palaceYun: p
    }));
    return {
      yun, mountain: opts.mountain, facing, year: opts.year || null,
      mi, fi, shanStart, xiangStart, judge, grid,
      shanPan, xiangPan, yunPan
    };
  }

  /* ---------- 流月飞星断方位：24 山合成宜动/忌动评分 ---------- */
  function directionTable(x, zb){
    if (!x || !zb || !zb.yearPan || !zb.monthPan) return null;
    const rows = M24.map(name => {
      const info = mountainInfo(name);
      if (!info) return null;
      const yStar = zb.yearPan[info.palace], mStar = zb.monthPan[info.palace];
      const g = x.grid.find(q => q.palace === info.palace);
      let score = 0;
      const reasons = [];
      const yLuck = zibaiLuck(yStar), mLuck = zibaiLuck(mStar);
      if (yLuck === '吉'){ score += 2; reasons.push('年' + yStar + '吉'); }
      else if (yLuck === '凶'){ score -= 2; reasons.push('年' + yStar + '凶'); }
      if (mLuck === '吉'){ score += 2; reasons.push('月' + mStar + '吉'); }
      else if (mLuck === '凶'){ score -= 2; reasons.push('月' + mStar + '凶'); }
      /* 山星当运旺星落本宫：本宫得旺气 */
      if (g.shan === x.yun){ score += 3; reasons.push('山星当运得气'); }
      else if (g.xiang === x.yun){ score += 2; reasons.push('向星当运得气'); }
      /* 宅盘山星下水 / 上山下水：坐向宫位减分 */
      if (name === x.mountain && x.judge === '上山下水'){ score -= 1; reasons.push('宅局上山下水'); }
      const level = score >= 4 ? '宜动' : score >= 1 ? '可动' : score <= -3 ? '忌动' : '慎动';
      return { name, palace: info.palace, palaceName: PALACE_NAMES[info.palace], yuan: info.yuan,
        yStar, mStar, score, reasons, level };
    }).filter(Boolean);
    const byScore = rows.slice().sort((a, b) => b.score - a.score);
    return {
      rows, good: byScore.filter(r => r.score >= 1).slice(0, 8),
      bad: byScore.filter(r => r.score <= 0).slice(-8).reverse()
    };
  }

  return { pai, yunOf, feipan, yuanLong, isYin, mountainInfo, M24, SEQ, PALACE_NAMES,
    yearZibai, monthZibai, zibaiLuck, zibaiOf, digitRoot, directionTable };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { XUANKONG };
