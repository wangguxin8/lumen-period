import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { designTokens as t } from '../theme';
import { db, type Settings } from '../db';
import { SetOnboarded } from '../lib/onboard';
import { todayKey } from '../hooks/useCycle';
import { setLang, currentLang } from '../lib/lang';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t: tr } = useTranslation();
  const [start, setStart] = useState<string>(todayKey());
  const [cycleLen, setCycleLen] = useState(28);
  const [periodLen] = useState(5);
  const [age, setAge] = useState<'18+' | 'minor' | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!age || saving) return;
    setSaving(true);
    console.log('[Lumen] start clicked, saving onboarding...');
    try {
      // 语言跟随 i18n 当前值 (不再硬编码), 避免 settings.lang 与界面语言不一致
      const settings: Settings = {
        cycleLength: cycleLen,
        periodLength: periodLen,
        lastPeriodStart: start,
        lang: currentLang(),
        age,
      };
      // 先落盘再切页: 保证主界面 mount 时 DB 已有数据, 消除"点 start 没反应, 刷新才好"的竞态
      await db.transaction('rw', db.settings, db.cycleDays, async () => {
        await db.settings.put({ id: 1, ...settings });
        // 把 start 标记为经期 (用户手动)
        await db.cycleDays.put({ date: start, isPeriod: true, flow: 2, markedBy: 'user' });
      });
      SetOnboarded();
      console.log('[Lumen] save complete, navigating to main app');
      onDone();
    } catch (err) {
      // 数据库写失败不再静默吞掉 — 给用户可见提示, 便于诊断
      console.error('[Lumen] onboarding save failed', err);
      alert('保存失败: ' + (err instanceof Error ? err.message : String(err)));
      setSaving(false);
    }
  };

  const canStart = age !== null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 28,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 300, letterSpacing: '-0.02em', color: t.textPrimary }}>
          {tr('onboarding.title')}
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 14, color: t.textSecondary, lineHeight: 1.7, fontWeight: 300 }}>
          {tr('onboarding.sub')}
        </p>
      </div>

      {/* 语言: 首次进 App 就该能切, 不等到设置页 */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['zh', 'en'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            style={{
              ...numChip,
              ...(currentLang() === l ? chipActive : {}),
            }}
          >
            {l === 'zh' ? '中文' : 'English'}
          </button>
        ))}
      </div>

      {/* 经期开始日 */}
      <label style={{ display: 'block', fontSize: 12, color: t.textMuted }}>
        {tr('onboarding.step1')}
        <input
          type="date"
          value={start}
          max={todayKey()}
          onChange={(e) => setStart(e.target.value)}
          style={{
            ...inputStyle,
            marginTop: 8,
            color: t.textPrimary,
          }}
        />
      </label>

      {/* 周期长度 */}
      <label style={{ display: 'block', fontSize: 12, color: t.textMuted }}>
        {tr('onboarding.step2')}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[25, 28, 31].map((v) => (
            <button
              key={v}
              onClick={() => setCycleLen(v)}
              style={{
                ...numChip,
                ...(cycleLen === v ? chipActive : {}),
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </label>

      {/* 年龄门: 未成年人数据单独处理 (完全本地, 无同步) */}
      <label style={{ display: 'block', fontSize: 12, color: t.textMuted }}>
        {tr('onboarding.step3')}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {(['18+', 'minor'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setAge(v)}
              style={{
                ...numChip,
                ...(age === v ? chipActive : {}),
              }}
            >
              {v === '18+' ? tr('onboarding.age18') : tr('onboarding.ageMinor')}
            </button>
          ))}
        </div>
        {age === 'minor' && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8, fontWeight: 300, lineHeight: 1.5 }}>
            {tr('onboarding.ageMinorNote')}
          </div>
        )}
      </label>

      <button
        onClick={save}
        disabled={!canStart || saving}
        style={{
          ...primaryBtn,
          opacity: !canStart ? 0.45 : 1,
          cursor: !canStart || saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? '…' : tr('onboarding.start')}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: `1px solid ${t.border}`,
  background: t.surface,
  fontSize: 15,
  fontWeight: 300,
  width: '100%',
  outline: 'none',
};

const numChip: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 999,
  border: `1px solid ${t.border}`,
  background: 'none',
  fontSize: 14,
  fontWeight: 300,
  color: t.textSecondary,
  cursor: 'pointer',
};

const chipActive = {
  border: `1px solid ${t.accent}`,
  background: t.accentSoft,
  color: t.accentText,
  fontWeight: 500,
} as const;

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 14,
  border: 'none',
  background: t.accent,
  color: t.surface,
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
};
