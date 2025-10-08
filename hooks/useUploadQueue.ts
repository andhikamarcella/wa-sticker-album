'use client';

import { useCallback, useMemo, useState } from 'react';

type UploadItem = {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
};

type Queue = Record<string, UploadItem>;

export function useUploadQueue() {
  const [queue, setQueue] = useState<Queue>({});

  const addFile = useCallback((file: File) => {
    const id = `${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    setQueue((prev) => ({ ...prev, [id]: { id, file, status: 'pending', progress: 0 } }));
    return id;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setQueue((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const clearItem = useCallback((id: string) => {
    setQueue((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const items = useMemo(() => Object.values(queue), [queue]);

  return { items, addFile, updateItem, clearItem };
}
