import { api } from './client';

// Загрузка одного фото (multipart, поле file).
// Возвращает { url, filename, recognition }, где recognition — результат
// распознавания (тип продукта + испорченность) или null, если ИИ недоступен.
export function uploadPhoto(file, { recognize = false } = {}) {
  const form = new FormData();
  form.append('file', file);
  form.append('recognize', recognize ? '1' : '0');
  return api.upload('/uploads/photo', form);
}

export function recognizePhoto(filename) {
  return api.post('/uploads/recognize', { filename });
}
