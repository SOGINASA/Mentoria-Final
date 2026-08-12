import { api, request } from './client';

const mutation = (path, method, body, idempotencyKey) => request(path, {
  method,
  body,
  headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
});

export const getTodayQueue = () => api.get('/manager/today');
export const getWorkspace = () => api.get('/manager/workspace');

export const createShift = (payload, key) => mutation('/shifts/manager', 'POST', payload, key);
export const updateShift = (shiftId, payload, key) => mutation(`/shifts/manager/${shiftId}`, 'PATCH', payload, key);
export const assignShift = (shiftId, userId, key) => mutation(`/shifts/manager/${shiftId}/assignments`, 'POST', { user_id: userId }, key);
export const publishShift = (shiftId, key) => mutation(`/shifts/manager/${shiftId}/publish`, 'POST', undefined, key);
export const cancelShift = (shiftId, payload, key) => mutation(`/shifts/manager/${shiftId}/cancel`, 'POST', payload, key);
export const removeShiftAssignment = (shiftId, userId, payload, key) => request(
  `/shifts/manager/${shiftId}/assignments/${userId}`,
  { method: 'DELETE', body: payload, headers: key ? { 'Idempotency-Key': key } : {} },
);
export const createTask = (payload, key) => mutation('/tasks/manager', 'POST', payload, key);
export const updateTask = (taskId, payload, key) => mutation(`/tasks/manager/${taskId}`, 'PATCH', payload, key);
export const deleteTask = (taskId, payload, key) => mutation(`/tasks/manager/${taskId}`, 'DELETE', payload, key);
export const getAnalytics = ({ days = 30, storeId } = {}) => {
  const params = new URLSearchParams({ days: String(days) });
  if (storeId && storeId !== 'all') params.set('store_id', storeId);
  return api.get(`/manager/analytics?${params.toString()}`);
};

export const listDocumentRequests = () => api.get('/employee-services/manager/documents/requests');
export const listLeaveRequests = () => api.get('/employee-services/manager/leave/requests');

export const decideShiftRequest = (requestId, payload, key) => (
  mutation(`/shifts/manager/requests/${requestId}/decision`, 'POST', payload, key)
);
export const decideTimecard = (timecardId, payload, key) => (
  mutation(`/time/manager/timecards/${timecardId}/decision`, 'POST', payload, key)
);
export const decideTimeCorrection = (correctionId, payload, key) => (
  mutation(`/time/manager/corrections/${correctionId}/decision`, 'POST', payload, key)
);
export const reviewTask = (taskId, payload, key) => (
  mutation(`/tasks/manager/${taskId}/review`, 'POST', payload, key)
);
export const decideDocumentRequest = (requestId, payload, key) => (
  mutation(`/employee-services/manager/documents/requests/${requestId}/decision`, 'POST', payload, key)
);
export const decideLeaveRequest = (requestId, payload, key) => (
  mutation(`/employee-services/manager/leave/requests/${requestId}/decision`, 'POST', payload, key)
);
