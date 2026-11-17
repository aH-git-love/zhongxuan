/* 中玄 · 塔罗体系（Tarot Engine）
 * 数据基准：Rider–Waite–Smith 1909（公版）+ A.E. Waite《The Pictorial Key to the Tarot》
 * 元素/行星对应：Golden Dawn 传统；牌阵位置：Waite 凯尔特十字通行十位
 * 说明：本文件为纯数据 + 纯函数，可在 Node 下直接用 require 测试。
 */
const TAROT = (function(){
  /* ---------------- 花色 ---------------- */
  const SUITS = [
    { key:'wands', name:'权杖', el:'火', sym:'✦', domain:'行动 · 事业 · 热情 · 创意' },
    { key:'cups',  name:'圣杯', el:'水', sym:'♥', domain:'情感 · 关系 · 直觉 · 疗愈' },
    { key:'swords',name:'宝剑', el:'风', sym:'⚔', domain:'思维 · 沟通 · 冲突 · 真相' },
    { key:'pents', name:'星币', el:'土', sym:'◉', domain:'物质 · 金钱 · 身体 · 工作' }
  ];

  /* ---------------- 数字与宫廷 ---------------- */
  const NUM_MEANING = {
    1:'开端 · 种子 · 纯粹的力量', 2:'平衡 · 选择 · 两端之间', 3:'成长 · 协作 · 初现成果',
    4:'稳定 · 结构 · 巩固', 5:'变动 · 冲突 · 打破平衡', 6:'和谐 · 给予 · 关系调和',
    7:'评估 · 坚持 · 内在考验', 8:'力量 · 推进 · 效率', 9:'接近完成 · 最后的考验',
    10:'圆满 · 极限 · 新循环的入口'
  };
  const COURT_MEANING = {
    page:'侍从：学习 · 消息 · 初学者的好奇',
    knight:'骑士：行动 · 推进 · 全情投入',
    queen:'王后：成熟 · 滋养 · 内在掌握',
    king:'国王：掌控 · 权威 · 外在实现'
  };

  /* ---------------- 大阿尔卡纳 22 张 ----------------
   * [编号, 中文名, 英文名, 元素, 行星/星座, 正位倾向, 逆位倾向, 正位核心, 逆位核心, 建议]
   * 倾向取值 −2…+2（吉凶力度），逆位另给值（逆位不是简单取反）
   */
  const MAJOR_RAW = [
    [0,'愚者','The Fool','风','天王星',1,0,'新的开始 · 纯真 · 冒险 · 无限可能','鲁莽 · 逃避 · 时机未成熟 · 原地打转','带着好奇心迈第一步，但先看清脚下有没有坑'],
    [1,'魔术师','The Magician','风','水星',2,0,'创造 · 整合资源 · 表达力 · 着手成事','操控 · 华而不实 · 才华浪费 · 自欺','手上的工具已经够了，缺的是立刻动手'],
    [2,'女祭司','The High Priestess','水','月亮',1,0,'直觉 · 潜意识 · 秘密知识 · 静观','忽略直觉 · 浮于表面 · 隐瞒 · 内在断线','答案不在外面，安静下来听自己'],
    [3,'皇后','The Empress','土','金星',2,0,'丰饶 · 滋养 · 母性 · 感官与创造','过度付出 · 依赖 · 创造力受阻 · 忽略自己','先把自己养好，才有东西给出去'],
    [4,'皇帝','The Emperor','火','白羊座',1,-1,'秩序 · 权威 · 结构与边界','专断 · 僵化 · 控制欲 · 失去掌控','立规矩是为了保护，不是为了压人'],
    [5,'教皇','The Hierophant','土','金牛座',1,-1,'传统 · 教导 · 信念体系 · 引路人','教条 · 形式主义 · 叛逆 · 盲从权威','借传统的框架，但别把框架当真理'],
    [6,'恋人','The Lovers','风','双子座',2,-1,'结合 · 抉择 · 价值一致 · 真诚的连接','失衡 · 诱惑 · 选择困难 · 价值观冲突','先弄清你真正看重什么，再选'],
    [7,'战车','The Chariot','水','巨蟹座',2,-1,'意志 · 推进 · 胜利 · 掌控方向','失控 · 方向迷失 · 内耗 · 强推无效','两个方向拉扯时，先统一缰绳'],
    [8,'力量','Strength','火','狮子座',2,-1,'温柔的坚定 · 耐心 · 驯服本能','自我怀疑 · 压抑 · 情绪失控 · 硬碰硬','用耐心和温柔，而不是蛮力'],
    [9,'隐士','The Hermit','土','处女座',0,-1,'内省 · 独处 · 寻找真理 · 自省之光','孤立 · 逃避现实 · 固执 · 拒绝求助','退一步是为了看清，不是为了躲开'],
    [10,'命运之轮','Wheel of Fortune','火','木星',1,-1,'转机 · 周期 · 机遇 · 顺势而为','逆转 · 重复旧模式 · 时运低 · 抗拒变化','轮子在转，抓稳当下这一格'],
    [11,'正义','Justice','风','天秤座',1,-1,'公平 · 因果 · 权衡 · 诚实面对','偏颇 · 逃避责任 · 双标 · 失衡','该算的账要算清，包括自己的'],
    [12,'倒吊人','The Hanged Man','水','海王星',0,-1,'暂停 · 换视角 · 自愿的牺牲 · 顿悟','拖延 · 无谓的牺牲 · 挣扎 · 卡在原地','换个角度看，暂停也是一种行动'],
    [13,'死神','Death','水','天蝎座',-1,-2,'结束与转化 · 告别 · 彻底的清理','抗拒改变 · 停滞 · 旧事未了 · 慢性消耗','结束不是失败，是给新生腾位置'],
    [14,'节制','Temperance','火','射手座',2,-1,'平衡 · 调和 · 适度 · 耐心配比','失衡 · 极端 · 急躁 · 过犹不及','把两样东西调到刚好的比例'],
    [15,'恶魔','The Devil','土','摩羯座',-2,-1,'束缚 · 欲望 · 执着 · 物质捆绑','解脱 · 看清 · 断链 · 走出依赖','看清那条链子是你自己扣上的'],
    [16,'塔','The Tower','火','火星',-2,-1,'突变 · 崩塌 · 真相显形 · 强制清理','延迟的崩塌 · 内部动荡 · 勉强维持','塌掉的部分本来就不牢，别急着扶'],
    [17,'星星','The Star','风','水瓶座',2,0,'希望 · 疗愈 · 指引 · 长远的信心','失望 · 信心不足 · 迷茫 · 光被遮住','抬头看星，别只盯着脚下的泥'],
    [18,'月亮','The Moon','水','双鱼座',-1,0,'潜意识 · 幻象 · 不安 · 直觉的暗流','迷雾散去 · 真相浮现 · 恐惧释放','分辨是直觉还是恐惧，别急着下结论'],
    [19,'太阳','The Sun','火','太阳',2,0,'成功 · 喜悦 · 清晰 · 光天化日','暂时受阻 · 过度乐观 · 迟来的成功','该亮出来的，就堂堂正正亮出来'],
    [20,'审判','Judgement','火','冥王星',1,-1,'觉醒 · 召唤 · 重新评估 · 复起','自我怀疑 · 逃避召唤 · 拖延决定 · 旧账未清','听见召唤就回应，别等第二遍'],
    [21,'世界','The World','土','土星',2,-1,'完成 · 整合 · 圆满 · 阶段闭环','未竟 · 收尾延迟 · 缺最后一步 · 循环未闭','只差最后一颗扣子，把它扣上']
  ];

  /* ---------------- 小阿尔卡纳：每花色 14 张 ----------------
   * [序号, 名称, 正位倾向, 逆位倾向, 正位核心, 逆位核心]
   * 序号 1–10 为数字牌，11 侍从 12 骑士 13 王后 14 国王
   */
  const MINOR_RAW = {
    wands: [
      [1,'权杖一',2,-1,'灵感迸发 · 新项目 · 行动契机 · 生命力','动力不足 · 计划搁浅 · 起点被拖住'],
      [2,'权杖二',1,-1,'展望 · 规划 · 选择方向 · 握在手里','恐惧未知 · 计划受阻 · 迟迟不选'],
      [3,'权杖三',1,0,'远见 · 合作 · 初现成果 · 等待回报','延误 · 视野狭窄 · 合作不顺'],
      [4,'权杖四',2,0,'里程碑 · 欢庆 · 和谐 · 阶段安稳','过渡期 · 庆祝延迟 · 根基还没稳'],
      [5,'权杖五',0,-2,'竞争 · 摩擦 · 各自为战 · 练习场','冲突化解 · 避免争斗 · 内耗结束'],
      [6,'权杖六',2,0,'胜利 · 公开认可 · 进展 · 士气','自满 · 认可延迟 · 名不副实'],
      [7,'权杖七',0,-1,'坚守立场 · 抵御压力 · 占据高处','疲于防守 · 放弃阵地 · 失去优势'],
      [8,'权杖八',2,0,'快速推进 · 消息 · 行动加速','延误 · 节奏紊乱 · 急躁冒进'],
      [9,'权杖九',0,-1,'坚持 · 戒备 · 接近目标 · 余勇可贾','疲惫 · 过度防备 · 撑不住想放'],
      [10,'权杖十',0,-2,'责任过重 · 压力 · 硬扛到收尾','卸下重担 · 学会分担 · 该放就放'],
      [11,'权杖侍从',1,0,'好奇心 · 新消息 · 学习热情 · 敢于试','三分钟热度 · 消息不实 · 方向未定'],
      [12,'权杖骑士',1,-1,'行动力 · 冒险 · 热情推进 · 说走就走','冲动 · 半途而废 · 方向摇摆'],
      [13,'权杖王后',2,0,'自信 · 热情 · 领导魅力 · 能量外放','嫉妒 · 自我怀疑 · 情绪化'],
      [14,'权杖国王',2,-1,'领导力 · 远见 · 掌控全局 · 敢担事','专断 · 急躁 · 好大喜功']
    ],
    cups: [
      [1,'圣杯一',2,0,'新感情 · 心灵敞开 · 直觉 · 情感觉醒','情感封闭 · 空虚 · 错过真心'],
      [2,'圣杯二',2,0,'结盟 · 相互吸引 · 伙伴关系 · 平等互许','失衡关系 · 猜疑 · 分离 · 一方付出多'],
      [3,'圣杯三',2,0,'友谊 · 聚会 · 共享喜悦 · 社群支持','小圈子 · 过度社交 · 表面热闹'],
      [4,'圣杯四',0,-2,'倦怠 · 错失机会 · 内耗 · 视而不见','走出低谷 · 重新接受 · 开始觉察'],
      [5,'圣杯五',0,-2,'悲伤 · 遗憾 · 只盯着失去的','接受与疗愈 · 走出哀伤 · 回头看见剩下的'],
      [6,'圣杯六',1,0,'怀旧 · 善意 · 童年 · 纯粹的给予','困于过去 · 幼稚 · 用回忆逃避现在'],
      [7,'圣杯七',0,-1,'幻想 · 多选项 · 迷离 · 什么都想要','看清现实 · 收敛幻想 · 做出决断'],
      [8,'圣杯八',0,-1,'放下 · 远行 · 寻找更深的意义','犹豫 · 回头 · 难以割舍'],
      [9,'圣杯九',2,0,'心愿达成 · 满足 · 享受 · 自我犒赏','欲求不满 · 虚浮 · 过度放纵'],
      [10,'圣杯十',2,0,'家庭和谐 · 情感圆满 · 长期幸福','关系裂痕 · 表面和谐 · 理想落差'],
      [11,'圣杯侍从',1,0,'情感讯息 · 温柔 · 灵感 · 初萌的心意','情绪化 · 不成熟 · 逃避表达'],
      [12,'圣杯骑士',1,-1,'浪漫追求 · 邀请 · 理想主义 · 真诚的示好','空口承诺 · 情绪起伏 · 不切实际'],
      [13,'圣杯王后',2,0,'共情 · 温柔 · 直觉强 · 疗愈他人','情绪依赖 · 过度敏感 · 忽略自己'],
      [14,'圣杯国王',2,-1,'情绪稳定 · 包容 · 外交手腕 · 成熟的爱','情感操控 · 冷漠 · 压抑不表达']
    ],
    swords: [
      [1,'宝剑一',1,-1,'清晰 · 真相 · 新思路 · 一语中的','混乱 · 误判 · 沟通不畅 · 想不清楚'],
      [2,'宝剑二',0,-1,'两难 · 回避 · 平衡僵持 · 蒙眼不看','打破僵局 · 做出选择 · 信息终于够了'],
      [3,'宝剑三',0,-2,'伤痛 · 背叛 · 冲突 · 心被扎穿','修复 · 释怀 · 走出伤痛 · 伤口结痂'],
      [4,'宝剑四',0,-1,'暂停 · 休养 · 退一步 · 恢复期','强撑 · 焦虑 · 想休却停不下来'],
      [5,'宝剑五',0,-2,'争执 · 胜负心 · 双输 · 赢了也难看','和解 · 放下争胜 · 退出战场'],
      [6,'宝剑六',1,0,'过渡 · 离开困境 · 平稳迁移 · 渐入静水','滞留 · 逃避改变 · 反复回到原地'],
      [7,'宝剑七',-1,-1,'策略 · 暗中行事 · 取巧 · 不完全坦白','坦白 · 败露 · 良心发现 · 隐藏失效'],
      [8,'宝剑八',0,-2,'受困 · 自我设限 · 恐惧 · 其实能走','松绑 · 看清出口 · 挣脱束缚'],
      [9,'宝剑九',0,-2,'焦虑 · 担忧 · 噩梦 · 夜里放大一切','释放焦虑 · 寻求帮助 · 天快亮了'],
      [10,'宝剑十',0,-2,'结束 · 彻底了断 · 谷底 · 无法再坏','触底反弹 · 缓慢恢复 · 还没了结'],
      [11,'宝剑侍从',1,0,'求知 · 观察 · 新消息 · 警觉的眼睛','流言 · 多疑 · 口舌是非'],
      [12,'宝剑骑士',1,-1,'果断 · 直言 · 快速行动 · 冲锋','鲁莽 · 言语伤人 · 急躁失控'],
      [13,'宝剑王后',2,0,'清晰判断 · 独立 · 直言 · 边界分明','尖刻 · 冷漠 · 过度理性'],
      [14,'宝剑国王',2,-1,'理性权威 · 公正 · 战略 · 说到做到','专断 · 教条 · 冷酷无情']
    ],
    pents: [
      [1,'星币一',2,0,'新机会 · 资源 · 务实开端 · 真金白银','机会流失 · 规划不足 · 贪快求成'],
      [2,'星币二',1,0,'平衡收支 · 灵活兼顾 · 多线并行','失衡 · 分身乏术 · 财务紧张'],
      [3,'星币三',2,0,'团队协作 · 专业认可 · 匠心 · 有人搭手','配合不佳 · 低效 · 质量下降'],
      [4,'星币四',0,-1,'稳健 · 储蓄 · 掌控资源 · 守住阵地','吝啬 · 过度控制 · 该放手'],
      [5,'星币五',0,-2,'匮乏 · 困顿 · 被排除在外 · 冷风中','转机 · 获得援助 · 走出困境'],
      [6,'星币六',1,0,'给予 · 受助 · 公平交换 · 资源流动','失衡的给予 · 债务 · 依赖成习'],
      [7,'星币七',1,0,'长期投入 · 评估成果 · 耐心 · 看收成','急功近利 · 投入回报差 · 想放弃'],
      [8,'星币八',2,0,'专注练习 · 技艺提升 · 勤勉 · 熟能生巧','敷衍 · 重复劳动 · 缺乏专注'],
      [9,'星币九',2,0,'独立 · 丰盛 · 自我价值 · 享受成果','过度依赖外物 · 虚荣 · 根基不稳'],
      [10,'星币十',2,0,'家族 · 长期成果 · 稳固 · 传承','家事纷争 · 根基动摇 · 短视'],
      [11,'星币侍从',1,0,'学习 · 务实计划 · 新技能 · 脚踏实地','拖延 · 眼高手低 · 散漫'],
      [12,'星币骑士',1,0,'踏实推进 · 可靠 · 按部就班 · 说到做到','停滞 · 固执 · 无趣僵化'],
      [13,'星币王后',2,0,'务实 · 照料 · 资源管理 · 会过日子','过度操劳 · 物质焦虑 · 忽略自己'],
      [14,'星币国王',2,0,'富足 · 稳健 · 商业头脑 · 长期经营','贪婪 · 固执 · 物质至上']
    ]
  };

  const ADVICE = {
    wands:'把热情落到具体的一步行动上，别只在脑子里烧',
    cups:'先照顾自己的感受，再谈关系里的取舍',
    swords:'把话说明白、把事实摆出来，比情绪化有用',
    pents:'算清成本与回报，用可执行的小步骤推进'
  };

  /* ---------------- 牌阵 ---------------- */
  const SPREADS = [
    {
      id:'one', name:'单张指引', en:'One Card', need:'一个明确的问题',
      desc:'最克制也最准的用法：只抽一张，看当下最该注意什么。适合每日一牌或临时决断。',
      positions:[{ name:'当下指引', desc:'这件事此刻最需要你看见的一面', w:1.4 }]
    },
    {
      id:'three', name:'三张牌 · 过去现在未来', en:'Three Card', need:'一件正在发展的事',
      desc:'通行三张阵。也可按「状况 / 行动 / 结果」读，问事、问关系、问选择都适用。',
      positions:[
        { name:'过去', desc:'已发生、仍在影响你的因', w:0.8 },
        { name:'现在', desc:'当下的真实状态与关键变量', w:1.2 },
        { name:'未来', desc:'按当前趋势推进的走向', w:1.1 }
      ]
    },
    {
      id:'five', name:'五张 · 十字洞察', en:'Five Card Cross', need:'一件卡住、需要破局的事',
      desc:'在「现状—阻碍」之外补根源与建议，适合困局分析，能给出可执行的下一步。',
      positions:[
        { name:'现状', desc:'事情目前的真实面貌', w:1.1 },
        { name:'阻碍', desc:'挡在中间的那股力量', w:1.1 },
        { name:'根源', desc:'更深层的成因（常在自身）', w:0.9 },
        { name:'建议', desc:'当下最值得采取的做法', w:1.2 },
        { name:'结果', desc:'照此推进的走向', w:1.3 }
      ]
    },
    {
      id:'cross', name:'凯尔特十字 · 十张', en:'Celtic Cross', need:'一件值得完整拆解的大事',
      desc:'Waite 传统十位，覆盖现状、挑战、根源、过去、目标、近未来、自我、环境、希望恐惧、最终结果。信息量最大，也最容易读散——先看 1、2、10 三张。',
      positions:[
        { name:'① 现状', desc:'核心状态（牌横放则为挑战的交叉）', w:1.2 },
        { name:'② 挑战', desc:'横在面前的阻力或助力', w:1.2 },
        { name:'③ 根源', desc:'潜意识与深层成因', w:0.8 },
        { name:'④ 过去', desc:'正在退场的旧影响', w:0.7 },
        { name:'⑤ 目标', desc:'意识层的目标或可能结果', w:0.9 },
        { name:'⑥ 近未来', desc:'不久将发生的事', w:0.9 },
        { name:'⑦ 自我', desc:'你的态度与所处位置', w:0.8 },
        { name:'⑧ 环境', desc:'他人与环境的影响', w:0.8 },
        { name:'⑨ 希望与恐惧', desc:'你既期待又害怕的东西', w:0.7 },
        { name:'⑩ 最终结果', desc:'综合走向的落点', w:1.6 }
      ]
    },
    {
      id:'love', name:'关系七张', en:'Relationship Seven', need:'一段具体关系',
      desc:'双人关系专用：各自状态与期待、关系现状、阻碍、走向。别用来替对方做决定。',
      positions:[
        { name:'你', desc:'你在这段关系里的状态', w:1 },
        { name:'对方', desc:'对方的状态与态度', w:1 },
        { name:'关系现状', desc:'两人之间的真实气氛', w:1.2 },
        { name:'你的期待', desc:'你真正想要的', w:0.8 },
        { name:'对方期待', desc:'对方真正想要的', w:0.8 },
        { name:'阻碍', desc:'卡住关系的那一点', w:1.1 },
        { name:'走向', desc:'不改变现状的走向', w:1.3 }
      ]
    },
    {
      id:'yesno', name:'是否 · 三张裁决', en:'Yes / No', need:'一个能回答是或否的问题',
      desc:'支持 / 反对 / 裁决。裁决位偏吉则成，偏凶则不成；两张同向时几乎可定。',
      positions:[
        { name:'支持', desc:'支持这件事的力量', w:1 },
        { name:'反对', desc:'反对或代价', w:1 },
        { name:'裁决', desc:'综合裁定', w:1.6 }
      ]
    },
    {
      id:'month', name:'月运 · 五张', en:'Monthly Five', need:'想问的一个月',
      desc:'本月主题 + 四周节奏，适合安排节奏、避开硬碰的时间点。',
      positions:[
        { name:'本月主题', desc:'这个月的核心课题', w:1.2 },
        { name:'第一周', desc:'开局状态', w:0.8 },
        { name:'第二周', desc:'推进与摩擦', w:0.8 },
        { name:'第三周', desc:'转折点', w:0.8 },
        { name:'第四周', desc:'收尾与结果', w:0.9 }
      ]
    }
  ];

  /* 通行异译别名（校核自公开中文牌义源：隐者=隐士、高塔=塔） */
  const ALIAS = { M09:['隐者','The Hermit'], M16:['高塔','The Tower'] };

  /* ---------------- 组装 78 张 ---------------- */
  const MAJORS = MAJOR_RAW.map(r => ({
    id:'M' + String(r[0]).padStart(2, '0'),
    num:r[0], name:r[1], en:r[2], arcana:'大牌', suit:'major', suitName:'大阿尔卡纳',
    el:r[3], planet:r[4], pol:r[5], polR:r[6], up:r[7], rev:r[8], advice:r[9], sym:'✧',
    alias:ALIAS['M' + String(r[0]).padStart(2, '0')] || []
  }));

  const NUMS = { 11:'侍从', 12:'骑士', 13:'王后', 14:'国王' };
  const MINORS = [];
  SUITS.forEach(s => {
    MINOR_RAW[s.key].forEach(r => {
      const n = r[0];
      MINORS.push({
        id:s.key.slice(0, 1).toUpperCase() + String(n).padStart(2, '0'),
        num:n, name:r[1], en:'', arcana:'小牌', suit:s.key, suitName:s.name, sym:s.sym,
        el:s.el, planet:'', pol:r[2], polR:r[3], up:r[4], rev:r[5],
        advice:ADVICE[s.key],
        numMeaning: n <= 10 ? NUM_MEANING[n] : COURT_MEANING[{ 11:'page', 12:'knight', 13:'queen', 14:'king' }[n]]
      });
    });
  });
  const ALL = MAJORS.concat(MINORS);

  /* ---------------- 随机与抽牌 ---------------- */
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd){
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function spreadOf(id){ return SPREADS.find(s => s.id === id) || SPREADS[0]; }
  function byId(id){ return ALL.find(c => c.id === id) || null; }

  /* 抽牌：seed 决定可复现；reverseRate 逆位概率 */
  function draw(opts){
    const o = opts || {};
    const spread = spreadOf(o.spreadId || 'three');
    const seed = Number.isFinite(o.seed) ? o.seed : (Date.now() % 2147483647);
    const rnd = mulberry32(seed);
    const deck = shuffle(ALL, rnd);
    const reverseRate = o.allowReverse === false ? 0 : (typeof o.reverseRate === 'number' ? o.reverseRate : 0.35);
    const bags = o.bags || [];
    const cards = spread.positions.map((pos, i) => {
      const card = deck[i];
      const rev = rnd() < reverseRate;
      return { card, rev, pos, index:i + 1, bag: bags[i] || '' };
    });
    return { spread, cards, seed, question:o.question || '', mode:o.mode || 'classic' };
  }

  /* 解读统计分析 */
  function analyze(result){
    const cards = result.cards || [];
    const els = {}, suits = {};
    let score = 0, wsum = 0, rev = 0, major = 0;
    cards.forEach(c => {
      const pol = c.rev ? c.card.polR : c.card.pol;
      const w = c.pos.w || 1;
      score += pol * w;
      wsum += Math.abs(w);
      if (c.rev) rev++;
      if (c.card.arcana === '大牌') major++;
      const el = c.card.el || '—';
      els[el] = (els[el] || 0) + 1;
      suits[c.card.suitName] = (suits[c.card.suitName] || 0) + 1;
    });
    const norm = wsum ? score / wsum : 0;
    const tone = norm >= 1.1 ? '大吉' : norm >= 0.35 ? '偏吉' : norm > -0.35 ? '中性' : norm > -1.1 ? '偏凶' : '大凶';
    const majorRatio = cards.length ? major / cards.length : 0;
    const revRatio = cards.length ? rev / cards.length : 0;
    const domEl = Object.keys(els).sort((a, b) => els[b] - els[a])[0] || '—';
    const missEl = ['火', '水', '风', '土'].filter(e => !els[e]);
    const domSuit = Object.keys(suits).filter(k => k !== '大阿尔卡纳').sort((a, b) => suits[b] - suits[a])[0] || '—';
    const strong = cards.filter(c => c.card.arcana === '大牌' || Math.abs(c.rev ? c.card.polR : c.card.pol) >= 2);
    const advices = [];
    cards.forEach(c => {
      const a = c.card.advice;
      if (a && !advices.includes(a)) advices.push(a);
    });
    const notes = [];
    if (majorRatio >= 0.4) notes.push('大牌占比 ' + Math.round(majorRatio * 100) + '%，主题由命运层面主导，个人能控制的部分少，顺势比硬推有效');
    if (revRatio >= 0.5) notes.push('逆位过半（' + rev + '/' + cards.length + '），能量偏内收与阻滞，宜先整理内部再对外行动');
    if (domEl !== '—') notes.push('元素偏「' + domEl + '」（' + els[domEl] + ' 张），本次解读重心在' + ({ 火:'行动与热情', 水:'情感与直觉', 风:'思考与沟通', 土:'物质与身体' }[domEl] || '该元素对应领域'));
    if (missEl.length && missEl.length < 4) notes.push('缺' + missEl.join('、') + '元素，对应领域（' + missEl.map(e => ({ 火:'行动', 水:'情感', 风:'沟通', 土:'落地' }[e])).join('、') + '）当前供给不足');
    if (domSuit !== '—' && domSuit !== '大阿尔卡纳') notes.push(domSuit + '牌最多，主线落在' + ({
      '权杖':'行动与事业', '圣杯':'情感与关系', '宝剑':'思维与沟通', '星币':'物质与工作'
    }[domSuit] || '其所属领域'));
    return {
      score:+score.toFixed(2), norm:+norm.toFixed(2), tone,
      elements:els, suits, majorRatio:+(majorRatio * 100).toFixed(0), revCount:rev, revRatio:+(revRatio * 100).toFixed(0),
      domEl, missEl, domSuit,
      strong:strong.map(c => ({ id:c.card.id, name:c.card.name, rev:c.rev, pos:c.pos.name })),
      advices:advices.slice(0, 3), notes
    };
  }

  /* 一句话结论 */
  function verdict(result, an){
    const a = an || analyze(result);
    const best = (result.cards || []).slice().sort((x, y) => (y.rev ? y.card.polR : y.card.pol) - (x.rev ? x.card.polR : x.card.pol))[0];
    const worst = (result.cards || []).slice().sort((x, y) => (x.rev ? x.card.polR : x.card.pol) - (y.rev ? y.card.polR : y.card.pol))[0];
    const tail = result.spread.id === 'yesno'
      ? (a.norm >= 0.35 ? '倾向「是，可以推进」' : a.norm <= -0.35 ? '倾向「否，暂缓」' : '「不确定」，先补信息再问')
      : a.norm >= 1.1 ? '整体强吉，可顺势而为' : a.norm >= 0.35 ? '整体偏吉，稳步推进' : a.norm > -0.35 ? '整体中性，取决于你的选择' : a.norm > -1.1 ? '整体偏凶，宜守不宜攻' : '整体强凶，先止损与休整';
    return {
      tone:a.tone, line:`${a.tone} · ${tail}`,
      best:best ? `${best.pos.name}「${best.card.name}${best.rev ? '（逆）' : ''}」` : '',
      worst:worst ? `${worst.pos.name}「${worst.card.name}${worst.rev ? '（逆）' : ''}」` : ''
    };
  }

  /* 检索 */
  function search(kw){
    const k = String(kw || '').trim().toLowerCase();
    if (!k) return ALL.slice();
    return ALL.filter(c =>
      (c.name + ' ' + (c.en || '') + ' ' + (c.alias || []).join(' ') + ' ' + c.up + ' ' + c.rev + ' ' + c.suitName + ' ' + c.el + ' ' + (c.planet || '')).toLowerCase().includes(k));
  }
  function list(filter){
    if (!filter || filter === '全部') return ALL.slice();
    if (filter === '大牌') return MAJORS.slice();
    if (filter === '小牌') return MINORS.slice();
    if (['权杖', '圣杯', '宝剑', '星币'].includes(filter)) return MINORS.filter(c => c.suitName === filter);
    return ALL.slice();
  }
  const groups = () => ['全部', '大牌', '小牌', '权杖', '圣杯', '宝剑', '星币'];

  const API = {
    MAJORS, MINORS, ALL, SUITS, SPREADS, NUM_MEANING, COURT_MEANING,
    spreadOf, byId, draw, analyze, verdict, search, list, groups, shuffle, mulberry32
  };
  return API;
})();

if (typeof window !== 'undefined') window.TAROT = TAROT;
if (typeof module !== 'undefined' && module.exports) module.exports = { TAROT };
