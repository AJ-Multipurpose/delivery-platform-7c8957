import { useEffect, useRef } from "react";
/** Events contain no business records. Every update reloads through authorised APIs. */
export function useLiveEvents(enabled: boolean, onChange: () => void) {
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (!enabled) return;
    let stream: EventSource | null = null,
      timer: ReturnType<typeof setTimeout>,
      attempt = 0,
      closed = false;
    function connect() {
      if (closed) return;
      stream = new EventSource("/api/events");
      stream.onopen = () => {
        attempt = 0;
        latest.current();
      };
      stream.addEventListener("change", () => latest.current());
      stream.onerror = () => {
        stream?.close();
        if (!closed)
          timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempt++));
      };
    }
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      stream?.close();
    };
  }, [enabled]);
}
