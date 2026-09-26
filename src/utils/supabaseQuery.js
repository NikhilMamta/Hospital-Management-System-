/**
 * Small helpers for Supabase list queries.
 *
 * Supabase (PostgREST) returns at most 1,000 rows per request. A query without
 * .range() silently stops at 1,000, so long lists must be paged on the server
 * (preferred) or fetched in chunks with fetchAllRows (only when the full list
 * is really needed, e.g. a dropdown of all medicines).
 */

/** Removes characters that have a meaning in PostgREST's or() filter syntax. */
export const cleanSearchTerm = (term) =>
  String(term || "").replace(/[,()"\\]/g, " ").trim();

/**
 * or() filter that matches `term` anywhere in any of `columns`, ignoring case.
 * Pass a term already cleaned with cleanSearchTerm.
 * @example query.or(ilikeAny(["patient_name", "ipd_number"], term))
 */
export const ilikeAny = (columns, term) =>
  columns.map((col) => `${col}.ilike."%${term}%"`).join(",");

/**
 * Fetches every row of a query, 1,000 at a time.
 * The query must have a stable order (e.g. .order("id")) or rows can repeat/skip.
 *
 * @param {(from: number, to: number) => PromiseLike<{ data: any[], error: any }>} fetchPage
 *   builds and runs the query for one range, e.g.
 *   (from, to) => supabase.from("medicine").select("medicine_name").order("id").range(from, to)
 * @returns {Promise<any[]>}
 */
export const fetchAllRows = async (fetchPage, pageSize = 1000) => {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
};
