"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The Daily Planner now lives inside Today: old links open Today's day-plan editor. */
export default function PlannerPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("editPlan", "1");
    router.replace(`/today?${params}`);
  }, [router]);

  return null;
}
