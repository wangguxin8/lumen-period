/**
 * 医生报告导出 (Day 4 功能, Premium 门 report) — 差异化 C "异常预警 + 就医指导" 的载体。
 *
 * 形态:
 *  1. 可读文本报告 (医生可读: 近期周期序列 / 经期长度 / 出血量 / 情绪症状 / 规则引擎提示),
 *     支持 ① 复制全文 ② 下载 .txt ③ 打印/PDF (浏览器 window.print)。
 *  2. 加密数据备份 (AES-GCM, PIN 派生密钥, 走 lib/crypto.ts) — 本地"加密备份",
 *     未来接云同步时就是同一个加密包。
 *
 * 合规: 报告首尾带 "非医疗诊断" 声明; 措辞只有"记录 / 提示 / 建议咨询医生"。
 */

import { db } from '../db';
import { toLocalDateKey } from '../cycle';
import { runRules } from '../alerts';
import { exportAllData } from '../db';
import { deriveKey, randomSaltHex, encryptJson } from './crypto';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { designTokens as t } from '../theme';

/** 生成可读报告文本 (i18n 由调用方注入 tr) */
export async function buildReportText(
  tr: (k: string, o?: Record<string, unknown>) => string,
): Promise<string> {
  const [days, symptoms, moods, settings] = await Promise.all([
    db.cycleDays.toArray(),
    db.symptoms.toArray(),
    db.moods.toArray(),
    db.settings.get(1),
  ]);
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));

  // 经期开始日: 前一天不是经期的那天
  const allDates = sorted.filter((d) => d.isPeriod).map((d) => d.date);
  const starts = allDates.filter((_, i) => i === 0 || !isPrevDay(allDates[i - 1], allDates[i]));

  const recentCycles: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    recentCycles.push(Math.round((new Date(starts[i]).getTime() - new Date(starts[i - 1]).getTime()) / 86400000));
  }

  // 最近一次经期长度: 从最后一个开始日往后数连续经期天
  let lastPeriodLength = 0;
  if (starts.length) {
    const lastStart = starts[starts.length - 1];
    const idx = sorted.findIndex((d) => d.date === lastStart);
    if (idx >= 0) {
      for (let i = idx; i < sorted.length; i++) {
        const cur = new Date(sorted[i].date).getTime();
        const prev = i > 0 ? new Date(sorted[i - 1].date).getTime() : 0;
        if (i === idx || Math.round((cur - prev) / 86400000) === 1) lastPeriodLength++;
        else break;
      }
    }
  }

  const heavyFlowDays = days.filter((d) => d.isPeriod && (d.flow === 3 || d.flow === 4)).length;
  const { alerts } = runRules({ recentCycles, lastPeriodLength, heavyFlowDays });

  const lines: string[] = [];
  lines.push('Lumen · ' + tr('report.title'));
  lines.push(tr('report.date') + ': ' + toLocalDateKey(new Date()));
  if (settings) {
    lines.push('');
    lines.push(tr('report.basicCycle') + ': ' + settings.cycleLength + 'd / ' + tr('report.basicPeriod') + ': ' + settings.periodLength + 'd');
  }
  lines.push('');
  lines.push('── ' + tr('report.cycleSection') + ' ──');
  if (recentCycles.length) {
    lines.push(tr('report.recentCycles') + ': ' + recentCycles.join(', '));
    lines.push(tr('report.lastPeriodLength') + ': ' + lastPeriodLength + 'd');
    if (heavyFlowDays) lines.push(tr('report.heavyFlow') + ': ' + heavyFlowDays + 'd');
  } else {
    lines.push(tr('report.noCycles'));
  }
  lines.push('');
  lines.push('── ' + tr('report.moodSection') + ' ──');
  const moodCount: Record<string, number> = {};
  moods.forEach((m) => (moodCount[m.key] = (moodCount[m.key] || 0) + 1));
  if (Object.keys(moodCount).length) {
    lines.push(
      Object.entries(moodCount)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => tr(`log.${k}`) + ' × ' + n)
        .join(' · '),
    );
  } else {
    lines.push(tr('report.noMoods'));
  }
  const symCount: Record<string, number> = {};
  symptoms.forEach((s) => (symCount[s.key] = (symCount[s.key] || 0) + 1));
  if (Object.keys(symCount).length) {
    lines.push(
      '── ' + tr('report.symptomSection') + ' ──',
      ...Object.entries(symCount)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => tr(`log.${k}`) + ' × ' + n),
    );
  }
  if (alerts.length) {
    lines.push('');
    lines.push('── ' + tr('report.alertSection') + ' ──');
    alerts.forEach((a) => lines.push('• ' + tr(`alert.${a.key}.title`) + ' — ' + tr(`alert.${a.key}.body`)));
    lines.push(tr('alert.disclaimer'));
  }
  lines.push('');
  lines.push('—');
  lines.push(tr('report.disclaimer'));
  return lines.join('\n');
}

function isPrevDay(a: string, b: string): boolean {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const d1 = new Date(ay, am - 1, ad).getTime();
  const d2 = new Date(by, bm - 1, bd).getTime();
  return Math.round((d2 - d1) / 86400000) === 1;
}

/** 加密数据备份: 用户输 4 位 PIN → AES-GCM 加密全部数据 → 下载 .json */
export async function makeEncryptedBackup(pin: string): Promise<{
  salt: string;
  iv: string;
  ct: string;
}> {
  const data = await exportAllData();
  const salt = randomSaltHex();
  const key = await deriveKey(pin, salt);
  const { iv, ct } = await encryptJson(key, data);
  return { salt, iv, ct };
}

/* ── UI 块 ── */

/** 医生报告区: 生成文本 + 复制/下载/打印 + 加密备份 (PIN 4 位) */
export function ReportSection() {
  const { t: tr } = useTranslation();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      setText(await buildReportText((k, o) => tr(k, o)));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用 (隐私模式) 时忽略 */
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumen-report-${toLocalDateKey(new Date())}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    // 把报告文本打印到浏览器打印对话框 (用户存为 PDF)
    const w = window.open('', '_blank', 'width=700,height=500');
    if (!w) return;
    w.document.write(
      `<html><head><title>Lumen</title><style>body{font-family:Georgia,serif;padding:32px;font-size:13px;line-height:1.7;white-space:pre-wrap;}</style></head><body>${escapeHtml(text)}</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  };

  const backup = async () => {
    if (pin.length !== 4) {
      setPinError(true);
      return;
    }
    setBackingUp(true);
    try {
      const enc = await makeEncryptedBackup(pin);
      const blob = new Blob([JSON.stringify({ app: 'lumen', format: 1, salt: enc.salt, iv: enc.iv, ct: enc.ct })], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lumen-backup-${toLocalDateKey(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBackingUp(false);
      setPin('');
      setPinError(false);
    }
  };

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tr('report.title')}
        </span>
        <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 300 }}>{tr('report.sub')}</span>
      </div>

      {!text ? (
        <button onClick={generate} style={{ ...primaryBtn, width: 'auto', marginTop: t.space2 }} disabled={loading}>
          {loading ? '…' : tr('report.generate')}
        </button>
      ) : (
        <div style={{ marginTop: t.space2 }}>
          <pre style={preStyle}>{text}</pre>
          <div style={{ display: 'flex', gap: 8, marginTop: t.space1 }}>
            <button onClick={copy} style={linkBtn}>
              {copied ? '✓' : tr('report.copy')}
            </button>
            <button onClick={download} style={linkBtn}>
              {tr('report.download')}
            </button>
            <button onClick={print} style={linkBtn}>
              {tr('report.print')}
            </button>
          </div>
        </div>
      )}

      {/* 加密备份 (PIN 派生 AES-GCM) */}
      <div style={{ marginTop: t.space3, paddingTop: t.space2, borderTop: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {tr('report.backup')}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 300, marginTop: 4, lineHeight: 1.5 }}>
          {tr('report.backupHint')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: t.space1 }}>
          <input
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
              setPinError(false);
            }}
            inputMode="numeric"
            placeholder="····"
            aria-label={tr('report.pinLabel')}
            style={{
              width: 88,
              padding: '9px 12px',
              borderRadius: t.radiusSm,
              border: `1px solid ${pinError ? '#FF453A' : t.border}`,
              background: t.surfaceAlt,
              fontSize: 14,
              letterSpacing: '0.3em',
              color: t.textPrimary,
              outline: 'none',
            }}
          />
          <button onClick={backup} style={linkBtn} disabled={backingUp}>
            {backingUp ? '…' : tr('report.backup')}
          </button>
        </div>
        {pinError && <div style={{ fontSize: 10, color: '#FF453A', marginTop: 4 }}>{tr('report.pinError')}</div>}
      </div>
    </section>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

const preStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: t.textSecondary,
  fontWeight: 300,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: t.surfaceAlt,
  borderRadius: t.radiusSm,
  padding: t.space2,
  maxHeight: 260,
  overflowY: 'auto',
};
