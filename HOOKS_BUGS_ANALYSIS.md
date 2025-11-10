# Анализ багов в хуках (Hooks)

## Дата анализа: 2024

## Обзор
Проанализированы все хуки в проекте на наличие багов, связанных с валидацией данных, обработкой ошибок, утечками памяти и race conditions.

---

## 🔴 Критичные баги

### #1. useSocket.ts - Отсутствие валидации типов данных в `stats:update`
**Описание:** В обработчике `stats:update` отсутствовала проверка типов данных. `data.totalHours`, `data.activeUsers`, и т.д. могли быть не числами, что приводило к ошибкам при обновлении статистики.

**Исправление:**
- Добавлена проверка структуры данных (`typeof data !== 'object'`)
- Добавлена валидация и конвертация числовых значений с проверкой на `NaN`
- Добавлена проверка на неотрицательные значения для `activeUsers` и `totalProjects`
- Добавлен `try-catch` блок для обработки ошибок

**Код:**
```typescript
socket.on('stats:update', (data: any) => {
  try {
    // Validate data structure
    if (!data || typeof data !== 'object') {
      console.warn('WebSocket: Invalid stats data structure:', data);
      return;
    }
    
    // Validate and convert numeric values
    const totalHours = typeof data.totalHours === 'number' && !isNaN(data.totalHours) ? data.totalHours : undefined;
    const activeUsers = typeof data.activeUsers === 'number' && !isNaN(data.activeUsers) && data.activeUsers >= 0 ? data.activeUsers : 0;
    // ... и т.д.
  } catch (error) {
    console.error('WebSocket: Error processing stats:update', error);
  }
});
```

---

### #2. useSocket.ts - Отсутствие валидации `data.id` в `time-entry:update`
**Описание:** В обработчике `time-entry:update` отсутствовала проверка на наличие и валидность `data.id`, что могло привести к ошибкам при обновлении записей времени.

**Исправление:**
- Добавлена проверка на наличие `data.id`
- Добавлена проверка на тип `data.id` (должен быть строкой)
- Добавлена валидация UUID формата для `data.id` и `data.userId`
- Добавлена валидация `projectId` (должен быть UUID или 'none')

**Код:**
```typescript
// Validate required fields
if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
  console.error('WebSocket: Invalid time entry data - missing or invalid id', data);
  return;
}

// Validate UUID format for id
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(data.id)) {
  console.error('WebSocket: Invalid time entry id format (not UUID):', data.id);
  return;
}
```

---

### #3. useSSE.ts - Отсутствие валидации данных в обработчике сообщений
**Описание:** В обработчике `onmessage` отсутствовала валидация структуры данных и проверка на наличие `data.type`, что могло привести к ошибкам при обработке сообщений.

**Исправление:**
- Добавлена проверка на наличие и тип `event.data`
- Добавлена проверка структуры данных после парсинга JSON
- Добавлена проверка на наличие и валидность `data.type`
- Добавлена проверка на массив `timeEntries` перед использованием `reduce`
- Добавлена валидация структуры записей в `reduce`

**Код:**
```typescript
eventSource.onmessage = (event) => {
  try {
    // Validate event data
    if (!event.data || typeof event.data !== 'string') {
      console.warn('SSE: Invalid event data:', event.data);
      return;
    }
    
    const data = JSON.parse(event.data);
    
    // Validate data structure
    if (!data || typeof data !== 'object') {
      console.warn('SSE: Invalid data structure:', data);
      return;
    }
    
    // Validate type field
    if (!data.type || typeof data.type !== 'string') {
      console.warn('SSE: Missing or invalid type field:', data);
      return;
    }
    // ... и т.д.
  } catch (error) {
    console.error('Error parsing SSE message:', error);
  }
};
```

---

## 🟡 Средние баги

### #4. useSocket.ts - Отсутствие проверки на массив в `timeEntries.find`
**Описание:** В обработчике `time-entry:update` использовался `state.timeEntries.find`, но отсутствовала проверка, что `timeEntries` является массивом.

**Исправление:**
- Добавлена проверка `Array.isArray(state.timeEntries)` перед использованием `find`

**Код:**
```typescript
// Validate timeEntries is an array
if (!state.timeEntries || !Array.isArray(state.timeEntries)) {
  console.warn('WebSocket: timeEntries is not an array, skipping update');
  return;
}
```

---

### #5. useSocket.ts - Отсутствие валидации UUID для `data.id` и `data.userId` в `activity:new`
**Описание:** В обработчике `activity:new` отсутствовала проверка на валидность UUID для `data.id` и `data.userId`.

**Исправление:**
- Добавлена валидация UUID формата для `data.id` и `data.userId`
- Добавлена валидация `projectId` (должен быть UUID или 'none')

**Код:**
```typescript
// Validate UUID format for id and userId
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (typeof data.id !== 'string' || !uuidRegex.test(data.id)) {
  console.warn('WebSocket: Invalid activity id format (not UUID):', data.id);
  return;
}
```

---

### #6. useSSE.ts - Отсутствие проверки на массив в `timeEntries.reduce`
**Описание:** В `useSSE.ts` использовался `timeEntries.reduce`, но отсутствовала проверка, что `timeEntries` является массивом.

**Исправление:**
- Добавлена проверка `Array.isArray(timeEntries)` перед использованием `reduce`
- Добавлена валидация структуры записей в `reduce`

**Код:**
```typescript
// Validate timeEntries is an array
if (!timeEntries || !Array.isArray(timeEntries)) {
  console.warn('SSE: timeEntries is not an array, skipping stats update');
  return;
}

// Recalculate stats based on current time entries
const totalSeconds = timeEntries.reduce(
  (acc, entry) => {
    // Validate entry structure
    if (!entry || typeof entry.duration !== 'number' || isNaN(entry.duration)) {
      return acc;
    }
    return acc + entry.duration;
  },
  0
);
```

---

### #7. useScreenshotSettings.ts - Отсутствие обработки ошибок и валидации
**Описание:** Функции `setEnabled`, `setIntervalValue`, и `updateSettings` не имели обработки ошибок и валидации входных данных.

**Исправление:**
- Добавлена валидация входных данных (типы, допустимые значения)
- Добавлена обработка ошибок с `try-catch` блоками
- Добавлена проверка структуры объекта `newSettings`

**Код:**
```typescript
const setEnabled = async (enabled: boolean) => {
  try {
    // Validate enabled is a boolean
    if (typeof enabled !== 'boolean') {
      console.error('useScreenshotSettings: enabled must be a boolean', enabled);
      return;
    }
    await updateStoreSettings({ screenshotEnabled: enabled });
  } catch (error) {
    console.error('useScreenshotSettings: Error setting enabled', error);
    throw error;
  }
};
```

---

### #8. useKeyboardShortcuts.ts - Отсутствие валидации и обработки ошибок
**Описание:** В хуке отсутствовала валидация массива `shortcuts`, проверка структуры каждого `shortcut`, и обработка ошибок при выполнении действий.

**Исправление:**
- Добавлена проверка на массив `shortcuts`
- Добавлена валидация структуры каждого `shortcut` (проверка на наличие `key` и `action`)
- Добавлена обработка ошибок в `handleKeyDown` и при выполнении `shortcut.action()`
- Добавлена проверка на наличие `target` в обработчике событий

**Код:**
```typescript
useEffect(() => {
  // Validate shortcuts is an array
  if (!shortcuts || !Array.isArray(shortcuts)) {
    console.warn('useKeyboardShortcuts: shortcuts must be an array', shortcuts);
    shortcutsRef.current = [];
    return;
  }
  shortcutsRef.current = shortcuts;
}, [shortcuts]);

// В handleKeyDown:
for (const shortcut of shortcutsRef.current) {
  // Validate shortcut structure
  if (!shortcut || typeof shortcut !== 'object') {
    continue;
  }
  
  // Validate shortcut.key
  if (!shortcut.key || typeof shortcut.key !== 'string') {
    console.warn('useKeyboardShortcuts: Invalid shortcut key', shortcut);
    continue;
  }
  
  // Validate shortcut.action
  if (typeof shortcut.action !== 'function') {
    console.warn('useKeyboardShortcuts: Invalid shortcut action', shortcut);
    continue;
  }
  
  // ... выполнение действия с обработкой ошибок
  try {
    shortcut.action();
  } catch (error) {
    console.error('useKeyboardShortcuts: Error executing shortcut action', error);
  }
}
```

---

## 🟢 Низкие баги

### #9. use-toast.ts - Отсутствие обработки ошибок
**Описание:** В хуке `useToast` отсутствовала обработка ошибок при показе toast уведомлений.

**Исправление:**
- Добавлена валидация входных данных (проверка типов)
- Добавлена обработка ошибок с fallback на console.log

**Код:**
```typescript
toast: ({ title, description, variant }: ToastOptions) => {
  try {
    // Validate inputs
    const safeTitle = title && typeof title === 'string' ? title : (variant === 'destructive' ? 'Error' : 'Success');
    const safeDescription = description && typeof description === 'string' ? description : undefined;
    const safeVariant = variant === 'destructive' ? 'destructive' : 'default';
    
    if (safeVariant === 'destructive') {
      sonnerToast.error(safeTitle, {
        description: safeDescription,
      });
    } else {
      sonnerToast.success(safeTitle, {
        description: safeDescription,
      });
    }
  } catch (error) {
    // Fallback to console if toast fails
    console.error('useToast: Error showing toast', error);
    console.log('Toast:', { title, description, variant });
  }
}
```

---

### #10. useSocket.ts - Отсутствие валидации `projectId` в `time-entry:update` и `activity:new`
**Описание:** В обработчиках `time-entry:update` и `activity:new` отсутствовала валидация `projectId`, который должен быть UUID или 'none'.

**Исправление:**
- Добавлена валидация `projectId` (должен быть UUID или 'none')
- Если `projectId` невалиден, он устанавливается в `undefined`

**Код:**
```typescript
// Validate projectId if present (must be UUID or 'none')
let projectId = data.projectId;
if (projectId !== undefined && projectId !== null && projectId !== 'none') {
  if (typeof projectId !== 'string' || !uuidRegex.test(projectId)) {
    console.error('WebSocket: Invalid time entry projectId format (not UUID or "none"):', projectId);
    projectId = undefined; // Set to undefined if invalid
  }
}
```

---

## Итоговая статистика

- 🔴 **Критичных багов:** 3 → ✅ Все исправлены
- 🟡 **Средних багов:** 5 → ✅ Все исправлены
- 🟢 **Низких багов:** 2 → ✅ Все исправлены

**Всего:** 10 багов → ✅ Все исправлены

---

## Основные улучшения

1. ✅ Добавлена валидация данных во всех обработчиках WebSocket и SSE событий
2. ✅ Добавлена проверка типов данных перед использованием
3. ✅ Добавлена валидация UUID формата для всех ID полей
4. ✅ Добавлена проверка на массивы перед использованием методов массивов
5. ✅ Добавлена обработка ошибок во всех хуках
6. ✅ Добавлена валидация входных данных в функциях хуков
7. ✅ Улучшена обработка ошибок в обработчиках событий

---

## Рекомендации

1. **Типизация:** Рассмотреть возможность замены `any` на конкретные типы для данных WebSocket и SSE событий
2. **Централизованная валидация:** Создать утилиты для валидации UUID и других общих проверок
3. **Тестирование:** Добавить unit-тесты для хуков, особенно для обработчиков событий
4. **Мониторинг:** Добавить логирование ошибок в систему мониторинга (Sentry) для критичных ошибок

