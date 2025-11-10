# 🐛 Дополнительные найденные баги в Backend

## 🔴 Критичные баги

### 11. **Отсутствие проверки companyId в операции delete для time entries**
**Файл:** `server/src/time-entries/time-entries.service.ts` (строка 888)

**Проблема:**
- `remove()` использует `findOne()` для проверки companyId, но затем выполняет `delete({ where: { id } })` без проверки companyId
- Между `findOne()` и `delete()` entry может быть изменен или удален другим запросом
- Нет транзакции для атомарности операции

**Текущий код:**
```typescript
async remove(id: string, companyId: string, deleterId: string, deleterRole: UserRole) {
  const entry = await this.findOne(id, companyId); // ✅ Проверяет companyId
  
  // ... проверки прав доступа ...
  
  // ⚠️ Нет проверки companyId в самом delete!
  // ⚠️ Нет транзакции!
  const deleted = await this.prisma.timeEntry.delete({
    where: { id }, // Только по id, без проверки companyId
  });
  
  await this.cache.invalidateStats(companyId);
  return deleted;
}
```

**Сценарий проблемы:**
1. Запрос A: `findOne(id, companyId1)` - находит entry
2. Запрос B: entry удаляется или перемещается в другую компанию
3. Запрос A: `delete({ where: { id } })` - может удалить entry из другой компании (если ID совпадает)

**Решение:**
Использовать транзакцию с проверкой companyId:
```typescript
const deleted = await this.prisma.$transaction(async (tx) => {
  // Проверить entry еще раз внутри транзакции
  const entry = await tx.timeEntry.findFirst({
    where: {
      id,
      user: { companyId },
    },
  });
  
  if (!entry) {
    throw new NotFoundException(`Time entry with ID ${id} not found`);
  }
  
  // Проверки прав доступа
  if (deleterRole !== UserRole.OWNER && deleterRole !== UserRole.ADMIN && deleterRole !== UserRole.SUPER_ADMIN) {
    if (entry.userId !== deleterId) {
      throw new ForbiddenException('You can only delete your own time entries');
    }
  }
  
  return tx.timeEntry.delete({
    where: { id },
  });
});
```

**Приоритет:** 🔴 Критичный (безопасность - потенциальный доступ к чужим данным)

---

### 12. **Отсутствие проверки companyId в операциях stop() и pause() внутри транзакции**
**Файл:** `server/src/time-entries/time-entries.service.ts` (строка 525, 636)

**Проблема:**
- `stop()` и `pause()` используют `findOne()` для проверки companyId
- Но в транзакции используется `update({ where: { id } })` без проверки companyId
- Между `findOne()` и транзакцией entry может быть изменен

**Текущий код:**
```typescript
async stop(id: string, companyId: string, stopperId: string, stopperRole: UserRole) {
  const entry = await this.findOne(id, companyId); // ✅ Проверяет companyId
  
  // ... валидация ...
  
  const transactionResult = await this.prisma.$transaction(async (tx) => {
    // ⚠️ Нет проверки companyId в update!
    const updatedEntry = await tx.timeEntry.update({
      where: { id }, // Только по id, без проверки companyId
      data: { endTime, duration, status: 'STOPPED' },
      // ...
    });
    // ...
  });
}
```

**Решение:**
Проверять entry внутри транзакции:
```typescript
const transactionResult = await this.prisma.$transaction(async (tx) => {
  // Проверить entry внутри транзакции
  const currentEntry = await tx.timeEntry.findFirst({
    where: {
      id,
      user: { companyId },
    },
  });
  
  if (!currentEntry) {
    throw new NotFoundException(`Time entry with ID ${id} not found`);
  }
  
  // Проверить статус
  if (currentEntry.status === 'STOPPED') {
    throw new BadRequestException('Time entry is already stopped');
  }
  
  // Выполнить update
  const updatedEntry = await tx.timeEntry.update({
    where: { id },
    data: { endTime, duration, status: 'STOPPED' },
    // ...
  });
  // ...
});
```

**Приоритет:** 🔴 Критичный (безопасность - потенциальный доступ к чужим данным)

---

### 13. **Отсутствие проверки companyId в операции delete для screenshots**
**Файл:** `server/src/screenshots/screenshots.service.ts` (строка 239, 315)

**Проблема:**
- `delete()` использует `findUnique()` без проверки companyId
- Проверка companyId происходит через `screenshot.timeEntry.user.companyId`
- Но если timeEntry был удален между проверками, может быть проблема
- В самом `delete()` нет проверки companyId

**Текущий код:**
```typescript
async delete(screenshotId: string, companyId: string, userId: string) {
  const screenshot = await this.prisma.screenshot.findUnique({
    where: { id: screenshotId }, // ⚠️ Нет проверки companyId
    include: {
      timeEntry: {
        include: { user: true },
      },
    },
  });
  
  if (!screenshot) {
    throw new NotFoundException('Screenshot not found');
  }
  
  // Проверка companyId через timeEntry.user.companyId
  if (screenshot.timeEntry.user.companyId !== companyId) {
    throw new ForbiddenException('Access denied');
  }
  
  // ... проверки прав доступа ...
  
  // ⚠️ Нет проверки companyId в самом delete!
  await this.prisma.screenshot.delete({
    where: { id: screenshotId }, // Только по id
  });
}
```

**Проблема:**
- Если timeEntry был удален между проверками, `screenshot.timeEntry` может быть null
- Нет проверки на null перед доступом к `screenshot.timeEntry.user.companyId`

**Решение:**
Добавить проверку на null и использовать транзакцию:
```typescript
const screenshot = await this.prisma.screenshot.findUnique({
  where: { id: screenshotId },
  include: {
    timeEntry: {
      include: { user: true },
    },
  },
});

if (!screenshot || !screenshot.timeEntry || !screenshot.timeEntry.user) {
  throw new NotFoundException('Screenshot not found');
}

if (screenshot.timeEntry.user.companyId !== companyId) {
  throw new ForbiddenException('Access denied');
}

// Использовать транзакцию для атомарности
await this.prisma.$transaction(async (tx) => {
  // Проверить еще раз внутри транзакции
  const currentScreenshot = await tx.screenshot.findUnique({
    where: { id: screenshotId },
    include: {
      timeEntry: {
        include: { user: true },
      },
    },
  });
  
  if (!currentScreenshot || !currentScreenshot.timeEntry || !currentScreenshot.timeEntry.user) {
    throw new NotFoundException('Screenshot not found');
  }
  
  if (currentScreenshot.timeEntry.user.companyId !== companyId) {
    throw new ForbiddenException('Access denied');
  }
  
  // Удалить файлы и запись
  // ...
  
  return tx.screenshot.delete({
    where: { id: screenshotId },
  });
});
```

**Приоритет:** 🔴 Критичный (безопасность - потенциальный доступ к чужим данным)

---

## 🟡 Средние баги

### 14. **Потенциальная проблема с null в WebSocket при отсутствии email**
**Файл:** `server/src/events/events.gateway.ts` (строка 116, 121)

**Проблема:**
- `payload.email` может быть undefined
- Используется в логировании без проверки

**Текущий код:**
```typescript
client.data.userId = payload.sub;
client.data.email = payload.email; // ⚠️ Может быть undefined
client.data.companyId = companyId;

this.logger.log(`Client ${client.id} connected (User: ${payload.email}, Company: ${companyId})`); // ⚠️ Может быть undefined
```

**Решение:**
Добавить проверку или использовать fallback:
```typescript
client.data.userId = payload.sub;
client.data.email = payload.email || 'unknown';
client.data.companyId = companyId;

this.logger.log(`Client ${client.id} connected (User: ${payload.email || payload.sub}, Company: ${companyId})`);
```

**Приоритет:** 🟡 Средний (может вызвать проблемы в логировании)

---

### 15. **Отсутствие проверки на максимальный limit в findAllActivities**
**Файл:** `server/src/time-entries/time-entries.service.ts` (строка 830)

**Проблема:**
- `findAllActivities()` принимает `limit` без проверки максимального значения
- В контроллере есть проверка до 1000, но если метод вызывается напрямую, можно передать любое значение

**Текущий код:**
```typescript
async findAllActivities(companyId: string, userId?: string, limit: number = 100) {
  // ⚠️ Нет проверки на максимальное значение limit
  const activities = await this.prisma.activity.findMany({
    where: { /* ... */ },
    take: limit, // Может быть любое значение
    // ...
  });
}
```

**Решение:**
Добавить проверку в сервисе:
```typescript
async findAllActivities(companyId: string, userId?: string, limit: number = 100) {
  // Валидация limit
  const validatedLimit = Math.min(Math.max(1, limit), 1000); // От 1 до 1000
  
  const activities = await this.prisma.activity.findMany({
    where: { /* ... */ },
    take: validatedLimit,
    // ...
  });
}
```

**Приоритет:** 🟡 Средний (может вызвать проблемы с производительностью)

---

### 16. **Потенциальная проблема с null в screenshots.delete()**
**Файл:** `server/src/screenshots/screenshots.service.ts` (строка 254)

**Проблема:**
- Доступ к `screenshot.timeEntry.user.companyId` без проверки на null
- Если timeEntry или user null, будет ошибка

**Текущий код:**
```typescript
if (screenshot.timeEntry.user.companyId !== companyId) {
  throw new ForbiddenException('Access denied');
}
```

**Решение:**
Добавить проверку на null:
```typescript
if (!screenshot.timeEntry || !screenshot.timeEntry.user) {
  throw new NotFoundException('Time entry or user not found for this screenshot');
}

if (screenshot.timeEntry.user.companyId !== companyId) {
  throw new ForbiddenException('Access denied');
}
```

**Приоритет:** 🟡 Средний (может вызвать runtime error)

---

## 🟢 Низкие баги / Улучшения

### 17. **Отсутствие валидации startTime в create() для прошлых дат**
**Файл:** `server/src/time-entries/time-entries.service.ts` (строка 63-68)

**Проблема:**
- Проверяется только максимальное время в будущем (1 час)
- Нет проверки на слишком старые даты (например, 10 лет назад)

**Текущий код:**
```typescript
const startTime = dto.startTime ? new Date(dto.startTime) : new Date();
const maxFutureTime = new Date();
maxFutureTime.setHours(maxFutureTime.getHours() + 1);
if (startTime > maxFutureTime) {
  throw new BadRequestException('Start time cannot be more than 1 hour in the future');
}
// ⚠️ Нет проверки на прошлое
```

**Решение:**
Добавить проверку на разумный диапазон:
```typescript
const startTime = dto.startTime ? new Date(dto.startTime) : new Date();
const now = new Date();
const maxFutureTime = new Date(now);
maxFutureTime.setHours(maxFutureTime.getHours() + 1);
const minPastTime = new Date(now);
minPastTime.setFullYear(minPastTime.getFullYear() - 10); // Максимум 10 лет назад

if (startTime > maxFutureTime) {
  throw new BadRequestException('Start time cannot be more than 1 hour in the future');
}
if (startTime < minPastTime) {
  throw new BadRequestException('Start time cannot be more than 10 years in the past');
}
```

**Приоритет:** 🟢 Низкий (может быть полезно для валидации данных)

---

### 18. **Отсутствие проверки на валидность UUID в параметрах**
**Файл:** Множество контроллеров

**Проблема:**
- Параметры `id` принимаются как строки без проверки формата UUID
- Могут быть переданы невалидные значения

**Пример:**
```typescript
@Get(':id')
findOne(@Param('id') id: string, @GetUser() user: any) {
  return this.timeEntriesService.findOne(id, user.companyId);
}
```

**Решение:**
Добавить валидацию UUID в DTO или использовать pipe:
```typescript
import { IsUUID } from 'class-validator';

class IdParamDto {
  @IsUUID()
  id: string;
}

@Get(':id')
findOne(@Param() params: IdParamDto, @GetUser() user: any) {
  return this.timeEntriesService.findOne(params.id, user.companyId);
}
```

**Приоритет:** 🟢 Низкий (может улучшить обработку ошибок)

---

### 19. **Потенциальная проблема с обработкой ошибок в WebSocket**
**Файл:** `server/src/events/events.gateway.ts` (строка 130-133)

**Проблема:**
- Ошибки логируются, но не всегда понятно, что произошло
- Может быть полезно добавить более детальное логирование

**Текущий код:**
```typescript
} catch (error: any) {
  this.logger.error(`Authentication error for client ${client.id}: ${error.message}`);
  client.disconnect();
}
```

**Решение:**
Улучшить логирование:
```typescript
} catch (error: any) {
  this.logger.error(
    {
      clientId: client.id,
      error: error.message,
      stack: error.stack,
      handshake: client.handshake,
    },
    `Authentication error for client ${client.id}`
  );
  client.disconnect();
}
```

**Приоритет:** 🟢 Низкий (улучшение логирования)

---

### 20. **Отсутствие проверки на дублирование скриншотов**
**Файл:** `server/src/screenshots/screenshots.service.ts` (строка 164)

**Проблема:**
- Нет проверки на максимальное количество скриншотов для одного time entry
- Может быть создано неограниченное количество скриншотов

**Текущий код:**
```typescript
const screenshot = await this.prisma.screenshot.create({
  data: {
    timeEntryId: dto.timeEntryId,
    imageUrl: `/uploads/screenshots/${filename}`,
    thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
    timestamp: new Date(),
  },
  // ...
});
```

**Решение:**
Добавить проверку на максимальное количество (опционально):
```typescript
// Проверить количество существующих скриншотов
const existingCount = await this.prisma.screenshot.count({
  where: { timeEntryId: dto.timeEntryId },
});

const maxScreenshots = 1000; // Максимум скриншотов на entry
if (existingCount >= maxScreenshots) {
  throw new BadRequestException(`Maximum number of screenshots (${maxScreenshots}) reached for this time entry`);
}
```

**Приоритет:** 🟢 Низкий (может быть полезно для ограничения ресурсов)

---

## 📋 Сводная таблица

| #   | Баг                                            | Приоритет    | Файл                           | Статус          |
| --- | ---------------------------------------------- | ------------ | ------------------------------ | --------------- |
| 11  | Отсутствие проверки companyId в remove()       | 🔴 Критичный | `time-entries.service.ts:888` | ✅ Исправлено |
| 12  | Отсутствие проверки companyId в stop()/pause() | 🔴 Критичный | `time-entries.service.ts:525`  | ✅ Исправлено |
| 13  | Отсутствие проверки companyId в screenshots   | 🔴 Критичный | `screenshots.service.ts:239`   | ✅ Исправлено |
| 14  | Потенциальная проблема с null в WebSocket       | 🟡 Средний   | `events.gateway.ts:116`        | ✅ Исправлено |
| 15  | Отсутствие проверки limit в findAllActivities | 🟡 Средний   | `time-entries.service.ts:830`  | ✅ Исправлено |
| 16  | Потенциальная проблема с null в screenshots    | 🟡 Средний   | `screenshots.service.ts:254`  | ✅ Исправлено |
| 17  | Отсутствие валидации прошлых дат              | 🟢 Низкий    | `time-entries.service.ts:63`   | ⚠️ Можно улучшить |
| 18  | Отсутствие проверки UUID                       | 🟢 Низкий    | Множество контроллеров         | ⚠️ Можно улучшить |
| 19  | Улучшение логирования в WebSocket              | 🟢 Низкий    | `events.gateway.ts:130`         | ⚠️ Можно улучшить |
| 20  | Отсутствие проверки на дублирование            | 🟢 Низкий    | `screenshots.service.ts:164`   | ⚠️ Можно улучшить |

---

## 🎯 Рекомендации по исправлению

### Приоритет 1 (Критичный): ✅ ВСЕ ИСПРАВЛЕНО

1. ✅ **Исправить remove() для time entries**
   - ✅ Добавлена транзакция
   - ✅ Проверка companyId внутри транзакции

2. ✅ **Исправить stop() и pause()**
   - ✅ Проверка entry внутри транзакции с companyId

3. ✅ **Исправить delete() для screenshots**
   - ✅ Добавлена проверка на null
   - ✅ Используется транзакция
   - ✅ Проверка companyId внутри транзакции

### Приоритет 2 (Средний): ✅ ВСЕ ИСПРАВЛЕНО

4. ✅ **Исправить WebSocket null checks**
5. ✅ **Добавить проверку limit в findAllActivities**
6. ✅ **Добавить проверку на null в screenshots.delete()**

### Приоритет 3 (Низкий):

7. 📝 **Добавить валидацию прошлых дат**
8. 📝 **Добавить проверку UUID**
9. 📝 **Улучшить логирование в WebSocket**
10. 📝 **Добавить проверку на дублирование скриншотов**

---

## 📝 Заключение

**Критичные баги:** 3 ✅ Все исправлены
**Средние баги:** 3 ✅ Все исправлены
**Низкие баги/улучшения:** 4 ⚠️ Можно улучшить

**Основные проблемы:**
1. ✅ Отсутствие проверки companyId в операциях delete/update внутри транзакций - **ИСПРАВЛЕНО**
2. ✅ Отсутствие транзакций для критичных операций - **ИСПРАВЛЕНО**
3. ✅ Потенциальные проблемы с null/undefined - **ИСПРАВЛЕНО**

**Статус исправлений:**
- ✅ Баги #11, #12, #13 (критичные) - **ИСПРАВЛЕНЫ**
- ✅ Баги #14, #15, #16 (средние) - **ИСПРАВЛЕНЫ**
- ⚠️ Баги #17-20 (низкие) - можно улучшить по возможности

**Основные изменения:**
1. ✅ Добавлены транзакции с проверкой companyId в `remove()`, `stop()`, `pause()`
2. ✅ Добавлена транзакция с проверкой null и companyId в `screenshots.delete()`
3. ✅ Добавлена проверка на null для email в WebSocket
4. ✅ Добавлена валидация limit в `findAllActivities()`

