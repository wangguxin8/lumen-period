/**
 * 异常预警的"预警"载体 — 主动通知。
 *
 * 合规: 只提醒"你记录的周期/出血出现异常, 建议留意/咨询医生", 不做任何诊断措辞。
 * 文案从 i18n 的 alert.<key>.title / body 取。
 *
 * 双通道 (Capacitor 打包时原生, 浏览器回退 Web Notification):
 *  1. CapacitorPush (android/ios): @capacitor/push-notifications 本地通知,
 *     零后端 — scheduleLocalNotification, 不依赖推送服务器/证书。
 *  2. WebNotification (PWA/桌面浏览器): Notification API + SW; 桌面浏览器 PWA
 *     无法用 Web Push (需 VAPID + 推送服务器, 与本地优先原则冲突), 故走
 *     "打开着 app 时弹系统通知" + 下次打开时的本地提醒条 (见 useReminders)。
 */

import { db } from '../db';

/* ── 本地持久化: 用户已看过的预警去重 + 待提醒队列 ── */

export interface Reminder {
  id: string; // alert.key, 一个 key 一条
  date: string; // 产生提醒的日期 (YYYY-MM-DD), 次日清掉, 避免隔月重弹
}

const REMINDER_KEY = 'lumen_reminders';

export async function getReminders(): Promise<Reminder[]> {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    const list: Reminder[] = raw ? JSON.parse(raw) : [];
    // 清掉非今天的 (提醒只在产生当天提醒一次, 下次打开仍可见"你有一条待看提醒")
    const today = new Date().toISOString().slice(0, 10);
    const fresh = list.filter((r) => r.date === today);
    if (fresh.length !== list.length) localStorage.setItem(REMINDER_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return [];
  }
}

/** 存一条待提醒 (app 下次打开时弹本地提示条) */
export async function addReminder(r: Reminder): Promise<void> {
  try {
    const all = await getReminders();
    if (all.some((x) => x.id === r.id)) return;
    localStorage.setItem(REMINDER_KEY, JSON.stringify([...all, r]));
  } catch {
    /* 隐私模式存储不可用时静默丢弃 */
  }
}

export async function clearReminders(): Promise<void> {
  try {
    localStorage.removeItem(REMINDER_KEY);
  } catch {
    /* ignore */
  }
}

/* ── Capacitor 原生通道 ── */

let capacitorPush: any | null = null;
let capTried = false;

/** 惰性初始化 (只有 Capacitor 打包环境才成功) */
async function capPush() {
  if (capTried) return capacitorPush;
  capTried = true;
  if (typeof window === 'undefined' || !(window as any).Capacitor) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const p = PushNotifications as unknown as {
      register: () => Promise<unknown>;
      requestPermissions: () => Promise<{ receive: string }>;
      scheduleLocalNotification: (n: { title: string; body?: string }) => Promise<unknown>;
    };
    await p.register();
    const perms = await p.requestPermissions();
    if (perms.receive !== 'granted') return null;
    capacitorPush = p;
    return capacitorPush;
  } catch {
    return null;
  }
}

/**
 * 发一条本地通知 (Capacitor 环境 → 原生通知栏; 否则回退 Web Notification)。
 * 调用方 (Insights 页) 已保证 alerts 非空时才调用。
 * 文案走 react-i18next 的 i18next 实例 (与 UI 语言一致)。
 */
export async function fireAlertNotification(): Promise<void> {
  const i18next = (await import('i18next')).default;
  const tr = (k: string, o?: Record<string, unknown>) => i18next.t(k, o);
  const { runRules } = await import('../alerts');
  const [days, settingsRow] = await Promise.all([db.cycleDays.toArray(), db.settings.get(1)]);
  void settingsRow;

  const starts = days
    .filter((d) => d.isPeriod && (d.markedBy === 'user' || d.markedBy === 'system'))
    .map((d) => d.date)
    .sort();
  const cycleStarts = starts.filter((_, i) => i === 0 || !starts[i - 1]);
  const recentCycles: number[] = [];
  for (let i = 1; i < cycleStarts.length; i++) {
    const a = new Date(cycleStarts[i - 1]).getTime();
    const b = new Date(cycleStarts[i]).getTime();
    recentCycles.push(Math.round((b - a) / 86400000));
  }
  let lastPeriodLength = 0;
  if (cycleStarts.length) {
    const lastStart = cycleStarts[cycleStarts.length - 1];
    const idx = days.findIndex((d) => d.date === lastStart);
    if (idx >= 0) {
      for (let i = idx; i < days.length; i++) {
        const cur = new Date(days[i].date).getTime();
        const prev = i > 0 ? new Date(days[i - 1].date).getTime() : 0;
        if (i === idx || Math.round((cur - prev) / 86400000) === 1) lastPeriodLength++;
        else break;
      }
    }
  }
  const heavyFlowDays = days.filter((d) => d.isPeriod && (d.flow === 3 || d.flow === 4)).length;
  const { alerts } = runRules({ recentCycles, lastPeriodLength, heavyFlowDays });
  if (alerts.length === 0) return;

  // 取最严重的一条做通知 (action > warn > info; runRules 已排序)
  const top = alerts[0];
  const title = tr(`alert.${top.key}.title`);
  const body = tr(`alert.${top.key}.body`);
  const more = alerts.length > 1 ? tr('notify.more', { n: alerts.length - 1 }) : '';

  // 1) Capacitor 原生
  const cap = await capPush();
  if (cap) {
    try {
      cap.scheduleLocalNotification({
        title: 'Lumen · ' + tr('alert.title'),
        body: title + (more ? ` (+${more})` : ''),
      });
    } catch {
      /* 原生通道失败不阻塞 Web 通道 */
    }
  }

  // 2) Web Notification (浏览器打开着 app 时)
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
    if (Notification.permission === 'granted') {
      try {
        new Notification('Lumen · ' + tr('alert.title'), { body: body + (more ? `\n${more}` : '') });
      } catch {
        /* SW-only 环境 new Notification 会抛, 静默 */
      }
    }
  }
}

/* ── Settings 页的本地"下次打开提醒"开关 ── */

const REMIND_SWITCH = 'lumen_remind_on_open';

export function remindOnOpenEnabled(): boolean {
  try {
    return localStorage.getItem(REMIND_SWITCH) === '1';
  } catch {
    return true; // 默认开
  }
}

export function setRemindOnOpen(on: boolean): void {
  try {
    if (on) localStorage.setItem(REMIND_SWITCH, '1');
    else localStorage.removeItem(REMIND_SWITCH);
  } catch {
    /* ignore */
  }
}

/**
 * 从 db 生成"下次打开提醒条"的数据 (Insights 页挂载时调用,
 * 若存在未处理提醒则显示本地条, 点击"知道了"清掉)。
 */
export interface OpenReminder {
  id: string;
  title: string;
  body: string;
}

export async function buildOpenReminder(): Promise<OpenReminder | null> {
  if (!remindOnOpenEnabled()) return null;
  const reminders = await getReminders();
  if (reminders.length === 0) return null;
  const i18next = (await import('i18next')).default;
  const tr = (k: string) => i18next.t(k);
  const top = reminders[0];
  const r: OpenReminder = {
    id: top.id,
    title: tr(`alert.${top.id}.title`),
    body: tr(`alert.${top.id}.body`),
  };
  return r;
}

/** 生成提醒队列 (Insights 有告警时调用, 与 getReminders 去重) */
export async function queueAlerts(keys: string[]): Promise<void> {
  const dateKey = new Date().toISOString().slice(0, 10);
  for (const k of keys) await addReminder({ id: k, date: dateKey });
}
