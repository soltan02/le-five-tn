import { useSyncExternalStore } from "react";
import { subscribe, getState } from "./store.js";

/** Subscribe a component to the whole store (re-renders on any change). */
export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));
}

export function useSession() {
  return useStore((s) => s.session);
}
