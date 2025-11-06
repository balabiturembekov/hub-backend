# Structured Logging with Pino

## Обзор

Проект использует **Pino** (через `nestjs-pino`) для структурированного логирования. Это стандартная библиотека для production SaaS проектов.

## Основные преимущества

- ✅ **Высокая производительность** - минимальный overhead, не блокирует event loop
- ✅ **Structured JSON логи** - легко парсятся системами мониторинга (Datadog, CloudWatch, ELK)
- ✅ **Correlation IDs** - автоматическая генерация Request ID для трейсинга запросов
- ✅ **Разные форматы для dev/prod** - красивое форматирование в dev, JSON в production
- ✅ **Автоматическое логирование HTTP запросов** - все запросы логируются с метаданными

## Настройка

### Development
- Используется `pino-pretty` для красивого цветного вывода
- Уровень логирования: `debug`

### Production
- JSON формат для интеграции с системами мониторинга
- Уровень логирования: `info`
- Request ID автоматически добавляется в заголовки ответа (`X-Request-Id`)

## Использование

### В сервисах и контроллерах

```typescript
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(MyService.name);
  }

  someMethod() {
    // Structured logging with context
    this.logger.info({ userId: '123', action: 'login' }, 'User logged in');
    
    this.logger.error(
      { error: error.message, stack: error.stack },
      'Operation failed'
    );
  }
}
```

### Уровни логирования

- `logger.debug()` - детальная отладочная информация
- `logger.info()` - информационные сообщения
- `logger.warn()` - предупреждения
- `logger.error()` - ошибки

## Request Correlation

Каждый HTTP запрос автоматически получает уникальный Request ID:
- Генерируется автоматически
- Передается в заголовке `X-Request-Id`
- Используется для трейсинга запросов через микросервисы

## Интеграция с системами мониторинга

JSON логи легко интегрируются с:
- **Datadog** - через Filebeat или Datadog Agent
- **AWS CloudWatch** - через CloudWatch Logs Agent
- **ELK Stack** - через Filebeat или Logstash
- **Sentry** - для error tracking

## Конфигурация

Настройка находится в `app.module.ts`:
- Уровень логирования
- Формат вывода (dev vs prod)
- Сериализация запросов/ответов
- Генерация Request ID

## Замена console.log

Все `console.log`/`console.error` заменены на Pino logger, кроме:
- `auth.module.ts` - предупреждение о JWT_SECRET (выполняется до инициализации logger)

