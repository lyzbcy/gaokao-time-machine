/* ===========================================================
 * ranking.js — 排行榜页
 *
 * 三个 Tab：稀有度排行 / 省份分布 / 内卷指数
 * =========================================================== */

const RankingPage = (function () {

  let currentTab = 'rarity';

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="hero" style="padding-top:8px">
        <h1 class="hero-title" style="font-size:22px">🏆 全网排行榜</h1>
        <p class="hero-sub">看看大家都在抽什么标签</p>
      </section>

      <div class="rank-tabs">
        <button class="rank-tab active" data-tab="rarity">💎 稀有度排行</button>
        <button class="rank-tab" data-tab="province">🗺️ 省份分布</button>
        <button class="rank-tab" data-tab="involution">🔥 内卷指数</button>
      </div>

      <section class="card" id="rankBody">
        <div class="skeleton" style="height:48px;width:100%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:48px;width:100%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:48px;width:100%"></div>
      </section>
    `;

    bindTabs();
    loadTab(currentTab);
  }

  function bindTabs() {
    document.querySelectorAll('.rank-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rank-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        loadTab(currentTab);
      });
    });
  }

  async function loadTab(tab) {
    const body = document.getElementById('rankBody');
    if (!body) return;
    body.innerHTML = '<p class="muted text-center">加载中…</p>';

    try {
      if (tab === 'rarity') {
        const tiers = await Repo.getRarityRanking();
        renderRarity(body, tiers);
      } else if (tab === 'province') {
        const provs = await Repo.getProvinceStats();
        renderProvince(body, provs);
      } else if (tab === 'involution') {
        const provs = await Repo.getProvinceStats();
        renderInvolution(body, provs);
      }
    } catch (e) {
      body.innerHTML = '<p class="muted text-center">数据加载失败，刷新试试</p>';
      console.error(e);
    }
  }

  function renderRarity(body, tiers) {
    if (!tiers || tiers.length === 0) {
      body.innerHTML = '<div class="empty-state"><div class="big-emoji">😴</div><p>还没有人开盒，数据空空如也</p></div>';
      return;
    }
    const tierLabels = {
      hidden: { name: '隐藏款', emoji: '🌈', color: '#EC4899' },
      ssr:    { name: 'SSR 天选之子', emoji: '👑', color: '#FFB400' },
      sr:     { name: 'SR 紫卡', emoji: '💜', color: '#C084FC' },
      r:      { name: 'R 蓝卡', emoji: '💙', color: '#60A5FA' },
      n:      { name: 'N 普卡', emoji: '⚪', color: '#9CA3AF' },
    };
    const html = tiers.map((t, i) => {
      const tl = tierLabels[t.tier] || tierLabels.n;
      const numCls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      const pct = (t.prob * 100).toFixed(1);
      return `
        <div class="rank-row">
          <div class="rank-num ${numCls}">${i+1}</div>
          <span style="font-size:24px">${tl.emoji}</span>
          <div class="info">
            <div class="name">${tl.name}</div>
            <div class="meta">已抽出 ${t.count} 次 · 占比 ${pct}%</div>
          </div>
        </div>`;
    }).join('');
    body.innerHTML = html + `
      <p class="muted text-center mt-16" style="font-size:11px">
        💡 稀有度越高的标签抽到的人越少，快去试试你的运气
      </p>`;
  }

  function renderProvince(body, provs) {
    if (!provs || provs.length === 0) {
      body.innerHTML = '<div class="empty-state"><div class="big-emoji">🗺️</div><p>还没有省份数据</p></div>';
      return;
    }
    const html = provs.map((p, i) => {
      const numCls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      const def = p.topLabelDef;
      return `
        <div class="rank-row">
          <div class="rank-num ${numCls}">${i+1}</div>
          <span style="font-size:24px">${def?.emoji || '🎁'}</span>
          <div class="info">
            <div class="name">${p.province}</div>
            <div class="meta">抽到最多：${def?.name || '—'} · 共 ${p.count} 次</div>
          </div>
        </div>`;
    }).join('');
    body.innerHTML = html;
  }

  function renderInvolution(body, provs) {
    if (!provs || provs.length === 0) {
      body.innerHTML = '<div class="empty-state"><div class="big-emoji">🔥</div><p>还没有内卷数据</p></div>';
      return;
    }
    // 内卷指数 = 该省抽到"血亏战神/天选之子/一代不如一代"等掉档标签的比例
    const BAD = new Set(['chosen_one', 'blood_loss', 'declining', 'tuition_inflation']);
    const GOOD = new Set(['era_bonus']);
    const scored = provs.map(p => {
      // 由于 getProvinceStats 只返回 topLabel，这里用近似：根据 topLabel 判断
      let involution = p.count;
      let vibe = '中性';
      if (p.topLabelDef && BAD.has(p.topLabelDef.id)) vibe = '卷王';
      else if (p.topLabelDef && GOOD.has(p.topLabelDef.id)) vibe = '躺平';
      return { ...p, vibe };
    });
    // 按开盒量排（量大 = 卷）
    scored.sort((a, b) => b.count - a.count);
    const maxCount = scored[0]?.count || 1;

    const html = scored.map((p, i) => {
      const numCls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      const bar = (p.count / maxCount * 100).toFixed(0);
      const vibeEmoji = p.vibe === '卷王' ? '💀' : p.vibe === '躺平' ? '🛋️' : '😐';
      return `
        <div class="rank-row" style="align-items:center">
          <div class="rank-num ${numCls}">${i+1}</div>
          <div class="info" style="flex:1">
            <div class="name">${vibeEmoji} ${p.province}</div>
            <div class="prob-bar-track" style="margin-top:4px">
              <div class="prob-bar-fill" style="width:${bar}%;background:var(--grad-main)"></div>
            </div>
            <div class="meta">${p.vibe} · ${p.count} 次开盒</div>
          </div>
        </div>`;
    }).join('');
    body.innerHTML = html + `
      <p class="muted text-center mt-16" style="font-size:11px">
        💡 内卷指数根据各省开盒标签的氛围估算，纯属娱乐
      </p>`;
  }

  return { render };
})();

window.RankingPage = RankingPage;
