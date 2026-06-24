/* ===========================================================
 * result.js — 结果页
 *
 * 展示：标签卡（含稀有度光效）+ 对比表格 + 骚话评价 + 分享按钮
 * =========================================================== */

const ResultPage = (function () {

  const TIER_CN = { '985': '985', '211': '211', '1': '一本', '2': '二本', '3': '专科' };

  function render() {
    const result = App.lastResult;
    const input = App.lastInput;
    const app = document.getElementById('app');

    if (!result || !input) {
      app.innerHTML = `
        <div class="empty-state">
          <div class="big-emoji">🤔</div>
          <p>还没有开盒结果</p>
          <button class="btn btn-primary mt-16" onclick="location.hash='#/'" style="max-width:200px;margin:16px auto 0">去开盒</button>
        </div>`;
      return;
    }

    const def = result.label;
    const tier = Labels.tier(def.tier);
    const isHidden = def.tier === 'hidden';

    // V4：结果页吉祥物反应（升档庆祝/掉档安慰/隐藏款惊喜）
    if (window.Mascot) {
      if (isHidden) Mascot.setState('happy');
      else if (result.tierDelta > 0) Mascot.setState('happy');
      else if (result.tierDelta < 0) Mascot.setState('cry');
      else Mascot.setState('idle');
    }
    const probPct = (result.appearanceProb * 100).toFixed(isHidden ? 2 : 1);

    app.innerHTML = `
      <section class="hero" style="padding-top:8px">
        <h1 class="hero-title" style="font-size:22px">恭喜你抽到了</h1>
      </section>

      <!-- 标签卡 -->
      <div class="label-card-wrap animate-in">
        <div class="label-card tier-${def.tier}">
          ${def.tier === 'ssr' || isHidden ? '<div class="glow"></div>' : ''}
          <div class="inner">
            <img class="label-emoji" src="img/labels/${def.img}" alt="${def.name}"
                 onerror="this.outerHTML='<div style=\\'font-size:90px;line-height:1\\'>${def.emoji}</div>'">
            <div class="rarity">${tier.stars} ${tier.name}</div>
            <div class="label-title">${def.name}</div>
            <div class="label-subtitle">${def.subtitle}</div>
            <div class="prob">出现概率 ${probPct}%</div>
          </div>
        </div>
      </div>

      <!-- 对比表格 -->
      <h2 class="section-title">📊 位次锚定对比</h2>
      <section class="card">
        <table class="compare-table">
          <thead>
            <tr>
              <th></th>
              <th>${input.year}年（你）</th>
              <th>2026年（同位次）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>总分</b></td>
              <td>${input.score}</td>
              <td><b style="color:var(--orange)">${result.equivalentScore2026}</b> <span class="muted">等位分</span></td>
            </tr>
            ${input.majorScore ? `
            <tr>
              <td><b>专业分${input.major ? '（'+input.major+'）' : ''}</b></td>
              <td>${input.majorScore} <span class="muted">你填的</span></td>
              <td><b style="color:var(--orange)">${result.newJudgeScore}</b> <span class="muted">等位专业分</span></td>
            </tr>` : ''}
            <tr>
              <td><b>全省排名</b>${result.rankSource === 'estimated' ? '<br><span class="muted" style="font-size:10px">估算</span>' : ''}</td>
              <td>第 ${(result.provinceRank || input.rank || 0).toLocaleString()} 名${result.rankSource === 'estimated' ? ' <span class="muted" style="font-size:10px">(按分估算)</span>' : ''}</td>
              <td>第 ${(result.provinceRank || input.rank || 0).toLocaleString()} 名 <span class="muted">(同位次)</span></td>
            </tr>
            <tr>
              <td><b>科类</b></td>
              <td colspan="2">${result.conversion ? result.conversion.fromTrackLabel : '—'} → ${result.conversion ? result.conversion.targetTrackLabel : '—'}</td>
            </tr>
            <tr>
              <td><b>省份</b></td>
              <td colspan="2">${input.provinceName}</td>
            </tr>
            ${input.chosenSchool ? `
            <tr>
              <td><b>当年上的学校</b></td>
              <td colspan="2">${input.chosenSchool}${result.customSchool ? ` <span class="muted">（自定义，2026预计 ${result.custom2026} 分）</span>` : ''}</td>
            </tr>` : ''}
            <tr>
              <td><b>能上的档次</b>${result.judgeByMajor ? '<br><span class="muted" style="font-size:10px">按专业分判</span>' : ''}</td>
              <td>${tierTag(result.oldTier)}</td>
              <td>${tierTag(result.newTier)}</td>
            </tr>
            <tr>
              <td><b>档次变化</b></td>
              <td colspan="2">${deltaText(result.tierDelta)}</td>
            </tr>
          </tbody>
        </table>

        ${input.major ? `<p class="muted" style="margin-top:12px;font-size:12px">🎓 你当年的专业：<b>${input.major}</b>${input.chosenSchool ? ` @ ${input.chosenSchool}` : ''}（专业名仅展示，判定按学校级）</p>` : ''}

        ${renderSchoolList(result.oldSchools, input.year, false)}
        ${renderSchoolList(result.newSchools, 2026, true)}

        ${result.conversion && result.conversion.detail ? `
        <div style="margin-top:14px;padding:12px 14px;background:#FAF8FF;border-radius:10px;border-left:3px solid var(--purple)">
          <p class="muted" style="font-size:11px;line-height:1.6">💡 <b>换算说明：</b>${result.conversion.detail}</p>
        </div>` : ''}
      </section>

      <!-- 骚话评价 -->
      <div class="trash-talk">${result.trashTalk}</div>

      <!-- 操作按钮 -->
      <div class="action-row">
        <button class="btn btn-primary" id="shareBtn">
          <span>🖼️</span> 生成分享卡片
        </button>
        <button class="btn btn-ghost" id="againBtn">
          <span>🔄</span> 再开一次
        </button>
      </div>

      <div class="share-canvas-wrap" id="shareWrap"></div>

      <p class="muted text-center mt-16">
        ⚠️ 2026 等位分基于位次锚定换算（同年份同排名映射），一分一段曲线为模型估算，仅供娱乐
      </p>
    `;

    bindEvents(result, input);
  }

  function tierTag(tier) {
    if (!tier) return '<span class="muted">—</span>';
    const cls = { '985': 'tag-985', '211': 'tag-211', '1': 'tag-1', '2': 'tag-2', '3': 'tag-3' }[tier] || '';
    return `<span class="tier-tag ${cls}">${TIER_CN[tier] || tier}</span>`;
  }

  function deltaText(delta) {
    if (delta > 0) return `<span style="color:#15803D;font-weight:800">↑ 升了 ${delta} 档 🎉</span>`;
    if (delta < 0) return `<span style="color:#BE123C;font-weight:800">↓ 掉了 ${Math.abs(delta)} 档 💀</span>`;
    return `<span style="color:var(--text-sub);font-weight:800">— 档次没变</span>`;
  }

  function renderSchoolList(schools, year, predicted) {
    if (!schools || schools.length === 0) return '';
    const title = predicted ? `2026 你能上的代表校（预测）` : `${year} 你能上的代表校`;
    const rows = schools.map(s => {
      const cls = { '985': 'tag-985', '211': 'tag-211', '1': 'tag-1', '2': 'tag-2', '3': 'tag-3' }[s.tier] || '';
      return `
        <tr>
          <td style="text-align:left">${s.name}</td>
          <td><span class="tier-tag ${cls}">${TIER_CN[s.tier] || s.tier}</span></td>
          <td>${s.cutoff}${predicted ? '*' : ''}</td>
        </tr>`;
    }).join('');
    return `
      <div style="margin-top:16px">
        <div style="font-size:12px;color:var(--text-sub);font-weight:700;margin-bottom:6px">${title}</div>
        <table class="compare-table">
          <tbody>${rows}</table>
        </table>
        ${predicted ? '<p class="muted" style="font-size:10px;margin-top:4px">* 预测分，仅供娱乐</p>' : ''}
      </div>
    `;
  }

  function bindEvents(result, input) {
    document.getElementById('shareBtn').addEventListener('click', () => {
      const wrap = document.getElementById('shareWrap');
      ShareCard.generate(result, input, wrap);
      App.toast('卡片已生成，长按保存～');
    });
    document.getElementById('againBtn').addEventListener('click', () => {
      App.lastResult = null;
      location.hash = '#/';
    });
  }

  return { render };
})();

window.ResultPage = ResultPage;
