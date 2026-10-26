'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/clientCache';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
