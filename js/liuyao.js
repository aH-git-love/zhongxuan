/* ============================================================
 * 中玄 · 推演台 —— 六爻排盘（京房纳甲 · 卜筮正宗口径，零依赖纯算法）
 *
 * 摇卦：三枚铜钱摇六次（自下而上装爻）
 *   背数 3 → 老阳 9（动，○）   背数 2 → 少阴 8
 *   背数 1 → 少阳 7            背数 0 → 老阴 6（动，×）
 * 纳甲：八宫干支表（内卦三爻 + 外卦三爻）
 * 六亲：宫五行为「我」——同我兄弟 · 生我父母 · 我生子孙 · 克我官鬼 · 我克妻财
 * 六神：甲乙青龙 · 丙丁朱雀 · 戊勾陈 · 己腾蛇 · 庚辛白虎 · 壬癸玄武（初爻起依次上行）
 * 世应：纯卦世 6 · 一世 1 · 二世 2 · 三世 3 · 四世 4 · 五世 5 · 游魂 4 · 归魂 3；应 = 世 ± 3
 * ============================================================ */

const LIUYAO = (function(){
  /* 八卦（下→上三爻，1 阳 0 阴） */
  const TRIG = {
    乾: [1,1,1], 坎: [0,1,0], 艮: [0,0,1], 震: [1,0,0],
    巽: [0,1,1], 离: [1,0,1], 坤: [0,0,0], 兑: [1,1,0]
  };

  const PALACE_WX = { 乾:'金', 坎:'水', 艮:'土', 震:'木', 巽:'木', 离:'火', 坤:'土', 兑:'金' };
  const ZHI_WX = { 子:'水', 丑:'土', 寅:'木', 卯:'木', 辰:'土', 巳:'火',
                   午:'火', 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水' };
  const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

  /* 纳甲：每宫内卦三爻干支（下→上）+ 外卦三爻干支 */
  const NAJIA = {
    乾: { in: [['甲','子'],['甲','寅'],['甲','辰']], out: [['壬','午'],['壬','申'],['壬','戌']] },
    坎: { in: [['戊','寅'],['戊','辰'],['戊','午']], out: [['戊','申'],['戊','戌'],['戊','子']] },
    艮: { in: [['丙','辰'],['丙','午'],['丙','申']], out: [['丙','戌'],['丙','子'],['丙','寅']] },
    震: { in: [['庚','子'],['庚','寅'],['庚','辰']], out: [['庚','午'],['庚','申'],['庚','戌']] },
    巽: { in: [['辛','丑'],['辛','亥'],['辛','酉']], out: [['辛','未'],['辛','巳'],['辛','卯']] },
    离: { in: [['己','卯'],['己','丑'],['己','亥']], out: [['己','酉'],['己','未'],['己','巳']] },
    坤: { in: [['乙','未'],['乙','巳'],['乙','卯']], out: [['癸','丑'],['癸','亥'],['癸','酉']] },
    兑: { in: [['丁','巳'],['丁','卯'],['丁','丑']], out: [['丁','亥'],['丁','酉'],['丁','未']] }
  };

  /* 64 卦名（按宫 · 纯/一世/二世/三世/四世/五世/游魂/归魂） */
  const NAMES = {
    乾: ['乾为天','天风姤','天山遁','天地否','风地观','山地剥','火地晋','火天大有'],
    坎: ['坎为水','水泽节','水雷屯','水火既济','泽火革','雷火丰','地火明夷','地水师'],
    艮: ['艮为山','山火贲','山天大畜','山泽损','火泽睽','天泽履','风泽中孚','风山渐'],
    震: ['震为雷','雷地豫','雷水解','雷风恒','地风升','水风井','泽风大过','泽雷随'],
    巽: ['巽为风','风天小畜','风火家人','风雷益','天雷无妄','火雷噬嗑','山雷颐','山风蛊'],
    离: ['离为火','火山旅','火风鼎','火水未济','山水蒙','风水涣','天水讼','天火同人'],
    坤: ['坤为地','地雷复','地泽临','地天泰','雷天大壮','泽天夬','水天需','水地比'],
    兑: ['兑为泽','泽水困','泽地萃','泽山咸','水山蹇','地山谦','雷山小过','雷泽归妹']
  };
  const SHI = [6,1,2,3,4,5,4,3]; /* 纯/一世…五世/游魂/归魂 的世爻位 */

  /* 由六爻（下→上，6/7/8/9）定卦宫与卦名 */
  function hexOf(lines){
    const bits = lines.map(v => (v === 7 || v === 9) ? 1 : 0);
    for (const gong of Object.keys(NAMES)){
      const pure = TRIG[gong].concat(TRIG[gong]);
      for (let seq = 0; seq < 8; seq++){
        const cur = pure.slice();
        if (seq >= 1 && seq <= 5){ for (let i = 0; i < seq; i++) cur[i] ^= 1; }
        else if (seq === 6){ for (let i = 0; i < 5; i++) cur[i] ^= 1; cur[3] ^= 1; }
        else if (seq === 7){
          /* 归魂：游魂卦的内卦三爻复原为本宫纯卦下卦 */
          for (let i = 0; i < 5; i++) cur[i] ^= 1;
          cur[3] ^= 1;
          cur[0] = pure[0]; cur[1] = pure[1]; cur[2] = pure[2];
        }
        if (cur.every((b, i) => b === bits[i])){
          return { gong, seq, name: NAMES[gong][seq], shi: SHI[seq] };
        }
      }
    }
    return null;
  }

  /* 六亲 */
  function liuQin(gongWx, zhiWx){
    if (zhiWx === gongWx) return '兄弟';
    const sheng = { 金:'水', 水:'木', 木:'火', 火:'土', 土:'金' };
    if (sheng[gongWx] === zhiWx) return '子孙';      /* 我生 */
    if (sheng[zhiWx] === gongWx) return '父母';      /* 生我 */
    const ke = { 金:'木', 木:'土', 土:'水', 水:'火', 火:'金' };
    if (ke[gongWx] === zhiWx) return '妻财';         /* 我克 */
    if (ke[zhiWx] === gongWx) return '官鬼';        /* 克我 */
    return '兄弟';
  }
  /* 六神（日干起） */
  const SIX_GOD_START = { 甲:0, 乙:0, 丙:1, 丁:1, 戊:2, 己:3, 庚:4, 辛:4, 壬:5, 癸:5 };
  const SIX_GODS = ['青龙','朱雀','勾陈','腾蛇','白虎','玄武'];
  function sixGods(dayGan){
    const s = SIX_GOD_START[dayGan] != null ? SIX_GOD_START[dayGan] : 0;
    return SIX_GODS.map((_, i) => SIX_GODS[(s + i) % 6]);
  }
  /* 冲 */
  function isChong(a, b){
    return (ZHI.indexOf(a) + 6) % 12 === ZHI.indexOf(b);
  }

  /* 三币背数 → 爻值 */
  function coinsToLine(back){
    if (back === 3) return 9;
    if (back === 2) return 8;
    if (back === 1) return 7;
    if (back === 0) return 6;
    return null;
  }
  function shake(){
    const out = [];
    for (let i = 0; i < 6; i++){
      let back = 0;
      for (let j = 0; j < 3; j++) if (Math.random() < .5) back++;
      out.push(coinsToLine(back));
    }
    return out;
  }

  function pai(opts){
    if (!opts || !Array.isArray(opts.lines) || opts.lines.length !== 6) return null;
    if (!opts.lines.every(v => [6,7,8,9].includes(v))) return null;
    const lines = opts.lines;
    const hex = hexOf(lines);
    if (!hex) return null;
    const gongWx = PALACE_WX[hex.gong];
    /* 装干支：内卦三爻（1-3）+ 外卦三爻（4-6） */
    const nz = NAJIA[hex.gong];
    const yao = [];
    for (let i = 0; i < 6; i++){
      const pair = i < 3 ? nz.in[i] : nz.out[i - 3];
      const zhi = pair[1];
      const dong = lines[i] === 9 || lines[i] === 6;
      yao.push({
        pos: i + 1,
        gan: pair[0], zhi,
        zhiWx: ZHI_WX[zhi],
        liuqin: liuQin(gongWx, ZHI_WX[zhi]),
        yin: lines[i] === 6 || lines[i] === 8,
        dong, dongType: lines[i] === 9 ? '○' : lines[i] === 6 ? '×' : '',
        shi: hex.shi === i + 1, ying: ((hex.shi + 2) % 6) + 1 === i + 1
      });
    }
    /* 变卦 */
    const bLines = lines.map(v => v === 9 ? 8 : v === 6 ? 7 : v);
    const bHex = bLines.join('') !== lines.join('') ? hexOf(bLines) : null;
    /* 伏神：本卦缺的六亲 → 从本宫纯卦借 */
    const missing = [];
    ['兄弟','父母','子孙','官鬼','妻财'].forEach(q => {
      if (!yao.some(y => y.liuqin === q)){
        const pure = pai({ lines: TRIG[hex.gong].concat(TRIG[hex.gong]).map(b => b ? 7 : 8) });
        const src = pure.yao.find(y => y.liuqin === q);
        if (src) missing.push({ liuqin: q, zhi: src.zhi, gan: src.gan, from: src.pos });
      }
    });
    /* 月建 / 日令（可传字符串如 '子' / '甲子'） */
    const monthZhi = opts.monthZhi || null;
    const dayGan = opts.dayGan || null, dayZhi = opts.dayZhi || null;
    yao.forEach(y => {
      y.yuepo = monthZhi ? isChong(y.zhi, monthZhi) : false;
      y.andong = !y.dong && dayZhi ? isChong(y.zhi, dayZhi) : false;
    });
    return {
      lines, hex, gong: hex.gong, gongWx, name: hex.name,
      shi: hex.shi, ying: ((hex.shi + 2) % 6) + 1,
      yao, bian: bHex ? bHex.name : null, bianLines: bLines,
      sixGods: dayGan ? sixGods(dayGan) : null,
      missing, monthZhi, dayGan, dayZhi
    };
  }

  return { pai, shake, coinsToLine, hexOf, liuQin, sixGods, isChong,
    NAJIA, NAMES, TRIG, PALACE_WX, ZHI_WX, SIX_GODS, SHI };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { LIUYAO };
