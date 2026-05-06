const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const post = (path: string, body: object) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  }).then(r => r.json());

const get = (path: string) =>
  fetch(`${BASE}${path}`, {
    headers: getAuthHeaders(),
  }).then(r => r.json());

const put = (path: string, body?: object) =>
  fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.json());

export const api = {
  // Sync tenant to server whenever added
  syncTenant: (tenant: object) => post('/api/sync/tenants', tenant),

  // Sync payment to server + triggers real WhatsApp receipt
  syncPayment: (payment: object) => post('/api/sync/payments', payment),

  // Get notifications from server (real complaints from WhatsApp tenants)
  getNotifications: () => get('/api/sync/notifications'),

  // Get complaints from server (real complaints from WhatsApp tenants)
  getComplaints: () => get('/api/sync/complaints'),

  // Mark notification read on server
  markNotificationRead: (id: string) => put(`/api/sync/notifications/${id}/read`),

  // Get real WhatsApp thread for a tenant
  getWaMessages: (tenantId: string) => get(`/api/sync/wa-messages/${tenantId}`),

  // Send a real WhatsApp from landlord dashboard
  sendWhatsApp: (tenantId: string, body: string, direction = 'out', channel = 'landlord') =>
    post('/api/sync/wa-messages', { tenantId, body, direction, channel }),

  // Bulk remind all overdue (server sends real WhatsApp to each)
  bulkRemind: (tenants: Array<{ id: string; name: string; rent: number; phone: string }>) =>
    Promise.all(
      tenants.map(t =>
        post('/api/sync/wa-messages', {
          tenantId: t.id,
          body: `Hi ${t.name}, your rent of KSh ${t.rent.toLocaleString()} is overdue. Please settle at your earliest. Send BALANCE for details.`,
          direction: 'out',
          channel: 'landlord',
        })
      )
    ),

  // Get real tenant request threads from WhatsApp
  getRealThreads: () => get('/api/whatsapp/threads'),

  // Get specific tenant's real thread with complaint context
  getRealThread: (tenantId: string) => get(`/api/whatsapp/thread/${tenantId}`),

  // Send a landlord reply to a tenant within 23 hours
  sendReply: (complaintId: string, tenantId: string, message: string) =>
    post('/api/whatsapp/reply', { complaintId, tenantId, message }),

  // Update complaint status
  updateComplaintStatus: (complaintId: string, status: string) =>
    put(`/api/complaints/${complaintId}`, { status }),
};