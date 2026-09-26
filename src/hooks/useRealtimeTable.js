import { useEffect, useRef } from "react";
import supabase from "../SupabaseClient";

// Global cache to store active channels and their listeners
// Map<tableName: string, { channel: any, listenerCount: number, handlers: Set<Function> }>
const sharedChannels = new Map();

// Bulk writes (e.g. cron-generated tasks) send one event per row. Wait until
// the burst has been quiet this long, then call the page's reload once.
const DEBOUNCE_MS = 1000;

/**
 * Hook to subscribe to real-time changes on a Supabase table.
 * Uses a shared channel management system to reduce the number of active
 * WebSocket connections by reusing subscriptions for the same table.
 *
 * @param {string|string[]} table - The Supabase table name to listen to. An array
 *   like ["public", "ipd_admissions"] is accepted; only the last element is used.
 * @param {Function} onChangeCallback - Called once per burst of changes, with the latest payload
 * @param {boolean} enabled - Optional, set to false to disable subscription (default: true)
 * @param {Function|null} shouldHandleChange - Optional predicate, checked for every realtime payload.
 */
const useRealtimeTable = (
  table,
  onChangeCallback,
  enabled = true,
  shouldHandleChange = null,
) => {
  // A string keeps the effect below stable; an array literal is a new object
  // every render and would re-subscribe on every render.
  const tableName = Array.isArray(table) ? table[table.length - 1] : table;

  const callbackRef = useRef(onChangeCallback);
  const predicateRef = useRef(shouldHandleChange);

  // Keep callback and predicate refs updated without re-subscribing
  useEffect(() => {
    callbackRef.current = onChangeCallback;
  }, [onChangeCallback]);

  useEffect(() => {
    predicateRef.current = shouldHandleChange;
  }, [shouldHandleChange]);

  useEffect(() => {
    if (!enabled || !tableName) return;

    let timer = null;

    // Use a unique but stable handler for this hook instance
    const uniqueHandler = (payload) => {
      // Check if we should actually handle this change (e.g. filter by patient_id)
      if (predicateRef.current && !predicateRef.current(payload)) {
        return;
      }
      // Trailing debounce: one reload per burst. The delay also ensures the
      // DB write is fully committed before the reload.
      clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current?.(payload), DEBOUNCE_MS);
    };

    // Shared channel logic
    if (!sharedChannels.has(tableName)) {
      const channel = supabase
        .channel(`table-updates-${tableName}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: tableName },
          (payload) => {
            // Notify all registered handlers for this table
            const entry = sharedChannels.get(tableName);
            if (entry) {
              entry.handlers.forEach((handler) => handler(payload));
            }
          },
        )
        .subscribe();

      sharedChannels.set(tableName, {
        channel,
        handlers: new Set(),
      });
    }

    const currentEntry = sharedChannels.get(tableName);
    currentEntry.handlers.add(uniqueHandler);

    return () => {
      clearTimeout(timer);
      const entry = sharedChannels.get(tableName);
      if (entry) {
        entry.handlers.delete(uniqueHandler);
        // If no more components are listening, remove the channel from Supabase
        if (entry.handlers.size === 0) {
          supabase.removeChannel(entry.channel);
          sharedChannels.delete(tableName);
        }
      }
    };
  }, [tableName, enabled]);
};

export default useRealtimeTable;
