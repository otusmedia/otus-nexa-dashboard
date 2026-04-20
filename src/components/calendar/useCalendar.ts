"use client";

import { useCallback, useState } from "react";
import type { CalendarView } from "@/types/calendar";
import { addDays, addMonths, startOfWeekSunday } from "./calendar-utils";

export function useCalendar(initialView: CalendarView = "month") {
  const [view, setView] = useState<CalendarView>(initialView);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const goToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goPrev = useCallback(() => {
    setCurrentDate((d) => {
      if (view === "month") return addMonths(d, -1);
      if (view === "week") return addDays(d, -7);
      return addDays(d, -1);
    });
  }, [view]);

  const goNext = useCallback(() => {
    setCurrentDate((d) => {
      if (view === "month") return addMonths(d, 1);
      if (view === "week") return addDays(d, 7);
      return addDays(d, 1);
    });
  }, [view]);

  const weekStart = startOfWeekSunday(currentDate);

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
