/**
 * "今日提示" 的 已读/当天不再显示 开关。
 * 按本地日期存 key, 每天自动重置 (跨天后重新允许显示)。
 */
import { todayKey } from '../hooks/useCycle';

const KEY = 'lumen_tip_dismissed'; // 值 = 当天日期 key, 如 '2026-11-06'

export function isTipDismissedToday(): boolean {
  try {
    return localStorage.getItem(KEY) === todayKey();
  } catch {
    return false;
  }
}

export function dismissTipToday(): void {
  try {
    localStorage.setItem(KEY, todayKey());
  } catch {
    /* 隐私模式等无 localStorage 时忽略 */
  }
}
