import { type Prediction } from './cycle';

/**
 * 异常预警规则引擎 (Day 5) — 合规红线: 只提示"建议就医", 绝不诊断。
 * 用可解释的规则而非 AI: 健康 app 的异常提示必须可审、可解释、可追溯。
 *
 * 输出分两层:
 *  - alerts: 真正的"值得留意/建议就医"项 (按严重度排序)
 *  - advises: 非紧急的"记录参考/生活方式/中医口吻"贴士, 不触发就医, 纯参考
 */

export type Severity = 'info' | 'warn' | 'action';

export interface Alert {
  /** i18n key 前缀, UI 拼 alert.<key>.title / .body */
  key: string;
  severity: Severity;
}

/** 非紧急的个性化贴士 (生活方式/周期阶段/中医口吻), 不触发就医 */
export interface Advise {
  /** i18n key 前缀, UI 拼 advise.<key>.text */
  key: string;
}

export interface RuleInput {
  recentCycles: number[]; // 最近若干周期长度 (天, 升序)
  lastPeriodLength: number;
  heavyFlowDays: number;
  pred?: Prediction;
  /** 今天是否经期中 */
  isPeriodToday?: boolean;
  /** 今天周期第几天 (1..cycleLen), 用于阶段自适应 */
  dayInCycle?: number;
  /** 周期长度 */
  cycleLength?: number;
  /** 今天记录的经量 1-4 */
  todayFlow?: number;
}

export interface RuleOutput {
  alerts: Alert[];
  advises: Advise[];
}

export function runRules(input: RuleInput): RuleOutput {
  const alerts: Alert[] = [];
  const {
    recentCycles,
    lastPeriodLength,
    heavyFlowDays,
    pred,
    isPeriodToday,
    dayInCycle,
    cycleLength,
    todayFlow,
  } = input;

  // ── 1. 值得留意/建议就医 (alerts, 原逻辑不变) ──
  if (recentCycles.length >= 3) {
    const range = Math.max(...recentCycles) - Math.min(...recentCycles);
    if (range > 7) alerts.push({ key: 'irregularCycle', severity: 'warn' });
  }

  const lastCycle = recentCycles[recentCycles.length - 1];
  if (lastCycle !== undefined) {
    if (lastCycle < 21) alerts.push({ key: 'shortCycle', severity: 'warn' });
    else if (lastCycle > 35) alerts.push({ key: 'longCycle', severity: 'warn' });
  }

  if (lastPeriodLength > 7) alerts.push({ key: 'periodTooLong', severity: 'action' });
  else if (lastPeriodLength < 2 && lastPeriodLength > 0) {
    alerts.push({ key: 'periodTooShort', severity: 'warn' });
  }

  if (heavyFlowDays >= 3) alerts.push({ key: 'heavyFlow', severity: 'action' });

  if (pred && pred.confidence === 'low' && recentCycles.length < 2) {
    alerts.push({ key: 'keepLogging', severity: 'info' });
  }

  // ── 2. 严重度分级建议 (按经量给不同措辞, 仍守合规出口) ──
  if (isPeriodToday && todayFlow !== undefined) {
    if (todayFlow >= 4) {
      // 经量大: 升级措辞, 保留就医出口 (heavyFlow 规则已覆盖"多天", 这里是"今天"即时提示)
      if (heavyFlowDays < 3) alerts.push({ key: 'heavyFlowToday', severity: 'warn' });
    } else if (todayFlow === 1) {
      alerts.push({ key: 'lightFlowToday', severity: 'info' });
    }
  }

  // ── 3. 周期阶段自适应 (advises, 非紧急, 纯记录参考) ──
  const phase = cyclePhase(dayInCycle, cycleLength, isPeriodToday);
  const advisePhase = phase ? { key: phase } : null;

  // ── 4. 生活方式 + 中医口吻 (advises, 全部标注"记录参考, 非医学建议") ──
  const lifestyleKeys: string[] = [];
  if (isPeriodToday) {
    lifestyleKeys.push('lifestylePeriod'); // 经期保暖/补水
  }
  if (phase === 'luteal') {
    lifestyleKeys.push('lifestyleLuteal'); // 经前 PMS 记录
  }
  if (phase === 'ovulation') {
    lifestyleKeys.push('lifestyleFertile'); // 易孕窗记录
  }

  // 排序: 先严重 (action > warn > info), 同级保持稳定
  const order: Record<Severity, number> = { action: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  const advises: Advise[] = [];
  if (advisePhase) advises.push(advisePhase);
  lifestyleKeys.forEach((k) => advises.push({ key: k }));
  // 中医口吻贴士 (经期/经前) 放在阶段贴士之后
  if (isPeriodToday || phase === 'luteal') {
    advises.push({ key: 'tcmWarm' });
  }

  return { alerts, advises };
}

/** 根据当前周期日 + 是否经期, 判断所处阶段 (i18n key) */
function cyclePhase(
  dayInCycle: number | undefined,
  cycleLength: number | undefined,
  isPeriodToday: boolean | undefined,
): string | null {
  if (isPeriodToday) return 'period';
  if (dayInCycle === undefined || cycleLength === undefined) return null;
  const ovu = cycleLength - 14; // 排卵日 ≈ 下次经期前 14 天
  const fertileStart = Math.max(1, ovu - 5);
  const fertileEnd = ovu + 1;
  if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) return 'fertile';
  if (dayInCycle === ovu) return 'ovulation';
  if (dayInCycle > ovu && dayInCycle <= cycleLength) return 'luteal';
  return 'follicular';
}
