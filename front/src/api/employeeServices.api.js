import { api } from './client';

export const get = () => api.get('/employee-services');
export const completeModule = (courseId, moduleId) => (
  api.post(`/employee-services/learning/${courseId}/modules/${moduleId}/complete`)
);
export const completeAssessment = (courseId, answer) => (
  api.post(`/employee-services/learning/${courseId}/assessment`, { answer })
);
export const createDocumentRequest = (documentId) => (
  api.post('/employee-services/documents/requests', { document_id: documentId })
);
export const createLeaveRequest = (payload) => (
  api.post('/employee-services/leave/requests', payload)
);
export const cancelLeaveRequest = (requestId, version) => (
  api.post(`/employee-services/leave/requests/${requestId}/cancel`, { version })
);
