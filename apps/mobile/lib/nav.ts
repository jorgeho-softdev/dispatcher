import { useRef } from 'react';
import { useRouter, Href } from 'expo-router';

// A rapid double-tap fires router.push twice before the first screen has
// mounted, stacking two copies of the same route. Ignoring presses within
// this window is simpler and safer than tracking navigation-in-flight state.
const NAV_DEBOUNCE_MS = 600;

export function useDebouncedPush() {
  const router = useRouter();
  const lastNavAt = useRef(0);

  return (href: Href) => {
    const now = Date.now();
    if (now - lastNavAt.current < NAV_DEBOUNCE_MS) return;
    lastNavAt.current = now;
    router.push(href);
  };
}
