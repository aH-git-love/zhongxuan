/* ============================================================
 * 中玄 · 推演台 —— 思维逻辑训练（后台题库引擎）
 * 数列 / 干支 / 十神 / 三段论 / 真假话 / 生克 / 大运 / 类比 / 排序 / 矩阵
 * 含错题本与统计（localStorage 持久化）
 * 依赖：core.js, bazi.js
 * ============================================================ */

const TRAINER = (function(){
  const C = (typeof require !== 'undefined' ? require('./core.js') : CORE);
  const B = (typeof require !== 'undefined' ? require('./bazi.js').BAZI : BAZI);
  const { GAN, ZHI, SHENGXIAO, GAN_WUXING, WUXING_SHENG, WUXING_KE, JIAZI, shiShen } = C;

  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const WXS = ['木','火','土','金','水'];

  function opts4(correct, wrongs){
    const set = [correct, ...wrongs.filter(w => w !== correct)].slice(0, 4);
    while (set.length < 4){
      let w = correct + String.fromCharCode(65 + rnd(26)) + rnd(100);
      let dup = true, guard = 0;
      while (dup && guard++ < 50){ w = correct + '·' + rnd(999); dup = set.includes(w); }
      set.push(w);
    }
    const mixed = shuffle(set);
    return { options: mixed, answer: mixed.indexOf(correct) };
  }

  /* ---------- 1. 数列推理 ---------- */
  function genSequence(){
    const kind = rnd(5);
    let seq = [], q = '', a = '', explain = '';
    if (kind === 0){
      const d = pick([2,3,4,5,6,7,8,9,-3,-4,-5]), s = 1 + rnd(20);
      for (let i = 0; i < 5; i++) seq.push(s + i * d);
      q = '等差'; a = String(seq[4] + d); explain = `公差为 ${d}，下一项 = ${seq[4]} + ${d} = ${a}`;
    } else if (kind === 1){
      const r = pick([2,3]), s = 1 + rnd(4);
      for (let i = 0; i < 5; i++) seq.push(s * Math.pow(r, i));
      q = '等比'; a = String(seq[4] * r); explain = `公比为 ${r}，下一项 = ${seq[4]} × ${r} = ${a}`;
    } else if (kind === 2){
      const s = 1 + rnd(6);
      for (let i = 0; i < 5; i++) seq.push((s + i) * (s + i));
      const n = s + 5; a = String(n * n); explain = `第 n 项是完全平方数：依次是 ${s}², ${s+1}², ${s+2}²… 下一项 = ${n}² = ${a}`;
      q = '平方';
    } else if (kind === 3){
      let x = 1 + rnd(4), y = x + 1 + rnd(4);
      seq = [x, y];
      for (let i = 0; i < 3; i++){ const z = x + y; seq.push(z); x = y; y = z; }
      a = String(seq[3] + seq[4]); explain = `斐波那契式递推：a(n)=a(n-1)+a(n-2)，下一项 = ${seq[4]} + ${seq[3]} = ${a}`;
      q = '递推';
    } else {
      const d = 2 + rnd(6);
      seq = [];
      for (let i = 0; i < 3; i++){ seq.push(2 + i * 2); seq.push(10 + i * d); }
      seq = seq.slice(0, 5);
      a = String(10 + 2 * d); explain = `双数列交替：奇数位 2,4,6…；偶数位 10,${10+d},${10+2*d}… 下一项 = ${a}`;
      q = '交替';
    }
    const wrongs = [String(Number(a) + 1 + rnd(4)), String(Number(a) - 1 - rnd(4)), String(Number(a) + pick([10,-10,5,-5]))].map(String);
    const o = opts4(a, wrongs);
    return { type:'数列推理', level: 1 + (kind >= 3 ? 1 : 0),
      question: `【${q}】找出下一项：${seq.join(', ')} , ?`, options: o.options, answer: o.answer, explain };
  }

  /* ---------- 2. 干支速算 ---------- */
  function genGanZhi(){
    const kind = rnd(3);
    if (kind === 0){
      const year = 1900 + rnd(220);
      const g = ((year - 4) % 10 + 10) % 10, z = ((year - 4) % 12 + 12) % 12;
      const ans = GAN[g] + ZHI[z];
      const wrongs = shuffle(JIAZI.filter(x => x !== ans)).slice(0, 3);
      const o = opts4(ans, wrongs);
      return { type:'干支速算', level: 2, question: `公历 ${year} 年（已过立春）的年柱干支是？`,
        options: o.options, answer: o.answer,
        explain: `${year} - 4 = ${year - 4}；(${year - 4}) mod 10 = ${((year-4)%10+10)%10} → 天干${GAN[g]}；(${year - 4}) mod 12 = ${((year-4)%12+12)%12} → 地支${ZHI[z]}，即 ${ans} 年（生肖：${SHENGXIAO[z]}）` };
    } else if (kind === 1){
      const i = rnd(58);
      const ans = JIAZI[i + 1];
      const wrongs = shuffle(JIAZI.filter(x => x !== ans)).slice(0, 3);
      const o = opts4(ans, wrongs);
      return { type:'干支速算', level: 1, question: `六十甲子顺排：${JIAZI[i]} 的下一柱是？`,
        options: o.options, answer: o.answer,
        explain: `六十甲子干支各自独立循环，${JIAZI[i]} 之后是 ${ans}（天干进一、地支进一）` };
    } else {
      const z = rnd(12);
      const ans = SHENGXIAO[z];
      const wrongs = shuffle(SHENGXIAO.filter(x => x !== ans)).slice(0, 3);
      const o = opts4(ans, wrongs);
      return { type:'干支速算', level: 1, question: `地支「${ZHI[z]}」对应的生肖是？`,
        options: o.options, answer: o.answer, explain: `子鼠 丑牛 寅虎 卯兔 辰龙 巳蛇 午马 未羊 申猴 酉鸡 戌狗 亥猪 → ${ZHI[z]} 为${ans}` };
    }
  }

  /* ---------- 3. 十神判定 ---------- */
  function genShiShen(){
    const dg = rnd(10), og = rnd(10);
    const ans = shiShen(dg, og);
    const wrongs = shuffle(['比肩','劫财','食神','伤官','偏财','正财','七杀','正官','偏印','正印'].filter(x => x !== ans)).slice(0, 3);
    const o = opts4(ans, wrongs);
    return { type:'十神判定', level: 2,
      question: `日主为「${GAN[dg]}」，见「${GAN[og]}」，十神是？`,
      options: o.options, answer: o.answer,
      explain: `日主${GAN[dg]}属${GAN_WUXING[dg]}，${GAN[og]}属${GAN_WUXING[og]}；${relText(GAN_WUXING[dg], GAN_WUXING[og])}；阴阳${dg % 2 === og % 2 ? '相同' : '不同'} → ${ans}` };
  }
  function relText(a, b){
    if (a === b) return '二者同五行';
    if (WUXING_SHENG[a] === b) return `${a}生${b}（我生它）`;
    if (WUXING_SHENG[b] === a) return `${b}生${a}（生我）`;
    if (WUXING_KE[a] === b) return `${a}克${b}（我克它）`;
    return `${b}克${a}（克我）`;
  }

  /* ---------- 4. 五行生克 ---------- */
  function genWuXing(){
    const mode = rnd(2);
    if (mode === 0){
      const a = pick(WXS), b = WUXING_SHENG[a];
      const wrongs = shuffle(WXS.filter(x => x !== b)).slice(0, 3);
      const o = opts4(b, wrongs);
      return { type:'五行生克', level: 1, question: `五行之中，「${a}」所生的是？`,
        options: o.options, answer: o.answer, explain: `相生：木生火、火生土、土生金、金生水、水生木 → ${a}生${b}` };
    } else {
      const a = pick(WXS), b = WUXING_KE[a];
      const wrongs = shuffle(WXS.filter(x => x !== b)).slice(0, 3);
      const o = opts4(b, wrongs);
      return { type:'五行生克', level: 1, question: `五行之中，「${a}」所克的是？`,
        options: o.options, answer: o.answer, explain: `相克：木克土、土克水、水克火、火克金、金克木 → ${a}克${b}` };
    }
  }

  /* ---------- 5. 三段论 ---------- */
  const SYLLOGISMS = [
    { p:['所有甲都是乙','所有乙都是丙'], q:'所有甲都是丙', w:['有的甲不是丙','所有丙都是甲','所有甲都不是丙'] },
    { p:['所有甲都是乙','所有乙都不是丙'], q:'所有甲都不是丙', w:['所有甲都是丙','有的甲是丙','所有丙都是甲'] },
    { p:['有的甲是乙','所有乙都是丙'], q:'有的甲是丙', w:['所有甲都是丙','所有甲都不是丙','有的丙不是甲'] },
    { p:['所有甲都不是乙','所有丙都是乙'], q:'所有甲都不是丙', w:['所有甲都是丙','有的甲是丙','有的乙不是丙'] },
    { p:['所有甲都是乙','有的乙是丙'], q:'无法必然推出任何关于全部甲与丙的结论', w:['所有甲都是丙','所有甲都不是丙','有的甲必然是丙'] },
    { p:['没有甲是乙','没有乙是丙'], q:'无法必然推出任何关于甲与丙的结论', w:['没有甲是丙','所有甲都是丙','有的甲是丙'] }
  ];
  function genSyllogism(){
    const s = pick(SYLLOGISMS);
    const names = shuffle(['甲','乙','丙','丁']).slice(0, 3);
    const map = { '甲': names[0], '乙': names[1], '丙': names[2] };
    const rep = t => t.replace(/甲|乙|丙/g, ch => map[ch]);
    const q = rep(s.q);
    const o = opts4(q, s.w.map(rep));
    return { type:'三段论', level: 2, question: `前提一：${rep(s.p[0])}。前提二：${rep(s.p[1])}。以下哪项必然成立？`,
      options: o.options, answer: o.answer, explain: '三段论：中项在两个前提中至少周延一次；两个否定前提推不出结论；前提有一否定则结论否定。逐项代入即可验证。' };
  }

  /* ---------- 6. 真假话推理 ---------- */
  function genTruthTeller(){
    const which = rnd(3);
    if (which === 0){
      const o = opts4('丙', ['甲','乙','无法确定']);
      return { type:'真假话推理', level: 2,
        question: `甲、乙、丙三人中恰有一人打碎了花瓶。甲说：是乙打碎的。乙说：不是我打碎的。丙说：不是我打碎的。已知三人中恰好一人说真话。花瓶是谁打碎的？`,
        options: o.options, answer: o.answer,
        explain: '假设法：若乙打碎 → 甲真、乙假、丙真，两人真话，矛盾；若甲打碎 → 甲假、乙真、丙真，两人真话，矛盾；若丙打碎 → 甲假、乙假、丙真，恰一人真话 ✓。答案：丙。' };
    } else if (which === 1){
      const o = opts4('乙', ['甲','丙','无法确定']);
      return { type:'真假话推理', level: 2,
        question: `甲、乙、丙三人中恰有一人拿了钱。甲说：是丙拿的。乙说：不是我拿的。丙说：甲说的不对。已知三人中恰好一人说真话。钱是谁拿的？`,
        options: o.options, answer: o.answer,
        explain: '假设法：若甲拿 → 甲假（不是丙）、乙真（不是乙）、丙真（甲说的不对），两人真话，矛盾；若乙拿 → 甲假、乙假（其实没拿？乙说"不是我拿的"为假即乙拿了）、丙真，恰一人真话 ✓；若丙拿 → 甲真、乙真、丙假，两人真话，矛盾。答案：乙。' };
    } else {
      const o = opts4('乙', ['甲','丙','丁']);
      return { type:'真假话推理', level: 3,
        question: `骑士只说真话，骗子只说假话。甲说：我们三人都是骗子。乙说：我们中恰有两人是骗子。丙说：乙是骗子。三人中谁是骑士？`,
        options: o.options, answer: o.answer,
        explain: '①甲必是骗子：若甲是骑士，说"我们三人都是骗子"就自相矛盾。②设乙是骗子：若丙是骑士，则骗子为甲乙两人，乙说"恰有两人是骗子"反而成了真话，矛盾；若丙也是骗子，则三人皆骗子，甲的话变成真话，也矛盾。③所以乙是骑士：乙说"恰有两人是骗子"为真 → 甲、丙是骗子；丙（骗子）说"乙是骗子"确为假话 ✓，甲（骗子）说"三人都是骗子"也确为假话（乙是骑士）✓，全链自洽。答案：乙。' };
    }
  }

  /* ---------- 7. 大运推步 ---------- */
  function genDaYun(){
    const i = 1 + rnd(56);
    const forward = rnd(2) === 0;
    const step1 = JIAZI[forward ? i + 1 : i - 1];
    const wrongs = shuffle(JIAZI.filter(x => x !== step1)).slice(0, 3);
    const o = opts4(step1, wrongs);
    return { type:'大运推步', level: 2,
      question: `月柱为「${JIAZI[i]}」，大运${forward ? '顺' : '逆'}排。第一步大运是？`,
      options: o.options, answer: o.answer,
      explain: `大运从月柱起排：顺行取下一柱 ${JIAZI[(i + 1) % 60]}，逆行取上一柱 ${JIAZI[(i + 59) % 60]}。故${forward ? '顺' : '逆'}排第一步为 ${step1}` };
  }

  /* ---------- 8. 类比推理 ---------- */
  function genAnalogy(){
    const mode = rnd(2);
    if (mode === 0){
      const g = rnd(9);
      const ans = GAN[g + 1];
      /* 举例的天干与题干不同，避免出现"辛→壬。按同样规律：辛→？"这类重复 */
      const others = [];
      for (let k = 0; k < 9; k++) if (GAN[k] !== GAN[g]) others.push(GAN[k]); /* 排除癸（无下一位）与题干干 */
      const base = others[rnd(others.length)];
      const wrongs = shuffle(GAN.filter(x => x !== ans)).slice(0, 3);
      const o = opts4(ans, wrongs);
      return { type:'类比推理', level: 1,
        question: `天干顺推：${base} → ${GAN[GAN.indexOf(base) + 1]}。按同样规律：${GAN[g]} → ？`,
        options: o.options, answer: o.answer,
        explain: `天干顺序甲乙丙丁戊己庚辛壬癸，${GAN[g]} 的下一位是 ${ans}` };
    } else {
      const ans = WUXING_SHENG['火'];
      const wrongs = shuffle(WXS.filter(x => x !== ans)).slice(0, 3);
      const o = opts4(ans, wrongs);
      return { type:'类比推理', level: 2, question: `五行相生：木 → 火。按同样规律：火 → ？`,
        options: o.options, answer: o.answer, explain: `相生循环：木生火、火生土、土生金、金生水、水生木，所以火 → ${ans}` };
    }
  }

  /* ---------- 9. 排序推理 ---------- */
  function genOrder(){
    /* A>B>C 传递排序 */
    const names = shuffle(['甲','乙','丙','丁','戊','己']).slice(0, 3);
    const order = shuffle(names); /* order[0] 最高 */
    const s1 = `${order[0]} 比 ${order[1]} 高`, s2 = `${order[1]} 比 ${order[2]} 高`;
    const ans = order[0];
    const o = opts4(ans, names.filter(x => x !== ans));
    return { type:'排序推理', level: 1, question: `已知：${s1}；${s2}。三人中个子最高的是？`,
      options: o.options, answer: o.answer, explain: `传递关系：${order[0]}>${order[1]}>${order[2]}，最高为 ${ans}` };
  }

  /* ---------- 10. 逻辑矩阵 ---------- */
  function genMatrix(){
    const n = 3;
    const nums = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) nums.push(i * n + j + 1);
    const hole = rnd(n * n - 1) + 1;
    const shown = nums.map(x => x === hole ? '？' : x);
    const ans = String(hole);
    const wrongs = shuffle(nums.map(String).filter(x => x !== ans)).slice(0, 3);
    const o = opts4(ans, wrongs);
    return { type:'逻辑矩阵', level: 1,
      question: `方阵规律填空：\n${shown[0]}  ${shown[1]}  ${shown[2]}\n${shown[3]}  ${shown[4]}  ${shown[5]}\n${shown[6]}  ${shown[7]}  ${shown[8]}\n「？」处应填？`,
      options: o.options, answer: o.answer, explain: `3×3 方阵按行从左到右依次为 1~9，行列位置推得 ？ = ${ans}` };
  }

  /* ---------- 11. 推演方式选择（方法库联动） ---------- */
  function genMethodPick(){
    /* 依赖方法库 METHODS；取不到时退化为干支题 */
    const M = (function(){
      try { if (typeof require !== 'undefined' && typeof module !== 'undefined') return require('./methods.js'); } catch (e){}
      return (typeof METHODS !== 'undefined') ? METHODS : null;
    })();
    if (!M || !M.METHODS || !M.METHODS.length) return genGanZhi();
    const all = M.METHODS;
    const m = pick(all);
    /* 干扰项：优先同体系，不够再跨体系补齐 */
    const sameGroup = shuffle(all.filter(x => x.group === m.group && x.id !== m.id)).slice(0, 2);
    const others = shuffle(all.filter(x => x.group !== m.group && x.id !== m.id)).slice(0, 3 - sameGroup.length);
    const wrongs = [...sameGroup, ...others].map(x => x.name);
    const o = opts4(m.name, wrongs);
    return { type: '推演方式', level: 2,
      question: `【情境】${m.when.replace(/[。；]\s*$/, '')}\n该情境最应该用哪种推演方式？`,
      options: o.options, answer: o.answer,
      explain: `${m.id} ${m.name}（${m.group}）：${m.principle}` };
  }

  /* ---------- 塔罗牌义：直接引用本地知识库原文 ---------- */
  function genTarotMeaning(){
    let K=null;
    try{if(typeof require!=='undefined'&&typeof module!=='undefined')K=require('./brain-knowledge.js').BRAIN_KNOWLEDGE}catch(e){}
    if(!K&&typeof BRAIN_KNOWLEDGE!=='undefined')K=BRAIN_KNOWLEDGE;
    return K&&K.genTarotQuiz?K.genTarotQuiz():genMethodPick();
  }

  const GENERATORS = [ genSequence, genGanZhi, genShiShen, genWuXing, genSyllogism,
                      genTruthTeller, genDaYun, genAnalogy, genOrder, genMatrix, genMethodPick, genTarotMeaning ];
  const TYPE_NAMES = ['数列推理','干支速算','十神判定','五行生克','三段论','真假话推理','大运推步','类比推理','排序推理','逻辑矩阵','推演方式','塔罗牌义'];

  function genQuestion(types){
    /* types: 数组（限定题型）或 null（全部） */
    const pool = (types && types.length) ? GENERATORS.filter((g, i) => types.includes(TYPE_NAMES[i])) : GENERATORS;
    return pick(pool)();
  }
  function genRound(n, types){ const arr = []; for (let i = 0; i < n; i++) arr.push(genQuestion(types)); return arr; }

  /* ---------- 统计与错题本（localStorage） ---------- */
  const STORE_KEY = 'zhongxuan_trainer_v1';
  function loadStats(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || defaultStats(); }
    catch (e){ return defaultStats(); }
  }
  function defaultStats(){
    return { total: 0, correct: 0, streak: 0, bestStreak: 0, byType: {}, wrongBook: [], history: [] };
  }
  function saveStats(s){ try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e){} }
  function record(q, chosenIdx, timeMs, stats){
    const s = stats || loadStats();
    const ok = chosenIdx === q.answer;
    s.total++; if (ok){ s.correct++; s.streak++; if (s.streak > s.bestStreak) s.bestStreak = s.streak; }
    else {
      s.streak = 0;
      s.wrongBook.push({ type: q.type, question: q.question, options: q.options, answer: q.answer,
        explain: q.explain, source:q.source||null, at: Date.now() });
      if (s.wrongBook.length > 200) s.wrongBook.shift();
    }
    s.byType[q.type] = s.byType[q.type] || { total: 0, correct: 0 };
    s.byType[q.type].total++; if (ok) s.byType[q.type].correct++;
    const day = new Date().toISOString().slice(0, 10);
    let h = s.history.find(x => x.day === day);
    if (!h){ h = { day, total: 0, correct: 0 }; s.history.push(h); if (s.history.length > 60) s.history.shift(); }
    h.total++; if (ok) h.correct++;
    saveStats(s);
    return { ok, stats: s };
  }
  function clearWrongBook(){ const s = loadStats(); s.wrongBook = []; saveStats(s); return s; }
  function resetStats(){ const s = defaultStats(); saveStats(s); return s; }

  return { genQuestion, genRound, TYPE_NAMES, GENERATORS, loadStats, saveStats, record,
    clearWrongBook, resetStats, defaultStats };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { TRAINER };
