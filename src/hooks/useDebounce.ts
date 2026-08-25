import { useState, useEffect } from 'react';

/**
 * A custom hook that returns a debounced value.
 * Useful for delaying API calls or expensive operations until a user has stopped typing.
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Set debouncedValue to value after the specified delay
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Cancel the timeout if value or delay changes
        // This is how we prevent debouncedValue from updating if value is changed
        // within the delay period. Timeout gets cleared and restarted.
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
