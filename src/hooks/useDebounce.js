import { useState, useEffect } from "react";

/**
 * Delays updating a value until the user stops changing it for `delay` ms.
 * Use this to debounce search inputs so filters / DB calls don't fire on every keystroke.
 *
 * @param {any} value  - The raw value to debounce (usually from useState)
 * @param {number} delay - Milliseconds to wait after last change (default: 300ms)
 * @returns The debounced value (only updates after the user pauses)
 *
 * @example
 * const [search, setSearch] = useState("");
 * const debouncedSearch = useDebounce(search, 300);
 *
 * // Use debouncedSearch in useMemo / useEffect — not the raw `search` state
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes again before delay expires
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
