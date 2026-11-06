/**
 * 是否已完成 onboarding (首次设定了经期开始日 + 周期长度)。
 * 存在 localStorage, 作为"第一次用"的开关。
 */
const KEY = 'lumen_onboarded';

export function HasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 标记已完成 onboarding。
 * 用 try/catch 兜底: 隐私模式 / 存储被拦时 localStorage 会抛,
 * 抛了不接住就是"start 点了没反应"且 console 无红色报错的根因。
 */
export function SetOnboarded() {
  try {
    localStorage.setItem(KEY, '1');
  } catch (e) {
    console.error('[Lumen] 无法写入 onboarding 标记 (localStorage 不可用?)', e);
  }
}

/** 退出登录/重置: 清 onboarding 标记 (数据删除由调用方负责) */
export function ClearOnboarded() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
