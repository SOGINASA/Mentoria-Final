// Быстрое клиентское сжатие: фото с современных камер часто весят 5–15 МБ,
// хотя для подтверждения списания достаточно 1600 px по длинной стороне.
export async function compressImage(file, maxSide = 1600, quality = 0.78) {
  if (!file.type.startsWith('image/') || file.size < 500 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' }) : file;
}
