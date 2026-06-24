/* ===========================================================
 * app.js — 主应用
 *
 * 职责：
 *   1. 加载 scores.json 数据
 *   2. hash 路由（#/ 首页  #/result 结果  #/ranking 排行榜  #/collection 我的）
 *   3. 开盒全屏动效编排
 *   4. 全局工具：toast / 导航高亮
 *   5. 启动时初始化 Supabase（已配置则启用云端）
 * =========================================================== */

const App = (function () {

  let SCORE_DATA = null;   // 分数线数据
  let lastResult = null;   // 上次开盒结果（结果页用）
  let lastInput = null;

  // ---------- 启动 ----------
  async function start() {
    // 1. 加载数据：scores.json 必需，rank-tables.json 可选（失败则降级为同分逻辑）
    try {
      const scoreRes = await fetch('js/data/scores.json');
      if (!scoreRes.ok) throw new Error('scores.json HTTP ' + scoreRes.status);
      SCORE_DATA = await scoreRes.json();
      window.SCORE_DATA = SCORE_DATA;
    } catch (e) {
      document.getElementById('app').innerHTML =
        '<div class="empty-state"><div class="big-emoji">😵</div><p>数据加载失败，请通过 zeen-tools 一键启动前端.bat 打开</p></div>';
      console.error(e);
      return;
    }
    // rank-tables.json 单独加载，失败不致命（box-engine 会降级为同分换算）
    try {
      const rankRes = await fetch('js/data/rank-tables.json');
      if (rankRes.ok) window.RANK_DATA = await rankRes.json();
      else console.warn('[App] rank-tables.json 加载失败（HTTP ' + rankRes.status + '），将使用同分模式');
    } catch (e) {
      console.warn('[App] rank-tables.json 加载异常，将使用同分模式:', e.message);
    }

    // 2. 初始化 Supabase（异步，不阻塞）
    if (window.SupabaseConfig) {
      SupabaseConfig.init().catch(e => console.warn(e));
    }

    // 3. 渲染底部声明
    renderDisclaimer();

    // 4. 路由
    window.addEventListener('hashchange', route);
    route();
  }

  function renderDisclaimer() {
    const el = document.getElementById('disclaimerBody');
    if (!el || !SCORE_DATA) return;
    const m = SCORE_DATA._meta;
    el.innerHTML = `
      <p>🎯 <b>这是什么：</b>一个娱乐网页，把你当年的高考分数换算到 2026 年，看看能上什么学校，纯属开盲盒玩。</p>
      <p>📊 <b>数据范围：</b>${m.provinces.length} 个省份 × ${m.schoolCount} 所代表性院校 × ${m.years.length} 个年份（${m.years[0]}-${m.years[m.years.length-1]}）。</p>
      <p>🔮 <b>2026 分数：</b>100% 由加权线性回归模型预测，非真实数据。</p>
      <p>📈 <b>历史分数：</b>代表性估算值（基于学校梯队与省份难度系数生成），<b>非真实爬取</b>，与实际录取分可能存在偏差。</p>
      <p>⚠️ <b>郑重声明：</b>本网页仅供娱乐，<b>不是志愿填报工具</b>。任何升学决策请以各省教育考试院官方公告为准。</p>
      <p style="margin-top:8px;color:var(--text-light)">数据来源说明详见 <code>docs/数据与预测说明.md</code></p>
    `;
  }

  // ---------- 路由 ----------
  function route() {
    const hash = location.hash || '#/';
    const app = document.getElementById('app');

    // 导航高亮
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active',
        (hash === '#/' && a.getAttribute('href') === '#/') ||
        (hash !== '#/' && a.getAttribute('href') === hash));
    });

    // 滚动到顶
    window.scrollTo({ top: 0, behavior: 'instant' });

    switch (hash) {
      case '#/':          HomePage.render(); break;
      case '#/result':    ResultPage.render(); break;
      case '#/ranking':   RankingPage.render(); break;
      case '#/collection':CollectionPage.render(); break;
      default:            HomePage.render();
    }
  }

  // ---------- 开盒动效 ----------
  function playBoxAnimation() {
    return new Promise(resolve => {
      const overlay = document.getElementById('box-overlay');
      const img = document.getElementById('box-emoji');
      const shine = document.getElementById('box-shine');
      if (!overlay || !img) { resolve(); return; }

      // 随机一个表情作为开盒过程动画（用星星布丁或问号占位）
      const animFaces = ['❓', '🎲', '✨', '🔮', '⭐'];
      const face = animFaces[Math.floor(Math.random() * animFaces.length)];

      img.style.display = 'none';
      shine.className = 'box-shine';
      overlay.classList.remove('hidden', 'fade-out');

      // 用文字表情做过程动画（图片未接入时）
      let stage = document.createElement('div');
      stage.style.fontSize = '120px';
      stage.style.lineHeight = '1';
      stage.textContent = face;
      stage.className = 'box-emoji';
      stage.id = 'box-emoji';
      img.parentNode.replaceChild(stage, img);

      // 阶段1：震动
      stage.classList.add('stage-shake');

      setTimeout(() => {
        // 阶段2：放大发光
        stage.classList.remove('stage-shake');
        stage.classList.add('stage-pulse');
        shine.classList.add('show');
      }, 500);

      setTimeout(() => {
        // 阶段3：淡出
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.classList.add('hidden');
          overlay.classList.remove('fade-out');
          resolve();
        }, 300);
      }, 1100);
    });
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg, duration = 2200) {
    const el = document.getElementById('toast');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('hidden');
    // 触发重排以重启动画
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.classList.add('hidden'), 300);
    }, duration);
  }

  return {
    start, route, toast, playBoxAnimation,
    get data() { return SCORE_DATA; },
    // 全局可读写
    get lastResult() { return lastResult; },
    set lastResult(v) { lastResult = v; },
    get lastInput() { return lastInput; },
    set lastInput(v) { lastInput = v; },
  };
})();

window.App = App;

// DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.start);
} else {
  App.start();
}
