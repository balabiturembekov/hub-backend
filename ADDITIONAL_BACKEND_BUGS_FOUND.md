# 🐛 Дополнительные найденные баги в Backend

## 🔴 Критичные баги

### 21. **Отсутствие нормализации email в users.service.ts**
**Файл:** `server/src/users/users.service.ts` (строка 23-28, 149-160)

**Проблема:**
- Email не нормализуется к lowercase в `create()` и `update()`
- Можно создать несколько пользователей с одним email в разном регистре
- При обновлении email может быть проблема с дубликатами

**Текущий код:**
```typescript
// В create()
const existingUser = await this.prisma.user.findFirst({
  where: {
    email: dto.email, // ⚠️ Не нормализован
    companyId,
  },
});

// В update()
if (dto.email) {
  const existingUserWithEmail = await this.prisma.user.findFirst({
    where: {
      email: dto.email, // ⚠️ Не нормализован
      companyId,
    },
  });
}
```

**Решение:**
Нормализовать email к lowercase:
```typescript
// В create()
const normalizedEmail = dto.email.toLowerCase().trim();
const existingUser = await this.prisma.user.findFirst({
  where: {
    email: normalizedEmail,
    companyId,
  },
});

// Сохранять нормализованный email
const user = await this.prisma.user.create({
  data: {
    ...dto,
    email: normalizedEmail,
    password: hashedPassword,
    companyId,
  },
  // ...
});

// В update()
if (dto.email) {
  const normalizedEmail = dto.email.toLowerCase().trim();
  const existingUserWithEmail = await this.prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      companyId,
    },
  });
  // ...
  updateData.email = normalizedEmail;
}
```

**Приоритет:** 🔴 Критичный (безопасность - дублирование аккаунтов)

---

### 22. **Отсутствие проверки companyId в users.update() внутри update операции**
**Файл:** `server/src/users/users.service.ts` (строка 231-246)

**Проблема:**
- `update()` использует `findOne()` для проверки companyId
- Но затем выполняет `update({ where: { id } })` без проверки companyId в самом update
- Между `findOne()` и `update()` user может быть изменен или перемещен в другую компанию

**Текущий код:**
```typescript
async update(id: string, dto: UpdateUserDto, companyId: string, updaterRole: UserRole) {
  const existingUser = await this.findOne(id, companyId); // ✅ Проверяет companyId
  
  // ... валидация ...
  
  // ⚠️ Нет проверки companyId в самом update!
  const updated = await this.prisma.user.update({
    where: { id }, // Только по id, без проверки companyId
    data: updateData,
    // ...
  });
}
```

**Решение:**
Использовать транзакцию с проверкой companyId:
```typescript
const updated = await this.prisma.$transaction(async (tx) => {
  // Проверить user еще раз внутри транзакции
  const currentUser = await tx.user.findFirst({
    where: {
      id,
      companyId,
    },
  });

  if (!currentUser) {
    throw new NotFoundException(`User with ID ${id} not found in your company`);
  }

  // Проверить email на дубликаты внутри транзакции
  if (dto.email) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUserWithEmail = await tx.user.findFirst({
      where: {
        email: normalizedEmail,
        companyId,
        id: { not: id },
      },
    });

    if (existingUserWithEmail) {
      throw new ConflictException('User with this email already exists in your company');
    }
    updateData.email = normalizedEmail;
  }

  // Выполнить update
  return tx.user.update({
    where: { id },
    data: updateData,
    // ...
  });
});
```

**Приоритет:** 🔴 Критичный (безопасность - потенциальный доступ к чужим данным)

---

### 23. **Отсутствие проверки companyId в projects.update() внутри update операции**
**Файл:** `server/src/projects/projects.service.ts` (строка 124-127)

**Проблема:**
- `update()` использует `findOne()` для проверки companyId
- Но затем выполняет `update({ where: { id } })` без проверки companyId в самом update
- Между `findOne()` и `update()` project может быть изменен или перемещен в другую компанию

**Текущий код:**
```typescript
async update(id: string, dto: UpdateProjectDto, companyId: string) {
  await this.findOne(id, companyId); // ✅ Проверяет companyId
  
  // ... валидация ...
  
  // ⚠️ Нет проверки companyId в самом update!
  const updated = await this.prisma.project.update({
    where: { id }, // Только по id, без проверки companyId
    data: dto,
  });
}
```

**Решение:**
Использовать транзакцию с проверкой companyId:
```typescript
const updated = await this.prisma.$transaction(async (tx) => {
  // Проверить project еще раз внутри транзакции
  const currentProject = await tx.project.findFirst({
    where: {
      id,
      companyId,
    },
  });

  if (!currentProject) {
    throw new NotFoundException(`Project with ID ${id} not found in your company`);
  }

  // Проверить активные entries внутри транзакции
  if (dto.status === 'ARCHIVED') {
    const activeEntries = await tx.timeEntry.findMany({
      where: {
        projectId: id,
        status: { in: ['RUNNING', 'PAUSED'] },
        user: { companyId },
      },
    });

    if (activeEntries.length > 0) {
      throw new BadRequestException(
        `Cannot archive project with active time entries. Please stop all running/paused timers associated with this project first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
      );
    }
  }

  // Выполнить update
  return tx.project.update({
    where: { id },
    data: dto,
  });
});
```

**Приоритет:** 🔴 Критичный (безопасность - потенциальный доступ к чужим данным)

---

### 24. **Отсутствие проверки companyId в users.remove() внутри delete операции**
**Файл:** `server/src/users/users.service.ts` (строка 282-284)

**Проблема:**
- `remove()` использует `findOne()` для проверки companyId
- Но внутри транзакции используется `delete({ where: { id } })` без проверки companyId в самом delete
- Между `findOne()` и транзакцией user может быть изменен

**Текущий код:**
```typescript
const deleted = await this.prisma.$transaction(async (tx) => {
  const activeEntries = await tx.timeEntry.findMany({
    // ...
  });

  // ⚠️ Нет проверки companyId в самом delete!
  return tx.user.delete({
    where: { id }, // Только по id, без проверки companyId
  });
});
```

**Решение:**
Проверить user внутри транзакции:
```typescript
const deleted = await this.prisma.$transaction(async (tx) => {
  // Проверить user еще раз внутри транзакции
  const currentUser = await tx.user.findFirst({
    where: {
      id,
      companyId,
    },
  });

  if (!currentUser) {
    throw new NotFoundException(`User with ID ${id} not found in your company`);
  }

  // Проверить права доступа
  if (currentUser.role === UserRole.OWNER && deleterRole !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException('You cannot delete the owner of the company');
  }

  if (currentUser.role === UserRole.SUPER_ADMIN && deleterRole !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenException('You do not have permission to delete a super admin');
  }

  // Проверить активные entries
  const activeEntries = await tx.timeEntry.findMany({
    where: {
      userId: id,
      status: { in: ['RUNNING', 'PAUSED'] },
      user: { companyId },
    },
  });

  if (activeEntries.length > 0) {
    throw new BadRequestException(
      `Cannot delete user with active time entries. Please stop all running/paused timers first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
    );
  }

  return tx.user.delete({
    where: { id },
  });
});
```

**Приоритет:** 🔴 Критичный (безопасность - потенциальный доступ к чужим данным)

---

### 25. **Отсутствие проверки companyId в projects.remove() внутри delete операции**
**Файл:** `server/src/projects/projects.service.ts` (строка 156-158)

**Проблема:**
- `remove()` использует `findOne()` для проверки companyId
- Но внутри транзакции используется `delete({ where: { id } })` без проверки companyId в самом delete
- Между `findOne()` и транзакцией project может быть изменен

**Текущий код:**
```typescript
const deleted = await this.prisma.$transaction(async (tx) => {
  const activeEntries = await tx.timeEntry.findMany({
    // ...
  });

  // ⚠️ Нет проверки companyId в самом delete!
  return tx.project.delete({
    where: { id }, // Только по id, без проверки companyId
  });
});
```

**Решение:**
Проверить project внутри транзакции:
```typescript
const deleted = await this.prisma.$transaction(async (tx) => {
  // Проверить project еще раз внутри транзакции
  const currentProject = await tx.project.findFirst({
    where: {
      id,
      companyId,
    },
  });

  if (!currentProject) {
    throw new NotFoundException(`Project with ID ${id} not found in your company`);
  }

  // Проверить активные entries
  const activeEntries = await tx.timeEntry.findMany({
    where: {
      projectId: id,
      status: { in: ['RUNNING', 'PAUSED'] },
      user: { companyId },
    },
  });

  if (activeEntries.length > 0) {
    throw new BadRequestException(
      `Cannot delete project with active time entries. Please stop all running/paused timers associated with this project first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
    );
  }

  return tx.project.delete({
    where: { id },
  });
});
```

**Приоритет:** 🔴 Критичный (безопасность - потенциальный доступ к чужим данным)

---

## 🟡 Средние баги

### 26. **Отсутствие проверки на максимальную длину пароля в users.service.ts**
**Файл:** `server/src/users/users.service.ts` (строка 55, 217)

**Проблема:**
- Нет проверки на максимальную длину пароля в `create()` и `update()`
- Очень длинный пароль может вызвать проблемы с производительностью при хешировании
- Может быть использовано для DoS атаки

**Текущий код:**
```typescript
// В create()
if (dto.password.length < 8) {
  throw new BadRequestException('Password must be at least 8 characters long');
}
// ⚠️ Нет проверки на максимальную длину

// В update()
if (dto.password.length < 8) {
  throw new BadRequestException('Password must be at least 8 characters long');
}
// ⚠️ Нет проверки на максимальную длину
```

**Решение:**
Добавить проверку максимальной длины:
```typescript
if (dto.password.length < 8) {
  throw new BadRequestException('Password must be at least 8 characters long');
}
if (dto.password.length > 128) {
  throw new BadRequestException('Password must not exceed 128 characters');
}
```

**Приоритет:** 🟡 Средний (DoS защита)

---

### 27. **Отсутствие проверки на максимальную длину пароля в UpdateUserDto**
**Файл:** `server/src/users/dto/update-user.dto.ts` (строка 8-9)

**Проблема:**
- Нет проверки на максимальную длину пароля в DTO
- Очень длинный пароль может вызвать проблемы

**Текущий код:**
```typescript
@IsOptional()
@IsString()
@MinLength(6)
password?: string;
```

**Решение:**
Добавить проверку максимальной длины:
```typescript
@IsOptional()
@IsString()
@MinLength(8, { message: 'Password must be at least 8 characters long' })
@MaxLength(128, { message: 'Password must not exceed 128 characters' })
password?: string;
```

**Приоритет:** 🟡 Средний (DoS защита)

---

### 28. **Отсутствие санитизации имени в users.service.ts**
**Файл:** `server/src/users/users.service.ts` (строка 68-73)

**Проблема:**
- Имя пользователя не санитизируется (trim)
- Можно создать пользователя с именем из одних пробелов

**Текущий код:**
```typescript
const user = await this.prisma.user.create({
  data: {
    ...dto,
    password: hashedPassword,
    companyId,
  },
});
```

**Решение:**
Добавить санитизацию:
```typescript
const sanitizedName = dto.name.trim();
if (!sanitizedName || sanitizedName.length < 1) {
  throw new BadRequestException('Name cannot be empty');
}

const user = await this.prisma.user.create({
  data: {
    ...dto,
    name: sanitizedName,
    password: hashedPassword,
    companyId,
  },
});
```

**Приоритет:** 🟡 Средний (валидация данных)

---

### 29. **Отсутствие санитизации имени проекта в projects.service.ts**
**Файл:** `server/src/projects/projects.service.ts` (строка 14-20)

**Проблема:**
- Название проекта не санитизируется (trim)
- Можно создать проект с названием из одних пробелов

**Текущий код:**
```typescript
const project = await this.prisma.project.create({
  data: {
    ...dto,
    companyId,
  },
});
```

**Решение:**
Добавить санитизацию:
```typescript
const sanitizedName = dto.name.trim();
if (!sanitizedName || sanitizedName.length < 1) {
  throw new BadRequestException('Project name cannot be empty');
}

const project = await this.prisma.project.create({
  data: {
    ...dto,
    name: sanitizedName,
    companyId,
  },
});
```

**Приоритет:** 🟡 Средний (валидация данных)

---

### 30. **Использование console.log и console.error в main.ts**
**Файл:** `server/src/main.ts` (строка 130, 134)

**Проблема:**
- Используется `console.log` и `console.error` вместо структурированного логирования
- Не соответствует остальному коду, который использует PinoLogger

**Текущий код:**
```typescript
console.log(`🚀 Server is running on http://localhost:${port}/api`);

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

**Решение:**
Использовать PinoLogger или оставить console для bootstrap (приемлемо для startup сообщений).

**Приоритет:** 🟡 Средний (консистентность логирования)

---

### 31. **Отсутствие проверки на пустую строку в email после нормализации**
**Файл:** `server/src/users/users.service.ts` (строка 23, 149)

**Проблема:**
- После нормализации email может стать пустой строкой
- Нужна дополнительная проверка

**Решение:**
Проверять, что email не пустой после нормализации.

**Приоритет:** 🟡 Средний (валидация данных)

---

### 32. **Потенциальная проблема с накоплением setTimeout в time-entries.service.ts**
**Файл:** `server/src/time-entries/time-entries.service.ts` (строка 154, 469, 609, 739, 861)

**Проблема:**
- Используется `setTimeout` без очистки
- При большом количестве операций может накапливаться много таймеров
- Может привести к проблемам с памятью

**Текущий код:**
```typescript
setTimeout(() => {
  this.eventsGateway.broadcastStatsUpdate({ trigger: 'time-entry-updated' }, companyId);
}, 1000);
```

**Решение:**
Использовать debounce или очищать таймеры при необходимости. Или использовать очередь событий.

**Приоритет:** 🟡 Средний (производительность)

---

## 🟢 Низкие баги / Улучшения

### 33. **Отсутствие проверки на null payload в WebSocket**
**Файл:** `server/src/events/events.gateway.ts` (строка 96-98)

**Проблема:**
- `payload` может быть null или undefined
- Нет проверки перед использованием

**Решение:**
Добавить проверку на null перед использованием payload.

**Приоритет:** 🟢 Низкий (может вызвать runtime error)

---

### 34. **Отсутствие проверки на валидность email формата после нормализации**
**Файл:** `server/src/users/users.service.ts` (строка 23)

**Проблема:**
- После нормализации email может стать невалидным (хотя маловероятно)
- DTO уже проверяет, но можно добавить дополнительную проверку

**Решение:**
Добавить проверку после нормализации (опционально).

**Приоритет:** 🟢 Низкий (валидация данных)

---

### 35. **Отсутствие проверки на максимальную длину имени в users.service.ts**
**Файл:** `server/src/users/users.service.ts` (строка 68)

**Проблема:**
- DTO проверяет MaxLength(255), но нет проверки в сервисе
- Можно добавить для дополнительной безопасности

**Решение:**
Добавить проверку в сервисе (опционально, DTO уже проверяет).

**Приоритет:** 🟢 Низкий (валидация данных)

---

## 📋 Сводная таблица

| #   | Баг                                            | Приоритет    | Файл                           | Статус          |
| --- | ---------------------------------------------- | ------------ | ------------------------------ | --------------- |
| 21  | Отсутствие нормализации email в users          | 🔴 Критичный | `users.service.ts:23,149`      | ✅ Исправлено |
| 22  | Отсутствие проверки companyId в users.update() | 🔴 Критичный | `users.service.ts:231`         | ✅ Исправлено |
| 23  | Отсутствие проверки companyId в projects.update() | 🔴 Критичный | `projects.service.ts:124`      | ✅ Исправлено |
| 24  | Отсутствие проверки companyId в users.remove() | 🔴 Критичный | `users.service.ts:282`         | ✅ Исправлено |
| 25  | Отсутствие проверки companyId в projects.remove() | 🔴 Критичный | `projects.service.ts:156`      | ✅ Исправлено |
| 26  | Отсутствие проверки на максимальную длину пароля | 🟡 Средний   | `users.service.ts:55,217`      | ✅ Исправлено |
| 27  | Отсутствие проверки на максимальную длину пароля в DTO | 🟡 Средний   | `update-user.dto.ts:8`         | ✅ Исправлено |
| 28  | Отсутствие санитизации имени в users          | 🟡 Средний   | `users.service.ts:68`           | ✅ Исправлено |
| 29  | Отсутствие санитизации имени проекта         | 🟡 Средний   | `projects.service.ts:14`       | ✅ Исправлено |
| 30  | Использование console.log в main.ts           | 🟡 Средний   | `main.ts:130`                  | ⚠️ Можно улучшить |
| 31  | Отсутствие проверки на пустую строку в email  | 🟡 Средний   | `users.service.ts:23`          | ✅ Исправлено |
| 32  | Потенциальная проблема с setTimeout            | 🟡 Средний   | `time-entries.service.ts:154`  | ⚠️ Можно улучшить |
| 33  | Отсутствие проверки на null payload в WebSocket | 🟢 Низкий    | `events.gateway.ts:96`          | ⚠️ Можно улучшить |
| 34  | Отсутствие проверки email после нормализации   | 🟢 Низкий    | `users.service.ts:23`          | ✅ Исправлено |
| 35  | Отсутствие проверки на максимальную длину имени | 🟢 Низкий    | `users.service.ts:68`          | ⚠️ Можно улучшить |

---

## 🎯 Рекомендации по исправлению

### Приоритет 1 (Критичный): ✅ ВСЕ ИСПРАВЛЕНО

1. ✅ **Добавить нормализацию email в users.service.ts** - **ИСПРАВЛЕНО**
2. ✅ **Добавить проверку companyId в users.update() внутри транзакции** - **ИСПРАВЛЕНО**
3. ✅ **Добавить проверку companyId в projects.update() внутри транзакции** - **ИСПРАВЛЕНО**
4. ✅ **Добавить проверку companyId в users.remove() внутри транзакции** - **ИСПРАВЛЕНО**
5. ✅ **Добавить проверку companyId в projects.remove() внутри транзакции** - **ИСПРАВЛЕНО**

### Приоритет 2 (Средний): ✅ БОЛЬШИНСТВО ИСПРАВЛЕНО

6. ✅ **Добавить проверку на максимальную длину пароля в users.service.ts** - **ИСПРАВЛЕНО**
7. ✅ **Добавить проверку на максимальную длину пароля в UpdateUserDto** - **ИСПРАВЛЕНО**
8. ✅ **Добавить санитизацию имени в users.service.ts** - **ИСПРАВЛЕНО**
9. ✅ **Добавить санитизацию имени проекта в projects.service.ts** - **ИСПРАВЛЕНО**
10. ⚠️ **Исправить console.log в main.ts** - можно улучшить (приемлемо для startup)
11. ✅ **Добавить проверку на пустую строку в email** - **ИСПРАВЛЕНО**

### Приоритет 3 (Низкий): ⚠️ МОЖНО УЛУЧШИТЬ

12. 📝 **Улучшить обработку setTimeout (debounce)** - можно улучшить
13. 📝 **Добавить проверку на null payload в WebSocket** - можно улучшить
14. ✅ **Добавить проверку email после нормализации** - **ИСПРАВЛЕНО**
15. 📝 **Добавить проверку на максимальную длину имени** - можно улучшить (DTO уже проверяет)

---

## 📝 Заключение

**Критичные баги:** 5 ✅ Все исправлены
**Средние баги:** 7 ✅ Большинство исправлено
**Низкие баги/улучшения:** 4 ⚠️ Можно улучшить

**Основные проблемы:**
1. ✅ Отсутствие нормализации email в users.service.ts - **ИСПРАВЛЕНО**
2. ✅ Отсутствие проверки companyId в операциях update/delete внутри транзакций - **ИСПРАВЛЕНО**
3. ✅ Отсутствие валидации и санитизации данных - **ИСПРАВЛЕНО**
4. ⚠️ Потенциальные проблемы с производительностью - можно улучшить

**Статус исправлений:**
- ✅ Баги #21-25 (критичные) - **ИСПРАВЛЕНЫ**
- ✅ Баги #26-29, #31 (средние) - **ИСПРАВЛЕНЫ**
- ⚠️ Баги #30, #32 (средние) - можно улучшить
- ⚠️ Баги #33-35 (низкие) - можно улучшить

**Основные изменения:**
1. ✅ Добавлена нормализация email к lowercase в users.service.ts (create и update)
2. ✅ Добавлены транзакции с проверкой companyId в users.update() и projects.update()
3. ✅ Добавлены транзакции с проверкой companyId в users.remove() и projects.remove()
4. ✅ Добавлена проверка на максимальную длину пароля (128 символов)
5. ✅ Добавлена санитизация имени пользователя и названия проекта (trim)
6. ✅ Добавлена проверка на пустую строку в email после нормализации
7. ✅ Добавлена санитизация пароля через trim
8. ✅ Добавлена санитизация description проекта

