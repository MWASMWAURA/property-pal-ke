export const formatKsh = (n: number) =>
  `KSh ${n.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export const properties = [
  { id: "p1", name: "Kilimani Heights", location: "Kilimani, Nairobi", units: 24, occupied: 22, image: "", unitNames: ["A-101","A-102","A-103","A-104","A-201","A-202","A-203","A-204","A-301","A-302","A-303","A-304","B-101","B-102","B-103","B-104","B-201","B-202","B-203","B-204","B-301","B-302","C-101","C-102"] },
  { id: "p2", name: "Westlands Court", location: "Westlands, Nairobi", units: 18, occupied: 17, image: "", unitNames: ["A-101","A-102","A-103","A-104","A-201","A-202","A-203","A-204","B-101","B-102","B-103","B-104","B-201","B-202","B-203","C-101","C-102","C-103"] },
  { id: "p3", name: "Lavington Gardens", location: "Lavington, Nairobi", units: 12, occupied: 9, image: "", unitNames: ["A-101","A-102","A-103","B-101","B-102","B-103","C-101","C-102","C-103","C-104","C-105","D-101"] },
  { id: "p4", name: "Karen Villas", location: "Karen, Nairobi", units: 8, occupied: 8, image: "", unitNames: ["Villa-1","Villa-2","Villa-3","Villa-4","Villa-5","Villa-6","Villa-7","Villa-8"] },
];

export type TenantStatus = "paid" | "pending" | "overdue";

export const tenants = [
  { id: "t1", name: "Wanjiku Kamau",   unit: "A-204", property: "Kilimani Heights",  rent: 45000, status: "paid"    as TenantStatus, dueDate: "05/05/2026", phone: "+254 712 345 678", method: "M-Pesa",   leaseEnd: "30/11/2026" },
  { id: "t2", name: "Brian Otieno",    unit: "B-101", property: "Westlands Court",   rent: 65000, status: "overdue" as TenantStatus, dueDate: "01/04/2026", phone: "+254 722 998 411", method: "Bank",     leaseEnd: "15/05/2026" },
  { id: "t3", name: "Aisha Mohamed",   unit: "A-308", property: "Kilimani Heights",  rent: 52000, status: "pending" as TenantStatus, dueDate: "05/05/2026", phone: "+254 733 112 099", method: "M-Pesa",   leaseEnd: "12/08/2026" },
  { id: "t4", name: "David Mwangi",    unit: "C-202", property: "Lavington Gardens", rent: 78000, status: "paid"    as TenantStatus, dueDate: "01/05/2026", phone: "+254 700 554 321", method: "M-Pesa",   leaseEnd: "20/05/2026" },
  { id: "t5", name: "Faith Njeri",     unit: "B-205", property: "Westlands Court",   rent: 60000, status: "overdue" as TenantStatus, dueDate: "01/04/2026", phone: "+254 711 887 234", method: "Bank",     leaseEnd: "01/12/2026" },
  { id: "t6", name: "Samuel Kiprop",   unit: "A-102", property: "Kilimani Heights",  rent: 48000, status: "paid"    as TenantStatus, dueDate: "03/05/2026", phone: "+254 720 332 109", method: "M-Pesa",   leaseEnd: "30/06/2026" },
  { id: "t7", name: "Grace Achieng",   unit: "D-101", property: "Karen Villas",      rent: 120000,status: "paid"    as TenantStatus, dueDate: "01/05/2026", phone: "+254 733 220 991", method: "Bank",     leaseEnd: "01/09/2026" },
  { id: "t8", name: "Peter Wafula",    unit: "C-105", property: "Lavington Gardens", rent: 85000, status: "pending" as TenantStatus, dueDate: "05/05/2026", phone: "+254 712 776 543", method: "M-Pesa",   leaseEnd: "10/10/2026" },
];

export const maintenance = [
  { id: "m1", tenant: "Brian Otieno",  unit: "B-101", category: "Plumbing",   priority: "urgent" as const, description: "Burst pipe in kitchen, water all over",   status: "pending"     as const, created: "02/05/2026" },
  { id: "m2", tenant: "Aisha Mohamed", unit: "A-308", category: "Electrical", priority: "high"   as const, description: "Sockets in living room not working",       status: "in_progress" as const, created: "30/04/2026" },
  { id: "m3", tenant: "Faith Njeri",   unit: "B-205", category: "General",    priority: "low"    as const, description: "Door hinge needs tightening",              status: "pending"     as const, created: "01/05/2026" },
  { id: "m4", tenant: "David Mwangi",  unit: "C-202", category: "Plumbing",   priority: "medium" as const, description: "Slow drain in bathroom sink",              status: "resolved"    as const, created: "28/04/2026" },
];

export const messages = [
  { id: "w1", tenant: "Brian Otieno",  preview: "Sawa, I'll send by Friday...",        time: "10:24", unread: 2, status: "overdue" },
  { id: "w2", tenant: "Aisha Mohamed", preview: "Asante for the maintenance update",   time: "09:11", unread: 0, status: "active" },
  { id: "w3", tenant: "Faith Njeri",   preview: "Kindly confirm receipt of payment",   time: "Yest",  unread: 1, status: "pending" },
  { id: "w4", tenant: "Wanjiku Kamau", preview: "BALANCE",                              time: "Yest",  unread: 0, status: "command" },
];

export const revenueByMonth = [
  { month: "Nov", collected: 1850000, pending: 120000 },
  { month: "Dec", collected: 1920000, pending: 90000 },
  { month: "Jan", collected: 2010000, pending: 110000 },
  { month: "Feb", collected: 1980000, pending: 140000 },
  { month: "Mar", collected: 2120000, pending: 80000 },
  { month: "Apr", collected: 2240000, pending: 60000 },
];

export const collectionDonut = [
  { name: "Collected", value: 2240000, color: "hsl(var(--success))" },
  { name: "Pending",   value: 137000,  color: "hsl(var(--warning))" },
  { name: "Overdue",   value: 125000,  color: "hsl(var(--destructive))" },
];

export const payments = [
  { id: "pay1", tenantId: "t1", tenantName: "Wanjiku Kamau", amount: 45000, period: "April 2026", method: "M-Pesa", reference: "NDE4NDU5OTQ4", paidAt: "2026-04-30T10:00:00Z", status: "paid" as const },
  { id: "pay2", tenantId: "t1", tenantName: "Wanjiku Kamau", amount: 45000, period: "May 2026", method: "M-Pesa", reference: "NDE4NDU5OTQ5", paidAt: "2026-05-01T14:30:00Z", status: "paid" as const },
  { id: "pay3", tenantId: "t2", tenantName: "Brian Otieno", amount: 65000, period: "March 2026", method: "Bank", reference: "BT-20260315", paidAt: "2026-03-15T09:15:00Z", status: "paid" as const },
  { id: "pay4", tenantId: "t3", tenantName: "Aisha Mohamed", amount: 52000, period: "April 2026", method: "M-Pesa", reference: "NDE4NDU5OTQ2", paidAt: "2026-04-28T16:45:00Z", status: "paid" as const },
  { id: "pay5", tenantId: "t4", tenantName: "David Mwangi", amount: 78000, period: "April 2026", method: "M-Pesa", reference: "NDE4NDU5OTQ3", paidAt: "2026-04-29T11:20:00Z", status: "paid" as const },
  { id: "pay6", tenantId: "t5", tenantName: "Faith Njeri", amount: 60000, period: "March 2026", method: "Bank", reference: "BT-20260320", paidAt: "2026-03-20T13:10:00Z", status: "paid" as const },
  { id: "pay7", tenantId: "t6", tenantName: "Samuel Kiprop", amount: 48000, period: "April 2026", method: "M-Pesa", reference: "NDE4NDU5OTQ1", paidAt: "2026-04-27T08:55:00Z", status: "paid" as const },
  { id: "pay8", tenantId: "t7", tenantName: "Grace Achieng", amount: 120000, period: "April 2026", method: "Bank", reference: "BT-20260425", paidAt: "2026-04-25T15:40:00Z", status: "paid" as const },
  // Pending payments
  { id: "pay9", tenantId: "t3", tenantName: "Aisha Mohamed", amount: 52000, period: "May 2026", method: "M-Pesa", reference: null, paidAt: null, status: "pending" as const, dueDate: "2026-05-05T00:00:00Z" },
  { id: "pay10", tenantId: "t8", tenantName: "Peter Wafula", amount: 85000, period: "May 2026", method: "M-Pesa", reference: null, paidAt: null, status: "pending" as const, dueDate: "2026-05-05T00:00:00Z" },
  // Overdue payments
  { id: "pay11", tenantId: "t2", tenantName: "Brian Otieno", amount: 65000, period: "April 2026", method: "Bank", reference: null, paidAt: null, status: "overdue" as const, dueDate: "2026-04-01T00:00:00Z" },
  { id: "pay12", tenantId: "t5", tenantName: "Faith Njeri", amount: 60000, period: "April 2026", method: "Bank", reference: null, paidAt: null, status: "overdue" as const, dueDate: "2026-04-01T00:00:00Z" },
];
