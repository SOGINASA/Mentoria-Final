import { api } from './client';

// Загрузка одного фото (multipart, поле file).
// Возвращает { url, filename, recognition }, где recognition — результат
// распознавания (тип продукта + испорченность) или null, если ИИ недоступен.
export function uploadPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  return api.upload('/uploads/photo', form);
}
