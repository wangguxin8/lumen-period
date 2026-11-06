/**
 * 订阅付费墙 (Day 6) — 免费 vs Premium 功能边界。
 * 定位: C 异常预警 + 就医指导 — 预警是全 app 的差异化核心, 锁在 Premium。
 * 免费: 记录 + 基础周期预测 + 日历 + 基础周期洞察
 * Premium: 异常预警(含推送) · 医生报告导出 · 易孕窗 · 情绪×周期摘要
 *
 * MVP 阶段: 仅本地开关 (demo), 接 Stripe/RevenueCat 时替换 isPremium 的读取来源即可,
 * 功能边界逻辑 (PREMIUM_FEATURES + 各页 gate) 不变。
 */

import { db, type Settings } from '../db';

const KEY = 'lumen_premium';

/** 需要 Premium 的功能 key (UI 按此判断是否锁)。
 * 定位顺序即价值顺序: alerts(核心) > report > fertility > aiAnalysis */
export const PREMIUM_FEATURES = [
  'alerts', // 异常预警 + 就医指导 (差异化核心)
  'report', // 医生报告导出
  'fertility', // 生育预测 / 易孕窗
  'aiAnalysis', // 情绪×周期摘要 (本地, 见 insights.moodCycle)
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

/** 本地读取 Premium 开关 (MVP demo; 接支付后改为读支付状态) */
export function isPremium(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** 设置 Premium (demo 用; 接 Stripe 后由支付回调调用) */
export function setPremium(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** 某功能是否需要 Premium (feature 决定 Premium 内容, 解锁状态决定锁不锁) */
export function requiresPremium(feature: PremiumFeature): boolean {
  void feature;
  return !isPremium();
}

/** 取用户 settings (Premium 也存这里, 便于将来同步) */
export async function getUserSettings(): Promise<Settings | undefined> {
  return db.settings.get(1);
}
