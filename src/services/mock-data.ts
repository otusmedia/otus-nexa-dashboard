import type {
  ActivityLogItem,
  AppUser,
  ContractItem,
  EventItem,
  FileItem,
  Goal,
  IdeaItem,
  InvoiceItem,
  NotificationItem,
  RoadmapItem,
  Task,
} from "@/types";

export const users: AppUser[] = [
  {
    id: "u-admin-mc",
    name: "Matheus Canci",
    role: "admin",
    company: "nexa",
    modules: ["dashboard", "projects", "financial", "marketing", "calendar", "crm", "files", "contracts"],
  },
  {
    id: "u-admin-mf",
    name: "Matheus Foletto",
    role: "admin",
    company: "otus",
    modules: ["dashboard", "projects", "financial", "marketing", "calendar", "crm", "files", "contracts"],
  },
  {
    id: "u-admin-joe",
    name: "Joe",
    role: "admin",
    company: "rocketride",
    modules: ["dashboard", "projects", "financial", "calendar", "crm", "files", "contracts"],
  },
  {
    id: "u-admin-dm",
    name: "David Martins",
    role: "admin",
    company: "",
    modules: ["dashboard", "projects", "financial", "marketing", "calendar", "crm", "files", "contracts"],
  },
  {
    id: "u-mgr-kk",
    name: "Karla Kachuba",
    role: "manager",
    company: "nexa",
    modules: ["projects", "marketing", "files"],
  },
  {
    id: "u-mgr-luca",
    name: "Luca",
    role: "manager",
    company: "otus",
    modules: ["projects", "marketing", "files"],
  },
];

export const tasks: Task[] = [];

export const goals: Goal[] = [
  { id: "g1", name: "Leads / month", target: 800, current: 620, unit: "leads", status: "on_track" },
  { id: "g2", name: "CPL", target: 14, current: 17, unit: "USD", status: "at_risk" },
  { id: "g3", name: "Revenue", target: 120000, current: 89000, unit: "USD", status: "on_track" },
  { id: "g4", name: "Content output", target: 48, current: 29, unit: "pieces", status: "off_track" },
];

export const events: EventItem[] = [
  {
    id: "e1",
    title: "Campaign launch review",
    description: "Final go/no-go meeting with client.",
    date: "2026-04-19",
    time: "10:00",
    type: "meeting",
    assignedUsers: ["Ana Silva", "Lucas Rocha"],
    linkedTaskIds: ["t1"],
    status: "confirmed",
    tags: ["Meta Ads"],
  },
  {
    id: "e2",
    title: "Instagram Reels batch",
    description: "Record and schedule this week videos.",
    date: "2026-04-17",
    time: "14:00",
    type: "content",
    assignedUsers: ["Assistant - Pri"],
    linkedTaskIds: ["t2"],
    status: "planned",
    tags: ["Social"],
  },
];

export const fileItems: FileItem[] = [];

export const contracts: ContractItem[] = [];

export const invoices: InvoiceItem[] = [];

export const activityLog: ActivityLogItem[] = [];

export const notificationsSeed: NotificationItem[] = [];

export const ideasSeed: IdeaItem[] = [
  {
    id: "idea1",
    title: "Localized ad creatives for LATAM spring launch",
    description: "Test localization impact on CTR for Spanish and Portuguese creatives.",
    createdAt: "2026-04-10",
    status: "new",
    assignee: "Lucas Rocha",
    tags: ["Meta Ads", "Localization"],
  },
  {
    id: "idea2",
    title: "YouTube short educational funnel",
    description: "Introduce short educational ads before conversion campaign.",
    createdAt: "2026-04-13",
    status: "validated",
    assignee: "Camila Team",
    tags: ["YouTube", "Funnel"],
  },
];

export const roadmapSeed: RoadmapItem[] = [
  {
    id: "r1",
    title: "Creative sprint + UGC approvals",
    description: "Prepare assets for paid social and organic distribution.",
    startDate: "2026-04-14",
    endDate: "2026-04-21",
    status: "in_progress",
    assignee: "Camila Team",
    tags: ["social", "creative"],
  },
  {
    id: "r2",
    title: "Google Ads landing page test",
    description: "Run A/B conversion test with two LP variants.",
    startDate: "2026-04-22",
    endDate: "2026-05-02",
    status: "planned",
    assignee: "Lucas Rocha",
    tags: ["google ads", "cvr"],
  },
];
