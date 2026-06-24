/* ===========================================================
 * home.js — 首页
 *
 * 包含：英雄区、输入表单（省份/年份/分数）、开盒按钮、
 *       今日标签排行榜、最新开盒动态流。
 * =========================================================== */

const HomePage = (function () {

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="hero">
        <h1 class="hero-title">你的高考分数<br>放2026年能上啥？</h1>
        <p class="hero-sub">输入你当年的分数，时光机给你算算现在能上什么学校 🔮</p>
      </section>

      <section class="card input-card">
        <div class="input-row">
          <label>📍 高考省份 <span class="req">*</span></label>
          <select class="select" id="f-province">
            <option value="">选一个省</option>
          </select>
        </div>

        <div class="input-row">
          <label>📅 高考年份 <span class="req">*</span></label>
          <select class="select" id="f-year">
            <option value="">选个年份</option>
          </select>
        </div>

        <div class="input-row">
          <label>📚 科类 <span class="req">*</span></label>
          <select class="select" id="f-track">
            <option value="">先选省份和年份</option>
          </select>
          <span class="muted" style="font-size:11px">科类随省份和年份变化（文理 / 物理历史 / 总分）</span>
        </div>

        <div class="input-row">
          <label>💯 当年总分 <span class="req">*</span></label>
          <input class="input" id="f-score" type="number" min="0" max="750"
                 placeholder="比如 580">
        </div>

        <div class="input-row">
          <label>🏅 当年全省排名 <span class="req">*</span></label>
          <input class="input" id="f-rank" type="number" min="1" placeholder="比如 12000">
          <span class="muted" style="font-size:11px">位次比分数更准（每年难度不同，分数会变但排名稳定）</span>
        </div>

        <div class="input-row">
          <label>🎓 当年录取的学校（选填，可输入筛选）</label>
          <input class="input" id="f-school" list="schoolList" autocomplete="off"
                 placeholder="输入校名筛选，或直接填列表外的学校">
          <datalist id="schoolList"></datalist>
          <span class="muted" style="font-size:11px">从列表选会自动带出该校历年数据；填列表外的自定义学校需补「2026预计录取分」</span>
        </div>

        <div class="input-row" id="customSchoolRow" style="display:none">
          <label>🔢 自定义学校的 2026 预计录取分 <span style="color:var(--pink)">*</span></label>
          <input class="input" id="f-custom2026" type="number" min="0" max="750"
                 placeholder="比如 590（用于判定今年还能不能上）">
          <span class="muted" style="font-size:11px">列表外学校没有历年数据，需手动录入今年预测分</span>
        </div>

        <div class="input-row">
          <label>📖 专业名（选填，参与判定）</label>
          <input class="input" id="f-major" type="text" placeholder="比如 计算机科学与技术">
        </div>
        <div class="input-row" id="majorScoreRow" style="display:none">
          <label>🎯 该专业当年录取分（选填，用于专业级判定）</label>
          <input class="input" id="f-majorScore" type="number" min="0" max="750"
                 placeholder="比如 595（填了按专业分判，不填按学校分判）">
        </div>

        <button class="open-btn" id="openBtn">
          <img class="btn-emoji" src="img/ui/box.png" alt="" onerror="this.style.display='none'">
          <span>🔮 开 盒</span>
        </button>
        <p class="muted text-center mt-8">已有 <b id="totalCount">0</b> 人开过盒</p>
      </section>

      <!-- 今日标签排行榜 -->
      <h2 class="section-title">📊 今日标签排行榜</h2>
      <section class="card" id="todayRankCard">
        <div class="skeleton" style="height:14px;width:60%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:10px;width:100%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:10px;width:80%"></div>
      </section>

      <!-- 最新动态流 -->
      <h2 class="section-title">🌊 开盒动态</h2>
      <section class="card" id="feedCard">
        <div class="skeleton" style="height:36px;width:100%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:36px;width:100%"></div>
      </section>
    `;

    fillOptions();
    bindEvents();
    loadStats();
  }

  function fillOptions() {
    const provSel = document.getElementById('f-province');
    for (const code in SCORE_DATA.provinces) {
      const p = SCORE_DATA.provinces[code];
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = p.name;
      provSel.appendChild(opt);
    }

    const yearSel = document.getElementById('f-year');
    const years = SCORE_DATA._meta.years;
    for (const y of years) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y} 年`;
      yearSel.appendChild(opt);
    }
  }

  function bindEvents() {
    document.getElementById('openBtn').addEventListener('click', onOpen);
    ['f-score', 'f-rank'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') onOpen();
      });
    });
    // 省份/年份变化 → 联动刷新科类 + 学校列表
    document.getElementById('f-province').addEventListener('change', updateTrackAndSchools);
    document.getElementById('f-year').addEventListener('change', updateTrackAndSchools);
    // 学校输入变化 → 判断是自定义（列表外）→ 显示2026分数输入框
    document.getElementById('f-school').addEventListener('input', onSchoolInput);
    document.getElementById('f-school').addEventListener('change', onSchoolInput);
    // 专业名输入 → 显示专业分输入框
    document.getElementById('f-major').addEventListener('input', e => {
      const row = document.getElementById('majorScoreRow');
      if (row) row.style.display = e.target.value.trim() ? '' : 'none';
    });
  }

  // 判断输入的学校是否在列表内（自定义校）
  function isCustomSchool(provData, name) {
    if (!name || !provData) return false;
    return !provData.schools.some(s => s.name === name);
  }

  function onSchoolInput() {
    const prov = document.getElementById('f-province').value;
    const provData = SCORE_DATA.provinces[prov];
    const name = document.getElementById('f-school').value.trim();
    const customRow = document.getElementById('customSchoolRow');
    const isCustom = name && isCustomSchool(provData, name);
    if (customRow) customRow.style.display = isCustom ? '' : 'none';
  }

  // 根据所选省份+年份，刷新科类下拉 + 学校 datalist
  function updateTrackAndSchools() {
    const prov = document.getElementById('f-province').value;
    const year = parseInt(document.getElementById('f-year').value, 10);
    const trackSel = document.getElementById('f-track');
    trackSel.innerHTML = '';

    if (!prov || !year) {
      trackSel.innerHTML = '<option value="">先选省份和年份</option>';
      return;
    }

    // 从 rank-tables 取该省该年的科类
    const tracks = (window.RANK_DATA && RANK_DATA.provinces[prov] && RANK_DATA.provinces[prov].years[year])
      ? Object.keys(RANK_DATA.provinces[prov].years[year])
      : ['science', 'arts'];
    trackSel.innerHTML = '<option value="">选科类</option>';
    tracks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = RankConverter.trackLabel(t);
      trackSel.appendChild(opt);
    });

    // 刷新学校 datalist（可输入筛选）
    const list = document.getElementById('schoolList');
    list.innerHTML = '';
    const provData = SCORE_DATA.provinces[prov];
    if (provData) {
      provData.schools.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.label = `${{ '985': '985', '211': '211', '1': '一本', '2': '二本' }[s.tier] || s.tier}`;
        list.appendChild(opt);
      });
    }
    // 选省份变化时重置学校输入和自定义框
    document.getElementById('f-school').value = '';
    onSchoolInput();
  }

  function validate() {
    const prov = document.getElementById('f-province').value;
    const year = parseInt(document.getElementById('f-year').value, 10);
    const track = document.getElementById('f-track').value;
    const score = parseInt(document.getElementById('f-score').value, 10);
    const rank = parseInt(document.getElementById('f-rank').value, 10);
    const school = document.getElementById('f-school').value.trim() || undefined;
    const major = document.getElementById('f-major').value.trim() || undefined;
    const majorScore = parseInt(document.getElementById('f-majorScore').value, 10) || undefined;
    const custom2026 = parseInt(document.getElementById('f-custom2026').value, 10) || undefined;

    if (!prov) { App.toast('请先选省份～'); return null; }
    if (!year) { App.toast('请选你的高考年份～'); return null; }
    if (!track) { App.toast('请选科类（文理/物理历史/总分）～'); return null; }
    if (!score || score < 0 || score > 750) { App.toast('分数填得不对哦（0-750）～'); return null; }
    if (!rank || rank < 1) { App.toast('请填全省排名（位次比分数更准）～'); return null; }
    // 自定义学校必须填 2026 预计分
    if (school && isCustomSchool(SCORE_DATA.provinces[prov], school) && (!custom2026 || custom2026 < 0 || custom2026 > 750)) {
      App.toast('你填的学校不在数据库，请补上「2026预计录取分」～');
      return null;
    }
    return {
      province: prov, provinceName: SCORE_DATA.provinces[prov].name,
      year, score, rank, track, chosenSchool: school, major, majorScore, custom2026,
    };
  }

  async function onOpen() {
    const input = validate();
    if (!input) return;

    const provData = SCORE_DATA.provinces[input.province];
    if (!provData) { App.toast('数据加载异常'); return; }

    // 开盒动效
    await App.playBoxAnimation();

    // 计算
    const result = BoxEngine.open(input, provData);
    result.trashTalk = TrashTalk.generate(result);

    // 保存
    const record = {
      labelId: result.label.id,
      labelName: result.label.name,
      tier: result.label.tier,
      province: input.province,
      provinceName: input.provinceName,
      year: input.year,
      score: input.score,
      rank: input.rank,
      track: input.track,
      trackLabel: RankConverter.trackLabel(input.track),
      major: input.major || '',
      majorScore: input.majorScore || null,
      chosenSchool: input.chosenSchool || '',
      equivalentScore2026: result.equivalentScore2026,
      timestamp: result.timestamp,
    };
    await Repo.saveRecord(record);

    // 跳转结果页（带数据）
    App.lastResult = result;
    App.lastInput = input;
    location.hash = '#/result';
  }

  async function loadStats() {
    // 总数
    Repo.getTotalCount().then(n => {
      const el = document.getElementById('totalCount');
      if (el) el.textContent = n;
    });

    // 今日排行榜
    try {
      const stats = await Repo.getTodayLabelStats();
      renderTodayRank(stats);
    } catch (e) {
      document.getElementById('todayRankCard').innerHTML =
        '<p class="muted text-center">数据加载失败，刷新试试</p>';
    }

    // 动态流
    try {
      const provs = await Repo.getProvinceStats();
      renderFeed(provs);
    } catch (e) {
      document.getElementById('feedCard').innerHTML =
        '<p class="muted text-center">动态加载失败</p>';
    }
  }

  function renderTodayRank(stats) {
    const card = document.getElementById('todayRankCard');
    if (!stats || stats.length === 0) {
      card.innerHTML = '<p class="muted text-center">今天还没人开盒，快来当第一个！</p>';
      return;
    }
    const html = stats.slice(0, 8).map(s => {
      const def = Labels.get(s.labelId);
      const tier = Labels.tier(def?.tier || 'n');
      const probPct = (s.prob * 100).toFixed(1);
      const color = tier.color;
      return `
        <div class="prob-bar-item">
          <div class="prob-bar-head">
            <span class="left">
              <span>${def?.emoji || '❓'}</span>
              <span>${s.name}</span>
              <span class="rarity-pill" style="font-size:9px;padding:1px 6px;border-radius:4px;background:${color};color:#fff">${tier.name}</span>
            </span>
            <span class="pct">${probPct}%</span>
          </div>
          <div class="prob-bar-track">
            <div class="prob-bar-fill" style="width:${probPct}%;background:${color}"></div>
          </div>
        </div>
      `;
    }).join('');
    card.innerHTML = html;
  }

  function renderFeed(provs) {
    const card = document.getElementById('feedCard');
    if (!provs || provs.length === 0) {
      card.innerHTML = '<p class="muted text-center">还没有人开过盒，点击上方 🔮 开盒试试～</p>';
      return;
    }
    const html = provs.slice(0, 6).map(p => {
      const def = p.topLabelDef;
      return `
        <div class="feed-item">
          <span>${def?.emoji || '🎁'}</span>
          <span class="who">${p.province}的网友</span>
          <span>抽到了</span>
          <span class="label">${def?.name || '神秘标签'}</span>
          <span class="pct" style="margin-left:auto;color:var(--text-light);font-size:11px">${p.count}次</span>
        </div>
      `;
    }).join('');
    card.innerHTML = html;
  }

  return { render };
})();

window.HomePage = HomePage;
