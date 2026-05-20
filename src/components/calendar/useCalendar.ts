"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarView } from "@/types/calendar";
import { addDays, addMonths, startOfWeekSunday } from "./calendar-utils";

const VIEW_KEY = "calendar-view";

type PersistedView = "month" | "week";

function readPersistedView(): PersistedView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "week" || v === "month") return v;
  } catch {
    /* ignore */
  }
  return "month";
}

export function useCalendar() {
  const [view, setViewState] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setViewState(readPersistedView());
    setCurrentDate(new Date());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const v: PersistedView = view === "week" ? "week" : "month";
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }, [view, hydrated]);

  const setView = useCallback((v: CalendarView) => {
    if (v === "day") return;
    setViewState(v);
  }, []);

  const goToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goPrev = useCallback(() => {
    setCurrentDate((d) => {
      if (view === "month") return addMonths(d, -1);
      if (view === "week") return addDays(d, -7);
      return addDays(d, -7);
    });
  }, [view]);

  const goNext = useCallback(() => {
    setCurrentDate((d) => {
      if (view === "month") return addMonths(d, 1);
      if (view === "week") return addDays(d, 7);
      return addDays(d, 7);
    });
  }, [view]);

  const weekStart = useMemo(() => startOfWeekSunday(currentDate), [currentDate]);

  return {
    view,
    setView,
    currentDate,
    setCurrentDate,
    weekStart,
    goToday,
    goPrev,
    goNext,
  };
}
