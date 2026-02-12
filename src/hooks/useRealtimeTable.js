import { useEffect, useRef } from 'react';
import supabase from '../SupabaseClient';

/**
 * Hook to subscribe to real-time changes on a Supabase table.
 * When any INSERT, UPDATE, or DELETE happens on the table,
 * the provided `onChangeCallback` is called to refresh data.
 *
 * Usage: useRealtimeTable('table_name', fetchFunction);
 *
 * @param {string} table - The Supabase table name to listen to
 * @param {Function} onChangeCallback - Function to call when data changes (e.g., your fetch function)
 * @param {boolean} enabled - Optional, set to false to disable subscription (default: true)
 */
const useRealtimeTable = (table, onChangeCallback, enabled = true) => {
  const callbackRef = useRef(onChangeCallback);

  // Keep callback ref updated without re-subscribing
  useEffect(() => {
    callbackRef.current = onChangeCallback;
  }, [onChangeCallback]);

  useEffect(() => {
    if (!enabled || !table) return;

    const channel = supabase
      .channel(`realtime-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          // Small delay to ensure the DB write is fully committed
          setTimeout(() => callbackRef.current?.(), 300);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, enabled]);
};

export default useRealtimeTable;
