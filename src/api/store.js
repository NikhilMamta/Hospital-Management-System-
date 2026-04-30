/**
 * Store API service for fetching master data and mappings.
 */

const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY2;
// Based on existing store-out-submit URL pattern
const EDGE_FUNCTION_URL =
  "https://kfdtcqjkesvdfzncfbns.supabase.co/functions/v1/bright-task";

/**
 * Fetches store masters (item mapping to group head) from the Edge Function.
 */
export const getStoreMasters = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      signal: controller.signal,
    });

    console.log("this is the edge function response", response);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("this is the edge function response data", data);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Error fetching store masters:", error);
    throw error;
  }
};
/**
 * Creates a new store out entry via Edge Function.
 */
export const createStoreOut = async (payload) => {
  const SUBMIT_URL = "https://kfdtcqjkesvdfzncfbns.supabase.co/functions/v1/store-out-submit";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "x-client-info": "supabase-js-v2",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Edge Function error response:", errorText);
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
    }

    const result = await response.json().catch(() => ({ success: true }));
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.error("Request timed out after 45s");
      throw new Error(
        "The request timed out. The server might be slow or the Edge Function is cold-starting. Please try again in a moment.",
      );
    }
    console.error("Submission error details:", error);
    throw error;
  }
};
