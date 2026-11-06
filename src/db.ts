import Dexie, { type Table } from 'dexie';

/**
 * Lumen 数据层 — 本地优先, 零云。
 * 所有周期/症状/情绪数据只存这台设备的 IndexedDB (Dexie), 不上传任何服务器。
 * "隐私本地"是核心卖点, 故 schema 设计为可独立运行的本地库。
 */

export interface CycleDay {
  /** 日期, 形如 '2026-11-04' (本地时区, 不用 UTC 避免跨天漂移) */
  date: string;
  /** 是否经期 (出血日) */
  isPeriod: boolean;
  /** 出血量 1-4 (0=无, 1=点滴, 2=少量, 3=中等, 4=大量), 非经期可空 */
  flow?: number;
  /** 是否用户手动标记(区别于自动回填) */
  markedBy?: 'user' | 'system';
  [key: string]: unknown;
}

export interface SymptomEntry {
  id?: number;
  date: string;
  /** 症状 key (i18n), 如 'cramps' | 'bloating' | 'headache' */
  key: string;
  /** 强度 1-3 */
  intensity: number;
}

export interface MoodEntry {
  id?: number;
  date: string;
  /** 情绪 key: 'calm' | 'happy' | 'anxious' | 'sad' | 'irritable' */
  key: string;
  /** 备注 (可选) */
  note?: string;
}

export interface Settings {
  id?: number;
  /** 默认周期长度 (天) */
  cycleLength: number;
  /** 默认经期长度 (天) */
  periodLength: number;
  /** 最近一次经期开始日, 用于预测 */
  lastPeriodStart?: string;
  /** 语言 'zh' | 'en' */
  lang: string;
  /** 用户年龄段 (年龄门 + 未成年人数据单独处理): '18+' | 'minor' */
  age?: '18+' | 'minor';
  /** 是否付费 (订阅), 用于付费墙 */
  premium?: boolean;
}

export class LumenDB extends Dexie {
  cycleDays!: Table<CycleDay, string>;
  symptoms!: Table<SymptomEntry, number>;
  moods!: Table<MoodEntry, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super('lumen');
    this.version(1).stores({
      cycleDays: 'date',
      symptoms: '++id, date',
      moods: '++id, date',
      settings: '++id',
    });
  }
}

export const db = new LumenDB();

/**
 * 导出全部本地数据 (用于端到端加密云同步, Day 7)。
 * 返回的是纯 JSON, 加密由调用方 (lib/crypto.ts) 负责。
 */
export async function exportAllData(): Promise<Record<string, unknown>> {
  const [cycleDays, symptoms, moods, settings] = await Promise.all([
    db.cycleDays.toArray(),
    db.symptoms.toArray(),
    db.moods.toArray(),
    db.settings.toArray(),
  ]);
  return { cycleDays, symptoms, moods, settings };
}

/** 把导出的数据写回本地 (云同步拉取后) */
export async function importAllData(data: {
  cycleDays?: CycleDay[];
  symptoms?: SymptomEntry[];
  moods?: MoodEntry[];
  settings?: Settings[];
}): Promise<void> {
  await db.transaction('rw', db.cycleDays, db.symptoms, db.moods, db.settings, async () => {
    if (data.cycleDays?.length) await db.cycleDays.bulkPut(data.cycleDays);
    if (data.symptoms?.length) await db.symptoms.bulkPut(data.symptoms);
    if (data.moods?.length) await db.moods.bulkPut(data.moods);
    if (data.settings?.length) await db.settings.bulkPut(data.settings);
  });
}

