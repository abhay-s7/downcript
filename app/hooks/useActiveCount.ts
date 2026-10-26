"use client";

import { useEffect, useState } from "react";
import { getActiveCount, subscribeActive } from "@/app/lib/services/activity/activeJobTracker";

// Reads the existing cross-tab activity pub/sub (already fed by
// Download/Transcript/Meta Ads' own queue hooks for the update-banner's
// "don't interrupt active jobs" check) as a live count, for the topline's
// "N running" pill -- no new tracking infrastructure, just a second
// subscriber to what already exists.
export function useActiveCount(): number {
  const [count, setCount] = useState(() => getActiveCount());

  useEffect(() => subscribeActive(setCount), []);

  return count;
}
