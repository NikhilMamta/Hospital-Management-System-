import { useEffect, useRef } from "react";
import supabase from "../SupabaseClient";

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
 * @param {Function|null} shouldHandleChange - Optional predicate that receives the realtime payload.
 * Return false to ignore unrelated table changes.
 */
const useRealtimeTable = (
  table,
  onChangeCallback,
  enabled = true,
  shouldHandleChange = null,
) => {
  const callbackRef = useRef(onChangeCallback);
  const predicateRef = useRef(shouldHandleChange);

  // Keep callback ref updated without re-subscribing
  useEffect(() => {
    callbackRef.current = onChangeCallback;
  }, [onChangeCallback]);

  useEffect(() => {
    predicateRef.current = shouldHandleChange;
  }, [shouldHandleChange]);

  useEffect(() => {
    if (!enabled || !table) return;

    const channel = supabase
      .channel(`realtime-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: '*', schema: 'public', table },
        (payload) => {
          if (predicateRef.current && !predicateRef.current(payload)) {
            return;
          }

          // Small delay to ensure the DB write is fully committed
          setTimeout(() => callbackRef.current?.(payload), 300);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, enabled]);
};

export default useRealtimeTable;
