export type CalendarEventType = "event" | "meeting" | "deadline" | "other";

export type CalendarInviteeStatus = "pending" | "accepted" | "declined";

export interface CalendarEventInvitee {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string | null;
  status: CalendarInviteeStatus;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  type: CalendarEventType;
  meet_link: string | null;
  location: string | null;
  color: string | null;
  created_by: string | null;
  organization: string | null;
  created_at: string;
  calendar_event_invitees?: CalendarEventInvitee[];
}

export type CalendarView = "month" | "week" | "day";

export interface CalendarInvitableUser {
  id: string;
  name: string;
  email: string;
}
