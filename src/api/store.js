/**
 * Store API service for fetching master data and mappings.
 */

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY2 ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZHRjcWprZXN2ZGZ6bmNmYm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTU3MzksImV4cCI6MjA5MjY3MTczOX0.SkoX4vwokA9iH8-jufYc01dreXa0Ms1PYDCmQpz89Y0";
// Based on existing store-out-submit URL pattern
const STORE_SUPABASE_URL = "https://kfdtcqjkesvdfzncfbns.supabase.co";
const EDGE_FUNCTION_URL =
  `${STORE_SUPABASE_URL}/functions/v1/bright-task`;

const STORE_OUT_PREFIX = "SO-";
const STORE_OUT_PADDING = 4;

/**
 * Fetches the next base store out indent number.
 */
export const getNextStoreOutIndentNo = async () => {
  // Only the highest issue numbers are needed. Fetching all of them stopped at
  // Supabase's 1,000-row limit, so past 1,000 requests the "max" could be too low
  // and a duplicate SO number could be issued. Numbers are zero-padded
  // (SO-0001), so text order equals number order up to SO-9999.
  const response = await fetch(
    `${STORE_SUPABASE_URL}/rest/v1/store_out_request?select=issue_no&issue_no=not.is.null&order=issue_no.desc&limit=50`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Store out issue number error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  const lastNumber = (data || []).reduce((max, row) => {
    const match = String(row.issue_no || "").match(/^SO-(\d+)(?:\/\d+)?$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `${STORE_OUT_PREFIX}${String(lastNumber + 1).padStart(
    STORE_OUT_PADDING,
    "0",
  )}`;
};

/**
 * Fetches store masters (items with group head, purchase_uom, and issue_uom)
 * directly from the store's items table, falling back to the Edge Function if needed.
 */
export const getStoreMasters = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(
      `${STORE_SUPABASE_URL}/rest/v1/items?select=id,item_name,group_head,purchase_uom,issue_uom&order=item_name.asc&limit=5000`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data;
    }

    console.warn("Items table fetch returned non-ok status:", response.status);

    // Fallback to Edge Function if items table fetch fails
    const edgeResponse = await fetch(EDGE_FUNCTION_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!edgeResponse.ok) {
      const errorText = await edgeResponse.text();
      throw new Error(`Edge Function error: ${edgeResponse.status} - ${errorText}`);
    }

    const data = await edgeResponse.json();
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
  const SUBMIT_URL = `${STORE_SUPABASE_URL}/rest/v1/store_out_request`;

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
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Store out submit error response:", errorText);
      throw new Error(`Store out submit error: ${response.status} - ${errorText}`);
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

/**
 * Fetches all store out requests from the external Supabase project.
 */
export const getStoreOutRequests = async () => {
  const FETCH_URL = `${STORE_SUPABASE_URL}/rest/v1/store_out_request?select=*&order=timestamp.desc`;

  const response = await fetch(FETCH_URL, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch store out requests: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Fetches the status of a specific store out request for a specific user.
 */
export const getStoreOutStatus = async (indentNumber, username) => {
  const REQUEST_URL = `${STORE_SUPABASE_URL}/rest/v1/store_out_request?indent_number=eq.${encodeURIComponent(indentNumber)}&requested_by=eq.${encodeURIComponent(username)}&select=*`;

  const response = await fetch(REQUEST_URL, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch request status: ${response.status} - ${errorText}`);
  }

  const requestData = await response.json();
  
  if (!requestData || requestData.length === 0) {
    return null; // Not found or not authorized
  }

  const request = requestData[0];

  // Now fetch from store_out_approval if it exists
  const APPROVAL_URL = `${STORE_SUPABASE_URL}/rest/v1/store_out_approval?indent_number=eq.${encodeURIComponent(indentNumber)}&select=*`;

  const approvalResponse = await fetch(APPROVAL_URL, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  let approvalData = null;
  if (approvalResponse.ok) {
    const arr = await approvalResponse.json();
    if (arr && arr.length > 0) {
      approvalData = arr[0];
    }
  }

  return {
    request,
    approval: approvalData
  };
};

/**
 * Fetches all store out requests for a specific user.
 */
export const getUserStoreOutRequests = async (username) => {
  const FETCH_URL = `${STORE_SUPABASE_URL}/rest/v1/store_out_request?requested_by=eq.${encodeURIComponent(username)}&select=*&order=timestamp.desc`;

  const response = await fetch(FETCH_URL, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch user store out requests: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

/**
 * Fetches the approval status for a specific indent number.
 */
export const getStoreOutApproval = async (indentNumber) => {
  const APPROVAL_URL = `${STORE_SUPABASE_URL}/rest/v1/store_out_approval?indent_number=eq.${encodeURIComponent(indentNumber)}&select=*`;

  const response = await fetch(APPROVAL_URL, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch approval status: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data && data.length > 0 ? data[0] : null;
};
