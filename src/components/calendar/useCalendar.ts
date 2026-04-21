"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarView } from "@/types/calendar";
import { addDays, addMonths, startOfWeekSunday } from "./calendar-utils";

const VIEW_KEY = "calendar-view";
const POS_KEY = "calendar-position";

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

function readPersistedDate(): Date {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { y?: unknown; m?: unknown };
      const y = typeof o.y === "number" ? o.y : new Date().getFullYear();
      const m = typeof o.m === "number" ? o.m : new Date().getMonth();
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 0 && m <= 11) {
        return new Date(y, m, 1);
      }
    }
  } catch {
    /* ignore */
  }
  return new Date();
}

export function useCalendar() {
  const [view, setViewState] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setViewState(readPersistedView());
    setCurrentDate(readPersistedDate());
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

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ y: currentDate.getFullYear(), m: currentDate.getMonth() }));
    } catch {
      /* ignore */
    }
  }, [currentDate, hydrated]);

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
