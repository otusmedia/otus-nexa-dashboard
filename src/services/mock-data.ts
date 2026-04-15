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
    id: "u1",
    name: "Ana Silva",
    role: "admin",
    modules: ["dashboard", "tasks", "goals", "roadmap", "events", "ideas", "files", "contracts", "invoices", "marketing", "users"],
  },
  {
    id: "u2",
    name: "Camila Team",
    role: "team",
    modules: ["dashboard", "tasks", "goals", "roadmap", "events", "ideas", "files", "marketing"],
  },
  {
    id: "u3",
    name: "Lucas Rocha",
    role: "traffic_manager",
    modules: ["dashboard", "tasks", "events", "marketing"],
  },
  {
    id: "u4",
    name: "Client - Bright EU",
    role: "client",
    modules: ["dashboard", "goals", "files", "invoices"],
  },
  {
    id: "u5",
    name: "Assistant - Pri",
    role: "assistant",
    modules: ["tasks", "files", "events"],
  },
];

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Launch Q2 Meta campaign",
    description: "Finalize creatives and tracking setup for EU audience.",
    status: "in_progress",
    assignee: "Lucas Rocha",
    dueDate: "2026-04-20",
    tags: ["Meta Ads"],
    files: ["creative_q2_v5.png"],
    comments: [
      { id: "tc1", author: "Ana Silva", text: "Please confirm budget split.", createdAt: "2026-04-15 10:22" },
      { id: "tc2", author: "Lucas Rocha", text: "Updated and ready for approval.", createdAt: "2026-04-15 12:11" },
    ],
    approval: "pending",
    linkedEventIds: ["e1"],
  },
  {
    id: "t2",
    title: "Weekly content calendar",
    description: "Plan reels and static posts for 3 channels.",
    status: "in_review",
    assignee: "Assistant - Pri",
    dueDate: "2026-04-18",
    tags: ["Social"],
    files: ["content_week_16.xlsx"],
    comments: [{ id: "tc3", author: "Assistant - Pri", text: "Waiting client feedback.", createdAt: "2026-04-14 09:42" }],
    approval: "draft",
    linkedEventIds: ["e2"],
  },
  {
    id: "t3",
    title: "Google Ads CPL optimization",
    description: "Adjust bidding strategy and negative keyword list.",
    status: "backlog",
    assignee: "Lucas Rocha",
    dueDate: "2026-04-24",
    tags: ["Google Ads"],
    files: [],
    comments: [],
    approval: "approved",
    linkedEventIds: [],
  },
  {
    id: "t4",
    title: "Client monthly report deck",
    description: "Prepare performance summary and recommendations.",
    status: "completed",
    assignee: "Ana Silva",
    dueDate: "2026-04-12",
    tags: ["Social", "Google Ads", "Meta Ads"],
    files: ["report_march.pdf"],
    comments: [{ id: "tc4", author: "Ana Silva", text: "Deck sent to client.", createdAt: "2026-04-12 08:20" }],
    approval: "approved",
    linkedEventIds: [],
  },
];

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

export const fileItems: FileItem[] = [
  {
    id: "f1",
    name: "creative_q2_v5.png",
    category: "Creatives",
    description: "Primary paid social creative",
    status: "approved",
    uploadedAt: "2026-04-14",
    assignee: "Lucas Rocha",
    tags: ["Meta Ads"],
    attachedToTask: "t1",
  },
  {
    id: "f2",
    name: "launch_video_cut.mp4",
    category: "Videos",
    description: "Launch cut v2",
    status: "draft",
    uploadedAt: "2026-04-13",
    assignee: "Assistant - Pri",
    tags: ["Social"],
  },
  {
    id: "f3",
    name: "report_march.pdf",
    category: "Reports",
    description: "Monthly report package",
    status: "approved",
    uploadedAt: "2026-04-10",
    assignee: "Ana Silva",
    tags: ["Reports"],
    attachedToTask: "t4",
  },
];

export const contracts: ContractItem[] = [
  {
    id: "c1",
    name: "Bright EU - Annual Scope.pdf",
    description: "Main client scope agreement.",
    uploadDate: "2026-01-03",
    status: "active",
    assignee: "Ana Silva",
    tags: ["legal", "scope"],
  },
  {
    id: "c2",
    name: "Legacy Retainer 2025.pdf",
    description: "Previous yearly agreement.",
    uploadDate: "2025-01-03",
    status: "expired",
    assignee: "Ana Silva",
    tags: ["legacy"],
  },
];

export const invoices: InvoiceItem[] = [
  { id: "i1", amount: 6200, status: "paid", dueDate: "2026-04-05", fileName: "invoice_apr_2026.pdf", description: "Main monthly fee" },
  { id: "i2", amount: 6200, status: "pending", dueDate: "2026-05-05", fileName: "invoice_may_2026.pdf", description: "Main monthly fee" },
  { id: "i3", amount: 1500, status: "overdue", dueDate: "2026-03-20", fileName: "extra_media_costs.pdf", description: "Extra paid media costs" },
];

export const activityLog: ActivityLogItem[] = [
  { id: "a1", action: "Task status changed to In Progress", actor: "Lucas Rocha", timestamp: "2h ago" },
  { id: "a2", action: "New file uploaded: report_march.pdf", actor: "Ana Silva", timestamp: "5h ago" },
  { id: "a3", action: "Invoice added: invoice_may_2026.pdf", actor: "Finance Bot", timestamp: "1d ago" },
  { id: "a4", action: "Campaign meeting event created", actor: "Ana Silva", timestamp: "1d ago" },
];

export const notificationsSeed: NotificationItem[] = [
  { id: "n1", message: "Task 'Launch Q2 Meta campaign' was updated.", type: "task", read: false },
  { id: "n2", message: "New comment added on content calendar.", type: "comment", read: false },
  { id: "n3", message: "Invoice May 2026 is now pending.", type: "invoice", read: true },
];

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
