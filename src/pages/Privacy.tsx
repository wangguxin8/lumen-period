import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { designTokens as t } from '../theme';
import { db } from '../db';
import { SetOnboarded, ClearOnboarded } from '../lib/onboard';

export function Privacy({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  const { t: tr } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const deleteAll = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    // 一键删除全部数据 (合规 + 隐私卖点: 数据真正归用户)
    await db.transaction('rw', db.cycleDays, db.symptoms, db.moods, db.settings, async () => {
      await db.cycleDays.clear();
      await db.symptoms.clear();
      await db.moods.clear();
      await db.settings.clear();
    });
    SetOnboarded();
    onBack();
  };

  // 更换用户: 清数据 + 清 onboarding 标记 → App 重渲染回到 Onboarding
  const switchUser = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    (async () => {
      await db.transaction('rw', db.cycleDays, db.symptoms, db.moods, db.settings, async () => {
        await db.cycleDays.clear();
        await db.symptoms.clear();
        await db.moods.clear();
        await db.settings.clear();
      });
      ClearOnboarded();
      setConfirmReset(false);
      onReset();
    })();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={backBtn} aria-label="back">←</button>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 300, color: t.textPrimary }}>{tr('privacy.title')}</h2>
      </div>

      <section style={card}>
        {[tr('privacy.body1'), tr('privacy.body2'), tr('privacy.body3')].map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 14, color: t.textSecondary, fontWeight: 300, lineHeight: 1.7, marginBottom: i < 2 ? t.space2 : 0 }}>
            {p}
          </p>
        ))}
      </section>

      <section style={card}>
        <div style={{ fontSize: 12, color: t.accentText, fontWeight: 500 }}>{tr('privacy.notMedical')}</div>
      </section>

      <button
        onClick={deleteAll}
        style={{
          padding: '12px',
          borderRadius: t.radiusSm,
          border: `1px solid ${confirming ? '#FF453A' : t.border}`,
          background: confirming ? 'rgba(255,69,58,0.08)' : 'none',
          color: confirming ? '#FF453A' : t.textMuted,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        {confirming ? tr('privacy.confirmDelete') : tr('privacy.deleteAll')}
      </button>

      <button
        onClick={switchUser}
        style={{
          padding: '12px',
          borderRadius: t.radiusSm,
          border: `1px solid ${confirmReset ? t.accent : t.border}`,
          background: 'none',
          color: t.textSecondary,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        {confirmReset ? tr('privacy.confirmReset') : tr('privacy.switchUser')}
      </button>
    </div>
  );
}

const card: React.CSSProperties = {
  background: t.surface,
  borderRadius: t.radius,
  padding: t.space3,
  border: `1px solid ${t.border}`,
};

const backBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: `1px solid ${t.border}`,
  background: t.surface,
  color: t.textPrimary,
  fontSize: 16,
  cursor: 'pointer',
};
