import { useTranslation } from 'react-i18next';
import { designTokens as t } from '../theme';
import { db } from '../db';
import { useSettings } from '../hooks/useCycle';
import { usePremium, togglePremium } from '../hooks/usePremium';
import { currentLang, setLang } from '../lib/lang';
import { remindOnOpenEnabled, setRemindOnOpen } from '../lib/notify';
import { useState } from 'react';

export function Settings({ onNavigate }: { onNavigate: (tab: 'home' | 'log' | 'calendar' | 'insights' | 'privacy') => void }) {
  const { t: tr } = useTranslation();
  const settings = useSettings();
  const lang = currentLang();
  const premium = usePremium();
  const [remindOn, setRemindOn] = useState(remindOnOpenEnabled);

  const cycleOptions = [24, 28, 32];

  const save = async (patch: Partial<typeof settings>) => {
    const row = await db.settings.get(1);
    if (row) {
      await db.settings.put({ ...row, ...patch });
    } else {
      // 兜底: onboarding 没跑完/数据被清, 直接建行
      await db.settings.put({ id: 1, cycleLength: 28, periodLength: 5, lang: 'zh', ...patch });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space3 }}>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 300, letterSpacing: '-0.01em', color: t.textPrimary }}>
        {tr('settings.title')}
      </h2>

      {/* 语言 */}
      <section style={card}>
        <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: t.space1 }}>
          {tr('settings.lang')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['zh', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: t.radiusSm,
                border: `1.5px solid ${lang === l ? t.accent : t.border}`,
                background: lang === l ? t.accentSoft : 'none',
                color: lang === l ? t.accentText : t.textSecondary,
                fontSize: 13,
                fontWeight: lang === l ? 500 : 300,
                cursor: 'pointer',
              }}
            >
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </section>

      {/* 周期长度 */}
      <section style={card}>
        <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: t.space1 }}>
          {tr('settings.cycleLength')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cycleOptions.map((c) => (
            <button
              key={c}
              onClick={() => save({ cycleLength: c })}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: t.radiusSm,
                border: `1.5px solid ${settings.cycleLength === c ? t.accent : t.border}`,
                background: settings.cycleLength === c ? t.accentSoft : 'none',
                color: settings.cycleLength === c ? t.accentText : t.textSecondary,
                fontSize: 14,
                fontWeight: settings.cycleLength === c ? 500 : 300,
                cursor: 'pointer',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* 异常提醒 (本地) */}
      <section style={card}>
        <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: t.space1 }}>
          {tr('alert.remindOnOpen')}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 300, lineHeight: 1.5 }}>{tr('alert.remindOnOpenSub')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: t.space1 }}>
          <button
            onClick={() => {
              const next = !remindOn;
              setRemindOn(next);
              setRemindOnOpen(next);
            }}
            aria-pressed={remindOn}
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              border: 'none',
              background: remindOn ? t.accent : t.borderStrong,
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <i
              style={{
                position: 'absolute',
                top: 3,
                left: remindOn ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: t.surface,
                transition: 'left 0.15s ease',
                display: 'block',
              }}
            />
          </button>
          <span style={{ fontSize: 12, color: remindOn ? t.accentText : t.textMuted, fontWeight: 400 }}>
            {remindOn ? tr('settings.on') : tr('settings.off')}
          </span>
        </div>
      </section>

      {/* Premium 状态 */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, color: t.textPrimary, fontWeight: 400 }}>Lumen Premium</div>
            <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 300, marginTop: 4 }}>
              {tr('paywall.sub')}
            </div>
          </div>
          <button
            onClick={() => togglePremium(!premium)}
            style={{
              padding: '9px 16px',
              borderRadius: 999,
              border: `1px solid ${premium ? t.border : 'transparent'}`,
              background: premium ? t.surface : t.accent,
              color: premium ? t.textSecondary : t.surface,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {premium ? 'Premium ✓' : tr('paywall.unlock')}
          </button>
        </div>
        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 8, fontWeight: 300 }}>{tr('paywall.demo')}</div>
      </section>

      {/* 隐私入口 */}
      <button onClick={() => onNavigate('privacy')} style={{ ...cardBtn, width: '100%' }}>
        {tr('privacy.title')} <span style={{ float: 'right' }}>→</span>
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

const cardBtn: React.CSSProperties = {
  background: t.surface,
  borderRadius: t.radius,
  padding: '16px 22px',
  border: `1px solid ${t.border}`,
  color: t.textPrimary,
  fontSize: 14,
  fontWeight: 300,
  cursor: 'pointer',
  textAlign: 'left',
};
