/* ===========================================================
 * predictor.js — 2026 高考录取分预测模型
 *
 * 方法：加权线性回归（近年权重更高）+ 趋势平滑
 *   - 对某校某省 2019-2025 的录取最低分序列拟合
 *   - 近年数据权重更大（避免久远年份干扰）
 *   - 若数据点过少，退化为简单外推
 *
 * ⚠️ 100% 模型预测结果，仅供娱乐，不代表真实录取情况
 * =========================================================== */

const Predictor = (function () {

  // 权重：越近的年份权重越高（2025 > 2024 > ... > 2019）
  // 指数衰减，base = 1.35
  function weight(year, latestYear) {
    const gap = latestYear - year;
    return Math.pow(1.35, -gap); // gap=0 → 1, gap=1 → 0.74, ...
  }

  /**
   * 加权线性回归：y = a + b*x
   * @param {number[]} xs 年份（如 [2019,2020,...]）
   * @param {number[]} ys 对应分数
   * @param {number[]} ws 权重
   * @returns {{a:number,b:number}}
   */
  function weightedLinearRegression(xs, ys, ws) {
    const n = xs.length;
    let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0;
    for (let i = 0; i < n; i++) {
      const w = ws[i];
      sw += w;
      swx += w * xs[i];
      swy += w * ys[i];
      swxx += w * xs[i] * xs[i];
      swxy += w * xs[i] * ys[i];
    }
    const denom = sw * swxx - swx * swx;
    if (Math.abs(denom) < 1e-9) {
      // 退化：所有年份同分 / 数据退化，返回均值
      const meanY = swy / sw;
      return { a: meanY, b: 0 };
    }
    const b = (sw * swxy - swx * swy) / denom;
    const a = (swy - b * swx) / sw;
    return { a, b };
  }

  /**
   * 对单条分数序列预测目标年份分数
   * @param {Object<number,number>} yearScoreMap {2019:585, 2020:590, ...}（缺失年份可省略）
   * @param {number} targetYear 预测年份（如 2026）
   * @returns {{predicted:number, confidence:number, sampleYears:number[]}}
   */
  function predict(yearScoreMap, targetYear) {
    const years = Object.keys(yearScoreMap).map(Number).filter(y => !isNaN(yearScoreMap[y])).sort((a, b) => a - b);
    if (years.length === 0) return { predicted: null, confidence: 0, sampleYears: [] };

    const xs = years;
    const ys = years.map(y => yearScoreMap[y]);
    const latestYear = years[years.length - 1];
    const ws = years.map(y => weight(y, latestYear));

    let predicted;
    if (years.length >= 3) {
      // 加权线性回归
      const { a, b } = weightedLinearRegression(xs, ys, ws);
      predicted = a + b * targetYear;
    } else if (years.length === 2) {
      // 两点线性外推
      const slope = (ys[1] - ys[0]) / (xs[1] - xs[0]);
      predicted = ys[1] + slope * (targetYear - xs[1]);
    } else {
      // 单点：直接沿用
      predicted = ys[0];
    }

    // 限幅：单年波动不超过 ±15 分（避免外推爆炸）
    const lastReal = ys[ys.length - 1];
    const MAX_STEP = 15;
    if (targetYear > latestYear) {
      const maxAllowed = lastReal + MAX_STEP * (targetYear - latestYear);
      const minAllowed = lastReal - MAX_STEP * (targetYear - latestYear);
      predicted = Math.min(maxAllowed, Math.max(minAllowed, predicted));
    }

    predicted = Math.round(predicted);

    // 置信度：样本数越多、波动越小，置信度越高（纯娱乐指标）
    let confidence = 50;
    confidence += Math.min(years.length * 5, 30); // 数据多加分
    if (years.length >= 2) {
      const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
      const variance = ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length;
      const std = Math.sqrt(variance);
      confidence += Math.max(0, 20 - std * 2); // 波动小加分
    }
    confidence = Math.max(20, Math.min(95, Math.round(confidence)));

    return { predicted, confidence, sampleYears: years };
  }

  /**
   * 批量预测：对一所学校所有专业方向预测
   * @param {Object} school 学校记录 {name, tier, province, scores:{2019:..}, ...}
   * @param {number} targetYear
   */
  function predictSchool(school, targetYear = 2026) {
    const r = predict(school.scores || {}, targetYear);
    return {
      name: school.name,
      tier: school.tier,
      province: school.province,
      predicted2026: r.predicted,
      confidence: r.confidence,
      sampleYears: r.sampleYears,
      // 最新一年真实分（用于对比展示）
      lastRealYear: r.sampleYears.length ? Math.max(...r.sampleYears) : null,
      lastRealScore: r.sampleYears.length ? (school.scores[Math.max(...r.sampleYears)] || null) : null,
    };
  }

  return { predict, predictSchool, weightedLinearRegression };
})();

// 暴露到全局
window.Predictor = Predictor;
