import { useTranslation } from 'react-i18next';
import { designTokens as t, flowColor } from '../theme';
import { useToday, useSettings, usePeriodStarts, useMonthlyStats, todayKey } from '../hooks/useCycle';
import { predict, type Prediction } from '../cycle';
import { runRules } from '../alerts';
import { useState } from 'react';
import { useMemo } from 'react';
import { requiresPremium } from '../lib/paywall';
import { isTipDismissedToday, dismissTipToday } from '../lib/tip';

export function Home({ onNavigate }: { onNavigate: (tab: 'home' | 'log' | 'calendar' | 'insights' | 'privacy' | 'settings') => void }) {
  const { t: tr } = useTranslation();
  const today = useToday();
  const settings = useSettings();
  const starts = usePeriodStarts();
  const stats = useMonthlyStats();

  // "今日提示" 当天已读: 点掉后存 localStorage, 跨天自动重置
  const [tipDismissed, setTipDismissed] = useState(() => isTipDismissedToday());
  const dismissTip = () => {
    dismissTipToday();
    setTipDismissed(true);
  };

  const pred = useMemo<Prediction | null>(
    () => (starts.length ? predict(starts, todayKey(), settings.periodLength) : null),
    [starts, settings.periodLength],
  );

  const dayInCycle = pred ? safeDayInCycle(pred, settings.cycleLength) : 0;

  // 首页"今日提示": 最紧急一条预警 + 当日贴士 (完整列表在洞察页)
  const { alerts, advises } = useMemo(
    () =>
      runRules({
        recentCycles: stats.recentCycles,
        lastPeriodLength: stats.lastPeriodLength,
        heavyFlowDays: stats.heavyFlowDays,
        ...(pred ? { pred } : {}),
        isPeriodToday: today.isPeriod,
        dayInCycle: dayInCycle || undefined,
        cycleLength: settings.cycleLength,
        todayFlow: today.flow,
      }),
    [stats, pred, today, dayInCycle, settings.cycleLength],
  );
  const topAlert = alerts[0] ?? null;
  const tip = advises[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space3 }}>
      {/* Today card */}
      <section style={card}>
        <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tr('home.greeting')} · {tr('home.todayStatus')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: t.space1 }}>
          <span style={{ fontSize: 56, fontWeight: 300, letterSpacing: '-0.02em', color: t.textPrimary, lineHeight: 1 }}>
            {dayInCycle}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, color: t.textSecondary, fontWeight: 300 }}>
              {today.isPeriod ? tr('home.periodNow') : tr('home.notPeriod')}
            </span>
            {today.flow ? (
              <span style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: flowColor(today.flow), display: 'inline-block' }} />
                {tr(`log.flow${today.flow}`)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Quick log button */}
        <button onClick={() => onNavigate('log')} style={quickLogBtn}>
          + {tr('nav.log')}
        </button>
      </section>

      {/* 情况化建议: 最紧急预警 + 今日贴士 (完整列表在洞察页; 当天可点掉, 次日重置) */}
      {(topAlert || tip) && !tipDismissed && (
        <TodayTipCard topAlert={topAlert} tip={tip} onNavigate={onNavigate} onDismiss={dismissTip} />
      )}

      {/* Prediction card */}
      {pred && (
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {tr('home.nextPeriod')}
            </span>
            <span style={{ fontSize: 11, color: pred.confidence === 'high' ? t.accentText : t.textMuted }}>
              {tr(`home.confidence.${pred.confidence}`)}
            </span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 300, color: t.textPrimary, marginTop: t.space1, letterSpacing: '-0.01em' }}>
            {pred.daysUntilPeriod}
            <span style={{ fontSize: 14, color: t.textMuted, marginLeft: 6, fontWeight: 300 }}>
              {tr('home.daysUntilPeriod')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: t.space2, fontSize: 12, color: t.textSecondary, fontWeight: 300 }}>
            <span>🗓 {pred.nextPeriodStart}</span>
          </div>
        </section>
      )}

      {/* Fertile / ovulation — Premium (fertility) */}
      {pred && <FertileCard pred={pred} onNavigate={onNavigate} />}
      {/* 更换用户: 高可见入口, 点它去 Privacy 页 (两步确认) */}
      <button onClick={() => onNavigate('privacy')} style={switchUserBtn}>
        ⟳ {tr('home.switchUser')}
      </button>
    </div>
  );
}

function safeDayInCycle(pred: Prediction, cycleLen: number): number {
  // 今天是本周期第几天 = 周期长度 - 距下次经期天数。
  // 例: 周期 28 天, 距下次 0 天 (明天来) → 第 28 天; 距下次 14 天 → 第 14 天。
  // 经期第 1 天 = 距下次经期还有 (cycleLen-1) 天。封顶, 不出现 0/负。
  const day = cycleLen - pred.daysUntilPeriod;
  return Math.max(1, Math.min(cycleLen, day));
}

/** 首页"今日提示": 最紧急预警 (锁时引导解锁) + 当日贴士; 当天可点掉 */
function TodayTipCard({
  topAlert,
  tip,
  onNavigate,
  onDismiss,
}: {
  topAlert: import('../alerts').Alert | null;
  tip: import('../alerts').Advise | null;
  onNavigate: (tab: 'home' | 'log' | 'calendar' | 'insights' | 'privacy' | 'settings') => void;
  onDismiss: () => void;
}) {
  const { t: tr } = useTranslation();
  const alertLocked = topAlert ? requiresPremium('alerts') : false;
  const dotColor =
    topAlert?.severity === 'action' ? t.flowHeavy : topAlert?.severity === 'warn' ? t.accent : t.textMuted;

  return (
    <section style={{ ...card, padding: t.space2 }}>
      {topAlert && (
        <button onClick={() => onNavigate('insights')} style={{ ...tipLink, textAlign: 'left', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <i
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: alertLocked ? t.textMuted : dotColor,
                marginTop: 5,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>
                {alertLocked ? '🔒 ' : ''}
                {tr(`alert.${topAlert.key}.title`)}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 300, marginTop: 2, lineHeight: 1.5 }}>
                {tr(`alert.${topAlert.key}.body`)}
              </div>
            </div>
            <span style={{ fontSize: 11, color: t.accentText, fontWeight: 500, flexShrink: 0 }}>
              {tr('home.viewInsights')} →
            </span>
          </div>
        </button>
      )}

      {tip && (
        <div style={{ marginTop: topAlert ? t.space2 : 0, fontSize: 12, color: t.textSecondary, fontWeight: 300, lineHeight: 1.6 }}>
          {tr(`advise.${tip.key}.text`)}
        </div>
      )}

      <button
        onClick={onDismiss}
        style={{ ...dismissBtn, marginTop: t.space1, width: '100%' }}
      >
        {tr('home.tipDismiss')}
      </button>
    </section>
  );
}

const tipLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  outline: 'none',
};

const dismissBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: t.textMuted,
  fontSize: 11,
  fontWeight: 300,
  cursor: 'pointer',
  padding: 0,
  textAlign: 'center',
};

/** 易孕窗 — Premium (fertility); 锁住时显示锁 + 解锁入口 */
function FertileCard({ pred, onNavigate }: { pred: Prediction; onNavigate: (tab: any) => void }) {
  const { t: tr } = useTranslation();
  const locked = requiresPremium('fertility');
  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: t.space1 }}>
        <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tr('home.ovulation')}
        </span>
        <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 300 }}>{pred.ovulationDate}</span>
      </div>
      {locked ? (
        <div>
          <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 300 }}>🔒 {tr('paywall.benefits.fertility')}</div>
          <button onClick={() => onNavigate('insights')} style={unlockLink}>
            {tr('paywall.unlock')} →
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 300 }}>
            {tr('home.fertile')}: {pred.fertileStart} – {pred.fertileEnd}
          </div>
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: t.space1, fontWeight: 300, lineHeight: 1.5 }}>
            {tr('home.fertileNote')}
          </div>
        </>
      )}
    </section>
  );
}

const unlockLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: t.accent,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  marginTop: t.space1,
};

const card: React.CSSProperties = {
  background: t.surface,
  borderRadius: t.radius,
  padding: t.space3,
  border: `1px solid ${t.border}`,
};

const quickLogBtn: React.CSSProperties = {
  marginTop: t.space2,
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${t.accent}`,
  background: t.accentSoft,
  color: t.accentText,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  width: '100%',
};

const switchUserBtn: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${t.border}`,
  background: 'none',
  color: t.textMuted,
  fontSize: 12,
  fontWeight: 300,
  cursor: 'pointer',
  width: '100%',
};
