import { useEffect, useState } from 'react'

/**
 * Diffère la valeur pour ne pas interroger l'API à chaque frappe.
 * 250 ms, comme l'autocomplétion du web.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
