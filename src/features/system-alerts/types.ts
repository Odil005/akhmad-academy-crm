export type SystemAlertSeverity = "critical" | "warning";

export type SystemAlert = {
  id: string;
  kind: "attendance" | "telegram" | "receipt" | "fiscal" | "system";
  severity: SystemAlertSeverity;
  title: string;
  detail: string;
  count: number;
  actionLabel: string;
  actionPath: string;
  createdAt: string;
};

export type SystemAlertSnapshot = {
  alerts: SystemAlert[];
  totalCount: number;
  criticalCount: number;
  checkedAt: string;
};
