import i18n from 'i18next';

/** 语言切换 (持久到 localStorage, 由 i18next detector 读取) */
export function setLang(lng: 'zh' | 'en') {
  i18n.changeLanguage(lng);
}

export function currentLang(): 'zh' | 'en' {
  const l = i18n.language?.toLowerCase();
  return l?.startsWith('en') ? 'en' : 'zh';
}
