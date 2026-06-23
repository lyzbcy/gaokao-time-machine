/* ===========================================================
 * rank-converter.js — 位次锚定换算模块
 *
 * 核心思想：分数因试题难度每年波动，但「全省排名」相对稳定。
 *   用户当年分数 → 当年一分一段表 → 位次 → 2026一分一段表 → 等位分
 *
 * 提供双向换算（分段线性插值）+ 口径路由。
 *
 * 数据来源：window.RANK_DATA（js/data/rank-tables.json）
 * =========================================================== */

const RankConverter = (function () {

  function getRankData() {
    if (!window.RANK_DATA) {
      console.error('[RankConverter] RANK_DATA 未加载');
      return null;
    }
    return window.RANK_DATA;
  }

  /**
   * 取某省某年某科类的一分一段表
   * @returns {object|null} { label, batchLine, specialLine, points:[[score,rank]...], source }
   */
  function getTable(provinceCode, year, track) {
    const d = getRankData();
    if (!d || !d.provinces[provinceCode]) return null;
    const prov = d.provinces[provinceCode];
    if (!prov.years[year]) return null;
    // track 精确匹配；兼容老口径查找
    let t = prov.years[year][track];
    if (t) return t;
    // 同科类的别名兼容（science↔physics, arts↔history）
    const aliases = { science: 'physics', physics: 'science', arts: 'history', history: 'arts' };
    if (aliases[track]) t = prov.years[year][aliases[track]];
    return t || null;
  }

  /**
   * 该省该年有哪些可选科类（用于UI下拉）
   */
  function tracksFor(provinceCode, year) {
    const d = getRankData();
    if (!d || !d.provinces[provinceCode] || !d.provinces[provinceCode].years[year]) return [];
    return Object.keys(d.provinces[provinceCode].years[year]);
  }

  function trackLabel(track) {
    return { science: '理科', arts: '文科', physics: '物理类', history: '历史类', general: '总分' }[track] || track;
  }

  /**
   * 分数 → 位次（在某条曲线上查）
   * points 按 score 降序排列（750,749,...），rank 升序
   * 返回该分数对应的累计位次（分段线性插值）
   */
  function scoreToRank(score, points) {
    if (!points || points.length === 0) return null;
    // points[0] 是最高分(score最大,rank最小)
    // 降序：[750,1],[749,3],...
    if (score >= points[0][0]) return points[0][1];
    if (score <= points[points.length - 1][0]) return points[points.length - 1][1];

    for (let i = 0; i < points.length - 1; i++) {
      const [s1, r1] = points[i];
      const [s2, r2] = points[i + 1];
      // s1 > s2（降序），r1 < r2
      if (score <= s1 && score >= s2) {
        // 线性插值 rank
        const frac = (s1 - score) / (s1 - s2);
        return Math.round(r1 + (r2 - r1) * frac);
      }
    }
    return null;
  }

  /**
   * 位次 → 分数（在某条曲线上查，反向插值）
   */
  function rankToScore(rank, points) {
    if (!points || points.length === 0) return null;
    // rank 升序（随 score 降序）
    if (rank <= points[0][1]) return points[0][0]; // 最高分
    if (rank >= points[points.length - 1][1]) return points[points.length - 1][0]; // 最低分

    for (let i = 0; i < points.length - 1; i++) {
      const [s1, r1] = points[i];
      const [s2, r2] = points[i + 1];
      // r1 < r2
      if (rank >= r1 && rank <= r2) {
        const frac = (rank - r1) / (r2 - r1);
        return Math.round(s1 + (s2 - s1) * frac);
      }
    }
    return null;
  }

  /**
   * 跨年份换算：把"当年某分数"对应的位次，换算到"目标年"的等位分
   * @param {number} score 当年分数
   * @param {string} provinceCode
   * @param {number} fromYear
   * @param {string} track 科类（science/arts/physics/history/general）
   * @param {number} targetYear 目标年（通常2026）
   * @returns {object} { rank, equivalentScore, fromTrack, targetTrack, detail }
   *
   * 处理口径切换：若 fromYear 和 targetYear 的 track 不同（如老→新高考），
   * 用同科类等价（science↔physics, arts↔history）映射。
   */
  function convert(score, provinceCode, fromYear, track, targetYear = 2026) {
    const fromTable = getTable(provinceCode, fromYear, track);
    if (!fromTable) {
      return { error: '无该省该年该科类数据', rank: null, equivalentScore: null };
    }

    // 求当年位次
    const rank = scoreToRank(score, fromTable.points);

    // 目标年的 track（可能因新高考切换而不同）
    let targetTrack = track;
    const targetTracks = tracksFor(provinceCode, targetYear);
    if (targetTracks.indexOf(track) === -1) {
      // 口径切换：老→新
      if (track === 'science') targetTrack = targetTracks.indexOf('physics') !== -1 ? 'physics' : targetTracks[0];
      else if (track === 'arts') targetTrack = targetTracks.indexOf('history') !== -1 ? 'history' : targetTracks[0];
      else targetTrack = targetTracks[0];
    }

    const targetTable = getTable(provinceCode, targetYear, targetTrack);
    if (!targetTable) {
      return { error: '无目标年数据', rank, equivalentScore: null };
    }

    const equivalentScore = rankToScore(rank, targetTable.points);

    return {
      rank,
      equivalentScore,
      fromTrack: track,
      fromTrackLabel: trackLabel(track),
      targetTrack,
      targetTrackLabel: trackLabel(targetTrack),
      fromBatchLine: fromTable.batchLine,
      targetBatchLine: targetTable.batchLine,
      source: targetTable.source,
      detail: `${fromYear}年${score}分（${trackLabel(track)}）位次约${rank}名，同位次在${targetYear}年（${trackLabel(targetTrack)}）约${equivalentScore}分`,
    };
  }

  return {
    convert,
    scoreToRank,
    rankToScore,
    getTable,
    tracksFor,
    trackLabel,
  };
})();

window.RankConverter = RankConverter;
