import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useRealtimeTable from "./useRealtimeTable";

/**
 * Hook to synchronize Supabase real-time changes with React Query cache.
 *
 * PREVIOUS BEHAVIOUR (bug):
 *   Each call created a brand-new Supabase channel named
 *   `rt-query-{table}-{JSON.stringify(queryKey)}`.
 *   Multiple components on the same page watching the same table would open
 *   N separate WebSocket subscriptions — wasting connections and triggering
 *   N separate DB CDC events.
 *
 * CURRENT BEHAVIOUR (fixed):
 *   Delegates to useRealtimeTable, which maintains a single shared channel
 *   per table (see useRealtimeTable.js).  Any number of useRealtimeQuery
 *   hooks for the same table reuse one WebSocket subscription.
 *
 * @param {string}          table    - Supabase table to listen to
 * @param {Array|string}    queryKey - React Query key(s) to invalidate on change
 * @param {Object}          options
 * @param {boolean}         options.enabled - Whether the listener is active
 * @param {Function|null}   options.filter  - Optional predicate; if it returns
 *                                            false for a payload the query is
 *                                            NOT invalidated (avoids noisy
 *                                            cross-patient updates).
 */
const useRealtimeQuery = (table, queryKey, options = {}) => {
  const { enabled = true, filter = null } = options;
  const queryClient = useQueryClient();
  const filterRef   = useRef(filter);
  const queryKeyRef = useRef(queryKey);

  // Keep refs current so the stable callback below always uses latest values
  useEffect(() => { filterRef.current   = filter;    }, [filter]);
  useEffect(() => { queryKeyRef.current = queryKey;  }, [queryKey]);

  // Stable callback — identity never changes, so useRealtimeTable never
  // re-subscribes due to this callback changing.
  const handleChange = useRef((payload) => {
    if (filterRef.current && !filterRef.current(payload)) return;

    // 300 ms delay mirrors useRealtimeTable's own delay (ensures DB write is
    // committed before the refetch lands).
    setTimeout(() => {
      const key = queryKeyRef.current;
      queryClient.invalidateQueries({
        queryKey: Array.isArray(key) ? key : [key],
      });
    }, 300);
  }).current;

  // Reuse the single shared channel for this table.
  // useRealtimeTable guarantees at most one WS channel per table name.
  useRealtimeTable(table, handleChange, enabled);
};

export default useRealtimeQuery;
