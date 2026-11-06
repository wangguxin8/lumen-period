import { useSyncExternalStore } from 'react';
import { isPremium, setPremium as _setPremium } from '../lib/paywall';

// 让 Premium 状态对 React 可响应 (localStorage 变化时刷新所有订阅者)
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

/** 响应式读 Premium */
export function usePremium(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isPremium(),
  );
}

/** 切换 Premium (MVP demo; 接支付后由回调调用) */
export function togglePremium(on: boolean) {
  _setPremium(on);
  notify();
}
