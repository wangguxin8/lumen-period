import { useState, useCallback } from 'react';
import { Home } from './pages/Home';
import { Log } from './pages/Log';
import { Calendar } from './pages/Calendar';
import { Insights } from './pages/Insights';
import { Settings } from './pages/Settings';
import { Privacy } from './pages/Privacy';
import { TabBar, type TabKey } from './components/TabBar';
import { useDBReady } from './hooks/useDBReady';
import { Onboarding } from './pages/Onboarding';
import { HasOnboarded, ClearOnboarded } from './lib/onboard';
import { designTokens } from './theme';

type View = TabKey | 'settings' | 'privacy';

export default function App() {
  const [tab, setTab] = useState<TabKey>('home');
  // settings/privacy 是覆盖在 tab 之上的子视图; 点 tab 时先退出子视图
  const [subView, setSubView] = useState<'settings' | 'privacy' | null>(null);
  const dbReady = useDBReady();
  // onboarding 是否完成 — 用 state 而非每次渲染读 localStorage:
  // 读 localStorage 不触发渲染, 导致"点了 start 但 setTab 后重渲染又读到 false"的竞态。
  const [onboarded, setOnboarded] = useState(() => HasOnboarded());
  // 换用户后需要重走 Onboarding — 清标记 + 翻状态
  const [onboardTick, setOnboardTick] = useState(0);

  const navigate = (v: View) => {
    if (v === 'settings' || v === 'privacy') setSubView(v);
    else {
      setSubView(null);
      setTab(v);
    }
  };

  // 底部 TabBar: 点 tab 时若处于 settings/privacy 子视图, 先退出子视图再切 tab
  const handleTabBar = (k: TabKey) => {
    if (subView) setSubView(null);
    setTab(k);
  };

  // Onboarding 完成: 先标记 localStorage, 再翻 React state 触发重渲染
  const handleOnboarded = useCallback(() => {
    setOnboarded(true);
    setTab('home');
  }, []);

  // 退出登录/换用户: 清数据标记 + 翻状态 → 回到 Onboarding
  const handleReset = useCallback(() => {
    ClearOnboarded();
    setOnboarded(false);
    setSubView(null);
    setTab('home');
    setOnboardTick((n) => n + 1);
  }, []);

  if (!dbReady) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: designTokens.textMuted,
          fontSize: 13,
        }}
      >
        …
      </div>
    );
  }

  void onboardTick;
  if (!onboarded) {
    return <Onboarding onDone={handleOnboarded} />;
  }

  // 隐私页删除全部数据后 onBack → 回到首页
  const backFromSub = () => setSubView(null);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* 顶栏: 品牌 + 设置齿轮 */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 500, color: designTokens.textPrimary, letterSpacing: '-0.01em' }}>
          Lumen
        </span>
        <button
          onClick={() => setSubView('settings')}
          aria-label="settings"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: `1px solid ${designTokens.border}`,
            background: designTokens.surface,
            color: subView === 'settings' ? designTokens.accentText : designTokens.textPrimary,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          ⚙
        </button>
      </header>

      <main style={{ flex: 1, padding: '0 18px 96px', overflowY: 'auto' }}>
        {subView === 'settings' ? (
          <Settings onNavigate={navigate} />
        ) : subView === 'privacy' ? (
          <Privacy onBack={backFromSub} onReset={handleReset} />
        ) : (
          <>
            {tab === 'home' && <Home onNavigate={navigate} />}
            {tab === 'log' && <Log />}
            {tab === 'calendar' && <Calendar />}
            {tab === 'insights' && <Insights />}
          </>
        )}
      </main>

      <TabBar active={tab} onChange={handleTabBar} />
    </div>
  );
}
