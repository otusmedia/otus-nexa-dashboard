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
  source?: string | null;
  source_id?: string | null;
  lead_id?: string | null;
  lead_name?: string | null;
  /** True for auto-populated project / marketing task due dates (read-only on calendar). */
  is_task_deadline?: boolean;
  task_meta?: CalendarTaskMeta | null;
  /** Synthetic row from `scheduled_posts` (Publishing). */
  is_scheduled_post?: boolean;
  publishing_platforms?: string[] | null;
  publishing_status?: string | null;
  /** When a published scheduled post is tied to a project task (Publishing calendar). */
  scheduled_post_linked_task_id?: string | null;
  scheduled_post_project_id?: string | null;
  scheduled_post_task_name?: string | null;
}

export type CalendarView = "month" | "week" | "day";

export interface CalendarInvitableUser {
  id: string;
  name: string;
  email: string;
}

/** Synthetic task deadlines shown on calendar (not persisted in calendar_events). */
export interface CalendarTaskMeta {
  projectLabel: string;
  source: "project" | "marketing";
}
