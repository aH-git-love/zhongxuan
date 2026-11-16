/* ============================================================
 * 中玄 · 推演台 —— 八字排盘核心
 * 四柱 / 十神 / 大运 / 流年 / 旺衰 / 神煞 / 推演
 * 依赖：core.js, astro.js
 * ============================================================ */

const BAZI = (function(){
  const { GAN, ZHI, GAN_WUXING, ZHI_WUXING, JIAZI, gzName, gzIndexOf, ZHI_CANG, CANG_WEIGHT,
          shiShen, nayin, changsheng, CS_SCORE, SHENSHA, SHENSHA_BY_SANHE, GUCHEN,
          WUXING_KE, WUXING_SHENG, SHISHEN_DESC, LIUHE, HAI, SANHE } = (typeof require !== 'undefined' ? require('./core.js') : CORE);
  const A = (typeof require !== 'undefined' ? require('./astro.js').ASTRO : ASTRO);

  /* 月份节界：黄经 315 立春→寅月 ... 285 小寒→丑月 */
  /* 月支与节气（"节"）的对应 */
  const JIE_MONTH = [
    { longitude: 315, zhi: 2,  name:'立春' },  /* 寅月 */
    { longitude: 345, zhi: 3,  name:'惊蛰' },  /* 卯月 */
    { longitude: 15,  zhi: 4,  name:'清明' },  /* 辰月 */
    { longitude: 45,  zhi: 5,  name:'立夏' },  /* 巳月 */
    { longitude: 75,  zhi: 6,  name:'芒种' },  /* 午月 */
    { longitude: 105, zhi: 7,  name:'小暑' },  /* 未月 */
    { longitude: 135, zhi: 8,  name:'立秋' },  /* 申月 */
    { longitude: 165, zhi: 9,  name:'白露' },  /* 酉月 */
    { longitude: 195, zhi: 10, name:'寒露' },  /* 戌月 */
    { longitude: 225, zhi: 11, name:'立冬' },  /* 亥月 */
    { longitude: 255, zhi: 0,  name:'大雪' },  /* 子月 */
    { longitude: 285, zhi: 1,  name:'小寒' }   /* 丑月 */
  ];

  /* ---- 求某时刻（北京时间）所处的月柱 ---- */
  function monthPillar(jdLocal){
    const ymd = A.fromJD(jdLocal);
    const year = ymd.year;
    /* 找到最近的、jdLocal 之前的节 */
    let best = null, bestJd = -Infinity;
    for (let yy = year - 1; yy <= year + 1; yy++){
      for (const j of JIE_MONTH){
        const jd = A.solarTermJD(yy, j.longitude);
        if (jd <= jdLocal && jd > bestJd){ bestJd = jd; best = j; }
      }
    }
    /* 月干：年干起月。甲己年丙寅起、乙庚戊寅、丙辛庚寅、丁壬壬寅、戊癸甲寅 */
    /* 年柱以立春界，先求年干 */
    const lichunThis = A.solarTermJD(year, 315);
    const lichunPrev = A.solarTermJD(year - 1, 315);
    let ganzhiYear = year;
    if (jdLocal < lichunThis) ganzhiYear = year - 1;
    if (jdLocal < lichunPrev) ganzhiYear = year - 1;
    /* 年干 = (ganzhiYear - 4) % 10（1984 甲子年：年干 甲=0） */
    const yearGan = ((ganzhiYear - 4) % 10 + 10) % 10;
    const yearZhi = ((ganzhiYear - 4) % 12 + 12) % 12;
    /* 月干 */
    const startGan = [2, 4, 6, 8, 0][yearGan % 5]; /* 甲→丙 乙→戊 丙→庚 丁→壬 戊→甲 */
    /* 寅月 zhi=2 起，月干 = startGan + (zhi - 2) */
    const mZhi = best.zhi;
    const mGan = (startGan + (mZhi - 2 + 12) % 12 + 10) % 10;
    return { gan: mGan, zhi: mZhi, jieName: best.name, jieJd: bestJd, yearGan, yearZhi, ganzhiYear };
  }

  /* ---- 完整排盘 ---- */
  function paiPan(input){
    /* input: {year, month, day, hour, minute, gender('男'|'女'), trueSolar:false, lon:116.4, zhiHourDay:true} */
    const { year, month, day, hour, minute, gender } = input;
    const lon = (input.lon !== undefined) ? input.lon : 116.4;
    const useTrue = !!input.trueSolar;
    /* 北京时间的"北京 JD"表示（与节气/朔的返回值同一坐标系） */
    let jdLocal = A.toJD(year, month, day, hour, minute, 0);
    if (useTrue){
      /* 真太阳时 = 北京时间 + 经度差(4分钟/度) + 均时差(分钟) */
      const doyStart = A.toJD(year, 1, 1, 0, 0) + 8 / 24;
      const n = Math.round(jdLocal - doyStart) + 1; /* 年积日 */
      const B = 2 * Math.PI * (n - 81) / 364;
      const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
      jdLocal = jdLocal + (lon - 120) / 1440 + eot / 1440;
    }
    /* 23 点换日（子时换日） */
    const ymd = A.fromJD(jdLocal);
    let dayJdn, hourMin = ymd.frac * 24 * 60;
    if (input.ziHourDay !== false){
      /* 23:00 后日柱进一位 */
      if (hourMin >= 23 * 60){ dayJdn = A.jdn(ymd.year, ymd.month, ymd.day) + 1; }
      else dayJdn = A.jdn(ymd.year, ymd.month, ymd.day);
    } else {
      dayJdn = A.jdn(ymd.year, ymd.month, ymd.day);
    }
    /* 日柱：(JDN + 49) % 60 */
    const dayIdx = ((dayJdn + 49) % 60 + 60) % 60;
    const dGan = dayIdx % 10, dZhi = dayIdx % 12;

    /* 年柱 */
    const mp = monthPillar(jdLocal);
    const yGan = mp.yearGan, yZhi = mp.yearZhi;

    /* 时柱 */
    const totalMin = Math.floor(hourMin);
    const hZhi = Math.floor(((totalMin + 60) / 120)) % 12;
    const hGan = ((dGan % 5) * 2 + hZhi) % 10;

    /* 农历 */
    const lunar = A.solarToLunar(ymd.year, ymd.month, ymd.day);

    const pillars = [
      { name:'年柱', gan:yGan, zhi:yZhi, label:'年柱' },
      { name:'月柱', gan:mp.gan, zhi:mp.zhi, label:'月柱' },
      { name:'日柱', gan:dGan, zhi:dZhi, label:'日柱' },
      { name:'时柱', gan:hGan, zhi:hZhi, label:'时柱' }
    ];
    for (const p of pillars){
      p.gz = GAN[p.gan] + ZHI[p.zhi];
      p.gzIdx = gzIndexOf(p.gan, p.zhi);
      p.nayin = nayin(p.gzIdx);
      p.wuxing = GAN_WUXING[p.gan] + ZHI_WUXING[p.zhi];
      p.cang = cangOf(p.zhi);
      p.cangShiShen = p.cang.map(c => shiShen(dGan, GAN.indexOf(c.ch)));
      p.zhishen = p === pillars[3] ? '日主' : (p === pillars[2] ? '日主' : shiShen(dGan, p.gan));
    }
    pillars[2].zhishen = '日主';
    pillars[3].zhishen = shiShen(dGan, hGan);
    pillars[0].zhishen = shiShen(dGan, yGan);
    pillars[1].zhishen = shiShen(dGan, mp.gan);
    /* 藏干十二长生 */
    for (const p of pillars) p.changsheng = changsheng(dGan, p.zhi);

    /* 五行统计（含藏干加权） */
    const wxCount = { '木':0, '火':0, '土':0, '金':0, '水':0 };
    for (const p of pillars){
      wxCount[GAN_WUXING[p.gan]] += 1;
      for (const c of p.cang) wxCount[GAN_WUXING[GAN.indexOf(c.ch)]] += c.w;
    }
    /* 同党异党（日主强弱评分）：同党=比劫+印，异党=食伤+财+官杀 */
    const myWx0 = GAN_WUXING[dGan];
    const yinWx = { '木':'水','火':'木','土':'火','金':'土','水':'金' }[myWx0]; /* 生我者 */
    const sameScore = wxCount[myWx0] + wxCount[yinWx];
    const all = sameScore + wxCount[WUXING_KE[myWx0]] + wxCount[KE_ME(dGan)] + wxCount[I_SHENG(dGan)];
    const strength = all > 0 ? sameScore / all : 0.5;
    const strengthLabel = strength >= 0.55 ? '偏强' : (strength <= 0.42 ? '偏弱' : '中和');

    /* 喜用神（简化）：偏弱喜印比；偏强喜克泄耗 */
    const myWx = GAN_WUXING[dGan];
    const yongShen = strength >= 0.55
      ? { '克': WUXING_KE[myWx], '泄': shengWx(myWx), '耗': keWx(myWx) }
      : { '印': yinWx, '比': myWx };

    /* 神煞 */
    const shensha = findShenSha(yGan, dGan, [yZhi, mp.zhi, dZhi, hZhi]);

    /* 大运 */
    const dayun = calcDaYun(dGan, mp, jdLocal, gender, yGan);

    /* 流年（当前年起 10 年，用真实当前时间） */
    const nowYear = (typeof CURRENT_YEAR !== 'undefined' && CURRENT_YEAR) || new Date().getFullYear();
    const liunian = [];
    for (let i = 0; i < 10; i++){
      const y = nowYear + i;
      const g = ((y - 4) % 10 + 10) % 10, z = ((y - 4) % 12 + 12) % 12;
      liunian.push({ year: y, gan: g, zhi: z, gz: GAN[g] + ZHI[z], shiShen: shiShen(dGan, g) });
    }

    /* ---- 多流派扩展字段 ---- */
    const kongArr = kongWangOf(gzIndexOf(dGan, dZhi));
    const kongWang = { zhis: kongArr.map(z => ZHI[z]), hit: [] };
    [yZhi, mp.zhi, dZhi, hZhi].forEach((z, i) => { if (kongArr.includes(z)) kongWang.hit.push(['年','月','日','时'][i] + '支' + ZHI[z]); });
    const mingGong = { zhi: mingGongOf(mp.zhi, hZhi) };
    mingGong.gz = GAN[mingGongGan(yGan, mingGong.zhi)] + ZHI[mingGong.zhi];
    const taiYuan = taiYuanOf(mp.gan, mp.zhi);
    taiYuan.gz = GAN[taiYuan.gan] + ZHI[taiYuan.zhi];
    const xiaoYun = xiaoYunOf({ gan: hGan, zhi: hZhi }, gender, yGan, 8);
    const tiaoHou = tiaoHouOf(dGan, mp.zhi);
    const geju = geJu(dGan, mp.zhi, [GAN[yGan], GAN[mp.gan], GAN[dGan], GAN[hGan]]);
    const relations = allRelations([yZhi, mp.zhi, dZhi, hZhi]);
    const sanDeInfo = sanDe({ dayGan: dGan, pillars });

    return {
      jdLocal, ymd, lunar, pillars, wxCount, strength, strengthLabel, yongShen, shensha,
      dayIdx, dayJdn, monthPillarInfo: mp, dayun, liunian,
      dayGan: dGan, dayZhi: dZhi, hourInfo: { hZhi, hGan },
      kongWang, mingGong, taiYuan, xiaoYun, tiaoHou, geju, relations, sanDe: sanDeInfo
    };
  }

  /* 命宫天干：五虎遁（年上起月）推至命宫支 */
  function mingGongGan(yearGan, mingZhi){
    const startGan = [2, 4, 6, 8, 0][yearGan % 5];
    const offset = ((mingZhi - 2) + 12) % 12;
    return (startGan + offset) % 10;
  }

  /* 工具 */
  function shengWx(wx){ return { '木':'火','火':'土','土':'金','金':'水','水':'木' }[wx]; }
  function keWx(wx){ return { '木':'土','土':'水','水':'火','火':'金','金':'木' }[wx]; }
  function KE_ME(g){ const wx = GAN_WUXING[g]; return { '木':'金','火':'水','土':'木','金':'火','水':'土' }[wx]; }
  function I_SHENG(g){ const wx = GAN_WUXING[g]; return { '木':'火','火':'土','土':'金','金':'水','水':'木' }[wx]; }

  /* ============================================================
   * ---- 多流派推演扩展（推演方式库 M01-M24 的可计算部分）----
   * ============================================================ */

  /* 刑（三刑：寅巳申、丑戌未、子卯） */
  const XING = { '寅':'巳申', '巳':'寅申', '申':'寅巳', '丑':'戌未', '戌':'丑未', '未':'丑戌', '子':'卯', '卯':'子' };
  /* 六破 */
  const PO = { 0:9, 1:4, 2:11, 3:6, 4:1, 5:8, 6:3, 7:10, 8:5, 9:0, 10:7, 11:2 };
  /* 暗合（本气天干六合）：寅丑、亥午、卯申 */
  const ANHE = { 2:1, 1:2, 11:6, 6:11, 3:8, 8:3 };
  /* 三会局 */
  const SANHUI = [ [11,0,1,'水'], [2,3,4,'木'], [5,6,7,'火'], [8,9,10,'金'] ];
  /* 调候用神简表（据《穷通宝鉴》主流流传版整理）：10 日干 × 12 节气月（寅=0 … 丑=11） */
  const TIAOHOU = {
    0: ['丙癸','丙癸','庚丁壬','癸丁庚','癸丁庚','癸丁庚','庚丁壬','庚丁丙','庚甲丁壬','庚丁丙戊','丁庚丙','丁庚丙'],
    1: ['丙癸','丙癸','癸丙戊','癸','癸丙','癸丙','丙癸','癸丙','癸辛','丙戊','丙戊','丙'],
    2: ['壬庚','壬己','壬甲','壬癸庚','壬庚','壬庚','壬戊','壬癸','甲壬','甲戊壬','壬戊己','壬甲'],
    3: ['甲庚','庚甲','甲庚','甲庚','壬庚癸','甲壬庚','甲庚丙戊','甲庚丙戊','甲庚戊','甲庚','甲庚','甲庚'],
    4: ['丙甲癸','丙甲癸','甲丙癸','甲丙癸','壬甲丙','癸丙甲','丙癸甲','丙癸','甲丙癸','甲丙','丙甲','丙甲'],
    5: ['丙庚甲','甲癸丙','丙癸甲','癸丙','癸丙','癸丙','丙癸','丙癸','甲丙癸','丙戊甲','丙戊甲','丙甲戊'],
    6: ['戊甲壬丙丁','丁甲庚丙','甲丁壬癸','壬戊丙丁','壬癸','丁甲','丁甲','丁甲丙','甲壬','丁丙','丙丁甲','丙丁甲'],
    7: ['己壬庚','壬甲','壬甲','壬甲癸','壬己癸','壬庚甲','壬甲戊','壬甲','壬甲','壬丙','丙戊壬甲','丙壬戊己'],
    8: ['庚丙戊','戊辛庚','甲庚','壬辛庚癸','癸庚辛','辛甲','戊丁','甲庚','甲丙','戊丙庚','戊丙','丙丁甲'],
    9: ['辛丙','庚辛','丙辛甲','辛','庚辛壬癸','庚辛壬癸','丁','辛丙','辛甲壬癸','庚辛戊丁','丙辛','丙丁甲']
  };

  /* 两支关系全表（M09 关系法） */
  function relOf(z1, z2){
    if (z1 === z2) return [{ type:'伏吟', level:1, desc:`${ZHI[z1]}${ZHI[z2]}伏吟（重复引动）` }];
    const out = [];
    if ((z1 + 6) % 12 === z2 || (z2 + 6) % 12 === z1) out.push({ type:'六冲', level:5, desc:`${ZHI[z1]}${ZHI[z2]}相冲` });
    if (LIUHE[z1] === z2) out.push({ type:'六合', level:4, desc:`${ZHI[z1]}${ZHI[z2]}六合` });
    for (const grp of SANHE) if (grp.includes(z1) && grp.includes(z2)) out.push({ type:'三合', level:4, desc:`${ZHI[z1]}${ZHI[z2]}半三合` });
    if (HAI[z1] === z2 || HAI[z2] === z1) out.push({ type:'六害', level:2, desc:`${ZHI[z1]}${ZHI[z2]}相害` });
    const x1 = XING[ZHI[z1]] || '', x2 = XING[ZHI[z2]] || '';
    if (ZHI[z2] && x1.includes(ZHI[z2])) out.push({ type:'相刑', level:3, desc:`${ZHI[z1]}刑${ZHI[z2]}` });
    if (PO[z1] === z2 || PO[z2] === z1) out.push({ type:'六破', level:1, desc:`${ZHI[z1]}${ZHI[z2]}相破` });
    if (ANHE[z1] === z2) out.push({ type:'暗合', level:2, desc:`${ZHI[z1]}${ZHI[z2]}暗合` });
    for (const h of SANHUI) if (h.includes(z1) && h.includes(z2)) out.push({ type:'三会', level:5, desc:`${ZHI[z1]}${ZHI[z2]}半三会（趋${h[3]}局）` });
    if (Math.abs(z1 - z2) === 2 || Math.abs(z1 - z2) === 10){
      const mid = Math.abs(z1 - z2) === 2 ? (z1 + z2) / 2 : ((z1 + z2 + 12) / 2) % 12;
      out.push({ type:'相夹', level:1, desc:`${ZHI[z1]}${ZHI[z2]}相夹${ZHI[mid]}` });
    }
    return out.length ? out : null;
  }

  /* 原局全部关系（含宫位标注） */
  function allRelations(zhis){
    const names = ['年','月','日','时'];
    const out = [];
    for (let i = 0; i < 4; i++){
      for (let j = i + 1; j < 4; j++){
        const rs = relOf(zhis[i], zhis[j]);
        if (rs) out.push({ pillars: `${names[i]}支—${names[j]}支`, relations: rs });
      }
    }
    return out;
  }

  /* 空亡（旬空，M10） */
  function kongWangOf(gzIdx){
    const xun = Math.floor(gzIdx / 10);
    const pairs = [[10,11],[8,9],[6,7],[4,5],[2,3],[0,1]];
    return pairs[xun];
  }

  /* 命宫（节气月支起，逆数生时）/ 胎元（月干进一、月支进三）（M15） */
  function mingGongOf(monthZhi, hourZhi){
    return (((monthZhi - hourZhi) % 12) + 12) % 12;
  }
  function taiYuanOf(monthGan, monthZhi){
    return { gan: (monthGan + 1) % 10, zhi: (monthZhi + 3) % 12 };
  }

  /* 小运：从时柱起，阳男阴女顺、阴男阳女逆（M16） */
  function xiaoYunOf(hourGz, gender, yearGan, steps){
    const yang = (yearGan % 2 === 0);
    const forward = (gender === '男') ? yang : !yang;
    const idx = gzIndexOf(hourGz.gan, hourGz.zhi);
    const out = [];
    for (let i = 1; i <= (steps || 8); i++){
      const n = (((forward ? idx + i : idx - i) % 60) + 60) % 60;
      out.push({ age: i, gz: JIAZI[n] });
    }
    return out;
  }

  /* 格局判定（M03 格局法·简化） */
  function geJu(dGan, monthZhi, ganzhi){
    const cang = cangOf(monthZhi);
    /* 建禄 / 羊刃：日干禄、刃在月支 */
    const luZhi = { 0:2, 1:3, 2:5, 3:6, 4:5, 5:6, 6:8, 7:9, 8:10, 9:0 }[dGan]; /* 日干禄支 */
    if (monthZhi === luZhi) return { name:'建禄格', ge:'建禄', cheng:'旺气当令，喜财官食伤流通', breaker:'再见比劫帮身', note:'月令为日主临官禄地' };
    const renZhi = { 0:3, 2:6, 4:6, 6:9, 8:0 }[dGan]; /* 五阳干刃支 */
    if (renZhi !== undefined && monthZhi === renZhi) return { name:'羊刃格', ge:'羊刃', cheng:'羊刃驾杀 / 食伤泄秀为佳', breaker:'无杀制刃则刚极易折', note:'月令为日主帝旺刃地' };
    /* 八正格：月支藏干透干优先 */
    for (const c of cang){
      for (let k = 0; k < 4; k++){
        if (k === 2) continue; /* 日干是日主本身 */
        if (ganzhi[k] === c.ch){
          const ss = shiShen(dGan, GAN.indexOf(c.ch));
          const geName = ss.replace('比肩','建禄').replace('劫财','羊刃') + '格';
          return { name: geName, ge: ss, cang: c.ch,
            cheng: `${ss}透干有力；${ss === '伤官' ? '配印制伤' : ss === '七杀' ? '食神制杀或杀印相生' : ss === '食神' ? '食神生财' : ss === '正官' ? '官印相生' : (ss === '偏财' || ss === '正财') ? '食伤生财或财旺生官' : '印绶护身、行财运发'}则格成`,
            breaker: `${ss === '正官' ? '伤官见官' : ss === '食神' ? '枭神夺食' : ss === '七杀' ? '财生杀攻身无制' : (ss === '偏财' || ss === '正财') ? '比劫争财' : ss.includes('印') ? '财坏印' : '忌神冲克'}则破格`,
            note: `月支${ZHI[monthZhi]}藏${c.ch}透于${['年','月','日','时'][k]}干` };
        }
      }
    }
    /* 无透：以本气取格 */
    const ben = cang[0].ch;
    const ss = shiShen(dGan, GAN.indexOf(ben));
    return { name: ss + '格（不透）', ge: ss, cang: ben,
      cheng: '本气当令，虽不透干仍有力',
      breaker: '被冲被合则月令之力受损', note: `月支${ZHI[monthZhi]}本气${ben}不透，以本气论格（力减）` };
  }

  /* 调候查表（M02）：节气月支（寅=2 … 丑=1）转 0 起月序 */
  function tiaoHouOf(dayGan, monthZhi){
    const mIdx = ((monthZhi - 2) + 12) % 12;
    const chars = TIAOHOU[dayGan][mIdx].split('');
    return { yong: chars, month: ZHI[monthZhi] + '月', text: `${ZHI[monthZhi]}月${GAN[dayGan]}日生，调候用神取「${chars.join('、')}」` };
  }

  /* 旺衰三得法量化（M08） */
  function sanDe(pan){
    const dGan = pan.dayGan;
    const myWx = GAN_WUXING[dGan];
    /* 得令：月支是否为日干的长生/临官/帝旺/墓？标准得令=月支本气生或同日干 */
    const monthWx = ZHI_WUXING[pan.pillars[1].zhi];
    const yinWx = { '木':'水','火':'木','土':'火','金':'土','水':'金' }[myWx];
    const deLing = (monthWx === myWx || monthWx === yinWx);
    /* 得地：日干在其他三支有本气根 */
    const benGen = [0,0,0,0];
    pan.pillars.forEach((p, i) => { const c = ZHI_CANG[p.zhi]; if (c.main && GAN.indexOf(c.main) === dGan) benGen[i] = 1; });
    const deDi = benGen.filter((v, i) => i !== 1).some(v => v) + (benGen[1] ? 1 : 0) > 0;
    /* 得势：天干比劫/印数量（除日干） */
    let bang = 0;
    pan.pillars.forEach((p, i) => { if (i !== 2){ const w = GAN_WUXING[p.gan]; if (w === myWx || w === yinWx) bang++; } });
    const deShi = bang >= 2;
    return { deLing, deDi, deShi, score: (deLing ? 0.4 : 0.1) + (deDi ? 0.35 : 0.1) + (deShi ? 0.25 : 0.08),
      label: (deLing && deDi) ? '偏强' : (!deLing && !deDi) ? '偏弱' : '中和' };
  }

  /* 盲派串宫压运（M21）：命宫起十二宫逆行，太岁压宫 */
  const PALACES = ['命宫','兄弟宫','夫妻宫','子女宫','财帛宫','疾厄宫','迁移宫','交友宫','官禄宫','田宅宫','福德宫','父母宫'];
  function chuanGong(mingZhi, yearZhi){
    /* 传统排法：从命宫起，逆时针布十二宫（命→兄弟→夫妻…） */
    const idx = (((mingZhi - yearZhi) % 12) + 12) % 12;
    const palace = PALACES[idx];
    const themes = {
      '命宫':'自身、总体状态、身体主轴', '兄弟宫':'兄弟朋友、合作、同辈',
      '夫妻宫':'婚姻感情、配偶状态', '子女宫':'子女、晚辈、创作成果',
      '财帛宫':'财务、现金流、进财破财', '疾厄宫':'健康、情绪、身体隐患',
      '迁移宫':'外出、变动、搬迁、远行', '交友宫':'人际、下属、人脉消耗',
      '官禄宫':'事业、职位、升迁压力', '田宅宫':'房产、家宅、根基变动',
      '福德宫':'心态、享受、精神状态', '父母宫':'父母长辈、文书、上司'
    };
    return { palace, theme: themes[palace], note: `流年${ZHI[yearZhi]}压${palace}（盲派串宫）` };
  }

  /* ---- 多流派并列推演（M01-M24 综合） ---- */
  function multiTuiYan(pan, targetYear){
    const dayGan = pan.dayGan;
    const yearG = ((targetYear - 4) % 10 + 10) % 10, yearZ = ((targetYear - 4) % 12 + 12) % 12;
    const natal = pan.pillars.map(p => p.zhi);
    const names = ['年','月','日','时'];
    const cards = [];
    let score = 0;

    /* 1. 正格法（M01 扶抑 + M03 格局） */
    const isYong = (g) => {
      const ss = shiShen(dayGan, g);
      return pan.strengthLabel === '偏弱' ? (ss.includes('印') || ss === '比肩' || ss === '劫财')
        : (ss === '食神' || ss === '伤官' || ss.includes('财') || ss === '正官' || ss === '七杀');
    };
    const ganHelp = isYong(yearG);
    const zhiWx = ZHI_WUXING[yearZ];
    const myWx = GAN_WUXING[dayGan];
    const yinWx = { '木':'水','火':'木','土':'火','金':'土','水':'金' }[myWx];
    const zhiHelp = pan.strengthLabel === '偏弱' ? (zhiWx === myWx || zhiWx === yinWx) : (zhiWx !== myWx && zhiWx !== yinWx);
    const ssYear = shiShen(dayGan, yearG);
    score += (ganHelp ? 1 : -1) + (zhiHelp ? 1 : -1);
    cards.push({ school:'扶抑用神法', title:`流年干${GAN[yearG]}（${ssYear}）· 流年支${ZHI[yearZ]}（${zhiWx}）`,
      points:[ `日主${pan.strengthLabel}，${pan.strengthLabel === '偏弱' ? '喜印比帮扶' : '喜克泄耗'}`,
        `流年天干${ganHelp ? '为用神方向（帮扶用神）→ 天干层面吉' : '为忌神方向（助忌）→ 天干层面受制'}`,
        `流年地支${zhiHelp ? '为用神方向 → 地基层面得力' : '为忌神方向 → 地基层面受阻'}` ] });

    /* 2. 调候法（M02） */
    const th = pan.tiaoHou;
    const thYongGan = th.yong[0];
    const thYongWx = GAN_WUXING[GAN.indexOf(thYongGan)];
    const thHitG = GAN_WUXING[yearG] === thYongWx;
    const thHitZ = ZHI_WUXING[yearZ] === thYongWx;
    const thGood = thHitG || thHitZ;
    score += thGood ? 1 : 0;
    cards.push({ school:'调候用神法', title:`本命调候喜「${th.yong.join('、')}」（${th.month}）`,
      points:[ `调候为命局之药：${th.yong.join('、')}到位则全局舒展`,
        thHitG ? `流年干${GAN[yearG]}正合调候之${thYongWx} → 药到位` : `流年干${GAN[yearG]}（${GAN_WUXING[yearG]}）非调候正用`,
        thHitZ ? `流年支${ZHI[yearZ]}（${zhiWx}）合调候 → 应期成立` : `流年支${ZHI[yearZ]}（${zhiWx}）不合调候`,
        thGood ? '→ 调候层面利好（该年"顺"的成分重）' : '→ 调候层面平（既不助力也不拆台）' ] });

    /* 3. 关系引动法（M09 + M18） */
    const relPts = [];
    let chong = 0, he = 0;
    for (let i = 0; i < 4; i++){
      const rs = relOf(yearZ, natal[i]);
      if (rs) for (const r of rs){
        relPts.push(`${r.desc}（动${names[i]}柱 / ${['祖上·幼年','父母·青年','自身配偶·中年','子女·晚年'][i]}宫）`);
        if (r.type === '六冲'){ score -= 1.5; chong++; }
        if (r.type === '六合' || r.type === '三合'){ score += 1; he++; }
        if (r.type === '相刑'){ score -= 0.5; }
        if (r.type === '六害'){ score -= 0.5; }
      }
    }
    if (!relPts.length) relPts.push('流年支与命局四支无明显刑冲合害 → 平稳之年（引动弱）');
    else relPts.push(`合 ${he} 处 / 冲 ${chong} 处 → ${chong > he ? '动荡为主（防变动）' : he > chong ? '合动为主（主合作、结合）' : '引动均衡'}`);
    cards.push({ school:'关系引动法', title:`${ZHI[yearZ]}支与四柱关系（${relPts.length > 1 ? '有引动' : '无引动'}）`, points: relPts });

    /* 4. 宫位六亲法（M11 + M12） */
    const gongPts = [];
    for (let i = 0; i < 4; i++){
      const rs = relOf(yearZ, natal[i]);
      if (rs && rs.some(r => r.type === '六冲')) gongPts.push(`${names[i]}柱被冲 → ${['祖上/长辈事务、幼年环境', '父母/工作环境、住所变动', '自身与配偶：婚姻感情信号、身体', '子女/晚辈、外出与成果'][i]}`);
      if (rs && rs.some(r => r.type === '六合' || r.type === '三合')) gongPts.push(`${names[i]}柱被合 → ${['祖辈/家族事务被牵动（喜）', '父母助力或环境资源结合', '婚恋结合信号（合入夫妻宫）', '子女/成果层面喜合'][i]}`);
    }
    cards.push({ school:'宫位六亲法', title: gongPts.length ? '被引动宫位' : '宫位平静', points: gongPts.length ? gongPts : ['无宫位被冲合 → 六亲层面平稳年份'] });

    /* 5. 盲派串宫压运（M21） */
    const cg = chuanGong(pan.mingGong.zhi, yearZ);
    cards.push({ school:'盲派串宫压运', title: `太岁压${cg.palace}`,
      points:[ cg.note, `该年主题：${cg.theme}`, '（盲派视角，供交叉验证；宫位起法各派略有差异）' ] });

    /* 6. 病药与应期（M05 + M19） */
    const yaoHit = ganHelp && zhiHelp;
    const fuyin = natal.some(z => z === yearZ);
    const yaoPts = [];
    if (yaoHit) yaoPts.push('流年干支双合用神 → 病得药，该年为"药到"之年，转折/成事概率高');
    else if (ganHelp || zhiHelp) yaoPts.push('流年干或支一边合用神 → 半药：事件有望但过程反复');
    else yaoPts.push('流年干支均不合用神 → 药未到，该年宜守不宜攻');
    if (fuyin) yaoPts.push(`流年与命局伏吟（${ZHI[yearZ]}重复出现）→ 同主题事件重复/加重，情绪面易反复`);
    cards.push({ school:'病药应期法', title: yaoHit ? '药到应期（强信号）' : (ganHelp || zhiHelp ? '半药之年（中信号）' : '守成年（弱信号）'), points: yaoPts });

    /* 7. 神煞流年（M14） */
    const ss = [];
    for (const z of natal){
      if (SHENSHA_BY_SANHE.taohua[natal[0]] === yearZ || SHENSHA_BY_SANHE.taohua[natal[2]] === yearZ) ss.push('桃花入命年：感情/人际引动');
      if (SHENSHA_BY_SANHE.luoma[natal[0]] === yearZ || SHENSHA_BY_SANHE.luoma[natal[2]] === yearZ) ss.push('驿马入命年：迁移/出行/换环境引动');
      if (SHENSHA_BY_SANHE.huagai[natal[0]] === yearZ || SHENSHA_BY_SANHE.huagai[natal[2]] === yearZ) ss.push('华盖入命年：学业/艺术/宗教倾向引动');
      if (SHENSHA_BY_SANHE.jiangxing[natal[0]] === yearZ || SHENSHA_BY_SANHE.jiangxing[natal[2]] === yearZ) ss.push('将星入命年：权责/管理事务引动');
    }
    if ((yearZ + 6) % 12 === natal[0]) ss.push('冲太岁之年：长辈/自身根基变动，宜守');
    cards.push({ school:'神煞流年法', title: ss.length ? '引动神煞' : '神煞层面平', points: ss.length ? Array.from(new Set(ss)) : ['无桃花/驿马/华盖/将星直接入命 → 神煞辅助判断平'] });

    const label = score >= 3 ? '多法共振·吉（强信号）' : score >= 1 ? '偏吉（中信号）' : score >= -1 ? '平（信号混杂）' : score >= -3 ? '偏凶（中信号）' : '多法共振·凶（强信号）';
    return { year: targetYear, gz: GAN[yearG] + ZHI[yearZ], score: Math.round(score * 10) / 10, label, cards };
  }

  function cangOf(zhi){
    const c = ZHI_CANG[zhi];
    const out = [];
    if (c.main) out.push({ ch: c.main, w: CANG_WEIGHT.main });
    if (c.mid) out.push({ ch: c.mid, w: CANG_WEIGHT.mid });
    if (c.side) out.push({ ch: c.side, w: CANG_WEIGHT.side });
    return out;
  }

  /* 神煞查找 */
  function findShenSha(yearGan, dayGan, zhiArr){
    const out = [];
    const push = (name, zhi) => out.push({ name, at: ZHI[zhi] });
    for (const z of zhiArr){
      if ((SHENSHA.tianyi.map[dayGan] || []).includes(z)) push('天乙贵人', z);
      if ((SHENSHA.wenchang.map[dayGan] || []).includes(z)) push('文昌', z);
      if ((SHENSHA.yangren.map[dayGan] || []).includes(z)) push('羊刃', z);
      if ((SHENSHA.tianyi.map[yearGan] || []).includes(z)) push('天乙贵人(年)', z);
      if ((SHENSHA_BY_SANHE.taohua[zhiArr[0]] === z) || (SHENSHA_BY_SANHE.taohua[zhiArr[2]] === z)) push('桃花', z);
      if ((SHENSHA_BY_SANHE.luoma[zhiArr[0]] === z) || (SHENSHA_BY_SANHE.luoma[zhiArr[2]] === z)) push('驿马', z);
      if ((SHENSHA_BY_SANHE.huagai[zhiArr[0]] === z) || (SHENSHA_BY_SANHE.huagai[zhiArr[2]] === z)) push('华盖', z);
      if ((SHENSHA_BY_SANHE.jiangxing[zhiArr[0]] === z) || (SHENSHA_BY_SANHE.jiangxing[zhiArr[2]] === z)) push('将星', z);
      if (GUCHEN[zhiArr[0]] && GUCHEN[zhiArr[0]][0] === z) push('孤辰', z);
      if (GUCHEN[zhiArr[0]] && GUCHEN[zhiArr[0]][1] === z) push('寡宿', z);
    }
    /* 去重合并：同名神煞（如年支起、日支起各有一处）合并为一枚，多支用「/」并列 */
    const map = new Map();
    for (const x of out){
      if (!map.has(x.name)) map.set(x.name, []);
      const arr = map.get(x.name);
      if (!arr.includes(x.at)) arr.push(x.at);
    }
    return [...map.entries()].map(([name, ats]) => ({ name, at: ats.join('/') }));
  }

  /* 大运计算 */
  function calcDaYun(dayGan, mp, jdLocal, gender, yearGan){
    const yangYear = (yearGan % 2 === 0); /* 年干阳 */
    const forward = (gender === '男') ? yangYear : !yangYear; /* 阳男阴女顺行 */
    /* 顺行：到下一个节；逆行：到上一个节 */
    let targetJd;
    if (forward){
      /* 找 jdLocal 之后的最近节气（12"节"之一） */
      let best = null;
      for (let yy = mp.ganzhiYear; yy <= mp.ganzhiYear + 1; yy++){
        for (const j of JIE_MONTH){
          const jd = A.solarTermJD(yy, j.longitude);
          if (jd > jdLocal && (!best || jd < best)) best = jd;
        }
      }
      targetJd = best;
    } else {
      targetJd = mp.jieJd; /* 当前月柱的起始节 */
    }
    const days = Math.abs(targetJd - jdLocal);
    const years = days / 3;
    const y1 = Math.floor(years);
    const r1 = years - y1;
    const months = Math.floor(r1 * 12);
    const days2 = Math.floor((r1 * 12 - months) * 30);
    /* 大运干支 */
    const mIdx = gzIndexOf(mp.gan, mp.zhi);
    const list = [];
    for (let i = 1; i <= 10; i++){
      const idx = forward ? mIdx + i : mIdx - i;
      const n = ((idx % 60) + 60) % 60;
      list.push({ startAge: y1 + (i - 1) * 10, gz: JIAZI[n], gan: n % 10, zhi: n % 12, shiShen: shiShen(dayGan, n % 10) });
    }
    return { forward, years, y1, months, days2, list };
  }

  /* ---- 推演：大运/流年与命局的刑冲合害 ---- */
  function tuiYan(pan, targetYear){
    /* 返回该流年与命局的交互 */
    const dayGan = pan.dayGan;
    const yearG = ((targetYear - 4) % 10 + 10) % 10, yearZ = ((targetYear - 4) % 12 + 12) % 12;
    const natal = pan.pillars.map(p => p.zhi);
    const events = [];
    /* 流年支与命局四支的关系 */
    for (let i = 0; i < 4; i++){
      const nz = natal[i];
      const pillarName = ['年','月','日','时'][i];
      if ((yearZ + 6) % 12 === nz) events.push({ type:'冲', target: pillarName + '支', detail: `流年${ZHI[yearZ]}冲${pillarName}支${ZHI[nz]}`, level: 3 });
      if (LIUHE[yearZ] === nz) events.push({ type:'合', target: pillarName + '支', detail: `流年${ZHI[yearZ]}合${pillarName}支${ZHI[nz]}`, level: 1 });
      if (HAI[yearZ] === nz) events.push({ type:'害', target: pillarName + '支', detail: `流年${ZHI[yearZ]}害${pillarName}支${ZHI[nz]}`, level: 2 });
      for (const grp of SANHE) {
        if (grp.includes(yearZ) && grp.includes(nz)) events.push({ type:'三合', target: pillarName + '支', detail: `流年${ZHI[yearZ]}与${pillarName}支${ZHI[nz]}半三合`, level: 1 });
      }
    }
    /* 流年天干十神 */
    events.push({ type:'十神', target:'流年干', detail: `流年天干${GAN[yearG]}，十神为${shiShen(dayGan, yearG)}，主${SHISHEN_DESC[shiShen(dayGan, yearG)]}`, level: 0 });
    /* 大运匹配：流年年龄落在哪一步大运 */
    const age = targetYear - pan.ymd.year;
    const dy = pan.dayun.list.find(d => age >= d.startAge && age < d.startAge + 10);
    if (dy) events.push({ type:'大运', target:'大运', detail: `行${dy.gz}大运（${dy.startAge}岁起），十神${dy.shiShen}`, level: 0 });
    events.sort((a, b) => b.level - a.level);
    return { year: targetYear, gz: GAN[yearG] + ZHI[yearZ], events };
  }
  function SHISHEN_DESC_MAP(){ return SHISHEN_DESC; }

  /* 时辰区间名 */
  const SHICHEN = ['子时 23:00-00:59','丑时 01:00-02:59','寅时 03:00-04:59','卯时 05:00-06:59','辰时 07:00-08:59','巳时 09:00-10:59','午时 11:00-12:59','未时 13:00-14:59','申时 15:00-16:59','酉时 17:00-18:59','戌时 19:00-20:59','亥时 21:00-22:59'];

  return { paiPan, tuiYan, multiTuiYan, monthPillar, SHICHEN, JIE_MONTH,
    /* 多流派推演组件（供 UI / 方法库调用） */
    relOf, allRelations, kongWangOf, mingGongOf, taiYuanOf, xiaoYunOf,
    geJu, tiaoHouOf, sanDe, chuanGong, PALACES, TIAOHOU };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { BAZI };
