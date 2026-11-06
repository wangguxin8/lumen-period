/**
 * 周期预测 — 统计法, 非 AI。
 * 为什么不用 AI: 周期预测本质是"用户历史周期中位数 + 出血窗口"的统计,
 * 可解释、可信、离线可算, 比黑盒模型更让健康用户放心。
 * AI 留给第 2 周的情绪/症状分析 (那些才需要理解力)。
 */

export interface Prediction {
  nextPeriodStart: string; // 预计下次经期开始
  nextPeriodEnd: string; // 预计下次经期结束
  fertileStart: string; // 易孕窗口开始
  fertileEnd: string; // 易孕窗口结束
  ovulationDate: string; // 预计排卵日
  daysUntilPeriod: number; // 距下次经期天数
  confidence: 'high' | 'medium' | 'low';
}

/** 日期工具: 本地时区, 格式 YYYY-MM-DD */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toLocalDateKey(dt);
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000,
  );
}

/**
 * 从用户的历史经期开始日 (数组, 升序) 推算预测。
 * 用最近若干个周期的中位数, 抗单次异常。
 */
export function predict(
  periodStarts: string[], // 用户标记的经期开始日 (升序), 至少需要 1 个
  todayKey: string,
  periodLength: number,
): Prediction {
  const starts = periodStarts.filter((s) => diffDays(s, todayKey) <= 0); // 只算过去的
  if (starts.length === 0) {
    // 无历史: 用默认 28/7 兜底, 从今天往后推 (最弱置信)
    return {
      nextPeriodStart: addDays(todayKey, 14),
      nextPeriodEnd: addDays(todayKey, 14 + periodLength - 1),
      fertileStart: addDays(todayKey, 8),
      fertileEnd: addDays(todayKey, 12),
      ovulationDate: addDays(todayKey, 10),
      daysUntilPeriod: 14,
      confidence: 'low',
    };
  }

  // 周期长度 = 相邻经期开始日的间隔, 取最近 4 个的中位数
  let cycleLen = 28;
  if (starts.length >= 2) {
    const recent = starts.slice(-5);
    const gaps: number[] = [];
    for (let i = 1; i < recent.length; i++) gaps.push(diffDays(recent[i - 1], recent[i]));
    if (gaps.length > 0) {
      gaps.sort((a, b) => a - b);
      cycleLen = gaps[Math.floor((gaps.length - 1) / 2)]; // 中位数
      cycleLen = Math.max(21, Math.min(35, cycleLen)); // 生理合理区间
    }
  }

  const lastStart = starts[starts.length - 1];
  const daysSinceLast = diffDays(lastStart, todayKey);
  const daysUntilPeriod = Math.max(0, cycleLen - daysSinceLast);

  const nextPeriodStart = addDays(todayKey, daysUntilPeriod);
  const nextPeriodEnd = addDays(nextPeriodStart, periodLength - 1);

  // 排卵日 ≈ 下次经期前 14 天 (黄体期相对固定)
  const ovulationDate = addDays(nextPeriodStart, -14);
  const fertileStart = addDays(ovulationDate, -5); // 精子可存活 ~5 天
  const fertileEnd = addDays(ovulationDate, 1);

  // 置信: 历史周期越多、波动越小越高
  const confidence: Prediction['confidence'] =
    starts.length >= 4 ? 'high' : starts.length >= 2 ? 'medium' : 'low';

  return {
    nextPeriodStart,
    nextPeriodEnd,
    fertileStart,
    fertileEnd,
    ovulationDate,
    daysUntilPeriod,
    confidence,
  };
}
