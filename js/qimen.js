/* ============================================================
 * 中玄 · 推演台 —— 时家转盘奇门遁甲排盘
 *
 * 依据：
 *  - 《烟波钓叟歌》"值符常遣加时干，值使顺逆遁宫去"
 *  - 《遁甲演义》卷一"八门九星逐时移宫诀"：
 *    阳一局乙丑时蓬星在九宫、休门在二宫；丙寅时蓬星在八宫、休门在三宫
 *  - 工程化口径 mainline-cn-v1：中宫一律寄坤；值符值使分别移宫；
 *    门迫 = 门克宫，宫克门 = 门受制；天禽寄坤随天芮转
 *  - 定局：24 节气 × 三元定局表（yishu.DUN_TABLE）；
 *    三元按符头法（甲己日为符头：子午卯酉上元 / 寅申巳亥中元 / 辰戌丑未下元）
 * ============================================================ */

const QIMEN = (function(){
  const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const QIMEN_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./yishu.js').YISHU : YISHU;
  const A_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./astro.js').ASTRO : ASTRO;

  /* 八宫环（物理顺时针：坎北→艮东北→震东→巽东南→离南→坤西南→兑西→乾西北；中五寄坤不在环上） */
  const RING = [1, 8, 3, 4, 9, 2, 7, 6];
  /* 星 / 门 / 神 常驻（地盘） */
  const STAR_OF = { 1:'天蓬', 2:'天芮', 3:'天冲', 4:'天辅', 5:'天禽', 6:'天心', 7:'天柱', 8:'天任', 9:'天英' };
  const DOOR_OF = { 1:'休门', 2:'死门', 3:'伤门', 4:'杜门', 6:'开门', 7:'惊门', 8:'生门', 9:'景门' };
  const GOD_ORDER = ['值符','螣蛇','太阴','六合','白虎','玄武','九地','九天'];
  const QI_YI_ORDER = ['戊','己','庚','辛','壬','癸','丁','丙','乙'];  /* 地盘布干序 */
  const XUN_YI = { '甲子':'戊', '甲戌':'己', '甲申':'庚', '甲午':'辛', '甲辰':'壬', '甲寅':'癸' };
  const WUXING_GONG = { 1:'水', 2:'土', 3:'木', 4:'木', 5:'土', 6:'金', 7:'金', 8:'土', 9:'火' };
  const WUXING_GAN = { '戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水','丁':'火','丙':'火','乙':'木' };
  const GONG_MING = { 1:'坎一宫（正北）', 2:'坤二宫（西南）', 3:'震三宫（正东）', 4:'巽四宫（东南）',
    5:'中五宫（中宫·寄坤）', 6:'乾六宫（西北）', 7:'兑七宫（正西）', 8:'艮八宫（东北）', 9:'离九宫（正南）' };
  const GUA_OF = { 1:'坎', 2:'坤', 3:'震', 4:'巽', 6:'乾', 7:'兑', 8:'艮', 9:'离' };
  /* 五行生克 */
  const SHENG = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
  const KE = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
  function relWx(a, b){
    if (!a || !b) return '—';
    if (a === b) return '比和';
    if (SHENG[a] === b) return '生';
    if (SHENG[b] === a) return '被生';
    if (KE[a] === b) return '克';
    if (KE[b] === a) return '被克';
    return '—';
  }

  /* ---------- 1. 定局：节气 × 三元（符头法） ---------- */
  /* 二十四节气按黄经序（立春 315 起） */
  const TERM_BY_LON = ['立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至',
    '小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至',
    '小寒','大寒'];

  function gzOfJdn(jdnDay){
    const idx = ((jdnDay + 49) % 60 + 60) % 60;
    return { idx, gz: GAN[idx % 10] + ZHI[idx % 12], gan: idx % 10, zhi: idx % 12 };
  }

  /* 找时刻之前最近的一个节气 */
  function lastTerm(jd){
    const ymd = A_LIB.jdnToYMD(jd);
    let terms = [];
    for (const y of [ymd.year - 1, ymd.year, ymd.year + 1]){
      for (const t of A_LIB.solarTermsOfYear(y)) terms.push(t);
    }
    terms = terms.filter(t => t.jd <= jd).sort((a, b) => a.jd - b.jd);
    return terms.length ? terms[terms.length - 1] : null;
  }

  /* 三元（符头法）：甲己日为符头；符头支 子午卯酉上元 / 寅申巳亥中元 / 辰戌丑未下元 */
  function yuanOf(jdnDay){
    const g = gzOfJdn(jdnDay);
    let idx = g.idx;
    const r = idx % 10;
    let back;
    if (r === 0 || r === 5) back = 0;            /* 今日即符头（甲 / 己） */
    else if (r < 5) back = r;                     /* 退回甲日 */
    else back = r - 5;                            /* 退回己日 */
    const fuIdx = idx - back;
    const fuZhi = ZHI[fuIdx % 12];
    const g2 = (fuZhi % 2 === 0) ? '子' : '戌';  /* placeholder，下面按组判 */
    let yuan = null, yuanIdx = -1;
    if ('子午卯酉'.includes(fuZhi)) { yuan = '上元'; yuanIdx = 0; }
    else if ('寅申巳亥'.includes(fuZhi)) { yuan = '中元'; yuanIdx = 1; }
    else if ('辰戌丑未'.includes(fuZhi)) { yuan = '下元'; yuanIdx = 2; }
    return { yuan, yuanIdx, fuTou: GAN[fuIdx % 10] + ZHI[fuIdx % 12], fuZhi, daysFromFuTou: back };
  }

  /* 定局主函数：北京时间 JD → {dun, ju, yuan, jieqi, ...} */
  function juOfJd(jd){
    const term = lastTerm(jd);
    if (!term) return null;
    const jdnDay = Math.floor(jd + 0.5 + 0.00001);      /* 当日 JDN（JD 从正午起） */
    const y = yuanOf(jdnDay);
    const t = QIMEN_LIB.DUN_TABLE[term.name];
    if (!t) return null;
    const daysFromTerm = Math.floor(jd - term.jd);
    return { dun: t.dun, ju: t.ju[y.yuanIdx], yuan: y.yuan,
      jieqi: term.name, jieqiJD: term.jd, daysFromTerm,
      fuTou: y.fuTou, daysFromFuTou: y.daysFromFuTou,
      juLabel: t.dun + '遁' + '一二三四五六七八九'[t.ju[y.yuanIdx] - 1] + '局',
      dayGz: gzOfJdn(jdnDay) };
  }

  /* ---------- 2. 地盘布干 ---------- */
  function earthOf(dun, ju){
    const earth = {};      /* 宫 → 干 */
    for (let i = 0; i < 9; i++){
      const gan = QI_YI_ORDER[i];
      let gong;
      if (dun === '阳') gong = ((ju - 1 + i) % 9) + 1;       /* 阳遁从局数宫起戊顺布 */
      else gong = ((ju - 1 - i) % 9 + 9) % 9 + 1;            /* 阴遁从局数宫起戊逆布 */
      earth[gong] = gan;
    }
    return earth;
  }
  function palaceOfGan(earth, gan){
    for (let k in earth) if (earth[k] === gan) return +k;
    return null;
  }

  /* ---------- 3. 核心排盘 buildPan ---------- */
  /* 输入：dun（'阳'/'阴'）、ju（1-9）、时柱干支（如 '乙丑'）
   * 输出：九宫天/地盘、星门神、值符值使、旬首旬空、格局提示 */
  function buildPan(dun, ju, hourGz){
    const yang = dun === '阳';
    const earth = earthOf(dun, ju);

    /* 时柱 → 旬首（六十甲子：GAN[i%10] + ZHI[i%12]） */
    let hIdx = -1;
    for (let i = 0; i < 60; i++) if (GAN[i % 10] + ZHI[i % 12] === hourGz) { hIdx = i; break; }
    if (hIdx < 0) return null;
    const xunIdx = hIdx - (hIdx % 10);
    const xunShou = GAN[xunIdx % 10] + ZHI[xunIdx % 12];
    const yi = XUN_YI[xunShou];                          /* 旬首遁仪 */
    const yiGong = palaceOfGan(earth, yi);                /* 旬首仪地盘宫 */
    const hourGan = GAN[hIdx % 10];
    /* 时干遇甲以旬仪代（六甲遁于六仪之下） */
    const hourGanEff = hourGan === '甲' ? yi : hourGan;
    const hourGong = palaceOfGan(earth, hourGanEff);      /* 时干地盘宫 */
    const stepInXun = hIdx % 10;                          /* 值使移宫步数（甲子=0） */

    /* 旬空：旬首支往前 10、11 位 */
    const kong1 = ZHI[(xunIdx % 12 + 10) % 12];
    const kong2 = ZHI[(xunIdx % 12 + 11) % 12];

    /* 值符星：旬首仪地盘宫的星（若落中宫 → 寄坤取天芮） */
    const zsStarGong = yiGong === 5 ? 2 : yiGong;
    const zhiFuStar = STAR_OF[zsStarGong];
    /* 值使门：旬首仪地盘宫的门（中宫无门取死门=坤门） */
    const zhiShiDoor = DOOR_OF[zsStarGong];

    /* 值符星落宫 = 时干地盘宫（时干落中宫 → 寄坤） */
    const hourGongAdj = hourGong === 5 ? 2 : hourGong;
    const zhiFuGong = hourGongAdj;

    /* 天盘：八星沿环转（值符星 → 时干宫） */
    const ringIdxS = RING.indexOf(zsStarGong === 5 ? 2 : zsStarGong);
    const ringIdxP = RING.indexOf(hourGongAdj);
    const off = ((ringIdxP - ringIdxS) % 8 + 8) % 8;
    const sky = {};                                       /* 宫 → 天盘干（星带干） */
    const starT = {};                                     /* 宫 → 天盘星 */
    for (let k = 0; k < 8; k++){
      const gongT = RING[k];
      const gongO = RING[((k - off) % 8 + 8) % 8];
      starT[gongT] = STAR_OF[gongO];
      sky[gongT] = earth[gongO];
    }
    /* 天禽寄芮：天芮所落宫带天禽 + 中五地盘干 */
    const ruiGong = +Object.keys(starT).find(k => starT[k] === '天芮');
    const centerStem = earth[5];
    const hostedSkyStem = centerStem;
    const hostedStar = '天禽';

    /* 值使门移宫：从旬首仪宫起，走 stepInXun 步（阳顺阴逆，九宫数序，中五照计） */
    const dir = yang ? 1 : -1;
    let q = yiGong;
    for (let i = 0; i < stepInXun; i++) q = (((q - 1 + dir) % 9) + 9) % 9 + 1;
    if (q === 5) q = 2;                                   /* 落中五寄坤二 */

    /* 天盘门：值使门落 q 后其余七门按物理环顺移 */
    const ringD = RING;
    const iD = ringD.indexOf(zsStarGong === 5 ? 2 : zsStarGong);
    const iQ = ringD.indexOf(q);
    const offD = ((iQ - iD) % 8 + 8) % 8;
    const doorT = {};
    for (let k = 0; k < 8; k++){
      const gongT = ringD[k];
      const gongO = ringD[((k - offD) % 8 + 8) % 8];
      doorT[gongT] = DOOR_OF[gongO];
    }

    /* 八神：值符神落值符星宫，阳顺阴逆 */
    const godT = {};
    const gDir = yang ? 1 : -1;
    for (let i = 0; i < 8; i++){
      const gong = RING[((ringIdxP + i * gDir) % 8 + 8) % 8];
      godT[gong] = GOD_ORDER[i];
    }

    /* 汇总九宫 */
    const palaces = [];
    for (let g = 1; g <= 9; g++){
      const isCenter = g === 5;
      const hostsRui = !isCenter && starT[g] === '天芮';
      const eGan = isCenter ? null : earth[g];
      const sGan = isCenter ? null : (hostsRui ? sky[g] + '·' + hostedSkyStem : sky[g]);
      const star = isCenter ? null : starT[g];
      const door = isCenter ? null : doorT[g];
      const god = isCenter ? null : godT[g];
      const gWx = WUXING_GONG[g];
      const dWx = door ? doorWx(door) : null;
      const doorPalace = door
        ? (dWx === gWx ? '比和' : (KE[dWx] === gWx ? '门迫（凶）' : (KE[gWx] === dWx ? '门受制' : (SHENG[dWx] === gWx ? '门生宫' : '宫生门'))))
        : null;
      palaces.push({
        palace: g, name: GONG_MING[g], gua: GUA_OF[g] || '中', wx: gWx,
        earthStem: eGan, skyStem: sGan, plainSkyStem: isCenter ? null : sky[g],
        star, door, god,
        hostedStar: hostsRui ? hostedStar : null,
        hostedSkyStem: hostsRui ? hostedSkyStem : null,
        stemRelation: (isCenter || !eGan) ? null : relWx(WUXING_GAN[sky[g]], WUXING_GAN[earth[g]]),
        starRelation: isCenter ? null : relWx(starWx(star), gWx),
        doorRelation: doorPalace,
        isCenter, hostsRui
      });
    }

    /* 格局自动检测 */
    const patterns = detectPatterns(palaces, { zhiFuGong, q, xunShou, yiGong, kong1, kong2, yang });

    return {
      dun, ju, juLabel: dun + '遁' + '一二三四五六七八九'[ju - 1] + '局',
      hourGz, hourGan,
      xunShou, yi, yiGong,
      zhiFuStar, zhiFuGong, zhiShiDoor, zhiShiGong: q, stepInXun,
      kongWang: [kong1, kong2],
      palaces, patterns,
      earth, sky, starT, doorT, godT, centerHosting: { hostedStar: '天禽', centerStem, skyPalace: ruiGong }
    };
  }

  function starWx(name){
    const m = { '天蓬':'水','天芮':'土','天冲':'木','天辅':'木','天禽':'土','天心':'金','天柱':'金','天任':'土','天英':'火' };
    return m[name] || null;
  }
  function doorWx(name){
    const m = { '休门':'水','生门':'土','伤门':'木','杜门':'木','景门':'火','死门':'土','惊门':'金','开门':'金' };
    return m[name] || null;
  }

  /* ---------- 4. 格局检测 ---------- */
  function detectPatterns(palaces, ctx){
    const out = [];
    /* 伏吟：天地盘干同宫（星未动） */
    const fuYin = palaces.filter(p => !p.isCenter && p.plainSkyStem === p.earthStem).length;
    if (fuYin >= 6) out.push({ name:'伏吟', nature:'凶', detail:'天盘干与地盘干多数同宫，主停滞守旧，宜静不宜动' });
    /* 反吟：星落本宫对冲（坎1↔离9 等） */
    const DUI = { 1:9, 9:1, 2:8, 8:2, 3:7, 7:3, 4:6, 6:4 };
    let fanYin = 0;
    /* 门反吟：本宫常驻门与对冲宫常驻门对调（门盘整体翻转） */
    for (const p of palaces){
      if (p.isCenter || !p.door) continue;
      const dui = palaces.find(x => x.palace === DUI[p.palace]);
      if (dui && dui.door && DOOR_AT(dui.palace) === p.door && DOOR_AT(p.palace) === dui.door){
        fanYin++;
      }
    }
    if (fanYin >= 6) out.push({ name:'反吟（门反吟）', nature:'凶', detail:'门盘整体翻转对冲，主反复折腾，宜收尾复盘，不宜新开局' });
    /* 门迫 / 门受制 */
    for (const p of palaces){
      if (!p.door) continue;
      if (p.doorRelation === '门迫（凶）') out.push({ name:'门迫', palace:p.palace, nature:'凶', detail:p.door + '落' + p.name + '，门克宫，用力越猛反噬越大' });
      if (p.doorRelation === '门受制' && '开休生'.includes(p.door[0])) out.push({ name:'吉门受制', palace:p.palace, nature:'凶', detail:p.door + '落' + p.name + '，宫克门，吉力打折' });
    }
    /* 三奇得使：乙丙丁配吉门 */
    for (const p of palaces){
      if (p.isCenter) continue;
      if ('乙丙丁'.includes(p.skyStem) && p.door && '开休生'.includes(p.door[0]))
        out.push({ name:'三奇得使', palace:p.palace, nature:'吉', detail:p.skyStem + '配' + p.door + '，事情有转机，行动资源更顺' });
    }
    /* 青龙返首（戊加丙）/ 飞鸟跌穴（丙加戊） */
    for (const p of palaces){
      if (p.isCenter) continue;
      if (p.skyStem === '戊' && p.earthStem === '丙') out.push({ name:'青龙返首', palace:p.palace, nature:'吉', detail:'天盘戊临地盘丙，大事可为、谋事有成' });
      if (p.skyStem === '丙' && p.earthStem === '戊') out.push({ name:'飞鸟跌穴', palace:p.palace, nature:'吉', detail:'天盘丙临地盘戊，求财谋事有意外之助' });
    }
    /* 太白入荧（庚加丙）/ 荧入太白（丙加庚） */
    for (const p of palaces){
      if (p.isCenter) continue;
      if (p.skyStem === '庚' && p.earthStem === '丙') out.push({ name:'太白入荧', palace:p.palace, nature:'凶', detail:'庚临丙，主客争、防口舌争斗' });
      if (p.skyStem === '丙' && p.earthStem === '庚') out.push({ name:'荧入太白', palace:p.palace, nature:'凶', detail:'丙临庚，火金相战，防破财' });
    }
    /* 旬空宫提示 */
    out.push({ name:'旬空', nature:'中性', detail:'时旬空 ' + ctx.kong1 + ctx.kong2 + '，对应宫位力量虚，事易拖延落空' });
    return out;
  }
  function STAR_AT(gong){ return STAR_OF[gong]; }
  function DOOR_AT(gong){ return DOOR_OF[gong]; }

  /* ---------- 5. 从公历时间起局 ---------- */
  /* 输入 {year,month,day,hour,minute}（北京时间）→ 完整盘 */
  function panFromDate(d){
    const jd = A_LIB.toJD(d.year, d.month, d.day, d.hour || 0, d.minute || 0, 0);
    const juInfo = juOfJd(jd);
    if (!juInfo) return null;
    /* 时柱：五鼠遁（甲己还加甲…） */
    const dayGan = juInfo.dayGz.gan;
    const hourZhi = Math.floor((((d.hour || 0) * 60 + (d.minute || 0)) % 1440 + 1440) % 1440 / 120); /* 0=子 */
    const hourGan = (dayGan % 5) * 2 + hourZhi;  /* 五鼠遁：甲己日子时起甲子 */
    const hourGz = GAN[hourGan % 10] + ZHI[hourZhi];
    const pan = buildPan(juInfo.dun, juInfo.ju, hourGz);
    return Object.assign({ juInfo, jd, hourZhi }, pan);
  }

  return {
    buildPan, panFromDate, juOfJd, yuanOf, earthOf, palaceOfGan,
    STAR_OF, DOOR_OF, GOD_ORDER, QI_YI_ORDER, XUN_YI, GONG_MING, RING,
    starWx, doorWx, relWx
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { QIMEN };
