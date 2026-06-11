import supabase from '../SupabaseClient';

/**
 * Fetches dashboard statistics via a single server-side RPC call.
 *
 * Previously this function fired 7 parallel full-table SELECT queries and
 * performed all aggregation in JavaScript — sending up to 15MB of raw rows
 * on every dashboard load.
 *
 * Now it calls get_dashboard_stats() (see sql_scripts/dashboard_rpc.sql),
 * which runs all COUNT / GROUP BY / trend queries inside PostgreSQL and
 * returns a single ~2KB JSON payload.
 *
 * Return shape is identical to the old implementation so Dashboard.jsx
 * requires no changes.
 */
export const getDashboardStats = async () => {
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw error;
  return data;
};

