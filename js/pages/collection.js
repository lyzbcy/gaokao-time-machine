/* ===========================================================
 * collection.js — 我的记录 / 收集图鉴
 *
 * 上半：标签图鉴墙（解锁/未解锁）
 * 下半：历史开盒记录
 * =========================================================== */

const CollectionPage = (function () {

  function render() {
    const app = document.getElementById('app');
    const collection = Repo.getUserCollection();
    const history = Repo.getUserHistory();

    const unlockedCount = collection.filter(c => c.unlocked).length;
    const totalCount = collection.length;

    app.innerHTML = `
      <section class="hero" style="padding-top:8px">
        <h1 class="hero-title" style="font-size:22px">📜 我的图鉴</h1>
        <p class="hero-sub">已解锁 ${unlockedCount} / ${totalCount} 个标签</p>
      </section>

      <!-- 收集进度 -->
      <section class="card">
        <div class="prob-bar-track" style="height:14px">
          <div class="prob-bar-fill" style="width:${(unlockedCount/totalCount*100).toFixed(0)}%;background:var(--grad-main)"></div>
        </div>
        <p class="muted text-center mt-8" style="font-size:11px">
          收集度 ${(unlockedCount/totalCount*100).toFixed(0)}% · 继续开盒解锁隐藏款 🌈
        </p>
      </section>

      <!-- 图鉴墙 -->
      <h2 class="section-title">🎨 标签图鉴</h2>
      <section class="card">
        <div class="collection-grid">
          ${collection.map(c => renderCell(c)).join('')}
        </div>
      </section>

      <!-- 历史记录 -->
      <h2 class="section-title">🕐 开盒历史</h2>
      <section class="card" id="historyCard">
        ${renderHistory(history)}
      </section>

      <div class="text-center mt-16 mb-16">
        <button class="btn btn-ghost" id="clearBtn" style="max-width:160px;margin:0 auto">
          🗑️ 清空我的记录
        </button>
      </div>
    `;

    bindEvents();
  }

  function renderCell(c) {
    const def = c.def;
    const tier = Labels.tier(def.tier);
    const cls = c.unlocked ? 'unlocked' : 'locked';
    const imgTag = c.unlocked
      ? `<img class="cell-emoji" src="img/labels/${def.img}" alt="${def.name}" onerror="this.outerHTML='<div style=\\'font-size:32px\\'>${def.emoji}</div>'">`
      : `<div class="cell-emoji" style="font-size:32px">${def.emoji}</div>`;
    return `
      <div class="coll-cell ${cls}" title="${c.unlocked ? def.subtitle : '未解锁'}">
        ${imgTag}
        <div class="cell-name">${c.unlocked ? def.name : '？？?'}</div>
        ${c.unlocked ? `<span style="font-size:9px;color:${tier.color}">${tier.name}</span>` : ''}
      </div>
    `;
  }

  function renderHistory(history) {
    if (!history || history.length === 0) {
      return `
        <div class="empty-state">
          <div class="big-emoji">📭</div>
          <p>你还没开过盒</p>
          <button class="btn btn-primary mt-16" onclick="location.hash='#/'" style="max-width:200px;margin:16px auto 0">去开盒</button>
        </div>`;
    }
    return history.slice(0, 20).map(r => {
      const def = Labels.get(r.labelId);
      const time = new Date(r.timestamp);
      const timeStr = `${time.getMonth()+1}/${time.getDate()} ${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}`;
      return `
        <div class="history-item">
          <div style="font-size:28px">${def?.emoji || '🎁'}</div>
          <div class="meta">
            <div class="title">${def?.name || r.labelName || '神秘标签'}</div>
            <div class="time">${r.provinceName} · ${r.year}年 · ${r.score}分 · 全省第${(r.rank||0).toLocaleString()}名${r.trackLabel ? '（'+r.trackLabel+'）' : ''}${r.major ? ' · '+r.major : ''} · ${timeStr}</div>
          </div>
        </div>`;
    }).join('');
  }

  function bindEvents() {
    const btn = document.getElementById('clearBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (!confirm('确定清空本地开盒记录吗？（云端数据不受影响）')) return;
        localStorage.removeItem('gk_box_history');
        App.toast('已清空本地记录');
        render();
      });
    }
  }

  return { render };
})();

window.CollectionPage = CollectionPage;
