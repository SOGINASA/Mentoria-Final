import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// Язык интерфейса → BCP-47 код распознавания речи
const LANG_MAP = { ru: 'ru-RU', kz: 'kk-KZ' };

// Нативный мост Android (см. MainActivity.kt: addJavascriptInterface "AndroidVoice").
// Есть только внутри APK; в обычном браузере вернёт null → работаем через Web Speech API.
function getNativeBridge() {
  if (typeof window === 'undefined') return null;
  const b = window.AndroidVoice;
  if (!b || typeof b.start !== 'function') return null;
  try {
    if (typeof b.isAvailable === 'function' && !b.isAvailable()) return null;
  } catch {
    return null;
  }
  return b;
}

/**
 * Голосовой ввод «сразу в поле». Распознавание идёт локально и мгновенно,
 * без отправки аудио на бэкенд:
 *   • в APK  — нативный android.speech.SpeechRecognizer через JS-мост AndroidVoice;
 *   • в браузере/PWA — Web Speech API (react-speech-recognition).
 *
 * Один активный микрофон на всю форму: в каждый момент диктуется ровно одно
 * поле (activeField). Текст дописывается к тому, что уже было в поле.
 *
 * Использование:
 *   const voice = useVoiceDictation(lang);
 *   <MicButton
 *     active={voice.activeField === 'name'}
 *     listening={voice.listening}
 *     supported={voice.supported}
 *     onClick={() => voice.toggle('name', value, setValue)}
 *   />
 */
export function useVoiceDictation(lang) {
  const native = useMemo(() => getNativeBridge(), []);

  const {
    transcript,
    listening: webListening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  const [activeField, setActiveField] = useState(null); // id поля, которое сейчас диктуют
  const [nativeListening, setNativeListening] = useState(false);
  const [error, setError] = useState(null); // 'denied' | 'unsupported' | null

  const baseRef = useRef(''); // текст, который был в поле до начала диктовки
  const setterRef = useRef(null); // сеттер активного поля

  const listening = native ? nativeListening : webListening;
  const supported = native ? true : browserSupportsSpeechRecognition;

  // Дописываем распознанный текст к исходному значению поля
  const applyTranscript = useCallback((text) => {
    if (!setterRef.current || !text) return;
    const base = baseRef.current;
    setterRef.current(base ? `${base} ${text}` : text);
  }, []);

  // --- Нативный движок: колбэки из Kotlin прилетают в window.__bahandiVoice ---
  useEffect(() => {
    if (!native) return undefined;
    window.__bahandiVoice = {
      onResult: (text) => applyTranscript(text),
      onEnd: () => {
        setNativeListening(false);
        setActiveField(null);
      },
      onError: (code) => {
        setNativeListening(false);
        setActiveField(null);
        if (code === 'denied') setError('denied');
        else if (code === 'unsupported') setError('unsupported');
      },
    };
    return () => {
      try { native.stop(); } catch { /* noop */ }
      delete window.__bahandiVoice;
    };
  }, [native, applyTranscript]);

  // --- Веб-движок: живое дописывание по мере распознавания ---
  useEffect(() => {
    if (native || !activeField) return;
    applyTranscript(transcript);
  }, [transcript, activeField, native, applyTranscript]);

  // Веб: распознавание остановилось само (тишина/уход) — снимаем метку
  useEffect(() => {
    if (native) return;
    if (!webListening && activeField) setActiveField(null);
  }, [webListening, activeField, native]);

  // Веб: нет доступа к микрофону
  useEffect(() => {
    if (native) return;
    if (browserSupportsSpeechRecognition && isMicrophoneAvailable === false) {
      setError('denied');
      setActiveField(null);
    }
  }, [native, browserSupportsSpeechRecognition, isMicrophoneAvailable]);

  // Останавливаем распознавание при размонтировании (уход с шага/страницы)
  useEffect(() => () => {
    if (native) { try { native.stop(); } catch { /* noop */ } }
    else SpeechRecognition.abortListening();
  }, [native]);

  const start = useCallback((fieldId, currentValue, setter) => {
    if (!supported) {
      setError('unsupported');
      return;
    }
    setError(null);
    baseRef.current = (currentValue || '').trim();
    setterRef.current = setter;
    setActiveField(fieldId);
    const code = LANG_MAP[lang] || 'ru-RU';
    if (native) {
      setNativeListening(true);
      try {
        native.start(code);
      } catch {
        setNativeListening(false);
        setActiveField(null);
        setError('unsupported');
      }
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true, language: code });
    }
  }, [supported, native, lang, resetTranscript]);

  const stop = useCallback(() => {
    if (native) {
      try { native.stop(); } catch { /* noop */ }
      setNativeListening(false);
    } else {
      SpeechRecognition.stopListening();
    }
    setActiveField(null);
  }, [native]);

  const toggle = useCallback((fieldId, currentValue, setter) => {
    if (activeField === fieldId && listening) stop();
    else start(fieldId, currentValue, setter);
  }, [activeField, listening, start, stop]);

  return {
    activeField,
    listening,
    supported,
    error, // 'denied' | 'unsupported' | null
    clearError: () => setError(null),
    toggle,
    stop,
  };
}
