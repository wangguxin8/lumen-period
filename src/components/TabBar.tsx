import { useTranslation } from 'react-i18next';
import { designTokens as t } from '../theme';

export type TabKey = 'home' | 'log' | 'calendar' | 'insights';

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const { t: tr } = useTranslation();
  const items: { key: TabKey; label: string; icon: string }[] = [
    { key: 'home', label: tr('nav.home'), icon: '⌂' },
    { key: 'log', label: tr('nav.log'), icon: '✎' },
    { key: 'calendar', label: tr('nav.calendar'), icon: '▦' },
    { key: 'insights', label: tr('nav.insights'), icon: '✳' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: t.surface,
        borderTop: `1px solid ${t.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 50,
      }}
    >
      {items.map((it) => {
        const on = active === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '12px 0 10px',
              minHeight: 60,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: on ? t.accentText : t.textMuted,
              transition: 'color 0.15s ease',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{it.icon}</span>
            <span style={{ fontSize: 10, fontWeight: on ? 500 : 300, letterSpacing: '0.04em' }}>
              {it.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
