import { useEffect, useRef } from "react";

/**
 * Cross-page data change bus.
 *
 * When a record type changes on one page (for example a new group), every other
 * open page and browser tab refreshes its own copy instead of showing stale data.
 */
export type DataTopic = "groups" | "students" | "teachers" | "subjects";

const EVENT_NAME = "akhmad:data-changed";
const CHANNEL_NAME = "akhmad:data-events";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const topic = (event.data as { topic?: DataTopic })?.topic;
      if (topic) {
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { topic, remote: true } }));
      }
    };
  }
  return channel;
}

export function emitDataChanged(topic: DataTopic) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { topic } }));
  try {
    getChannel()?.postMessage({ topic });
  } catch {
    /* broadcast is best-effort */
  }
}

/** Re-run `handler` whenever `topic` changes anywhere in the app. */
export function useDataEvent(topic: DataTopic, handler: () => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    getChannel();
    const listener = (event: Event) => {
      if ((event as CustomEvent<{ topic?: DataTopic }>).detail?.topic === topic) {
        handlerRef.current();
      }
    };
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
  }, [topic]);
}
