import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import supabase from "../SupabaseClient";

/**
 * Hook to synchronize Supabase real-time changes with React Query cache.
 * When a change occurs in the specified table, it invalidates the provided query keys.
 * 
 * @param {string} table - The Supabase table name to listen to
 * @param {Array|string} queryKey - The React Query key(s) to invalidate
 * @param {Object} options - Optional parameters
 * @param {boolean} options.enabled - Whether the listener is active
 * @param {Function} options.filter - Optional function to filter which events trigger invalidation
 */
const useRealtimeQuery = (table, queryKey, options = {}) => {
  const { enabled = true, filter = null } = options;
  const queryClient = useQueryClient();
  const filterRef = useRef(filter);

  // Keep filter ref updated
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    if (!enabled || !table) return;

    const channel = supabase
      .channel(`rt-query-${table}-${JSON.stringify(queryKey)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: table },
        (payload) => {
          // If a filter is provided, check if we should invalidate
          if (filterRef.current && !filterRef.current(payload)) {
            return;
          }

          // Small delay to ensure DB write is committed and Supabase cache is updated
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
          }, 300);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, JSON.stringify(queryKey), enabled, queryClient]);
};

export default useRealtimeQuery;
