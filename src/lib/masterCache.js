/**
 * masterCache.js — In-memory TTL cache for slow-changing master data.
 *
 * Problem solved:
 *   The pharmacy indent form called getMedicines() (5 000-row fetch),
 *   getInvestigations(), and getCategories() on EVERY mount.  Since
 *   these lists change only when an admin edits the masters page, a
 *   30-minute in-memory cache eliminates the redundant network trips.
 *
 * Usage:
 *   import { getCachedMedicines, invalidateMasterCache } from '../lib/masterCache';
 *
 *   // In any component / API that previously called getMedicines():
 *   const medicines = await getCachedMedicines();
 *
 *   // After saving/deleting a medicine, investigation, or category:
 *   invalidateMasterCache();
 */

import supabase from '../SupabaseClient';

const TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Generic cache entry structure.
 * @template T
 * @typedef {{ data: T, fetchedAt: number } | null} CacheEntry
 */

/** @type {CacheEntry<string[]>} */
let medicineCache = null;

/** @type {CacheEntry<{ Pathology: string[], 'X-ray': string[], 'CT-scan': string[], USG: string[] }>} */
let investigationCache = null;

/** @type {CacheEntry<Array<{name: string}>>} */
let categoryCache = null;

/** @type {CacheEntry<string[]>} */
let doctorCache = null;

/** @type {CacheEntry<string[]>} */
let departmentCache = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

const isStale = (entry) =>
  !entry || Date.now() - entry.fetchedAt > TTL;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the full medicine name list.
 * Fetched once and cached for 30 minutes.
 * @returns {Promise<string[]>}
 */
export const getCachedMedicines = async () => {
  if (!isStale(medicineCache)) return medicineCache.data;

  const { data, error } = await supabase
    .from('medicine')
    .select('medicine_name')
    .order('medicine_name');

  if (error) throw error;

  medicineCache = {
    data: (data || []).map((m) => m.medicine_name).filter(Boolean),
    fetchedAt: Date.now(),
  };

  return medicineCache.data;
};

/**
 * Returns investigation tests grouped by type.
 * Fetched once and cached for 30 minutes.
 * @returns {Promise<{ Pathology: string[], 'X-ray': string[], 'CT-scan': string[], USG: string[] }>}
 */
export const getCachedInvestigations = async () => {
  if (!isStale(investigationCache)) return investigationCache.data;

  const { data, error } = await supabase
    .from('investigation')
    .select('name, type')
    .order('name');

  if (error) throw error;

  const grouped = { Pathology: [], 'X-ray': [], 'CT-scan': [], USG: [] };
  (data || []).forEach((item) => {
    const type = item.type === 'CT Scan' ? 'CT-scan' : item.type;
    if (grouped[type]) grouped[type].push(item.name);
  });

  investigationCache = { data: grouped, fetchedAt: Date.now() };
  return investigationCache.data;
};

/**
 * Returns the category list.
 * Fetched once and cached for 30 minutes.
 * @returns {Promise<Array<{name: string}>>}
 */
export const getCachedCategories = async () => {
  if (!isStale(categoryCache)) return categoryCache.data;

  const { data, error } = await supabase
    .from('category')
    .select('name')
    .order('name');

  if (error) throw error;

  categoryCache = { data: data || [], fetchedAt: Date.now() };
  return categoryCache.data;
};

/**
 * Returns the doctor name list.
 * Fetched once and cached for 30 minutes.
 * @returns {Promise<string[]>}
 */
export const getCachedDoctors = async () => {
  if (!isStale(doctorCache)) return doctorCache.data;

  const { data, error } = await supabase
    .from('doctors')
    .select('name')
    .not('name', 'is', null)
    .order('name');

  if (error) throw error;

  doctorCache = {
    data: (data || []).map((d) => d.name).filter(Boolean),
    fetchedAt: Date.now(),
  };

  return doctorCache.data;
};

/**
 * Returns the distinct department list from the master table.
 * Fetched once and cached for 30 minutes.
 * @returns {Promise<string[]>}
 */
export const getCachedDepartments = async () => {
  if (!isStale(departmentCache)) return departmentCache.data;

  const { data, error } = await supabase
    .from('master')
    .select('department')
    .not('department', 'is', null)
    .order('department');

  if (error) throw error;

  departmentCache = {
    data: [...new Set((data || []).map((d) => d.department).filter((v) => v?.trim()))],
    fetchedAt: Date.now(),
  };

  return departmentCache.data;
};

/**
 * Clears all master data caches immediately.
 * Call this after any create / update / delete on medicine, investigation,
 * category, doctors, or master (department) tables so the next fetch
 * gets fresh data.
 */
export const invalidateMasterCache = () => {
  medicineCache      = null;
  investigationCache = null;
  categoryCache      = null;
  doctorCache        = null;
  departmentCache    = null;
};
