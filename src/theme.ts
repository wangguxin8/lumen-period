/**
 * Lumen 设计系统 — 纯 CSS 设计令牌, 无 MUI/重型 UI 库。
 * 极简克制 + 单一玫粉强调。继承音乐平台那套黑白留白审美,
 * 女性健康场景用柔和玫粉作唯一强调色。
 * 组件用 inline style 读这些令牌 (和你现有音乐平台一致的做法), 样式 100% 可控。
 */
export const designTokens = {
  // 底色: 暖米白, 不纯白(刺眼), 不粉嫩(低幼)
  bg: '#F4F1EE',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF8F6',
  // 强调: 柔和玫粉 (月经/生理意象, 但不刺眼)
  accent: '#C86B8A',
  accentSoft: 'rgba(200, 107, 138, 0.10)',
  accentText: '#A84B6C',
  // 文字层级 (暖灰, 不冷冰冰)
  textPrimary: '#2B2927',
  textSecondary: '#6B6660',
  textMuted: '#9A938B',
  textFaint: '#C4BEB6',
  // 功能色 (出血量 3 档, 走克制的低饱和, 用同一色相深浅渐变)
  flowLight: '#E8C9D3', // 点滴 (最浅)
  flowModerate: '#C86B8A', // 中等 (= 强调色)
  flowHeavy: '#8C3A54', // 大量 (最深)
  // 边界
  border: 'rgba(43, 41, 39, 0.08)',
  borderStrong: 'rgba(43, 41, 39, 0.14)',
  // 圆角
  radiusSm: 10,
  radius: 16,
  radiusLg: 24,
  // 间距节奏
  space1: 8,
  space2: 14,
  space3: 22,
  space4: 34,
  // 字体
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
} as const;

export type DesignTokens = typeof designTokens;

/** 出血量 1-4 对应的颜色 (0=无/未记, 走中性) */
export function flowColor(flow: number | undefined): string {
  switch (flow) {
    case 1:
      return designTokens.flowLight;
    case 2:
      return designTokens.flowModerate;
    case 3:
    case 4:
      return designTokens.flowHeavy;
    default:
      return designTokens.textFaint;
  }
}
