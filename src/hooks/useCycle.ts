import { useEffect, useState } from 'react';
import { db, type Settings, type SymptomEntry, type MoodEntry } from '../db';

export interface TodayInfo {
  isPeriod: boolean;
  flow?: number;
}

/** 今天的记录状态 */
export function useToday(): TodayInfo {
  const [info, setInfo] = useState<TodayInfo>({ isPeriod: false });
  const key = todayKey();
  useEffect(() => {
    db.cycleDays.get(key).then((d) => {
      setInfo({ isPeriod: !!d?.isPeriod, flow: d?.flow });
    });
  }, [key]);
  return info;
}

export function useSettings(): Settings {
  const [s, setS] = useState<Settings>({ cycleLength: 28, periodLength: 5, lang: 'zh' });
  useEffect(() => {
    db.settings
      .get(1)
      .then((row) => {
        if (row) setS(row);
      })
      .catch(() => {});
  }, []);
  return s;
}

/** 所有标记为经期的"开始日" (用于周期预测), 升序 */
export function usePeriodStarts(): string[] {
  const [starts, setStarts] = useState<string[]>([]);
  useEffect(() => {
    db.cycleDays
      .toArray()
      .then((all) => {
        const dates = all
          .filter((d) => d.isPeriod && (d.markedBy === 'user' || d.markedBy === 'system'))
          .map((d) => d.date)
          .sort();
        // 只保留"经期开始日" (前一天不是经期)
        const result = dates.filter((_, i) => i === 0 || !dates[i - 1]);
        setStarts(result);
      })
      .catch(() => {});
  }, []);
  return starts;
}

/** 月度聚合 (Day 4 + 给 Insights 页): 周期长度序列 / 经期长度 / 情绪与症状统计 */
export interface MonthlyStats {
  recentCycles: number[]; // 最近周期长度序列 (升序按时间)
  lastPeriodLength: number;
  heavyFlowDays: number;
  moodCounts: Record<string, number>; // 情绪 key -> 次数
  symptomCounts: Record<string, number>;
  periodDaysTotal: number; // 本月经期天数
}

export function useMonthlyStats(): MonthlyStats {
  const [stats, setStats] = useState<MonthlyStats>({
    recentCycles: [],
    lastPeriodLength: 0,
    heavyFlowDays: 0,
    moodCounts: {},
    symptomCounts: {},
    periodDaysTotal: 0,
  });
  useEffect(() => {
    (async () => {
      try {
        const [days, moods, symptoms] = await Promise.all([
          db.cycleDays.toArray(),
          db.moods.toArray(),
          db.symptoms.toArray(),
        ]);

        // 周期长度: 相邻经期开始日的间隔
        const starts = days
          .filter((d) => d.isPeriod)
          .map((d) => d.date)
          .sort();
        const cycleStarts = starts.filter((_, i) => i === 0 || !starts[i - 1]);
        const recentCycles: number[] = [];
        for (let i = 1; i < cycleStarts.length; i++) {
          const a = new Date(cycleStarts[i - 1]).getTime();
          const b = new Date(cycleStarts[i]).getTime();
          recentCycles.push(Math.round((b - a) / 86400000));
        }

        // 经期长度: 每个"开始日"往后连续经期的天数, 取最近一次
        let lastPeriodLength = 0;
        if (cycleStarts.length) {
          const lastStart = cycleStarts[cycleStarts.length - 1];
          let len = 0;
          const startIdx = days.findIndex((d) => d.date === lastStart);
          if (startIdx >= 0) {
            for (let i = startIdx; i < days.length; i++) {
              const cur = new Date(days[i].date).getTime();
              const prev = i > 0 ? new Date(days[i - 1].date).getTime() : 0;
              if (i === startIdx || Math.round((cur - prev) / 86400000) === 1) len++;
              else break;
            }
            lastPeriodLength = len;
          }
        }

        const heavyFlowDays = days.filter((d) => d.isPeriod && (d.flow === 3 || d.flow === 4)).length;

        const moodCounts: Record<string, number> = {};
        moods.forEach((m) => (moodCounts[m.key] = (moodCounts[m.key] || 0) + 1));

        const symptomCounts: Record<string, number> = {};
        symptoms.forEach((s) => (symptomCounts[s.key] = (symptomCounts[s.key] || 0) + 1));

        setStats({
          recentCycles,
          lastPeriodLength,
          heavyFlowDays,
          moodCounts,
          symptomCounts,
          periodDaysTotal: days.filter((d) => d.isPeriod).length,
        });
      } catch {
        /* 保留空态 */
      }
    })();
  }, []);
  return stats;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type { SymptomEntry, MoodEntry };
