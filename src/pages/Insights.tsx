import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { designTokens as t } from '../theme';
import { useMonthlyStats, usePeriodStarts, useSettings, useToday, todayKey } from '../hooks/useCycle';
import { predict } from '../cycle';
import { runRules, type Alert, type Advise } from '../alerts';
import { requiresPremium, type PremiumFeature } from '../lib/paywall';
import { queueAlerts, buildOpenReminder, clearReminders, fireAlertNotification, type OpenReminder } from '../lib/notify';
import { ReportSection } from '../lib/report';

export function Insights() {
  const { t: tr } = useTranslation();
  const stats = useMonthlyStats();
  const starts = usePeriodStarts();
  const settings = useSettings();
  const today = useToday();

  const pred = useMemo(
    () => (starts.length ? predict(starts, todayKey(), settings.periodLength) : null),
    [starts, settings.periodLength],
  );

  // 周期第几天 (与 Home 一致的计算), 供阶段自适应建议使用
  const dayInCycle = useMemo(() => {
    if (!pred) return undefined;
    const day = settings.cycleLength - pred.daysUntilPeriod;
    return Math.max(1, Math.min(settings.cycleLength, day));
  }, [pred, settings.cycleLength]);

  // Day 5: 规则引擎告警 + 情况化建议
  const { alerts, advises } = useMemo(() => {
    return runRules({
      recentCycles: stats.recentCycles,
      lastPeriodLength: stats.lastPeriodLength,
      heavyFlowDays: stats.heavyFlowDays,
      ...(pred ? { pred } : {}),
      isPeriodToday: today.isPeriod,
      dayInCycle,
      cycleLength: settings.cycleLength,
      todayFlow: today.flow,
    });
  }, [stats, pred, today, dayInCycle, settings.cycleLength]);

  // 有告警时: 进待提醒队列 (下次打开提醒条) + 发一次主动通知 (Capacitor 原生 / Web Notification)
  useEffect(() => {
    if (alerts.length) {
      void queueAlerts(alerts.map((a) => a.key));
      void fireAlertNotification();
    }
  }, [alerts]);

  // 待看提醒条 (上次打开时产生、还没看的预警)
  const [openReminder, setOpenReminder] = useState<OpenReminder | null>(null);
  useEffect(() => {
    buildOpenReminder().then(setOpenReminder);
  }, []);
  const dismissReminder = () => {
    void clearReminders();
    setOpenReminder(null);
  };

  // 情绪×周期摘要 (本地统计生成; 定位 C 不是主打, 诚实标注为"摘要"而非"AI")
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const avgCycle =
    stats.recentCycles.length > 0
      ? Math.round(stats.recentCycles.reduce((a, b) => a + b, 0) / stats.recentCycles.length)
      : null;

  const handleAi = () => {
    setAiLoading(true);
    // 本地生成: 基于统计的话术, 无网络请求 (本地优先原则)。
    setTimeout(() => {
      const top = Object.entries(stats.moodCounts).sort((a, b) => b[1] - a[1])[0];
      const topKey = top ? top[0] : null;
      const lines: string[] = [];
      lines.push(
        stats.recentCycles.length >= 3
          ? tr('insights.aiSummary.cycles', { n: avgCycle ?? 28 })
          : tr('insights.aiSummary.fewCycles'),
      );
      if (topKey) lines.push(tr('insights.aiSummary.mood', { mood: tr(`log.${topKey}`) }));
      lines.push(tr('insights.aiSummary.disclaimer'));
      setAiText(lines.join('\n'));
      setAiLoading(false);
    }, 300);
  };

  const locked = (f: PremiumFeature) => requiresPremium(f);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space3 }}>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 300, letterSpacing: '-0.01em', color: t.textPrimary }}>
        {tr('insights.title')}
      </h2>

      {/* 待看提醒条 */}
      {openReminder && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: t.accentSoft,
            borderRadius: t.radius,
            padding: t.space2,
            border: `1px solid ${t.border}`,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.accentText }}>
              ◉ {tr('alert.remindOnOpen')}
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 300, marginTop: 3, lineHeight: 1.5 }}>
              {openReminder.title}: {openReminder.body}
            </div>
          </div>
          <button onClick={dismissReminder} style={dismissBtn} aria-label="dismiss">
            ✕
          </button>
        </div>
      )}

      {stats.recentCycles.length < 1 && stats.periodDaysTotal < 1 ? (
        <div style={{ ...card, color: t.textMuted, fontSize: 14, fontWeight: 300, textAlign: 'center', padding: t.space4 }}>
          {tr('insights.empty')}
        </div>
      ) : (
        <>
          {/* 月度统计 */}
          <section style={card}>
            <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {tr('insights.thisMonth')}
            </div>
            <div style={{ display: 'flex', gap: t.space2, marginTop: t.space2 }}>
              <Stat label={tr('insights.avgCycle')} value={avgCycle ? `${avgCycle}` : '–'} unit={tr('insights.unitDay')} />
              <Stat label={tr('insights.avgPeriod')} value={`${stats.lastPeriodLength || '–'}`} unit={tr('insights.unitDay')} />
              <Stat label={tr('insights.cyclesLogged')} value={`${stats.recentCycles.length}`} />
            </div>
          </section>

          {/* Day 5: 异常预警 (差异化核心 C, Premium) */}
          <AlertsSection alerts={alerts} />

          {/* 情况化建议: 周期阶段 / 生活方式 / 中医口吻 — 免费 (纯记录参考, 不涉及诊断) */}
          {advises.length > 0 && <AdvisesSection advises={advises} />}

          {/* Day 4: 医生报告 + 加密备份 (Premium) */}
          {!locked('report') ? <ReportSection /> : <LockedFeature feature="report" />}

          {/* 情绪×周期摘要 (本地统计, Premium) */}
          {!locked('aiAnalysis') ? (
            <AiSection onUnlock={handleAi} aiText={aiText} loading={aiLoading} />
          ) : (
            <LockedFeature feature="aiAnalysis" />
          )}
        </>
      )}
    </div>
  );
}

/* ── Day 5 告警块 ── */
function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const { t: tr } = useTranslation();
  const locked = requiresPremium('alerts');
  const [open, setOpen] = useState(false);

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tr('alert.title')}
        </span>
        {!locked && alerts.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} style={linkBtn}>
            {open ? '∧' : '∨'}
          </button>
        )}
      </div>

      {locked ? (
        <LockedFeature feature="alerts" />
      ) : alerts.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 300, marginTop: t.space1 }}>
          {tr('alert.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: t.space1, marginTop: t.space2 }}>
          {alerts.map((a) => (
            <AlertRow key={a.key} alert={a} expanded={open} />
          ))}
          <div style={{ fontSize: 10, color: t.textMuted, marginTop: t.space1, fontWeight: 300 }}>
            {tr('alert.disclaimer')}
          </div>
        </div>
      )}
    </section>
  );
}

function AlertRow({ alert, expanded }: { alert: Alert; expanded: boolean }) {
  const { t: tr } = useTranslation();
  const color = alert.severity === 'action' ? t.flowHeavy : alert.severity === 'warn' ? t.accent : t.textMuted;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <i
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: t.textPrimary }}>{tr(`alert.${alert.key}.title`)}</div>
        {expanded && (
          <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 300, marginTop: 4, lineHeight: 1.6 }}>
            {tr(`alert.${alert.key}.body`)}
          </div>
        )}
        {(alert.severity === 'action' || alert.severity === 'warn') && (
          <div style={{ fontSize: 11, color: color, marginTop: 4, fontWeight: 400 }}>{tr('alert.viewDoc')}</div>
        )}
      </div>
    </div>
  );
}

/* ── 情况化建议块 (免费: 纯记录参考, 守合规红线) ── */
function AdvisesSection({ advises }: { advises: Advise[] }) {
  const { t: tr } = useTranslation();
  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: t.space1 }}>
        <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tr('advise.title')}
        </span>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 300 }}>{tr('advise.sub')}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: t.space2 }}>
        {advises.map((a) => (
          <div key={a.key} style={{ fontSize: 13, color: t.textSecondary, fontWeight: 300, lineHeight: 1.6 }}>
            {tr(`advise.${a.key}.text`)}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: t.textMuted, marginTop: t.space2, fontWeight: 300 }}>
        {tr('advise.disclaimer')}
      </div>
    </section>
  );
}

/* ── 情绪×周期摘要 (Premium: aiAnalysis) ── */
function AiSection({
  onUnlock,
  aiText,
  loading,
}: {
  onUnlock: () => void;
  aiText: string;
  loading: boolean;
}) {
  const { t: tr } = useTranslation();
  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tr('insights.aiTitle')}
        </span>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 300 }}>{tr('insights.aiSub')}</span>
      </div>

      <div style={{ marginTop: t.space2 }}>
        {!aiText ? (
          <button onClick={onUnlock} style={{ ...primaryBtn, width: 'auto' }} disabled={loading}>
            {loading ? '…' : tr('insights.generate')}
          </button>
        ) : (
          <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 300, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {aiText}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── 付费墙 ── */
function LockedFeature({ feature }: { feature: PremiumFeature }) {
  const { t: tr } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginTop: t.space1 }}>
      <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 300 }}>
        🔒 {tr('paywall.benefits.' + feature)}
      </div>
      <button onClick={() => setShow(true)} style={{ ...linkBtn, marginTop: t.space1 }}>
        {tr('paywall.unlock')}
      </button>

      {show && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 100,
          }}
          onClick={() => setShow(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: t.surface,
              borderTopLeftRadius: t.radiusLg,
              borderTopRightRadius: t.radiusLg,
              padding: t.space4,
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 300, color: t.textPrimary, letterSpacing: '-0.01em' }}>
              {tr('paywall.title')}
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 300, marginTop: 6 }}>{tr('paywall.sub')}</div>
            <div style={{ marginTop: t.space2, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(['fertility', 'aiAnalysis', 'alerts', 'report'] as PremiumFeature[]).map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textPrimary, fontWeight: 300 }}>
                  <span style={{ color: t.accent }}>✓</span>
                  {tr(`paywall.benefits.${f}`)}
                </div>
              ))}
            </div>
            <div style={{ marginTop: t.space3 }}>
              <button
                onClick={() => setShow(false)}
                style={{ ...primaryBtn, width: '100%' }}
              >
                {tr('paywall.price')} · {tr('paywall.demo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { t: tr } = useTranslation();
  void tr;
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 300, color: t.textPrimary, letterSpacing: '-0.01em' }}>
        {value}
        {unit ? <span style={{ fontSize: 12, color: t.textMuted, marginLeft: 3 }}>{unit}</span> : null}
      </div>
      <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 300, marginTop: 4, letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: t.surface,
  borderRadius: t.radius,
  padding: t.space3,
  border: `1px solid ${t.border}`,
};

const primaryBtn: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 999,
  border: 'none',
  background: t.accent,
  color: t.surface,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: t.accent,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
};

const dismissBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: 'none',
  background: 'none',
  color: t.textMuted,
  fontSize: 12,
  cursor: 'pointer',
  flexShrink: 0,
};
