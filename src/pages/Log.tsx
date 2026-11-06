import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { designTokens as t, flowColor } from '../theme';
import { db, type SymptomEntry } from '../db';
import { todayKey } from '../hooks/useCycle';

const SYMPTOMS = ['sCramps', 'sBloating', 'sHeadache', 'sTender', 'sFatigue'];
const MOODS = ['mCalm', 'mHappy', 'mAnxious', 'mSad', 'mIrritable'];

export function Log() {
  const { t: tr } = useTranslation();
  const key = todayKey();
  const [isPeriod, setIsPeriod] = useState<boolean | null>(null);
  const [flow, setFlow] = useState<number | null>(null);
  const [selSymptoms, setSelSymptoms] = useState<Record<string, number>>({});
  const [selMood, setSelMood] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    // 1. 经期 + 出血量
    if (isPeriod !== null) {
      await db.cycleDays.put({
        date: key,
        isPeriod,
        flow: isPeriod ? flow ?? 1 : undefined,
        markedBy: 'user',
      });
    }
    // 2. 症状: 先清今天旧的, 再写新的
    await db.symptoms.where('date').equals(key).delete();
    if (Object.keys(selSymptoms).length) {
      const rows: SymptomEntry[] = Object.entries(selSymptoms).map(([k, i]) => ({
        date: key,
        key: k,
        intensity: i,
      }));
      await db.symptoms.bulkAdd(rows);
    }
    // 3. 情绪
    if (selMood) {
      await db.moods.where('date').equals(key).delete();
      await db.moods.add({ date: key, key: selMood });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const toggleSymptom = (k: string) => {
    setSelSymptoms((prev) => {
      const next = { ...prev };
      if (next[k]) delete next[k];
      else next[k] = 2;
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space3 }}>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 300, letterSpacing: '-0.01em', color: t.textPrimary }}>
        {tr('log.title')}
      </h2>

      {/* 今天是否经期 */}
      <section style={card}>
        <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 300, marginBottom: t.space1 }}>
          {tr('log.isPeriodToday')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SegChip active={isPeriod === true} onClick={() => { setIsPeriod(true); setFlow(2); }}>
            {tr('log.yes')}
          </SegChip>
          <SegChip active={isPeriod === false} onClick={() => setIsPeriod(false)}>
            {tr('log.no')}
          </SegChip>
        </div>

        {isPeriod && (
          <div style={{ marginTop: t.space2 }}>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 8 }}>{tr('log.flow')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4].map((f) => (
                <button
                  key={f}
                  onClick={() => setFlow(f)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 0',
                    borderRadius: 12,
                    border: `1.5px solid ${flow === f ? flowColor(f) : t.border}`,
                    background: flow === f ? t.accentSoft : 'none',
                    cursor: 'pointer',
                    color: flow === f ? t.accentText : t.textMuted,
                    fontSize: 11,
                    fontWeight: flow === f ? 500 : 300,
                  }}
                >
                  <i
                    style={{
                      width: 10 + f * 3,
                      height: 10 + f * 3,
                      borderRadius: '50%',
                      background: flowColor(f),
                      display: 'block',
                      opacity: flow === f ? 1 : 0.35,
                    }}
                  />
                  {tr(`log.flow${f}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 症状 */}
      <section style={card}>
        <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 300, marginBottom: t.space1 }}>
          {tr('log.symptoms')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SYMPTOMS.map((k) => {
            const on = selSymptoms[k];
            return (
              <button
                key={k}
                onClick={() => toggleSymptom(k)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 999,
                  border: `1px solid ${on ? t.accent : t.border}`,
                  background: on ? t.accentSoft : 'none',
                  color: on ? t.accentText : t.textSecondary,
                  fontSize: 13,
                  fontWeight: on ? 500 : 300,
                  cursor: 'pointer',
                }}
              >
                {tr(`log.${k}`)}
              </button>
            );
          })}
        </div>
      </section>

      {/* 情绪 */}
      <section style={card}>
        <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 300, marginBottom: t.space1 }}>
          {tr('log.mood')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MOODS.map((k) => {
            const on = selMood === k;
            return (
              <button
                key={k}
                onClick={() => setSelMood(on ? null : k)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 999,
                  border: `1px solid ${on ? t.accent : t.border}`,
                  background: on ? t.accentSoft : 'none',
                  color: on ? t.accentText : t.textSecondary,
                  fontSize: 13,
                  fontWeight: on ? 500 : 300,
                  cursor: 'pointer',
                }}
              >
                {tr(`log.${k}`)}
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={save}
        style={{
          padding: '14px',
          borderRadius: 14,
          border: 'none',
          background: saved ? t.flowModerate : t.accent,
          color: t.surface,
          fontSize: 15,
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        {saved ? tr('log.saved') : tr('log.save')}
      </button>
    </div>
  );
}

function SegChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '11px',
        borderRadius: 12,
        border: `1.5px solid ${active ? t.accent : t.border}`,
        background: active ? t.accentSoft : 'none',
        color: active ? t.accentText : t.textSecondary,
        fontSize: 14,
        fontWeight: active ? 500 : 300,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const card: React.CSSProperties = {
  background: t.surface,
  borderRadius: t.radius,
  padding: t.space3,
  border: `1px solid ${t.border}`,
};
