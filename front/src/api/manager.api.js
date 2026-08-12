import { api, request } from './client';

export const getTodayQueue = () => api.get('/manager/today');
export const getWorkspace = () => api.get('/manager/workspace');

export const createShift = (payload) => api.post('/shifts/manager', payload);
export const updateShift = (shiftId, payload) => api.patch(`/shifts/manager/${shiftId}`, payload);
export const assignShift = (shiftId, userId) => api.post(`/shifts/manager/${shiftId}/assignments`, { user_id: userId });
export const publishShift = (shiftId) => api.post(`/shifts/manager/${shiftId}/publish`);
export const cancelShift = (shiftId, payload) => api.post(`/shifts/manager/${shiftId}/cancel`, payload);
export const removeShiftAssignment = (shiftId, userId, payload) => request(
  `/shifts/manager/${shiftId}/assignments/${userId}`,
  { method: 'DELETE', body: payload },
);
export const createTask = (payload) => api.post('/tasks/manager', payload);
export const updateTask = (taskId, payload) => api.patch(`/tasks/manager/${taskId}`, payload);
export const deleteTask = (taskId, payload) => request(`/tasks/manager/${taskId}`, { method: 'DELETE', body: payload });
export const getAnalytics = ({ days = 30, storeId } = {}) => {
  const params = new URLSearchParams({ days: String(days) });
  if (storeId && storeId !== 'all') params.set('store_id', storeId);
  return api.get(`/manager/analytics?${params.toString()}`);
};

export const listDocumentRequests = () => api.get('/employee-services/manager/documents/requests');
export const listLeaveRequests = () => api.get('/employee-services/manager/leave/requests');

export const decideShiftRequest = (requestId, payload) => (
  api.post(`/shifts/manager/requests/${requestId}/decision`, payload)
);
export const decideTimecard = (timecardId, payload) => (
  api.post(`/time/manager/timecards/${timecardId}/decision`, payload)
);
export const decideTimeCorrection = (correctionId, payload) => (
  api.post(`/time/manager/corrections/${correctionId}/decision`, payload)
);
export const reviewTask = (taskId, payload) => (
  api.post(`/tasks/manager/${taskId}/review`, payload)
);
export const decideDocumentRequest = (requestId, payload) => (
  api.post(`/employee-services/manager/documents/requests/${requestId}/decision`, payload)
);
export const decideLeaveRequest = (requestId, payload) => (
  api.post(`/employee-services/manager/leave/requests/${requestId}/decision`, payload)
);
