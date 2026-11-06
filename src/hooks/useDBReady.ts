import { useState, useEffect } from 'react';
import { db } from '../db';

/** 等待 Dexie 库打开 (首次建表) 就绪 */
export function useDBReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    db.open()
      .then(() => setReady(true))
      .catch((e) => {
        console.error('DB open failed', e);
        setReady(true); // 即使失败也让 UI 起来, 避免白屏
      });
  }, []);
  return ready;
}
