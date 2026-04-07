import { useEffect, useRef } from "react";
import supabase from "../SupabaseClient";

// Global cache to store active channels and their listeners
// Map<tableName: string, { channel: any, listenerCount: number, handlers: Set<Function> }>
const sharedChannels = new Map();

/**
 * Hook to subscribe to real-time changes on a Supabase table.
 * Uses a shared channel management system to reduce the number of active
 * WebSocket connections by reusing subscriptions for the same table.
 *
 * @param {string} table - The Supabase table name to listen to
 * @param {Function} onChangeCallback - Function to call when data changes
 * @param {boolean} enabled - Optional, set to false to disable subscription (default: true)
 * @param {Function|null} shouldHandleChange - Optional predicate that receives the realtime payload.
 */
const useRealtimeTable = (
  table,
  onChangeCallback,
  enabled = true,
  shouldHandleChange = null,
) => {
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
    if (!enabled || !table) return;

    // Use a unique but stable handler for this hook instance
    const uniqueHandler = (payload) => {
      // Check if we should actually handle this change (e.g. filter by patient_id)
      if (predicateRef.current && !predicateRef.current(payload)) {
        return;
      }
      // Small delay to ensure the DB write is fully committed
      setTimeout(() => callbackRef.current?.(payload), 300);
    };

    // Shared channel logic
    if (!sharedChannels.has(table)) {
      const channel = supabase
        .channel(`table-updates-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: table },
          (payload) => {
            // Notify all registered handlers for this table
            const entry = sharedChannels.get(table);
            if (entry) {
              entry.handlers.forEach((handler) => handler(payload));
            }
          },
        )
        .subscribe();

      sharedChannels.set(table, {
        channel,
        handlers: new Set(),
      });
    }

    const currentEntry = sharedChannels.get(table);
    currentEntry.handlers.add(uniqueHandler);

    return () => {
      const entry = sharedChannels.get(table);
      if (entry) {
        entry.handlers.delete(uniqueHandler);
        // If no more components are listening, remove the channel from Supabase
        if (entry.handlers.size === 0) {
          supabase.removeChannel(entry.channel);
          sharedChannels.delete(table);
        }
      }
    };
  }, [table, enabled]);
};

export default useRealtimeTable;
