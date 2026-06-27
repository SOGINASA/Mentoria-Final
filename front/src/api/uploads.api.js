import { api } from './client';

// Загрузка одного фото (multipart, поле file). Возвращает { url, filename }.
export function uploadPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  return api.upload('/uploads/photo', form);
}
