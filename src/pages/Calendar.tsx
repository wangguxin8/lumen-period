import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { designTokens as t, flowColor } from '../theme';
import { db } from '../db';
import { useSettings, usePeriodStarts, todayKey } from '../hooks/useCycle';
import { predict, toLocalDateKey } from '../cycle';
import { requiresPremium } from '../lib/paywall';

export function Calendar() {
  const { t: tr, i18n } = useTranslation();
  const settings = useSettings();
  const starts = usePeriodStarts();
  const [view, setView] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [recs, setRecs] = useState<Record<string, { isPeriod: boolean; flow?: number }>>({});

  // 记录变更时刷新 (Log 页保存后切回来能看到新标记)
  const loadRecs = useCallback(() => {
    db.cycleDays.toArray().then((rows) => {
      const m: Record<string, { isPeriod: boolean; flow?: number }> = {};
      rows.forEach((r) => (m[r.date] = { isPeriod: r.isPeriod, flow: r.flow }));
      setRecs(m);
    });
  }, []);

  useEffect(() => {
    loadRecs();
    const iv = window.setInterval(loadRecs, 30_000);
    return () => window.clearInterval(iv);
  }, [loadRecs]);

  const pred = useMemo(
    () => (starts.length ? predict(starts, todayKey(), settings.periodLength) : null),
    [starts, settings.periodLength],
  );

  const weekDays = i18n.t('calendar.week', { returnObjects: true }) as string[];

  const weeks = buildMonth(view.y, view.m);
  const monthLabel = `${view.y} · ${String(view.m + 1).padStart(2, '0')}`;

  const isPeriodDay = (key: string) => recs[key]?.isPeriod;
  const isPredPeriod = (key: string) =>
    pred ? key >= pred.nextPeriodStart && key <= pred.nextPeriodEnd : false;
  // 易孕窗/排卵 = Premium (fertility); 锁住时日历不渲染这两层
  const fertilityUnlocked = !requiresPremium('fertility');
  const isFertile = (key: string) =>
    fertilityUnlocked && pred ? key >= pred.fertileStart && key <= pred.fertileEnd : false;
  const isOvulation = (key: string) =>
    fertilityUnlocked && pred ? key === pred.ovulationDate : false;

  const prev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space3 }}>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 300, letterSpacing: '-0.01em', color: t.textPrimary }}>
        {tr('calendar.title')}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prev} style={navBtn} aria-label="prev">‹</button>
        <span style={{ fontSize: 15, fontWeight: 300, color: t.textPrimary }}>{monthLabel}</span>
        <button onClick={next} style={navBtn} aria-label="next">›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {weekDays.map((d) => (
          <div key={d} style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', fontWeight: 300 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {weeks.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const key = cell.key;
          const today = key === todayKey();
          const period = isPeriodDay(key);
          const predP = isPredPeriod(key);
          const fert = isFertile(key);
          const ovu = isOvulation(key);
          return (
            <div
              key={key}
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: today ? 500 : 300,
                color: today ? t.accentText : period ? t.surface : t.textPrimary,
                background: period
                  ? flowColor(recs[key]?.flow)
                  : predP
                    ? t.accentSoft
                    : fert
                      ? 'rgba(150, 190, 120, 0.22)'
                      : 'none',
                border: `1px solid ${today ? t.accent : period || predP ? 'transparent' : t.border}`,
              }}
            >
              <span>{cell.day}</span>
              {ovu && <span style={{ fontSize: 8, color: t.textMuted }}>◦</span>}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: t.textMuted, fontWeight: 300 }}>
        <LegendDot color={t.flowHeavy} label={tr('calendar.period')} />
        <LegendDot color={t.accentSoft} label={tr('calendar.predictedPeriod')} />
        {fertilityUnlocked && <LegendDot color='rgba(150,190,120,0.5)' label={tr('calendar.fertile')} />}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <i style={{ width: 10, height: 10, borderRadius: 4, background: color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.05)' }} />
      {label}
    </span>
  );
}

const navBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: `1px solid ${t.border}`,
  background: t.surface,
  color: t.textPrimary,
  fontSize: 16,
  cursor: 'pointer',
};

function buildMonth(y: number, m: number) {
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startWeekday = first.getDay();
  const cells: ({ key: string; day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: toLocalDateKey(new Date(y, m, d)), day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
