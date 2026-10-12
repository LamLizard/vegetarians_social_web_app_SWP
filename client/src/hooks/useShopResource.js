// Tùng — Sprint 2: hủy GET cũ, tránh response cũ đổi dữ liệu trang; mutation do page quản lý.
import { useCallback, useEffect, useState } from 'react';

export default function useShopResource(load, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (!enabled) { setData(null); setError(null); setLoading(false); return () => controller.abort(); }
    setLoading(true);
    setData(null);
    setError(null);
    load(controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, enabled, revision]);
  return { data, error, loading, reload };
}
