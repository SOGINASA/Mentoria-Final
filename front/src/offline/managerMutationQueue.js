import * as managerApi from '../api/manager.api';
import * as casesApi from '../api/cases.api';
import * as newsApi from '../api/news.api';

const STORAGE_KEY = 'bahandi_manager_mutation_queue_v1';
const CHANGE_EVENT = 'bahandi:manager-mutation-queue';
const FLUSH_EVENT = 'bahandi:manager-mutations-flushed';

function randomKey() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `manager-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function scopedKey(base, suffix) {
  return `${base}:${suffix}`.slice(0, 120);
}

async function execute(item) {
  const { type, payload, idempotencyKey: key } = item;
  if (type === 'shift.create') {
    const result = await managerApi.createShift(payload.shift, scopedKey(key, 'create'));
    for (const userId of payload.assigneeIds || []) {
      await managerApi.assignShift(result.shift.id, userId, scopedKey(key, `assign-${userId}`));
    }
    if (payload.publish) await managerApi.publishShift(result.shift.id, scopedKey(key, 'publish'));
    return result;
  }
  if (type === 'shift.update') {
    const result = await managerApi.updateShift(payload.shiftId, payload.shift, scopedKey(key, 'update'));
    for (const userId of payload.assigneeIds || []) {
      await managerApi.assignShift(payload.shiftId, userId, scopedKey(key, `assign-${userId}`));
    }
    return result;
  }
  if (type === 'shift.publish') return managerApi.publishShift(payload.shiftId, key);
  if (type === 'shift.cancel') return managerApi.cancelShift(payload.shiftId, payload.body, key);
  if (type === 'shift.unassign') return managerApi.removeShiftAssignment(payload.shiftId, payload.userId, payload.body, key);
  if (type === 'task.create') return managerApi.createTask(payload.body, key);
  if (type === 'task.update') return managerApi.updateTask(payload.taskId, payload.body, key);
  if (type === 'task.delete') return managerApi.deleteTask(payload.taskId, payload.body, key);
  if (type === 'decision.shift') return managerApi.decideShiftRequest(payload.id, payload.body, key);
  if (type === 'decision.timecard') return managerApi.decideTimecard(payload.id, payload.body, key);
  if (type === 'decision.correction') return managerApi.decideTimeCorrection(payload.id, payload.body, key);
  if (type === 'decision.task') return managerApi.reviewTask(payload.id, payload.body, key);
  if (type === 'decision.document') return managerApi.decideDocumentRequest(payload.id, payload.body, key);
  if (type === 'decision.leave') return managerApi.decideLeaveRequest(payload.id, payload.body, key);
  if (type === 'news.create') return newsApi.create(payload.body, key);
  if (type === 'case.process') {
    let result = { case: payload.current };
    if (payload.reply) result = await casesApi.addMessage(payload.caseId, payload.reply, scopedKey(key, 'message'));
    if (payload.status !== result.case.status) {
      result = await casesApi.update(payload.caseId, { status: payload.status }, scopedKey(key, 'status'));
    }
    return result;
  }
  throw new Error(`Неизвестное offline-действие: ${type}`);
}

function isRetryable(error) {
  return !error?.status || error.status === 408 || error.status === 429 || error.status >= 500;
}

function addItem(type, payload, ownerId) {
  const item = {
    id: randomKey(),
    idempotencyKey: randomKey(),
    ownerId: Number(ownerId),
    type,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastError: null,
  };
  writeQueue([...readQueue(), item]);
  return item;
}

function removeItem(id) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

function updateItem(id, patch) {
  writeQueue(readQueue().map((item) => item.id === id ? { ...item, ...patch } : item));
}

export function getManagerQueueSnapshot(ownerId) {
  const items = readQueue().filter((item) => item.ownerId === Number(ownerId));
  return {
    pending: items.filter((item) => item.status === 'pending').length,
    failed: items.filter((item) => item.status === 'failed').length,
    items,
  };
}

export async function submitManagerMutation(type, payload, ownerId) {
  const item = addItem(type, payload, ownerId);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { queued: true, queueId: item.id };
  }
  try {
    const result = await execute(item);
    removeItem(item.id);
    return result;
  } catch (error) {
    if (isRetryable(error)) {
      updateItem(item.id, { attempts: 1, lastError: error.message || 'Нет соединения' });
      return { queued: true, queueId: item.id };
    }
    removeItem(item.id);
    throw error;
  }
}

let flushPromise = null;

export async function flushManagerMutations(ownerId) {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return getManagerQueueSnapshot(ownerId);
    const items = readQueue().filter((item) => (
      item.ownerId === Number(ownerId) && item.status === 'pending'
    ));
    let completed = 0;
    for (const item of items) {
      try {
        await execute(item);
        removeItem(item.id);
        completed += 1;
      } catch (error) {
        updateItem(item.id, {
          attempts: (item.attempts || 0) + 1,
          lastError: error.message || 'Не удалось повторить действие',
          status: isRetryable(error) ? 'pending' : 'failed',
        });
        if (isRetryable(error)) break;
      }
    }
    if (completed) window.dispatchEvent(new CustomEvent(FLUSH_EVENT, { detail: { completed } }));
    return getManagerQueueSnapshot(ownerId);
  })();
  try {
    return await flushPromise;
  } finally {
    flushPromise = null;
  }
}

export async function retryManagerMutations(ownerId) {
  writeQueue(readQueue().map((item) => (
    item.ownerId === Number(ownerId) && item.status === 'failed'
      ? { ...item, status: 'pending', lastError: null }
      : item
  )));
  return flushManagerMutations(ownerId);
}

export function subscribeManagerQueue(listener) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export { CHANGE_EVENT, FLUSH_EVENT, STORAGE_KEY };
