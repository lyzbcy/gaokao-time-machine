/* ===========================================================
 * labels.js — 盲盒标签配置
 *
 * 8 个常规标签 + 2 个隐藏款。
 * 每个标签含：稀有度、显示概率、触发条件、表情、主题色、副标题。
 *
 * 触发条件由 box-engine.js 判定，这里只存配置。
 * =========================================================== */

const Labels = (function () {

  // 稀有度元信息
  const TIERS = {
    ssr:    { name: 'SSR',      stars: '⭐⭐⭐⭐⭐', color: '#FFB400', order: 1 },
    sr:     { name: 'SR',       stars: '⭐⭐⭐⭐',   color: '#C084FC', order: 2 },
    r:      { name: 'R',        stars: '⭐⭐⭐',     color: '#60A5FA', order: 3 },
    n:      { name: 'N',        stars: '⭐⭐',       color: '#9CA3AF', order: 4 },
    hidden: { name: 'HIDDEN',   stars: '🌈',         color: '#EC4899', order: 0 }, // 隐藏款优先级最高
  };

  // 标签定义
  // id 必须唯一；cond 是触发判定函数的标识，box-engine.js 实现
  // img 对应 img/labels/ 下的文件名（美术资源接入后替换）
  const DEFS = [
    {
      id: 'chosen_one',        // 天选之子
      name: '天选之子',
      emoji: '👑',
      tier: 'ssr',
      displayProb: 0.02,
      cond: { type: 'tier_drop', min: 2 }, // 当年985 → 2026掉到211 或更甚
      subtitle: '当年能上985，今年同分掉档了',
      img: 'tianxuan.png',
    },
    {
      id: 'blood_loss',        // 血亏战神
      name: '血亏战神',
      emoji: '💀',
      tier: 'sr',
      displayProb: 0.08,
      cond: { type: 'tier_drop', min: 2 },
      subtitle: '档次掉了2档以上，亏到姥姥家',
      img: 'xuekui.png',
    },
    {
      id: 'era_bonus',         // 时代红利
      name: '时代红利',
      emoji: '🎉',
      tier: 'sr',
      displayProb: 0.08,
      cond: { type: 'tier_rise', min: 2 },
      subtitle: '档次升了2档以上，躺赢了',
      img: 'shidai.png',
    },
    {
      id: 'early_bird',        // 幸好考得早
      name: '幸好考得早',
      emoji: '🫠',
      tier: 'r',
      displayProb: 0.25,
      cond: { type: 'score_inflation', min: 1 }, // 当年能上的学校今年分更高了
      subtitle: '当年能上的学校，今年分更高了',
      img: 'xingkao.png',
    },
    {
      id: 'lucky_king',        // 捡漏王
      name: '捡漏王',
      emoji: '🍀',
      tier: 'r',
      displayProb: 0.15,
      cond: { type: 'just_qualified' }, // 刚好压线进某档
      subtitle: '刚好压线进某档，运气用光了',
      img: 'jianlou.png',
    },
    {
      id: 'nothing_special',   // 平平无奇
      name: '平平无奇',
      emoji: '🤔',
      tier: 'r',
      displayProb: 0.20,
      cond: { type: 'tier_stable' }, // 排名基本没变
      subtitle: '排名基本没变，普普通通',
      img: 'pingping.png',
    },
    {
      id: 'declining',         // 一代不如一代
      name: '一代不如一代',
      emoji: '📉',
      tier: 'n',
      displayProb: 0.12,
      cond: { type: 'tier_drop', min: 1 }, // 小幅下降
      subtitle: '档次小幅下降，时代变了',
      img: 'yidai.png',
    },
    {
      id: 'tuition_inflation', // 学费通胀侠
      name: '学费通胀侠',
      emoji: '💸',
      tier: 'n',
      displayProb: 0.10,
      cond: { type: 'tier_drop', min: 1 },
      subtitle: '分掉了，换个学校还更贵了',
      img: 'xuefei.png',
    },

    // ===== 隐藏款 =====
    {
      id: 'parallel_universe', // 平行宇宙
      name: '平行宇宙',
      emoji: '🦄',
      tier: 'hidden',
      displayProb: 0.005,       // 显示概率极低（不公开）
      cond: { type: 'easter_egg', key: 'parallel' },
      subtitle: '你的分数触发了时空裂缝…',
      img: 'pingxing.png',
      special: 'rainbow',       // 全屏彩虹特效
    },
    {
      id: 'time_paradox',      // 时空悖论
      name: '时空悖论',
      emoji: '🔮',
      tier: 'hidden',
      displayProb: 0.005,
      cond: { type: 'easter_egg', key: 'paradox' },
      subtitle: '你输入了一个不该存在的年份…',
      img: 'shikong.png',
      special: 'rainbow',
    },
  ];

  // 索引
  const BY_ID = {};
  DEFS.forEach(d => BY_ID[d.id] = d);

  function get(id) { return BY_ID[id]; }
  function all() { return DEFS.slice(); }
  function visible() { return DEFS.filter(d => d.tier !== 'hidden'); }
  function hidden() { return DEFS.filter(d => d.tier === 'hidden'); }
  function tier(tierKey) { return TIERS[tierKey]; }
  function tiers() { return TIERS; }

  return { get, all, visible, hidden, tier, tiers };
})();

window.Labels = Labels;
