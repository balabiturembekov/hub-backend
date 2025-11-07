# 🔧 Исправление проблемы со скриншотами

## Проблема

У большинства пользователей (8 из 9) браузер не запрашивал разрешение на скриншот. Только у первого пользователя запрос работал.

## Причина

`getDisplayMedia` должен вызываться в контексте пользовательского действия (user gesture). Окно жеста ограничено по времени (обычно ~5 секунд).

**Проблемный код:**
```typescript
await startTimer(...); // Асинхронная операция (сетевой запрос)
// ... проверки и обновления состояния
setTimeout(() => {
  startScreenshotCapture(); // Вызов getDisplayMedia
}, 10);
```

Между кликом и вызовом `getDisplayMedia` происходило:
1. Валидация проекта
2. `startTimer` (async) - сетевой запрос к API
3. Обновление состояния
4. Проверки условий
5. `setTimeout` с задержкой

Все это могло занять больше времени, чем разрешено браузером для user gesture window.

## Решение

### 1. Вызов `getDisplayMedia` до асинхронных операций

В `components/TimeTracker.tsx`:
- `startScreenshotCapture` теперь вызывается **до** `startTimer`
- Используется `requestAnimationFrame` вместо `setTimeout` для минимальной задержки
- Stream получается сразу, даже если `timeEntryId` еще не доступен

```typescript
// Start screenshot capture BEFORE async operations
if (screenshotSettings.enabled) {
  screenshotCapturePromise = new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      startScreenshotCapture().catch(...).finally(() => resolve());
    });
  });
}

// Затем запускаем таймер
await startTimer(...);
```

### 2. Поддержка запуска без `timeEntryId`

В `hooks/useScreenCapture.ts`:
- `startCapture` теперь может работать без `timeEntryId`
- `getDisplayMedia` вызывается сразу (сохраняет user gesture)
- Stream сохраняется в глобальном объекте
- После получения `timeEntryId` он обновляется через `useEffect`

```typescript
// Validate timeEntryId - but allow starting capture even without it
const hasValidTimeEntryId = currentTimeEntryId && 
    typeof currentTimeEntryId === 'string' && 
    currentTimeEntryId.trim() !== '';

// Call getDisplayMedia immediately (preserves user gesture)
stream = await navigator.mediaDevices.getDisplayMedia({...});

// Store timeEntryId if available, otherwise wait for it
if (hasValidTimeEntryId && currentTimeEntryId) {
  globalScreenCapture.setTimeEntryId(currentTimeEntryId);
} else {
  console.log('[Screenshot] Stream obtained, waiting for timeEntryId...');
  globalScreenCapture.setTimeEntryId(null);
}
```

### 3. Автоматическое обновление `timeEntryId`

Добавлен `useEffect`, который обновляет `timeEntryId` в глобальном объекте, когда он становится доступен:

```typescript
// CRITICAL FIX: Update global timeEntryId when it becomes available
useEffect(() => {
  if (timeEntryId && 
      typeof timeEntryId === 'string' && 
      timeEntryId.trim() !== '' &&
      globalScreenCapture.hasActiveStream() &&
      !globalScreenCapture.getTimeEntryId()) {
    console.log('[Screenshot] timeEntryId now available, updating global singleton:', timeEntryId);
    globalScreenCapture.setTimeEntryId(timeEntryId);
  }
}, [timeEntryId]);
```

## Результат

Теперь `getDisplayMedia` вызывается **сразу** после клика пользователя, до всех асинхронных операций. Это гарантирует, что окно user gesture не истечет, и браузер запросит разрешение у всех пользователей.

## Тестирование

После деплоя проверьте:
1. ✅ Браузер запрашивает разрешение на скриншот у всех пользователей
2. ✅ Скриншоты начинают загружаться после получения разрешения
3. ✅ Интервал работает корректно после получения `timeEntryId`

## Дополнительные улучшения

- Использование `requestAnimationFrame` вместо `setTimeout` для более быстрого вызова
- Логирование для отладки процесса получения stream и `timeEntryId`
- Graceful handling случаев, когда `timeEntryId` не получен в течение 10 секунд

