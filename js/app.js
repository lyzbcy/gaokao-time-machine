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

  let SCORE_DATA = null;   // 分数线数据（V5 后保留兼容，但主用 SCHOOL_DICT + 按需 ScoreLoader）
  let lastResult = null;   // 上次开盒结果（结果页用）
  let lastInput = null;

  // ---------- 启动 ----------
  async function start() {
    // 1. 加载学校字典（轻量，~100KB，仅 name/tier/dept，无分数线）
    try {
      const dictRes = await fetch('js/data/schools-dict.json');
      if (!dictRes.ok) throw new Error('schools-dict.json HTTP ' + dictRes.status);
      const dict = await dictRes.json();
      window.SCHOOL_DICT = dict;
      // 兼容旧代码：构造一个 SCORE_DATA 壳（_meta + provinces.{name,schools:[{name,tier}]}）
      SCORE_DATA = { _meta: dict._meta, provinces: {} };
      for (const code in dict.provinces) {
        SCORE_DATA.provinces[code] = { name: dict.provinces[code].name, schools: dict.provinces[code].schools };
      }
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

    // 2. 初始化 Supabase（异步，不阻塞）；就绪后刷新所有云状态徽章
    if (window.SupabaseConfig) {
      SupabaseConfig.init().then(() => refreshCloudBadges()).catch(e => console.warn(e));
    }

    // 3. 渲染底部声明
    renderDisclaimer();

    // 4. 路由
    window.addEventListener('hashchange', route);
    route();

    // 5. 童话背景 + 吉祥物（V4）
    if (window.FairyBg) FairyBg.init();
    if (window.Mascot) Mascot.init();
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

  // ---------- 刷新所有云连接状态徽章（Supabase 就绪后调用） ----------
  function refreshCloudBadges() {
    const cloudOn = !!(window.SupabaseConfig && SupabaseConfig.isReady && SupabaseConfig.isReady());
    const html = cloudOn
      ? '<span class="cloud-badge on">☁️ 已连接云端 · 全网实时同步</span>'
      : '<span class="cloud-badge off">📱 单机模式 · 仅本地数据</span>';
    // 首页徽章
    const home = document.getElementById('homeCloudBadge');
    if (home) home.innerHTML = html;
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
      case '#/about':     AboutPage.render(); break;
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

      // V4：用星星布丁 GIF 做开盒动画（替代文字 emoji 占位）
      shine.className = 'box-shine';
      overlay.classList.remove('hidden', 'fade-out');
      img.style.display = '';
      img.classList.remove('stage-shake', 'stage-pulse', 'stage-pop');
      img.src = 'img/anim/spin.gif';

      // 阶段1：震动
      img.classList.add('stage-shake');

      setTimeout(() => {
        // 阶段2：放大发光
        img.classList.remove('stage-shake');
        img.classList.add('stage-pulse');
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

  // ---------- 赞赏弹窗 ----------
  function openReward() {
    const modal = document.getElementById('reward-modal');
    if (!modal) return;
    modal.classList.remove('hidden', 'fade-out');
    document.body.style.overflow = 'hidden';
  }
  function closeReward() {
    const modal = document.getElementById('reward-modal');
    if (!modal) return;
    modal.classList.add('fade-out');
    document.body.style.overflow = '';
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  // ---------- QQ群弹窗 ----------
  function openQq() {
    const modal = document.getElementById('qq-modal');
    if (!modal) return;
    modal.classList.remove('hidden', 'fade-out');
    document.body.style.overflow = 'hidden';
  }
  function closeQq() {
    const modal = document.getElementById('qq-modal');
    if (!modal) return;
    modal.classList.add('fade-out');
    document.body.style.overflow = '';
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  return {
    start, route, toast, playBoxAnimation, openReward, closeReward, openQq, closeQq,
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
