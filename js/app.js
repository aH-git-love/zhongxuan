/* ============================================================
 * 中玄 · 推演台 —— UI 交互层
 * 结构：UI.* 纯渲染函数（返回 HTML，可测试） + init() 事件绑定
 * ============================================================ */
var UI = (function(){
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const WUXING_GAN = ['木','木','火','火','土','土','金','金','水','水'];
  const SX = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  const ZHI_ARR = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const YISHU_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./yishu.js').YISHU
    : YISHU;
  const DANAO3D_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./danao3d.js').DANAO3D
    : DANAO3D;
  const ZIWEI_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./ziwei.js').ZIWEI
    : ZIWEI;
  const XUANKONG_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./xuankong.js').XUANKONG
    : XUANKONG;
  const LIUYAO_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./liuyao.js').LIUYAO
    : LIUYAO;
  const CASE_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./cases.js').CASES_LIB
    : CASES_LIB;
  /* 农历月名 → 数字 */
  const LUNAR_MONTH_N = { 正:1, 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10, 十一:11, 十二:12, 冬:11, 腊:12 };
  const lunarMonthNum = (name) => LUNAR_MONTH_N[String(name).replace('闰','')] || 1;

  /* ============================================================
   * 纯渲染函数（可独立测试）
   * ============================================================ */
  function validYMD(y, m, d){
    if (!y || y < 1 || !m || m < 1 || m > 12 || !d || d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function renderPaipan(pan, input){
    const p = pan.pillars;
    const lunar = pan.lunar;
    const WXS = ['木','火','土','金','水'];
    const wxVals = WXS.map(w => pan.wxCount[w] || 0);
    const wxMax = Math.max.apply(null, wxVals.concat([0.001]));
    const wxBars = WXS.map((w, i) => `
      <div class="wxbar">
        <div class="label"><span>${w}</span><span>${wxVals[i].toFixed(2)}</span></div>
        <div class="track"><div class="fill wx-${w}" style="width:${(wxVals[i] / wxMax * 100).toFixed(0)}%"></div></div>
      </div>`).join('');

    const cell = (x, field) => {
      if (field === '干支') return x.gz;
      if (field === '十神') return x.zhishen;
      if (field === '藏干') return x.cang.map(c => c.ch).join('');
      if (field === '藏干十神') return x.cangShiShen.join('/');
      if (field === '纳音') return x.nayin;
      if (field === '五行') return x.wuxing;
      if (field === '长生') return x.changsheng;
      return '';
    };
    const pillarRow = (field, cls) => `<tr><td class="gz-sub">${field}</td>` +
      p.map(x => `<td class="${cls || ''}">${esc(cell(x, field))}</td>`).join('') + '</tr>';

    const shenTags = pan.shensha.map(s => `<span class="tag gold">${esc(s.name)}@${esc(s.at)}</span>`).join('') || '<span class="tag">无</span>';

    /* 交运年月：出生时刻 + 起运年月日（精确到月，供「起始年」列展示） */
    const birthDate = new Date(Date.UTC(pan.ymd.year, pan.ymd.month - 1, pan.ymd.day));
    birthDate.setUTCFullYear(birthDate.getUTCFullYear() + pan.dayun.y1);
    birthDate.setUTCMonth(birthDate.getUTCMonth() + pan.dayun.months);
    birthDate.setUTCDate(birthDate.getUTCDate() + pan.dayun.days2);
    const jy0 = birthDate.getUTCFullYear(), jm0 = birthDate.getUTCMonth() + 1;

    const firstAge = pan.dayun.list[0].startAge;
    const dayunRows = pan.dayun.list.map(dy => {
      const ageRange = `${dy.startAge}-${dy.startAge + 9}岁`;
      const step = Math.round((dy.startAge - firstAge) / 10); /* 每步大运 10 年 */
      const jy = jy0 + step * 10;
      return `<tr><td>${ageRange}</td><td class="gz">${esc(dy.gz)}</td><td>${esc(dy.shiShen)}</td><td style="font-size:13px">${jy}-${pad2(jm0)}<br><span style="color:var(--dim);font-size:12px">起运 ${dy.startAge} 岁</span></td></tr>`;
    }).join('');

    const lnRows = pan.liunian.map(ln => {
      const events = BAZI.tuiYan(pan, ln.year).events.filter(e => e.level > 0).map(e => esc(e.detail));
      const evtTags = events.length ? events.map(e => `<span class="tag">${e}</span>`).join(' ') : '<span style="color:var(--dim)">无显著冲合</span>';
      return `<tr><td>${ln.year}</td><td class="gz">${esc(ln.gz)}</td><td>${esc(ln.shiShen)}</td><td style="text-align:left">${evtTags}</td></tr>`;
    }).join('');

    const yongText = [pan.yongShen.印, pan.yongShen.比, pan.yongShen.克, pan.yongShen.泄, pan.yongShen.耗].filter(Boolean).join('、') || '中和局';

    /* ---- 多流派扩展卡：格局 / 调候 / 空亡 / 命宫胎元 / 小运 / 原局关系 ---- */
    const geju = pan.geju;
    const relRows = (pan.relations || []).map(r => `
      <div class="kv"><span>${esc(r.pillars)}</span><b style="text-align:right;max-width:70%">${esc(r.relations.map(x => x.desc).join('、'))}</b></div>`).join('') || '<div class="kv"><span>关系</span><b>无明显刑冲合害</b></div>';
    const xiaoYunTags = (pan.xiaoYun || []).slice(0, 8).map(x => `<span class="tag">${x.age}岁 ${esc(x.gz)}</span>`).join('');

    return `
      <div class="panel">
        <h2>命例 · ${esc(input.name || '未命名')}</h2>
        <div class="grid2">
          <div class="card">
            <h3>基本信息</h3>
            <div class="kv"><span>公历</span><b>${pan.ymd.year}-${pad2(pan.ymd.month)}-${pad2(pan.ymd.day)} ${pad2(input.hour)}:${pad2(input.minute)}</b></div>
            <div class="kv"><span>农历</span><b>${lunar ? lunar.lunarYear + ' 年 ' + (lunar.isLeap ? '闰' : '') + lunar.month + ' 月 ' + lunar.day + ' 日' : '—'}</b></div>
            <div class="kv"><span>生肖</span><b>${SX[p[0].zhi]}</b></div>
            <div class="kv"><span>日主</span><b>${esc(p[2].gz.slice(0, 1))}（${WUXING_GAN[p[2].gan]}）</b></div>
            <div class="kv"><span>日主旺衰</span><b>${pan.strengthLabel}（同党占比 ${(pan.strength * 100).toFixed(0)}%）</b></div>
            <div class="kv"><span>三得法（滴天髓）</span><b>${pan.sanDe.deLing ? '得令' : '失令'} · ${pan.sanDe.deDi ? '得地' : '失地'} · ${pan.sanDe.deShi ? '得势' : '失势'} → ${pan.sanDe.label}</b></div>
            <div class="kv"><span>喜用神（简化）</span><b>${esc(yongText)}</b></div>
          </div>
          <div class="card">
            <h3>五行分布（含藏干加权）</h3>
            ${wxBars}
          </div>
          <div class="card">
            <h3>格局（月令取格）</h3>
            <div class="kv"><span>格局</span><b>${esc(geju.name)}</b></div>
            <div class="kv"><span>取格依据</span><b style="text-align:right;max-width:70%">${esc(geju.note)}</b></div>
            <div class="kv"><span>成格之相</span><b style="text-align:right;max-width:70%">${esc(geju.cheng)}</b></div>
            <div class="kv"><span>破格之因</span><b style="text-align:right;max-width:70%">${esc(geju.breaker)}</b></div>
          </div>
          <div class="card">
            <h3>调候 · 命宫 · 胎元（穷通宝鉴 / 果老星宗）</h3>
            <div class="kv"><span>调候用神</span><b>${esc(pan.tiaoHou.yong.join('、'))}（${esc(pan.tiaoHou.month)}）</b></div>
            <div class="kv"><span>命宫</span><b>${esc(pan.mingGong.gz)}（${ZHI_ARR[pan.mingGong.zhi]}宫）</b></div>
            <div class="kv"><span>胎元</span><b>${esc(pan.taiYuan.gz)}</b></div>
            <div class="kv"><span>旬空（空亡）</span><b>${esc(pan.kongWang.zhis.join('、'))}${pan.kongWang.hit.length ? ' · 落空：' + esc(pan.kongWang.hit.join('、')) : '（命局无落空）'}</b></div>
          </div>
          <div class="card">
            <h3>小运（起运前逐年，渊海子平）</h3>
            <div style="line-height:2.2">${xiaoYunTags}</div>
            <p class="hint">阳男阴女顺行 / 阴男阳女逆行，从时柱起一年一位；起运后以大运为准。</p>
          </div>
          <div class="card">
            <h3>原局干支关系（刑冲合害破会夹拱）</h3>
            ${relRows}
          </div>
        </div>

        <div class="card" style="margin-top:10px">
          <h3>四柱</h3>
          <table>
            <tr><td class="gz-sub"></td>${p.map(x => `<td class="gz-sub">${x.name}</td>`).join('')}</tr>
            ${pillarRow('干支', 'gz-big')}
            ${pillarRow('十神')}
            ${pillarRow('藏干')}
            ${pillarRow('藏干十神')}
            ${pillarRow('纳音')}
            ${pillarRow('五行')}
            ${pillarRow('长生')}
          </table>
        </div>

        <div class="card">
          <h3>神煞</h3>
          <div>${shenTags}</div>
        </div>

        <div class="card">
          <h3>大运（起运：${pan.dayun.y1} 年 ${pan.dayun.months} 月 ${pan.dayun.days2} 天，${pan.dayun.forward ? '顺排' : '逆排'}，交运约 ${jy0}-${pad2(jm0)}）</h3>
          <table>
            <tr><th>年龄区间</th><th>干支</th><th>日主十神</th><th>交运年月</th></tr>
            ${dayunRows}
          </table>
        </div>

        <div class="card">
          <h3>近十年流年</h3>
          <table>
            <tr><th>年份</th><th>干支</th><th>十神</th><th>与本命互动</th></tr>
            ${lnRows}
          </table>
        </div>
      </div>`;
  }

  function renderZeri(list, matter, days, zodiac){
    const top = list.slice(0, 10);
    return `
      <div class="panel">
        <h2>${esc(matter)} · 未来 ${days} 天吉日排行（Top 10）</h2>
        <p class="hint">评分 = 建除事项匹配 ×10 + 黄黑道修正 + 避冲修正 + 吉时数量。每年日均展示 12 时辰吉凶。</p>
        ${top.map((p, i) => `
          <div class="card day-card">
            <span class="score">${p.score}</span>
            <h3>${i + 1}. ${p.info.y}-${pad2(p.info.m)}-${pad2(p.info.d)}（农历${p.info.lunar ? (p.info.lunar.isLeap ? '闰' : '') + p.info.lunar.month + '月' + p.info.lunar.day : '—'}）</h3>
            <div class="kv"><span>日柱 / 建除 / 黄黑道</span><b>${esc(p.info.gz)} · ${esc(p.info.jc)} · ${p.info.huangdao ? '黄道' : '黑道'}</b></div>
            <div class="kv"><span>冲煞</span><b>冲${esc(p.info.chong)} · 煞${esc(p.info.sha)}</b></div>
            <div class="kv"><span>宜</span><b>${p.info.yi.length ? esc(p.info.yi.join('、')) : '—'}</b></div>
            <div class="kv"><span>忌</span><b>${p.info.ji.length ? esc(p.info.ji.join('、')) : '—'}</b></div>
            <div class="kv"><span>评分依据</span><b>${esc(p.reasons.join(' · '))}</b></div>
            <div class="kv"><span>吉时</span><b>${p.goodHours.length ? esc(p.goodHours.map(h => h.name + '(' + h.zhishen + ')').join('、')) : '—'}</b></div>
            <button class="btn zr-toggle" data-toggle="${i}">展开 12 时辰吉凶 ▾</button>
            <div class="hours-grid zr-hours" data-hours="${i}">
              ${p.info.hours.map(h => `<div class="hour ${h.good ? 'good' : 'bad'}">
                <div class="h-name">${esc(h.name)} ${esc(h.gz)}</div>
                <div>${esc(h.zhishen)}</div>
                <div style="color:var(--dim)">${esc(h.range)}</div>
                ${zodiac && h.chong === zodiac ? `<div style="color:var(--red)">冲${esc(zodiac)}</div>` : ''}
              </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  }

  function renderHuangli(info){
    const matterScores = Object.entries(info.scores).sort((a, b) => b[1] - a[1]);
    const best = matterScores.filter(x => x[1] >= 1);
    const worst = matterScores.filter(x => x[1] <= -1);
    return `
      <div class="card">
        <h3>${info.y}-${pad2(info.m)}-${pad2(info.d)} 黄历</h3>
        <div class="kv"><span>日柱 / 农历</span><b>${esc(info.gz)} · ${info.lunar ? info.lunar.lunarYear + '年' + (info.lunar.isLeap ? '闰' : '') + info.lunar.month + '月' + info.lunar.day + '日' : '—'}</b></div>
        <div class="kv"><span>月柱 / 建除</span><b>${esc(info.monthPillar)} · ${esc(info.jc)}（${info.huangdao ? '黄道日' : '黑道日'}）</b></div>
        <div class="kv"><span>建除释义</span><b style="text-align:right;max-width:70%">${esc(info.jcDesc)}</b></div>
        <div class="kv"><span>冲煞</span><b>冲${esc(info.chong)}（${ZHI_ARR[(info.dayZhi + 6) % 12]}） · 煞${esc(info.sha)}</b></div>
        <div class="kv"><span>彭祖百忌</span><b style="text-align:right;max-width:70%">${esc(info.pengzu)}</b></div>
        <div class="kv"><span>当前节气</span><b>${esc(info.term)} · ${esc(info.termDate)}</b></div>
        <div class="kv"><span>宜</span><b>${best.map(x => x[0]).join('、') || '平日常事'}</b></div>
        <div class="kv"><span>忌</span><b>${worst.map(x => x[0]).join('、') || '无大忌'}</b></div>
        <div class="kv"><span>神煞</span><b>${esc(info.shensha.join('、'))}</b></div>
        <div class="hours-grid">
          ${info.hours.map(h => `<div class="hour ${h.good ? 'good' : 'bad'}">
            <div class="h-name">${esc(h.name)} ${esc(h.gz)}</div>
            <div>${esc(h.zhishen)}</div>
            <div style="color:var(--dim)">${esc(h.range)}</div>
          </div>`).join('')}
        </div>
      </div>`;
  }

  function renderTuiyan(pan, years, label, mode){
    if (mode === 'multi') return renderTuiyanMulti(pan, years, label);
    const rows = years.map(y => {
      const r = BAZI.tuiYan(pan, y);
      const lv = r.events.length ? r.events[0].level : 0;
      const levelTag = lv >= 3 ? '<span class="tag bad">冲</span>' : lv === 2 ? '<span class="tag">害</span>' : lv === 1 ? '<span class="tag good">合</span>' : '<span class="tag">平</span>';
      return `<div class="card">
        <h3>${r.year} 年 · ${esc(r.gz)} ${levelTag}</h3>
        <ul class="chain">
          ${r.events.map(e => `<li><b>${esc(e.type)}</b> · ${esc(e.target)}<br>${esc(e.detail)}</li>`).join('')}
        </ul>
      </div>`;
    }).join('');
    return `
      <div class="panel">
        <h2>推演 · ${esc(label)}</h2>
        <p class="hint">本命：${esc(pan.pillars.map(x => x.gz).join(' '))} · 日主${WUXING_GAN[pan.dayGan]}（${pan.strengthLabel}）</p>
        ${rows}
        <p class="hint">说明：本推演只列出干支机械互动（冲合刑害 + 流年十神 + 所在大运），不做人身断言，请结合实际取舍。</p>
      </div>`;
  }

  /* ---- 多流派并列推演（7 派互证） ---- */
  function renderTuiyanMulti(pan, years, label){
    const blocks = years.map(y => {
      const m = BAZI.multiTuiYan(pan, y);
      const tagCls = m.score >= 3 ? 'bad' : m.score >= 1 ? 'good' : m.score >= -1 ? '' : m.score >= -3 ? '' : 'bad';
      return `<div class="card">
        <h3>${m.year} 年 · <span class="gz-big">${esc(m.gz)}</span>
          <span class="tag ${tagCls}" style="float:right">${esc(m.label)} · 综合 ${m.score > 0 ? '+' : ''}${m.score}</span></h3>
        <div class="grid2" style="margin-top:8px">
          ${m.cards.map(c => `
            <div class="card" style="border-left:3px solid var(--gold);margin:0">
              <h3 style="font-size:13px">${esc(c.school)}</h3>
              <div style="font-size:13px;color:var(--gold2);margin-bottom:6px">${esc(c.title)}</div>
              <ul class="chain" style="margin-left:-6px">
                ${c.points.map(pt => `<li style="padding:4px 0 4px 20px;font-size:12.5px">${esc(pt)}</li>`).join('')}
              </ul>
            </div>`).join('')}
        </div>
      </div>`;
    }).join('');
    return `
      <div class="panel">
        <h2>多流派推演 · ${esc(label)}</h2>
        <p class="hint">本命：${esc(pan.pillars.map(x => x.gz).join(' '))} · 日主${WUXING_GAN[pan.dayGan]}（${pan.strengthLabel}）· 格局 ${esc(pan.geju.name)} · 调候 ${esc(pan.tiaoHou.yong.join('、'))}</p>
        <p class="hint">七派并列：扶抑用神法 / 调候用神法 / 关系引动法 / 宫位六亲法 / 盲派串宫压运 / 病药应期法 / 神煞流年法。综合分 = 各派「吉 +1 / 凶 −1」累加，≥3 强吉、≤−3 强凶。</p>
        ${blocks}
        <p class="hint">用法：先看综合分定该年基调，再看哪一派给的是强信号（如"药到应期"），最后落到宫位/十神定具体领域。多派同向才下重话。</p>
      </div>`;
  }

  /* ---- 方法论页 ---- */
  function renderMethods(group, kw){
    let list = kw ? METHODS.search(kw) : METHODS.list(group);
    if (kw && group && group !== '全部') list = list.filter(m => m.group === group);
    if (!list.length) return '<p class="hint">没有匹配的推演方式，换个关键词试试（如：调候 / 应期 / 空亡 / 盲派）。</p>';
    return list.map(m => `
      <div class="card" style="border-left:3px solid var(--gold)">
        <h3>${m.id} · ${esc(m.name)}<span class="tag gold" style="float:right">${esc(m.group)}</span></h3>
        <div class="mt-row"><span class="mt-lbl">所属流派</span>${esc(m.school)}</div>
        <div class="mt-row"><span class="mt-lbl">经典出处</span>${esc(m.source)}</div>
        <div class="mt-block"><span class="mt-lbl">原理</span>${esc(m.principle)}</div>
        <div class="mt-row"><span class="mt-lbl">需要输入</span>${esc(m.inputs.join(' · '))}</div>
        <div class="mt-block"><span class="mt-lbl" style="color:var(--gold2)">推演步骤</span>
          <ol style="margin:6px 0 0 20px;padding:0">${m.steps.map(s => `<li style="font-size:13px;line-height:1.9">${esc(s)}</li>`).join('')}</ol>
        </div>
        <div class="mt-row"><span class="mt-lbl" style="color:var(--gold2)">能推出什么</span>${esc(m.gains.join(' · '))}</div>
        <div class="mt-block" style="color:var(--dim)"><span class="mt-lbl">局限</span>${esc(m.limits)}</div>
        <div class="mt-row"><span class="mt-lbl">何时用</span>${esc(m.when)}</div>
      </div>`).join('');
  }

  function renderSop(){
    return METHODS.sop().map(s => `
      <li><b>第 ${s.step} 步 · ${esc(s.name)}</b><br>${esc(s.detail)}<br><span style="color:var(--dim);font-size:12px">对应方式：${esc((s.tools || []).join(' / '))}</span></li>`).join('');
  }
  function renderMethodRules(){
    return METHODS.rules().map(r => `
      <div class="kv"><span style="color:var(--gold2)">${esc(r.title)}</span><b style="text-align:right;max-width:68%;font-weight:normal">${esc(r.text)}</b></div>`).join('');
  }
  function renderCross(){
    return `<table>
      <tr><th>体系</th><th>核心</th><th>能回答什么</th><th>最适用</th><th>与八字的关系</th></tr>
      ${METHODS.cross().map(c => `<tr>
        <td style="color:var(--gold2);white-space:nowrap">${esc(c.name)}</td>
        <td style="font-size:12.5px">${esc(c.core)}</td>
        <td style="font-size:12.5px;text-align:left">${esc(c.canAnswer)}</td>
        <td style="font-size:12.5px;text-align:left">${esc(c.bestFor)}</td>
        <td style="font-size:12.5px;text-align:left;color:var(--dim)">${esc(c.relation)}</td>
      </tr>`).join('')}
    </table>`;
  }

  function renderJieqi(year){
    const terms = [];
    for (let yy = year - 1; yy <= year + 1; yy++){
      for (let li = 0; li < 24; li++){
        const jd = ASTRO.solarTermJD(yy, ASTRO.TERM_LONG[li]);
        const dt = ASTRO.fromJD(jd);
        if (dt.year === year) terms.push({ name: ASTRO.TERM_NAMES[li], dt, jd });
      }
    }
    terms.sort((a, b) => a.jd - b.jd);
    const isJie = (n) => ['立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪','小寒'].includes(n);
    const rows = terms.map(t => `
      <tr><td>${t.name}</td><td>${isJie(t.name) ? '<span class="tag gold">节（月柱界）</span>' : '<span class="tag">中气</span>'}</td>
      <td>${t.dt.year}-${pad2(t.dt.month)}-${pad2(t.dt.day)}</td>
      <td>${pad2(Math.floor(t.dt.frac * 24))}:${pad2(Math.floor((t.dt.frac * 24 % 1) * 60))}</td></tr>`).join('');
    return `
      <div class="panel">
        <h2>${year} 年 24 节气</h2>
        <table>
          <tr><th>节气</th><th>类型</th><th>公历</th><th>北京时间</th></tr>
          ${rows}
        </table>
      </div>`;
  }

  function renderDanao(res){
    if (!res.matches.length){
      return `
        <div class="panel">
          <h2>大脑分析</h2>
          <ul class="chain">
            ${res.chain.map(c => `<li><b>${esc(c.step)}</b><br>${esc(c.detail)}</li>`).join('')}
          </ul>
          <p class="hint">未命中规则：请补充信息（出生时间几点几分、城市、想解决的具体问题），或点上方快捷问题换个说法再试。</p>
        </div>`;
    }
    return `
      <div class="panel">
        <h2>大脑分析</h2>
        <ul class="chain">
          ${res.chain.map(c => `<li><b>${esc(c.step)}</b><br>${esc(c.detail)}</li>`).join('')}
        </ul>
        <div style="margin-top:12px">
          ${res.matches.map(m => `
            <div class="card">
              <h3>${m.rule.id} · ${esc(m.rule.title)} <span class="tag gold" style="float:right">命中词：${esc(m.hits.join('、') || '标题')}</span></h3>
              <div class="kv"><span>适用条件</span><b style="text-align:right;max-width:70%">${esc(m.rule.condition)}</b></div>
              <div style="margin-top:8px">
                ${m.rule.steps.map((s, i) => `<div style="padding:4px 0;font-size:13px;line-height:1.7">${i + 1}. ${esc(s)}</div>`).join('')}
              </div>
              <div style="margin-top:6px">
                ${m.rule.tips.map(t => `<span class="tag gold">${esc(t)}</span>`).join('')}
              </div>
              <div class="actions" style="margin-top:8px">
                <button class="btn" data-fb="${m.rule.id}" data-good="1">✓ 这条有用</button>
                <button class="btn" data-fb="${m.rule.id}" data-good="0">✗ 不合适</button>
              </div>
            </div>`).join('')}
        </div>
        ${(res.methods && res.methods.length) ? `
          <div class="panel" style="margin-top:12px">
            <h2>推荐推演方式（方法库联动）</h2>
            <p class="hint">命中规则后自动关联到的推演方式，可在「方法」页查看全文（原理 / 步骤 / 局限）。</p>
            <div class="grid2">
              ${res.methods.map(x => `
                <div class="card" style="border-left:3px solid var(--gold)">
                  <h3>${x.id} · ${esc(x.name)}<span class="tag gold" style="float:right">${esc(x.group)}</span></h3>
                  <div style="font-size:13px;line-height:1.8">${esc(x.principle)}</div>
                  <div class="mt-row" style="margin-top:6px"><span class="mt-lbl" style="color:var(--gold2)">何时用</span>${esc(x.when)}</div>
                </div>`).join('')}
            </div>
          </div>` : ''}
        ${(res.yishu && res.yishu.length) ? `
          <div class="panel" style="margin-top:12px">
            <h2>术数条目速查（术数库联动）</h2>
            <p class="hint">命中道家术数规则后自动关联到的条目，可在「术数」页查看完整表（八经卦 / 格局 / 用神 / 六亲 / 天将 / 五术 / 典籍）。</p>
            <div class="grid2">
              ${res.yishu.map(y => `
                <div class="card" style="border-left:3px solid var(--gold)">
                  <h3>${esc(y.name)}<span class="tag gold" style="float:right">${esc(y.group)}</span></h3>
                  <div style="font-size:13px;line-height:1.8">${esc(y.note)}</div>
                </div>`).join('')}
            </div>
          </div>` : ''}
        <p class="hint">点"有用 / 不合适"会调整规则权重：下次类似问题的排序会变（自学习）。</p>
      </div>`;
  }

  function renderRules(rules){
    return rules.map(r => `
      <div class="card">
        <h3>${r.id} · ${esc(r.title)} <span class="tag gold" style="float:right">权重 ${r.curWeight.toFixed(1)} · 命中 ${r.hits} · 有用 ${r.good} / 不合适 ${r.bad}</span></h3>
        <div class="kv"><span>场景</span><b>${esc(r.scene)}</b></div>
        <div class="kv"><span>触发词</span><b style="text-align:right;max-width:70%">${esc(r.keywords.join('、'))}</b></div>
        <div style="margin-top:6px;font-size:13px;color:var(--dim)">${esc(r.condition)}</div>
      </div>`).join('');
  }

  /* ============================================================
   * 术数页（道家玄门知识库 YISHU + 时家转盘奇门 QIMEN）
   * ============================================================ */
  const YISHU_ZHI_NUM = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];  /* 数 1-12 */
  const QIMEN_LIB = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./qimen.js').QIMEN : QIMEN;

  /* 奇门九宫格：南在上（巽4 离9 坤2 / 震3 中5 兑7 / 艮8 坎1 乾6） */
  function renderQimenPan(pan){
    if (!pan) return '<p class="hint">起局失败：时间超出范围。</p>';
    const info = pan.juInfo || {};
    const order = [4, 9, 2, 3, 5, 7, 8, 1, 6];   /* 自左上（东南）到右下（西北），南在上 */
    const cell = (g) => {
      const p = pan.palaces[g - 1];
      if (p.isCenter){
        return `<div class="qm-cell qm-center"><div class="qm-gong">中五</div>
          <div class="qm-line" style="color:var(--dim)">寄坤（干随天芮转艮）</div>
          <div class="qm-line">地盘 ${esc(pan.earth[5] || '—')}</div></div>`;
      }
      const ji = p.door && '开休生'.includes(p.door[0]) ? 'qm-ji' : '';
      return `<div class="qm-cell ${ji}">
        <div class="qm-gong">${g}·${esc(p.gua)}（${esc(p.name.replace(/宫.*/, ''))}）</div>
        <div class="qm-line"><b>${esc(p.god || '—')}</b> ${esc(p.star || '')}${p.hostedStar ? '·' + esc(p.hostedStar) : ''}</div>
        <div class="qm-line">${esc(p.door || '')}${p.doorRelation ? '<span class="qm-rel">' + esc(p.doorRelation) + '</span>' : ''}</div>
        <div class="qm-line">天 ${esc(p.plainSkyStem || '—')} / 地 ${esc(p.earthStem || '—')}${p.stemRelation ? '<span class="qm-rel">' + esc(p.stemRelation) + '</span>' : ''}</div>
      </div>`;
    };
    const patTags = pan.patterns.map(x => `<span class="tag ${x.nature === '吉' ? 'gold' : ''}">${esc(x.name)}：${esc(x.detail)}</span>`).join(' ');
    return `
      <div class="card">
        <h3>${esc(pan.juLabel)} · ${esc(info.yuan || '')} <span class="tag gold" style="float:right">${esc(info.jieqi || '')} 后第 ${info.daysFromTerm} 日 · 符头 ${esc(info.fuTou || '')}</span></h3>
        <div class="kv"><span>日柱 / 时柱</span><b>${esc((info.dayGz || {}).gz || '—')} / ${esc(pan.hourGz)}（时干 ${esc(pan.hourGan)}）</b></div>
        <div class="kv"><span>旬首 · 遁仪</span><b>${esc(pan.xunShou)} · ${esc(pan.yi)}（地盘 ${esc(pan.yiGong)} 宫）</b></div>
        <div class="kv"><span>旬空</span><b>${esc(pan.kongWang.join('、'))}</b></div>
        <div class="kv"><span>值符（星）</span><b>${esc(pan.zhiFuStar)} 落 ${esc(pan.zhiFuGong)} 宫</b></div>
        <div class="kv"><span>值使（门）</span><b>${esc(pan.zhiShiDoor)} 落 ${esc(pan.zhiShiGong)} 宫</b></div>
        <div class="kv"><span>中宫寄坤</span><b>天禽 + 中五干（${esc(pan.centerHosting.centerStem)}）随天芮转 ${esc(pan.centerHosting.skyPalace)} 宫</b></div>
        <div class="qm-grid">${order.map(g => cell(g)).join('')}</div>
        <p class="hint">盘面为南在上（巽东南起）。天干列：天盘干 / 地盘干；门下标注与宫的生克（门迫 = 门克宫）。中五寄坤二（天禽与中干随天芮转，中宫不放星门神）。</p>
        <div style="margin-top:8px">${patTags}</div>
      </div>`;
  }

  function ysCard(title, rows){
    return `<div class="card"><h3>${title}</h3>${rows}</div>`;
  }
  function renderYishuSearch(kw){
    const r = YISHU_LIB.search(kw);
    if (!kw) return '<p class="hint">输入关键词在全库检索（八卦 / 门星神 / 格局 / 六亲 / 天将 / 典籍）。</p>';
    if (!r.hits.length) return `<p class="hint">未找到「${esc(kw)}」相关条目。</p>`;
    return `<p class="hint">命中 ${r.total} 条，展示前 ${Math.min(60, r.hits.length)} 条：</p>` +
      '<div class="grid2">' + r.hits.map(h => `
        <div class="card"><h3>${esc(h.name)}<span class="tag gold" style="float:right">${esc(h.group)}</span></h3>
        <div style="font-size:13px;line-height:1.8">${esc(h.text)}</div></div>`).join('') + '</div>';
  }
  function renderBagua(){
    return '<div class="grid2">' + YISHU_LIB.BAGUA.map(b => `
      <div class="card"><h3>${b.symbol} ${esc(b.name)}卦<span class="tag gold" style="float:right">先天${b.xianN} · 后天${b.houN} · ${esc(b.wx)}</span></h3>
        <div class="kv"><span>方位（先天/后天）</span><b>${esc(b.xianFang)} / ${esc(b.houFang)}</b></div>
        <div class="kv"><span>家人</span><b>${esc(b.family)}</b></div>
        <div class="kv"><span>身体</span><b>${esc(b.body)}</b></div>
        <div class="kv"><span>卦德</span><b>${esc(b.xing)} · ${esc(b.trait)}</b></div>
        <div class="mt-row"><span class="mt-lbl">象义</span><div style="flex:1">${esc(b.xiang)}</div></div>
        <div class="kv"><span>奇门宫位</span><b>${esc(b.houGong)}</b></div>
      </div>`).join('') + '</div>';
  }
  function renderJiuGong(){
    return '<table><tr><th>宫</th><th>卦</th><th>方位</th><th>五行</th><th>常驻星</th><th>常驻门</th><th>常驻神</th><th>本宫干</th></tr>' +
      YISHU_LIB.JIU_GONG.map(g => `<tr><td>${g.num}</td><td class="gz">${esc(g.gua)}</td><td>${esc(g.fang)}</td><td>${esc(g.wx)}</td><td>${esc(g.star)}</td><td>${esc(g.door)}</td><td>${esc(g.god)}</td><td>${esc(g.gan)}</td></tr>`).join('') + '</table>';
  }
  function renderBaMen(){
    return '<div class="grid2">' + YISHU_LIB.BA_MEN.map(m => `
      <div class="card"><h3>${esc(m.name)}<span class="tag gold" style="float:right">${esc(m.wx)} · ${esc(m.ji)}</span></h3>
        <div class="mt-row"><span class="mt-lbl">象义</span><div style="flex:1">${esc(m.xiang)}</div></div>
        <div class="mt-row"><span class="mt-lbl">宜</span><div style="flex:1">${esc(m.yi)}</div></div>
        <div class="mt-row"><span class="mt-lbl">忌</span><div style="flex:1">${esc(m.ji2)}</div></div>
      </div>`).join('') + '</div>';
  }
  function renderJiuXing(){
    return '<div class="grid2">' + YISHU_LIB.JIU_XING.map(x => `
      <div class="card"><h3>${esc(x.name)}<span class="tag gold" style="float:right">${esc(x.wx)} · ${esc(x.ji)}</span></h3>
        <div class="mt-row"><span class="mt-lbl">象义</span><div style="flex:1">${esc(x.xiang)}</div></div>
        <div class="mt-row"><span class="mt-lbl">注</span><div style="flex:1">${esc(x.note)}</div></div>
      </div>`).join('') + '</div>';
  }
  function renderBaShen(){
    return '<table><tr><th>神</th><th>象义</th><th>吉凶</th><th>说明</th></tr>' +
      YISHU_LIB.BA_SHEN.map(s => `<tr><td class="gz">${esc(s.name)}</td><td>${esc(s.xiang)}</td><td>${esc(s.ji)}</td><td style="text-align:left">${esc(s.note)}</td></tr>`).join('') + '</table>';
  }
  function renderQiYi(){
    return '<table><tr><th>干</th><th>类别</th><th>象义</th></tr>' +
      YISHU_LIB.QI_YI.map(q => `<tr><td class="gz">${esc(q.gan)}</td><td>${esc(q.type)}</td><td>${esc(q.xiang)}</td></tr>`).join('') + '</table>';
  }
  function renderGeju(){
    return '<table><tr><th>格局</th><th>性质</th><th>判定</th><th>白话解读</th></tr>' +
      YISHU_LIB.QIMEN_GEJU.map(g => `<tr><td class="gz">${esc(g.name)}</td><td>${esc(g.kind)}</td><td style="text-align:left">${esc(g.rule)}</td><td style="text-align:left">${esc(g.read)}</td></tr>`).join('') + '</table>';
  }
  function renderYongshen(){
    return '<table><tr><th>所问之事</th><th>主用神</th><th>辅助</th><th>说明</th></tr>' +
      YISHU_LIB.QIMEN_YONGSHEN.map(y => `<tr><td>${esc(y.shi)}</td><td class="gz">${esc(y.zhu)}</td><td>${esc(y.fu)}</td><td style="text-align:left">${esc(y.note)}</td></tr>`).join('') + '</table>';
  }
  function renderLiuyao(){
    const q1 = '<table><tr><th>六亲</th><th>象义</th><th>用事</th><th>生克</th></tr>' +
      YISHU_LIB.LIU_QIN.filter(q => q.name.indexOf('——') !== 0).map(q => `<tr><td class="gz">${esc(q.name)}</td><td>${esc(q.xiang)}</td><td>${esc(q.yong)}</td><td>${esc(q.sheng)}；${esc(q.ke)}</td></tr>`).join('') + '</table>';
    const q2 = '<table><tr><th>六神</th><th>五行</th><th>象义</th><th>说明</th></tr>' +
      YISHU_LIB.LIU_SHEN.map(s => `<tr><td class="gz">${esc(s.name)}</td><td>${esc(s.wx)}</td><td>${esc(s.xiang)}</td><td>${esc(s.note)}</td></tr>`).join('') + '</table>';
    const q3 = '<ol class="chain">' + YISHU_LIB.LIU_YAO_RULES.map(r => `<li><b>${esc(r.title)}</b><br>${esc(r.text)}</li>`).join('') + '</ol>';
    const q4 = '<table><tr><th>所问之事</th><th>取用神</th></tr>' + YISHU_LIB.LIU_YAO_YONG.map(y => `<tr><td>${esc(y.shi)}</td><td class="gz">${esc(y.yong)}</td></tr>`).join('') + '</table>';
    return '<h3 style="margin-top:6px">六亲</h3>' + q1 + '<h3 style="margin-top:12px">六神</h3>' + q2 +
      '<h3 style="margin-top:12px">断卦规则</h3>' + q3 + '<h3 style="margin-top:12px">取用神</h3>' + q4;
  }
  function renderMeihua(){
    return '<table><tr><th>起卦法</th><th>公式</th></tr>' + YISHU_LIB.MEIHUA_FA.map(m => `<tr><td class="gz">${esc(m.name)}</td><td style="text-align:left">${esc(m.formula)}</td></tr>`).join('') + '</table>' +
      '<table style="margin-top:10px"><tr><th>体用关系</th><th>读法</th></tr>' + YISHU_LIB.TI_YONG.map(t => `<tr><td class="gz">${esc(t.rel)}</td><td>${esc(t.read)}</td></tr>`).join('') + '</table>';
  }
  function renderMeihuaResult(g){
    const read = YISHU_LIB.guaNameOf(g.up, g.down);
    return `<div class="card"><h3>本卦 ${read}</h3>
      <div class="kv"><span>上卦 / 下卦</span><b>${esc(g.up)} / ${esc(g.down)}</b></div>
      <div class="kv"><span>动爻</span><b>第 ${g.dong} 爻</b></div>
      <div class="kv"><span>互卦</span><b>${esc(YISHU_LIB.guaNameOf(g.hu.up, g.hu.down))}</b></div>
      <div class="kv"><span>变卦</span><b>${esc(YISHU_LIB.guaNameOf(g.bian.up, g.bian.down))}</b></div>
      <div class="kv"><span>体 / 用</span><b>${esc(g.ti)}（${esc(g.tiWx)}） / ${esc(g.yong)}（${esc(g.yongWx)}）</b></div>
      <div class="kv"><span>体用关系</span><b>${esc(g.tiYong)}</b></div>
      <div style="margin-top:6px;font-size:13px;line-height:1.8;color:var(--gold2)">${esc(g.tiYongRead)}</div>
    </div>`;
  }
  function renderLiuren(){
    return '<table><tr><th>天将</th><th>象义</th><th>吉凶</th></tr>' + YISHU_LIB.LIU_REN_JIANG.map(j => `<tr><td class="gz">${esc(j.name)}</td><td>${esc(j.xiang)}</td><td>${esc(j.ji)}</td></tr>`).join('') + '</table>' +
      '<ol class="chain" style="margin-top:10px">' + YISHU_LIB.LIU_REN_RULES.map(r => `<li><b>${esc(r.title)}</b><br>${esc(r.text)}</li>`).join('') + '</ol>';
  }
  function renderWushu(){
    return '<div class="grid2">' + YISHU_LIB.WUSHU.map(w => `
      <div class="card"><h3>${esc(w.name)}术</h3>
        <div class="mt-row"><span class="mt-lbl">内容</span><div style="flex:1">${esc(w.content)}</div></div>
        <div class="mt-row"><span class="mt-lbl">经典</span><div style="flex:1">${esc(w.jing)}</div></div>
        <div class="mt-row"><span class="mt-lbl">说明</span><div style="flex:1">${esc(w.note)}</div></div>
      </div>`).join('') + '</div>';
  }
  function renderDianji(){
    return '<div class="grid2">' + YISHU_LIB.DIANJI.map(d => `
      <div class="card"><h3>${esc(d.name)}<span class="tag gold" style="float:right">${esc(d.era)}</span></h3>
        <div class="mt-row"><span class="mt-lbl">核心</span><div style="flex:1">${esc(d.core)}</div></div>
        ${d.quote.indexOf('——') !== 0 ? `<div class="mt-row"><span class="mt-lbl" style="color:var(--gold2)">原文</span><div style="flex:1;font-style:italic">「${esc(d.quote)}」</div></div>` : ''}
        <div class="mt-row"><span class="mt-lbl">注</span><div style="flex:1;color:var(--dim)">${esc(d.note)}</div></div>
      </div>`).join('') + '</div>';
  }
  function renderZiwei(){
    const t1 = '<div class="grid2">' + YISHU_LIB.ZIWEI_XING.map(x => `
      <div class="card"><h3>${esc(x.name)}<span class="tag gold" style="float:right">${esc(x.dou)}·${esc(x.wx)}</span></h3>
        <div class="mt-row"><span class="mt-lbl">象义</span><div style="flex:1">${esc(x.xiang)}</div></div>
        <div class="mt-row"><span class="mt-lbl">备注</span><div style="flex:1;color:var(--dim)">${esc(x.note)}</div></div>
      </div>`).join('') + '</div>';
    const t2 = '<table><tr><th>宫位</th><th>主管</th><th>看法</th></tr>' +
      YISHU_LIB.ZIWEI_GONG.map(g => `<tr><td class="gz">${esc(g.name)}</td><td style="text-align:left">${esc(g.xiang)}</td><td style="text-align:left">${esc(g.kan)}</td></tr>`).join('') + '</table>';
    const t3 = '<div class="grid2" style="margin-top:10px">' + YISHU_LIB.ZIWEI_SIHUA.map(s => `
      <div class="card"><h3>${esc(s.name)}</h3>
        <div class="mt-row"><span class="mt-lbl">主</span><div style="flex:1">${esc(s.xiang)}</div></div>
        <div class="mt-row"><span class="mt-lbl">读法</span><div style="flex:1">${esc(s.read)}</div></div>
      </div>`).join('') + '</div>';
    const t4 = '<ol class="chain" style="margin-top:10px">' + YISHU_LIB.ZIWEI_RULES.map(r => `<li><b>${esc(r.title)}</b><br>${esc(r.text)}</li>`).join('') + '</ol>';
    return t1 + t2 + t3 + t4;
  }
  function renderBazhai(){
    const t1 = '<table><tr><th>命卦</th><th>组</th><th>五行</th><th>方位</th><th>大游年歌</th></tr>' +
      YISHU_LIB.BAZHAI_MINGGUA.map(b => `<tr><td class="gz">${esc(b.name)}</td><td>${esc(b.group)}</td><td>${esc(b.wx)}</td><td>${esc(b.fang)}</td><td class="gz">${esc(b.ge)}</td></tr>`).join('') + '</table>';
    const t2 = '<ol class="chain" style="margin-top:10px">' + YISHU_LIB.BAZHAI_RULES.map(r => `<li><b>${esc(r.title)}</b><br>${esc(r.text)}</li>`).join('') + '</ol>';
    return t1 + t2;
  }
  function renderXuankong(){
    const t1 = '<table><tr><th>运</th><th>年份</th><th>卦</th><th>五行</th></tr>' +
      YISHU_LIB.XUANKONG_YUN.map(y => `<tr><td class="gz">${esc(y.name)}</td><td>${esc(y.years)}</td><td>${esc(y.gua)}</td><td>${esc(y.wx)}</td></tr>`).join('') + '</table>';
    const t2 = '<ol class="chain" style="margin-top:10px">' + YISHU_LIB.XUANKONG_RULES.map(r => `<li><b>${esc(r.title)}</b><br>${esc(r.text)}</li>`).join('') + '</ol>';
    return t1 + t2;
  }
  function renderXiangxue(){
    return '<table><tr><th>类</th><th>部位</th><th>位置</th><th>流年</th><th>主管与看法</th></tr>' +
      YISHU_LIB.XIANGXUE.map(x => `<tr><td>${esc(x.kind)}</td><td class="gz">${esc(x.name)}</td><td>${esc(x.part)}</td><td>${esc(x.years)}</td><td style="text-align:left">${esc(x.xiang)}。${esc(x.note)}</td></tr>`).join('') + '</table>';
  }
  function renderWuge(){
    const t1 = '<table><tr><th>格</th><th>算法</th><th>主管</th></tr>' +
      YISHU_LIB.WUGE.map(w => `<tr><td class="gz">${esc(w.name)}</td><td style="text-align:left">${esc(w.xiang)}</td><td style="text-align:left">${esc(w.note)}</td></tr>`).join('') + '</table>';
    const t2 = '<ol class="chain" style="margin-top:10px">' + YISHU_LIB.WUGE_RULES.map(r => `<li><b>${esc(r.title)}</b><br>${esc(r.text)}</li>`).join('') + '</ol>';
    return t1 + t2;
  }
  function renderHehun(){
    return '<div class="grid2">' + YISHU_LIB.HEHUN.map(h => `
      <div class="card"><h3>${esc(h.name)}</h3>
        <div class="mt-row"><span class="mt-lbl">关系</span><div style="flex:1">${esc(h.xiang)}</div></div>
        <div class="mt-row"><span class="mt-lbl">注</span><div style="flex:1;color:var(--dim)">${esc(h.note)}</div></div>
      </div>`).join('') + '</div>';
  }
  function renderTaisui(){
    return '<div class="grid2">' + YISHU_LIB.TAISUI.map(t => `
      <div class="card"><h3>${esc(t.name)}</h3>
        <div class="mt-row"><span class="mt-lbl">象</span><div style="flex:1">${esc(t.xiang)}</div></div>
        <div class="mt-row"><span class="mt-lbl">注</span><div style="flex:1;color:var(--dim)">${esc(t.note)}</div></div>
      </div>`).join('') + '</div>';
  }
  function renderWuyun(){
    return '<div class="grid2">' + YISHU_LIB.WUYUN_LIUQI.map(w => `
      <div class="card"><h3>${esc(w.name)}</h3>
        <div class="mt-row"><span class="mt-lbl">规则</span><div style="flex:1">${esc(w.xiang)}</div></div>
        <div class="mt-row"><span class="mt-lbl">注</span><div style="flex:1;color:var(--dim)">${esc(w.note)}</div></div>
      </div>`).join('') + '</div>';
  }
  function renderQimenJu(j){
    if (!j) return '<p class="hint">未识别的节气，请重新选择。</p>';
    return `<div class="card"><h3>${esc(j.juLabel)} · ${esc(j.yuan)}</h3>
      <div class="kv"><span>阴阳遁</span><b>${esc(j.dunLabel)}</b></div>
      <div class="kv"><span>三元</span><b>${esc(j.yuan)}（距${esc(j.daysFromTerm)}日）</b></div>
      <div class="kv"><span>局数</span><b>${j.ju} 局</b></div>
      <div style="margin-top:6px;font-size:13px;line-height:1.8">${j.dun === '阳' ? '阳遁顺布：戊己庚辛壬癸丁丙乙依次落一至九宫地盘。' : '阴遁逆布：戊己庚辛壬癸丁丙乙依次落九至一宫地盘。'}</div>
      <p class="hint">严格排盘需配合日干支旬首与值符值使（见方法页"旁参术数体系 · 奇门遁甲"）。</p>
    </div>`;
  }

  function initYishu(){
    if (!$('page-yishu')) return;
    $('ys-menpo-note').textContent = YISHU_LIB.MEN_PO_NOTE;
    $('ys-bagua').innerHTML = renderBagua();
    $('ys-jiugong').innerHTML = renderJiuGong();
    $('ys-bamen').innerHTML = renderBaMen();
    $('ys-jiuxing').innerHTML = renderJiuXing();
    $('ys-bashen').innerHTML = renderBaShen();
    $('ys-qiyi').innerHTML = renderQiYi();
    $('ys-geju').innerHTML = renderGeju();
    $('ys-yongshen').innerHTML = renderYongshen();
    $('ys-liuyao').innerHTML = renderLiuyao();
    $('ys-meihua').innerHTML = renderMeihua();
    $('ys-liuren').innerHTML = renderLiuren();
    $('ys-wushu').innerHTML = renderWushu();
    $('ys-dianji').innerHTML = renderDianji();
    $('ys-ziwei').innerHTML = renderZiwei();
    $('ys-bazhai').innerHTML = renderBazhai();
    $('ys-xuankong').innerHTML = renderXuankong();
    $('ys-xiangxue').innerHTML = renderXiangxue();
    $('ys-wuge').innerHTML = renderWuge();
    $('ys-hehun').innerHTML = renderHehun();
    $('ys-taisui').innerHTML = renderTaisui();
    $('ys-wuyun').innerHTML = renderWuyun();
    $('ys-search').innerHTML = renderYishuSearch('');

    /* 梅花下拉：年支、农历月、农历日、时支 */
    const fill = (id, opts) => $(id).innerHTML = opts;
    fill('ys-mh-nian', YISHU_ZHI_NUM.map(z => `<option>${z}</option>`).join(''));
    fill('ys-mh-yue', Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join(''));
    fill('ys-mh-ri', Array.from({ length: 30 }, (_, i) => `<option>${i + 1}</option>`).join(''));
    fill('ys-mh-shi', YISHU_ZHI_NUM.map(z => `<option>${z}</option>`).join(''));
    $('ys-mh-nian').value = '子'; $('ys-mh-yue').value = '1'; $('ys-mh-ri').value = '1'; $('ys-mh-shi').value = '子';
    $('ys-mh-go').onclick = () => {
      const yn = YISHU_ZHI_NUM.indexOf($('ys-mh-nian').value) + 1;
      const sn = YISHU_ZHI_NUM.indexOf($('ys-mh-shi').value) + 1;
      const g = YISHU_LIB.meihuaGua(yn, +$('ys-mh-yue').value, +$('ys-mh-ri').value, sn);
      $('ys-mh-result').innerHTML = renderMeihuaResult(g);
    };
    /* 奇门定局：节气 + 元 */
    const terms = Object.keys(YISHU_LIB.DUN_TABLE);
    $('ys-qm-jie').innerHTML = terms.map(t => `<option>${t}</option>`).join('');
    $('ys-qm-yuan').innerHTML = ['上元','中元','下元'].map((y, i) => `<option value="${i * 5}">${y}</option>`).join('');
    $('ys-qm-yuan').title = '距节气 0-4 日为上元，5-9 日为中元，10-14 日为下元';
    $('ys-qm-go').onclick = () => {
      const j = YISHU_LIB.qimenJu($('ys-qm-jie').value, +$('ys-qm-yuan').value);
      $('ys-qm-result').innerHTML = renderQimenJu(j);
    };
    /* 搜索 */
    $('ys-kw').oninput = () => { $('ys-search').innerHTML = renderYishuSearch($('ys-kw').value.trim()); };

    /* 奇门排盘：默认填当前时间 */
    if ($('qm-go')){
      const nowQ = new Date();
      $('qm-y').value = nowQ.getFullYear(); $('qm-m').value = nowQ.getMonth() + 1;
      $('qm-d').value = nowQ.getDate(); $('qm-h').value = nowQ.getHours(); $('qm-mi').value = nowQ.getMinutes();
      const runQm = () => {
        const pan = QIMEN_LIB.panFromDate({
          year: +$('qm-y').value, month: +$('qm-m').value, day: +$('qm-d').value,
          hour: +$('qm-h').value, minute: +$('qm-mi').value });
        $('qm-result').innerHTML = renderQimenPan(pan);
      };
      $('qm-go').onclick = runQm;
      runQm();
    }
  }

  /* ============================================================
   * 事件绑定与状态
   * ============================================================ */
  function init(){
    /* 收缩导航弹窗 */
    const navPop = $('nav-pop'), navMask = $('nav-mask'), navToggle = $('nav-toggle');
    const closeNav = () => { navPop.hidden = true; navMask.hidden = true; };
    if (navToggle) navToggle.onclick = () => {
      const open = navPop.hidden;
      navPop.hidden = !open; navMask.hidden = !open;
    };
    if (navMask) navMask.onclick = closeNav;
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

    /* 页面切换 */
    document.querySelectorAll('#mainTabs .tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#mainTabs .tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $('page-' + btn.dataset.page).classList.add('active');
        const cp = $('cur-page'); if (cp) cp.textContent = btn.textContent;
        closeNav();
        if (btn.dataset.page === 'danao'){ renderRulesView(); }
        if (btn.dataset.page === 'xunlian'){ renderXunlianStats(); }
        if (btn.dataset.page === 'tuiyan'){ refreshProfiles(); }
      };
    });

    /* 默认日期 */
    const now = new Date();
    ['zr-y','hl-y','jq-y','mc-y'].forEach(id => $(id).value = now.getFullYear());
    ['zr-m','hl-m','mc-m'].forEach(id => $(id).value = now.getMonth() + 1);
    ['zr-d','hl-d'].forEach(id => $(id).value = now.getDate());
    $('ty-years').value = `${now.getFullYear()},${now.getFullYear() + 1},${now.getFullYear() + 2}`;

    /* ============ 排盘 ============ */
    let currentPan = null;
    $('pp-go').onclick = () => {
      const y = +$('pp-y').value, m = +$('pp-m').value, d = +$('pp-d').value;
      if (!validYMD(y, m, d)) { alert('日期不合法'); return; }
      const input = {
        name: $('pp-name').value.trim(),
        year: y, month: m, day: d, hour: +$('pp-h').value, minute: +$('pp-mi').value,
        gender: $('pp-gender').value,
        lon: parseFloat($('pp-lon').value) || 116.4,
        trueSolar: $('pp-true').checked,
        ziHourDay: $('pp-zi').checked
      };
      currentPan = BAZI.paiPan(input);
      currentPan.input = input;
      $('pp-result').innerHTML = renderPaipan(currentPan, input);
      $('pp-save').disabled = false;
    };

    const PROFILES_KEY = 'zhongxuan_profiles_v1';
    function loadProfiles(){ try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; } catch(e){ return []; } }
    function saveProfiles(list){ try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch(e){} }
    function refreshProfiles(){
      const list = loadProfiles();
      $('ty-profile').innerHTML = `<option value="__current">（当前排盘结果）</option>` +
        list.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('');
    }
    $('pp-save').onclick = () => {
      if (!currentPan) return;
      const list = loadProfiles();
      const name = ($('pp-name').value.trim() || '未命名') + ' ' +
        `${currentPan.ymd.year}-${pad2(currentPan.ymd.month)}-${pad2(currentPan.ymd.day)}`;
      list.push({ name, input: currentPan.input, at: Date.now() });
      if (list.length > 50) list.shift();
      saveProfiles(list);
      alert('已保存到本地命例');
      refreshProfiles();
    };
    refreshProfiles();

    /* ============ 择日 ============ */
    const MATTERS = ['嫁娶','开市','出行','入宅','动土','安葬','上任','求医','签约','祭祀','移徙','求财'];
    $('zr-matter').innerHTML = MATTERS.map(x => `<option>${x}</option>`).join('');
    $('zr-zodiac').innerHTML = `<option value="">不限</option>` + SX.map(z => `<option value="${z}">${z}</option>`).join('');
    $('zr-go').onclick = () => {
      const y = +$('zr-y').value, m = +$('zr-m').value, d = +$('zr-d').value;
      const days = Math.min(120, Math.max(1, +$('zr-days').value || 30));
      const matter = $('zr-matter').value, zodiac = $('zr-zodiac').value;
      if (!validYMD(y, m, d)) { alert('日期不合法'); return; }
      const list = ALMANAC.pickDays(matter, y, m, d, days, { zodiac });
      const box = $('zr-result');
      box.innerHTML = renderZeri(list, matter, days, zodiac);
      box.querySelectorAll('[data-toggle]').forEach(btn => {
        const grid = box.querySelector(`[data-hours="${btn.dataset.toggle}"]`);
        btn.onclick = () => {
          if (!grid) return;
          const open = !grid.classList.contains('open');
          grid.classList.toggle('open', open);
          btn.textContent = open ? '收起 12 时辰吉凶 ▴' : '展开 12 时辰吉凶 ▾';
        };
      });
    };
    $('hl-go').onclick = () => {
      const y = +$('hl-y').value, m = +$('hl-m').value, d = +$('hl-d').value;
      if (!validYMD(y, m, d)) { alert('日期不合法'); return; }
      $('hl-result').innerHTML = renderHuangli(ALMANAC.dayInfo(y, m, d));
    };

    /* ============ 紫微排盘 ============ */
    $('zw-go').onclick = () => {
      const y = +$('zw-y').value, m = +$('zw-m').value, d = +$('zw-d').value, h = +$('zw-h').value;
      const gender = $('zw-g').value;
      if (!validYMD(y, m, d) || !(h >= 0 && h <= 23)){ alert('生日或时刻不合法'); return; }
      const pan = BAZI.paiPan({ year: y, month: m, day: d, hour: h, minute: 0, gender });
      const lun = pan.lunar;
      const zi = ZIWEI_LIB.pai({
        lunarMonth: lunarMonthNum(lun.month), lunarDay: lun.day,
        yearGan: pan.pillars[0].gan, hour: h, gender
      });
      $('zw-result').innerHTML = renderZiweiPan(zi);
    };

    /* ============ 玄空宅命盘 ============ */
    $('xk-mountain').innerHTML = XUANKONG_LIB.M24.map(m => `<option>${m}</option>`).join('');
    $('xk-mountain').value = '子';
    $('xk-month').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1} 月（节气月）</option>`).join('');
    $('xk-month').value = now.getMonth() + 1;
    $('xk-go').onclick = () => {
      const y = +$('xk-year').value;
      if (!(y >= 1 && y <= 2200)){ alert('年份不合法'); return; }
      const mt = $('xk-mountain').value;
      const x = XUANKONG_LIB.pai({ mountain: mt, year: y });
      const yearZhi = ZHI_ARR[((y - 4) % 12 + 12) % 12];
      const zb = XUANKONG_LIB.zibaiOf(y, yearZhi, +$('xk-month').value);
      $('xk-result').innerHTML = renderXuankongPan(x, zb);
    };

    /* ============ 六爻摇卦排盘 ============ */
    const lyOpts = [['9','老阳○（动）'],['7','少阳'],['8','少阴'],['6','老阴×（动）']];
    $('ly-inputs').innerHTML = [0,1,2,3,4,5].map(i =>
      `<select data-ly="${i}">${lyOpts.map(o => `<option value="${o[0]}"${o[0] === '7' || o[0] === '8' ? ' selected' : ''}>${o[1]}</option>`).join('')}</select>`).join('');
    const lyRun = lines => {
      const today = new Date();
      const info = ALMANAC.dayInfo(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const r = LIUYAO_LIB.pai({ lines, dayGan: info.dayGan, dayZhi: info.dayZhi, monthZhi: info.monthZhi });
      $('ly-result').innerHTML = renderLiuyaoPan(r);
    };
    $('ly-shake').onclick = () => lyRun(LIUYAO_LIB.shake());
    $('ly-go').onclick = () => {
      const lines = [0,1,2,3,4,5].map(i => +document.querySelector(`[data-ly="${i}"]`).value);
      lyRun(lines);
    };

    /* ============ 整月吉凶日历 ============ */
    $('mc-matter').innerHTML = ALMANAC.MATTER_NAMES.map(x => `<option>${x}</option>`).join('');
    $('mc-zodiac').innerHTML = '<option value="">不限</option>' + SX.map(z => `<option>${z}</option>`).join('');
    $('mc-go').onclick = () => {
      const y = +$('mc-y').value, m = +$('mc-m').value;
      if (!validYMD(y, m, 1)){ alert('年月不合法'); return; }
      const box = $('mc-result');
      box.innerHTML = renderMonthView(y, m, $('mc-matter').value, $('mc-zodiac').value) + '<div id="mc-detail" class="result" style="margin-top:10px"></div>';
      box.querySelectorAll('[data-mc]').forEach(cell => {
        cell.onclick = () => {
          $('mc-detail').innerHTML = renderHuangli(ALMANAC.dayInfo(y, m, +cell.dataset.mc));
          box.querySelectorAll('[data-mc]').forEach(c => c.classList.remove('mc-on'));
          cell.classList.add('mc-on');
        };
      });
    };

    /* ============ 推演 ============ */
    $('ty-go').onclick = () => {
      const sel = $('ty-profile').value;
      let pan = currentPan, label = '（当前排盘）';
      if (sel !== '__current'){
        const list = loadProfiles();
        if (!list[+sel]) { alert('命例不存在，请先在排盘页保存'); return; }
        pan = BAZI.paiPan(list[+sel].input);
        label = list[+sel].name;
      }
      if (!pan) { alert('请先到"排盘"页排盘，或保存命例'); return; }
      const years = $('ty-years').value.split(/[,,\s]+/).map(Number).filter(y => y > 100 && y < 3000);
      if (!years.length) { alert('请填入有效年份'); return; }
      $('ty-result').innerHTML = renderTuiyan(pan, years, label, $('ty-mode').value);
    };

    /* ============ 方法论（推演方式库） ============ */
    $('mt-group').innerHTML = `<option>全部</option>` + METHODS.groups().map(g => `<option>${g}</option>`).join('');
    function renderMethodView(){
      $('mt-list').innerHTML = renderMethods($('mt-group').value, $('mt-kw').value.trim());
    }
    $('mt-group').onchange = renderMethodView;
    $('mt-kw').oninput = renderMethodView;
    $('mt-sop').innerHTML = renderSop();
    $('mt-rules').innerHTML = renderMethodRules();
    $('mt-cross').innerHTML = renderCross();
    renderMethodView();

    /* ============ 节气 ============ */
    $('jq-go').onclick = () => {
      const y = +$('jq-y').value;
      if (!y || y < 1 || y > 3000) { alert('请填入有效年份'); return; }
      $('jq-result').innerHTML = renderJieqi(y);
    };

    /* ============ 大脑 ============ */
    /* 3D 脑图挂载（无 canvas 环境安全跳过） */
    if ($('danao-3d-canvas') && DANAO3D_LIB && typeof DANAO3D_LIB.mount === 'function'){
      try {
        DANAO3D_LIB.mount($('danao-3d-canvas'), {
          onPick(rule){
            const box = $('danao-3d-detail');
            if (!box || !rule) return;
            box.innerHTML = `<div class="card">
              <h3>${esc(rule.id)} ${esc(rule.title)}<span class="tag gold" style="float:right">${esc(rule.scene)}</span></h3>
              <div class="mt-row"><span class="mt-lbl">适用</span><div style="flex:1">${esc(rule.condition || '—')}</div></div>
              <ol class="chain">${(rule.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
              <div class="mt-row"><span class="mt-lbl">注意</span><div style="flex:1;color:var(--dim)">${(rule.tips || []).map(t => esc(t)).join('；') || '—'}</div></div>
              <p style="margin-top:10px"><button class="btn primary" id="dn-fill">用这条规则分析 ↑</button></p>
            </div>`;
            const fb = box.querySelector('#dn-fill');
            if (fb) fb.onclick = () => {
              const kw = (rule.keywords && rule.keywords[0]) ? rule.keywords[0] : rule.title;
              $('dn-input').value = kw;
              $('dn-go').click();
              if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
            };
          }
        });
      } catch (e){}
    }
    $('dn-scene').innerHTML = `<option>全部</option>` + BRAIN.SCENES.map(s => `<option>${s}</option>`).join('');
    $('dq-scene').innerHTML = `<option>全部</option>` + BRAIN.SCENES.map(s => `<option>${s}</option>`).join('');
    const QUICK = ['客人不知道出生时辰怎么排盘？','我算的结果跟别的 App 不一样。','客人问什么时候能结婚。','客人只能在这天开业，这天不是好日子怎么办？','生日刚好在立春那天，年柱算哪一年？','客人说我算得不准，怎么处理？','我想选个好日子签约，怎么挑？','23 点出生怎么算日柱？','两派结论相反，用神到底怎么取？','金木两停相战，怎么处理？','地支刑冲合害太多，怎么分主次？','客人纠结该用八字还是六爻。','哪一年能转运，怎么找应期？','奇门门迫怎么判断？','问签单用神怎么取？','梅花易数怎么起卦？','道家山医命相卜是什么？'];
    $('dn-quick').innerHTML = QUICK.map(q => `<span class="tag" data-q="${esc(q)}" style="cursor:pointer">${esc(q)}</span>`).join('');
    $('dn-quick').querySelectorAll('.tag').forEach(el => {
      el.onclick = () => { $('dn-input').value = el.dataset.q; $('dn-go').click(); };
    });
    function renderRulesView(){ $('dn-rules').innerHTML = renderRules(BRAIN.listRules($('dn-scene').value)); }
    $('dn-go').onclick = () => {
      const res = BRAIN.analyze($('dn-input').value.trim(), $('dn-scene').value);
      $('dn-result').innerHTML = renderDanao(res);
      /* 3D 脑图：命中规则点亮 */
      if (DANAO3D_LIB && typeof DANAO3D_LIB.highlight === 'function'){
        try { DANAO3D_LIB.highlight(res.matches.map(m => m.rule.id)); } catch (e){}
      }
      $('dn-result').querySelectorAll('[data-fb]').forEach(btn => {
        btn.onclick = () => { BRAIN.feedback(btn.dataset.fb, btn.dataset.good === '1'); renderRulesView(); };
      });
    };
    $('dn-scene').onchange = renderRulesView;
    $('dn-reset').onclick = () => { BRAIN.resetWeights(); renderRulesView(); alert('权重已重置'); };

    /* ============ 实断案例库 ============ */
    $('cs-sys').innerHTML = CASE_LIB.SYS.map(s => `<option>${s}</option>`).join('');
    const csRun = () => { $('cs-list').innerHTML = renderCases(CASE_LIB.list($('cs-sys').value, $('cs-kw').value)); };
    $('cs-go').onclick = csRun;
    $('cs-kw').onkeydown = e => { if (e.key === 'Enter') csRun(); };
    $('cs-sys').onchange = csRun;
    $('cs-list').innerHTML = renderCases(CASE_LIB.list('全部', ''));

    let curDq = null;
    $('dq-go').onclick = () => {
      curDq = BRAIN.genDecisionQuiz($('dq-scene').value);
      if (!curDq){ $('dq-result').innerHTML = '<p class="hint">该场景暂无训练题。</p>'; return; }
      $('dq-result').innerHTML = `
        <div class="question">${esc(curDq.question)}</div>
        <div class="options">
          ${curDq.options.map((o, i) => `<button class="opt" data-i="${i}">${'ABCD'[i]}. ${esc(o)}</button>`).join('')}
        </div>
        <div class="explain" id="dq-explain" style="display:none"></div>`;
      $('dq-result').querySelectorAll('.opt').forEach(btn => {
        btn.onclick = () => {
          const i = +btn.dataset.i;
          const right = i === curDq.answer;
          $('dq-result').querySelectorAll('.opt').forEach((b, j) => {
            b.disabled = true;
            if (j === curDq.answer) b.classList.add('right');
            if (j === i && !right) b.classList.add('wrong');
          });
          const ex = $('dq-explain');
          ex.style.display = 'block';
          ex.textContent = (right ? '✓ 回答正确 — ' : '✗ 答案是 ' + 'ABCD'[curDq.answer] + ' — ') + curDq.explain;
        };
      });
    };

    /* ============ 训练 ============ */
    const TYPES = TRAINER.TYPE_NAMES;
    $('xl-types').innerHTML = TYPES.map(t => `<label class="check"><input type="checkbox" value="${t}" checked> ${t}</label>`).join('');
    let quizState = { list: [], i: 0, answered: false, correct: 0, streak: 0, startTime: 0, timer: null };

    $('xl-go').onclick = () => {
      const n = +$('xl-mode').value;
      const selTypes = Array.from($('xl-types').querySelectorAll('input:checked')).map(i => i.value);
      const types = selTypes.length && selTypes.length < TYPES.length ? selTypes : null;
      quizState = { list: TRAINER.genRound(n, types), i: 0, answered: false, correct: 0, streak: 0, startTime: Date.now(), timer: null };
      $('xl-quiz-panel').style.display = 'block';
      renderQuestion();
    };

    function renderQuestion(){
      const st = quizState;
      if (st.i >= st.list.length){ finishQuiz(); return; }
      const q = st.list[st.i];
      st.answered = false;
      $('xl-progress').textContent = `第 ${st.i + 1} / ${st.list.length} 题`;
      $('xl-question').textContent = q.question;
      $('xl-explain').style.display = 'none';
      $('xl-next').style.display = 'none';
      $('xl-options').innerHTML = q.options.map((o, i) => `<button class="opt" data-i="${i}">${'ABCD'[i]}. ${esc(o)}</button>`).join('');
      $('xl-options').querySelectorAll('.opt').forEach(btn => btn.onclick = () => answer(+btn.dataset.i));
      clearInterval(st.timer);
      const t0 = Date.now();
      st.timer = setInterval(() => { $('xl-timer').textContent = `用时 ${Math.floor((Date.now() - t0) / 1000)}s`; }, 250);
      updateStatsBar();
    }

    function answer(i){
      const st = quizState;
      if (st.answered) return;
      st.answered = true;
      clearInterval(st.timer);
      const q = st.list[st.i];
      const right = i === q.answer;
      if (right){ st.correct++; st.streak++; } else { st.streak = 0; }
      TRAINER.record(q, i, Date.now() - st.startTime);
      $('xl-options').querySelectorAll('.opt').forEach((b, j) => {
        b.disabled = true;
        if (j === q.answer) b.classList.add('right');
        if (j === i && !right) b.classList.add('wrong');
      });
      const ex = $('xl-explain');
      ex.style.display = 'block';
      ex.textContent = (right ? '✓ 正确 — ' : `✗ 答案是 ${'ABCD'[q.answer]} — `) + q.explain;
      $('xl-next').style.display = 'inline-block';
      renderXunlianStats();
    }

    $('xl-next').onclick = () => { quizState.i++; renderQuestion(); };

    function finishQuiz(){
      clearInterval(quizState.timer);
      const total = quizState.list.length;
      const acc = total ? Math.round(quizState.correct / total * 100) : 0;
      const secs = Math.round((Date.now() - quizState.startTime) / 1000);
      $('xl-question').textContent = `本组完成！${quizState.correct}/${total} 题，正确率 ${acc}%，总用时 ${secs}s。`;
      $('xl-options').innerHTML = '';
      $('xl-explain').style.display = 'none';
      $('xl-next').style.display = 'none';
      $('xl-timer').textContent = '';
      renderXunlianStats();
    }

    function updateStatsBar(){
      const s = TRAINER.loadStats();
      const acc = s.total ? Math.round(s.correct / s.total * 100) : 0;
      $('xl-stats').innerHTML = `
        <span>累计 <b>${s.total}</b> 题</span>
        <span>正确率 <b>${acc}%</b></span>
        <span>当前连击 <b>${s.streak}</b></span>
        <span>最佳连击 <b>${s.bestStreak}</b></span>
        <span>错题本 <b>${s.wrongBook.length}</b></span>`;
    }

    function renderXunlianStats(){
      const s = TRAINER.loadStats();
      const acc = s.total ? Math.round(s.correct / s.total * 100) : 0;
      const typeRows = Object.entries(s.byType).map(([t, v]) => {
        const a = v.total ? Math.round(v.correct / v.total * 100) : 0;
        return `<div class="bar-row"><span class="name">${esc(t)}</span>
          <span class="track"><span class="fill" style="width:${a}%"></span></span>
          <span class="num">${v.correct}/${v.total} · ${a}%</span></div>`;
      }).join('') || '<p class="hint">暂无分类数据。</p>';
      const dayRows = s.history.slice(-14).map(h => {
        const a = h.total ? Math.round(h.correct / h.total * 100) : 0;
        return `<div class="bar-row"><span class="name">${h.day.slice(5)}</span>
          <span class="track"><span class="fill" style="width:${a}%"></span></span>
          <span class="num">${h.correct}/${h.total} · ${a}%</span></div>`;
      }).join('') || '<p class="hint">暂无每日记录。</p>';
      const wrongList = s.wrongBook.slice(-30).reverse().map(w => `
        <div class="card" style="border-left:3px solid var(--red)">
          <div class="kv"><span>题型</span><b>${esc(w.type)}</b></div>
          <div style="font-size:13px;line-height:1.7;margin:6px 0">${esc(w.question.split('\n').join(' · '))}</div>
          <div class="explain">正确答案：${esc(w.options[w.answer])}<br>${esc(w.explain)}</div>
        </div>`).join('') || '<p class="hint">错题本为空，继续保持！</p>';
      $('xl-report').innerHTML = `
        <div class="stats-bar">
          <span>累计 <b>${s.total}</b> 题</span><span>正确率 <b>${acc}%</b></span>
          <span>最佳连击 <b>${s.bestStreak}</b></span><span>错题本 <b>${s.wrongBook.length}</b></span>
        </div>
        <div class="card"><h3>题型正确率</h3>${typeRows}</div>
        <div class="card"><h3>近 14 天训练量</h3>${dayRows}</div>
        <div class="card"><h3>错题本（最近 30 条）</h3>${wrongList}</div>`;
      updateStatsBar();
    }

    $('xl-clear-wrong').onclick = () => { TRAINER.clearWrongBook(); renderXunlianStats(); };
    $('xl-reset').onclick = () => { if (confirm('确定清空全部训练统计与错题本？')){ TRAINER.resetStats(); renderXunlianStats(); } };

    /* 初始渲染 */
    renderXunlianStats();
    renderRulesView();

    /* URL hash 自动演示（便于无头验证与快速体验） */
    if (typeof location !== 'undefined' && location.hash === '#demo'){
      $('pp-name').value = '示例'; $('pp-y').value = 1990; $('pp-m').value = 8;
      $('pp-d').value = 15; $('pp-h').value = 14; $('pp-mi').value = 30;
      $('pp-gender').value = '男'; $('pp-go').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-zeri'){
      $('zr-y').value = 2026; $('zr-m').value = 11; $('zr-d').value = 12;
      $('zr-days').value = 30; $('zr-zodiac').value = '马';
      document.querySelector('#mainTabs .tab[data-page="zeri"]').click();
      $('zr-go').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-danao'){
      document.querySelector('#mainTabs .tab[data-page="danao"]').click();
      $('dn-input').value = '客人问我什么时候能结婚，可是不知道自己几点出生，而且他算的结果跟别的 App 不一样。';
      $('dn-go').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-quiz'){
      document.querySelector('#mainTabs .tab[data-page="xunlian"]').click();
      $('xl-mode').value = '5';
      $('xl-go').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-quiz-answer'){
      document.querySelector('#mainTabs .tab[data-page="xunlian"]').click();
      $('xl-mode').value = '5';
      $('xl-go').click();
      /* 自动答第一题：点第一个选项，验证解析与统计联动 */
      const firstOpt = $('xl-options').querySelector('.opt');
      if (firstOpt) firstOpt.click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-tuiyan'){
      $('pp-name').value = '示例'; $('pp-y').value = 1990; $('pp-m').value = 8;
      $('pp-d').value = 15; $('pp-h').value = 14; $('pp-mi').value = 30; $('pp-go').click();
      $('ty-years').value = '2026,2027,2028';
      document.querySelector('#mainTabs .tab[data-page="tuiyan"]').click();
      $('ty-go').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-jieqi'){
      document.querySelector('#mainTabs .tab[data-page="jieqi"]').click();
      $('jq-go').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-method'){
      document.querySelector('#mainTabs .tab[data-page="method"]').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-multi'){
      $('pp-name').value = '示例'; $('pp-y').value = 1990; $('pp-m').value = 8;
      $('pp-d').value = 15; $('pp-h').value = 14; $('pp-mi').value = 30; $('pp-go').click();
      $('ty-years').value = '2026,2027';
      $('ty-mode').value = 'multi';
      document.querySelector('#mainTabs .tab[data-page="tuiyan"]').click();
      $('ty-go').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-yishu'){
      document.querySelector('#mainTabs .tab[data-page="yishu"]').click();
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-yishu-qimen'){
      document.querySelector('#mainTabs .tab[data-page="yishu"]').click();
      $('ys-qm-jie').value = '冬至'; $('ys-qm-yuan').value = '0'; $('ys-qm-go').click();
      $('ys-mh-nian').value = '戌'; $('ys-mh-yue').value = '1'; $('ys-mh-ri').value = '15';
      $('ys-mh-shi').value = '巳'; $('ys-mh-go').click();
      window.scrollTo(0, 300);
    }
    if (typeof location !== 'undefined' && location.hash === '#demo-rules'){
      document.querySelector('#mainTabs .tab[data-page="danao"]').click();
      window.scrollTo(0, 99999);
    }

    initYishu();
  }

  /* ============ 紫微排盘卡（纯渲染） ============ */
  function renderZiweiPan(zi){
    if (!zi) return '<p class="hint">生日或时刻不合法，排不出来。请检查日期与 0-23 点时刻。</p>';
    const tag = s => {
      const lv = s.brightness ? s.brightness.level : '';
      const lvCls = !lv ? '' : s.brightness.rank >= 5 ? ' zw-miao' : s.brightness.rank <= 1 ? ' zw-xian' : ' zw-ping';
      const tagHtml = lv ? `<sup class="${lvCls.trim()}">${esc(lv)}</sup>` : '';
      return (s.sihua ? `<b class="zw-sh">${esc(s.name)}<sup>${esc(s.sihua)}</sup></b>` : esc(s.name)) + tagHtml;
    };
    const rows = zi.palaces.map((p, i) => `<tr>
      <td class="gz">${esc(p.name)}</td>
      <td>${esc(p.gan + p.zhi)}</td>
      <td style="text-align:left">${p.stars.length ? p.stars.map(tag).join('　') : '—'}</td>
      <td>${zi.dayun[i].start}-${zi.dayun[i].end}</td>
    </tr>`).join('');
    const sh = ['禄','权','科','忌'].map(k => `${zi.sihua[k]}${k}`).join('·');
    return `<div class="card">
      <h3>命宫 ${esc(zi.mingGong.gz)} · ${esc(zi.ju.wx)}${zi.ju.n}局<span class="tag gold" style="float:right">${esc(zi.gender)} · ${esc(zi.yearGan)}年干 · 大限 ${zi.ju.n} 岁起${zi.forward ? '顺行' : '逆行'}</span></h3>
      <p class="hint">身宫在「${esc(zi.shenGong.zhi)}」；紫微落「${esc(zi.zwZhi)}」、天府落「${esc(zi.tfZhi)}」；年干四化：${esc(sh)}（星名右上角标出禄权科忌）；星名后小标为庙旺利陷——<b class="zw-miao">庙旺</b>主星得地有力、<b class="zw-xian">落陷</b>主星失地打折（通行简表，派别略有差异）。</p>
      <table><thead><tr><th>宫名</th><th>干支</th><th>主星（四化 · 庙旺利陷）</th><th>大限</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">三方四正看格局见大脑规则 Z03；主星象义见上方「十四主星」面板；庙旺利陷定星力强弱，四化定应期轻重，先看庙旺再谈四化；两套体系结论打架见 G10。</p>
    </div>`;
  }

  /* ============ 整月吉凶日历（纯渲染） ============ */
  function renderMonthView(y, m, matter, zodiac){
    if (!validYMD(y, m, 1)) return '<p class="hint">年月不合法。</p>';
    const dim = new Date(y, m, 0).getDate();
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; /* 周一开头 */
    const WEEK = ['一','二','三','四','五','六','日'];
    const infos = [];
    for (let d = 1; d <= dim; d++){
      const info = ALMANAC.dayInfo(y, m, d);
      const sc = info.scores[matter] != null ? info.scores[matter] : 0;
      const chongMain = !!zodiac && info.chong === zodiac;
      let cls = sc >= 2 ? 'mc-good' : sc >= 1 ? 'mc-ok' : sc <= -1 ? 'mc-bad' : '';
      if (chongMain) cls += ' mc-chong';
      infos.push({ d, info, sc, cls, chongMain });
    }
    let html = `<p class="hint">${y} 年 ${m} 月 · 用途「${esc(matter)}」${zodiac ? ' · 主事属' + esc(zodiac) + '（冲日标红「冲主」）' : ''} · <span class="mc-key mc-good">金 大吉</span> <span class="mc-key mc-ok">绿 可用</span> <span class="mc-key">灰 常日</span> <span class="mc-key mc-bad">红 凶日</span> · 点日期看当日黄历</p>`;
    html += '<div class="mc-grid">' + WEEK.map(w => `<div class="mc-week">周${w}</div>`).join('');
    for (let i = 0; i < lead; i++) html += '<div class="mc-cell mc-empty"></div>';
    for (const it of infos){
      const i2 = it.info;
      const sum = it.chongMain ? '冲主事生肖'
        : it.sc >= 2 ? '宜 ' + (i2.yi.slice(0, 2).join(' ') || '吉')
        : it.sc <= -1 ? '忌 ' + (i2.ji.slice(0, 2).join(' ') || '凶') : '常日';
      html += `<div class="mc-cell ${it.cls}" data-mc="${it.d}" title="${esc(i2.jcDesc || '')}">
        <div class="mc-hd"><span class="mc-day">${it.d}</span><span class="mc-ln">${i2.lunar ? i2.lunar.day : ''}</span></div>
        <div class="mc-gz">${esc(i2.gz)}</div>
        <div class="mc-jc">${esc(i2.jc)}·${i2.huangdao ? '黄' : '黑'}道</div>
        <div class="mc-yi">${esc(sum)}</div>
      </div>`;
    }
    html += '</div>';
    const goods = infos.filter(i => i.sc >= 2 && !i.chongMain).map(i => i.d);
    const bads = infos.filter(i => i.sc <= -1).map(i => i.d);
    const chongs = infos.filter(i => i.chongMain).map(i => i.d);
    html += `<p class="hint">大吉日：${goods.length ? goods.join('、') + ' 号' : '本月无'}${bads.length ? '；凶日：' + bads.join('、') + ' 号' : ''}${chongs.length ? '；冲主事生肖：' + chongs.join('、') + ' 号' : ''}</p>`;
    return html;
  }

  /* ============ 玄空宅命盘（纯渲染） ============ */
  function renderXuankongPan(x, zb){
    if (!x) return '<p class="hint">坐山或年份不合法，排不出来。</p>';
    const luck = XUANKONG_LIB.zibaiLuck;
    const cell = g => {
      const yStar = zb && zb.yearPan ? zb.yearPan[g.palace] : null;
      const mStar = zb && zb.monthPan ? zb.monthPan[g.palace] : null;
      return `<div class="xk-cell${g.palace === 5 ? ' xk-center' : ''}">
      <div class="xk-head"><span class="xk-num xk-shan${g.shan === x.yun ? ' xk-wang' : ''}">${g.shan}</span><span class="xk-num xk-xiang${g.xiang === x.yun ? ' xk-wang' : ''}">${g.xiang}</span></div>
      <div class="xk-yun">${g.yun}</div>
      ${(yStar || mStar) ? `<div class="xk-zibai">${yStar ? `<span class="xk-zb xk-zb-${luck(yStar)}">年${yStar}${luck(yStar) === '吉' ? '★' : luck(yStar) === '凶' ? '✖' : ''}</span>` : ''}${mStar ? `<span class="xk-zb xk-zb-${luck(mStar)}">月${mStar}${luck(mStar) === '吉' ? '★' : luck(mStar) === '凶' ? '✖' : ''}</span>` : ''}</div>` : ''}
      <div class="xk-mt">${g.mountains.length ? esc(g.mountains.join('')) : '中宫'}<small>${esc(g.name)}</small></div>
    </div>`;
    };
    const rows = [[4,9,2],[3,5,7],[8,1,6]].map(row =>
      '<div class="xk-row">' + row.map(p => cell(x.grid.find(g => g.palace === p))).join('') + '</div>').join('');
    /* 流月断方位表 */
    let dirHtml = '';
    if (zb && zb.yearPan && zb.monthPan){
      const dir = XUANKONG_LIB.directionTable(x, zb);
      if (dir){
        const lv = s => `<span class="mc-key ${s === '宜动' ? 'xk-zb-吉' : s === '忌动' ? 'xk-zb-凶' : 'xk-zb-平'}">${s}</span>`;
        dirHtml = `<h4 style="margin:12px 0 6px;font-size:13px;color:var(--gold2);letter-spacing:2px">本月宜动方位（前 8）</h4>
        <div class="xk-dir">${dir.good.map(r => `<div class="xk-dir-cell"><b>${esc(r.name)}</b>${lv(r.level)}<small>${esc(r.palaceName)}宫 · ${r.reasons.join('·') || '中性'}</small></div>`).join('')}</div>
        <h4 style="margin:12px 0 6px;font-size:13px;color:var(--gold2);letter-spacing:2px">本月忌动方位（后 8）</h4>
        <div class="xk-dir">${dir.bad.map(r => `<div class="xk-dir-cell"><b>${esc(r.name)}</b>${lv(r.level)}<small>${esc(r.palaceName)}宫 · ${r.reasons.join('·') || '中性'}</small></div>`).join('')}</div>
        <p class="hint">评分为合成口径：年紫白（吉 +2/凶 −2）+ 月紫白（吉 +2/凶 −2）+ 宅盘山向星当运得气（+3/+2）+ 上山下水坐向（−1）；「宜动」≥4、「可动」≥1、「慎动」其余、「忌动」≤−3。动土修造以凶星到位、太岁与三煞方位为硬约束，本表仅作叠加参考。</p>`;
      }
    }
    return `<div class="card">
      <h3>${x.yun} 运 · ${esc(x.mountain)}山${esc(x.facing)}向 · ${esc(x.judge)}<span class="tag gold" style="float:right">${x.year ? esc(String(x.year)) + ' 年造 · ' : ''}${esc(x.mi.yuan)}元龙（坐 ${x.mi.yin ? '阴' : '阳'}）· ${esc(x.fi.yuan)}元龙（向 ${x.fi.yin ? '阴' : '阳'}）</span></h3>
      <p class="hint">山星 ${x.shanStart} 入中${x.mi.yin ? '逆' : '顺'}飞（${esc(x.mi.name)}），向星 ${x.xiangStart} 入中${x.fi.yin ? '逆' : '顺'}飞（${esc(x.fi.name)}）；每格上排左「山星」右「向星」，中为运星，下为二十四山与宫名；金色数字 = 当运旺星。${zb && zb.yearStar ? `年紫白 ${zb.yearStar} 入中${zb.yearLuck === '吉' ? '（吉）' : zb.yearLuck === '凶' ? '（凶）' : ''}` : ''}${zb && zb.monthStar ? `，月紫白 ${zb.monthStar} 入中${zb.monthLuck === '吉' ? '（吉）' : zb.monthLuck === '凶' ? '（凶）' : ''}；★ 吉星（1/6/8）、✖ 凶星（2/5/7）、无标平星（3/4/9）` : ''}。</p>
      <div class="xk-grid">${rows}</div>
      ${dirHtml}
      <p class="hint">${esc(x.judge)}${x.judge === '旺山旺向' ? '：旺星到山到向，丁财两旺，为上局' : x.judge === '上山下水' ? '：山星下水、向星上山，丁财两损，宜静不宜动、以形势补救' : x.judge === '双星到向' ? '：旺星齐到向首，利财不利丁，前方宜有水' : x.judge === '双星到坐' ? '：旺星齐到坐山，利丁不利财，坐后宜有山' : '：旺星未归正位，结合山水形势另断'}；年月紫白为流年流月叠加层，吉星到方可动、凶星到位避动土；三元九运与年紫白见上方玄空面板。</p>
    </div>`;
  }

  /* ============ 六爻摇卦排盘卡（纯渲染） ============ */
  function renderLiuyaoPan(ly){
    if (!ly) return '<p class="hint">六爻输入不合法（需 6 个 6/7/8/9），排不出来。</p>';
    const sym = y => y.yin ? '▅　▅　▅' : '▅▅▅▅▅';
    const rows = ly.yao.slice().reverse().map(y => `<tr>
      <td>${y.pos === 1 ? ly.sixGods ? esc(ly.sixGods[0]) : '—' : esc(ly.sixGods[y.pos - 1])}</td>
      <td>${esc(y.liuqin)}</td>
      <td class="gz">${esc(y.gan + y.zhi)}<small>${esc(y.zhiWx)}</small></td>
      <td><span class="${y.yin ? 'ly-yin' : 'ly-yang'}">${sym(y)}</span>${y.dong ? `<b class="ly-dong">${esc(y.dongType)}</b>` : ''}</td>
      <td>${y.shi ? '<b class="ly-shi">世</b>' : y.ying ? '<b class="ly-ying">应</b>' : ''}</td>
      <td>${y.yuepo ? '<span class="tag red">月破</span>' : ''}${y.andong ? '<span class="tag blue">暗动</span>' : ''}</td>
    </tr>`).join('');
    const fushi = ly.missing.length
      ? ly.missing.map(m => `${esc(m.liuqin)}（伏神 ${esc(m.gan + m.zhi)}，本宫首卦第 ${m.from} 爻）`).join('；')
      : '六亲齐全，无伏神';
    const bian = ly.bian ? `变卦「${esc(ly.bian)}」` : '无动爻，不变卦';
    return `<div class="card">
      <h3>${esc(ly.name)}<span class="tag gold" style="float:right">${esc(ly.gong)}宫（${esc(ly.gongWx)}）· 世 ${ly.shi} 应 ${ly.ying}${ly.monthZhi ? ' · 月建 ' + esc(ly.monthZhi) : ''}${ly.dayGan && ly.dayZhi ? ' · 日令 ' + esc(ly.dayGan + ly.dayZhi) : ''}</span></h3>
      <p class="hint">纳甲京房装卦：干支 → 宫五行定六亲 → 日干起六神（初爻青龙起）；月破 = 爻支冲月建，暗动 = 静爻被日冲；老阳○老阴×为动爻。${esc(bian)}；${esc(fushi)}。</p>
      <table class="ly-table"><thead><tr><th>六神</th><th>六亲</th><th>干支</th><th>爻象</th><th>世应</th><th>标志</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">断法：先取用神（问财看妻财、问婚看官鬼/妻财、问病看官鬼与世爻、问事看应与世的关系），旺衰看月建日令生扶冲合；动爻变卦定事体转折，伏神待引拨出之日；详见上方「六爻」面板与大脑规则 Q02/Q10。</p>
    </div>`;
  }

  /* ============ 实断案例库（纯渲染） ============ */
  function renderCases(list){
    if (!list || !list.length) return '<p class="hint">没有匹配的案例，换个关键词（如：财、病、婚、讼、应期、回头克）。</p>';
    return list.map(c => `<details class="cs-card">
      <summary><b>${esc(c.id)}</b> · ${esc(c.sys)} · ${esc(c.ask)}<span class="cs-time">${esc(c.time)}</span></summary>
      <div class="cs-meta">
        <span class="tag gold">${esc(c.ben || '—')}${c.bian ? ' → ' + esc(c.bian) : ''}</span>
        <span class="tag">${esc(c.src)}</span>
        ${(c.rule || []).map(r => `<span class="tag blue">${esc(r)}</span>`).join('')}
      </div>
      ${c.yao && c.yao.length ? `<table class="cs-yao"><tbody>${c.yao.map(y =>
        `<tr><td>${esc(y[0])}</td><td>${y[1] ? `<b class="${y[1] === '世' ? 'ly-shi' : 'ly-ying'}">${esc(y[1])}</b>` : ''}</td><td>${y[2] ? `<b class="ly-dong">${esc(y[2])}</b>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="cs-line"><b>用神</b>：${esc(c.yong || '—')}</p>
      <p class="cs-line"><b>断</b>：${esc(c.duan)}</p>
      <p class="cs-line cs-yan"><b>验</b>：${esc(c.yan || '—')}</p>
    </details>`).join('');
  }

  /* 浏览器加载即初始化；Node 下只导出纯渲染函数 */
  return { esc, pad2, validYMD, renderPaipan, renderZeri, renderHuangli, renderTuiyan,
    renderTuiyanMulti, renderMethods, renderSop, renderMethodRules, renderCross,
    renderJieqi, renderDanao, renderRules, init,
    renderYishuSearch, renderBagua, renderJiuGong, renderBaMen, renderJiuXing, renderBaShen,
    renderQiYi, renderGeju, renderYongshen, renderLiuyao, renderMeihua, renderMeihuaResult,
    renderLiuren, renderWushu, renderDianji, renderZiwei, renderBazhai, renderXuankong,
    renderXiangxue, renderWuge, renderHehun, renderTaisui, renderWuyun,
    renderQimenJu, initYishu, renderQimenPan, renderZiweiPan, renderMonthView, renderXuankongPan, renderLiuyaoPan, renderCases };
})();

if (typeof document !== 'undefined' && document.readyState !== 'loading') UI.init();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', UI.init);

if (typeof module !== 'undefined' && module.exports) module.exports = { UI };
