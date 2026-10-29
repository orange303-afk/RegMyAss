# RegMyAss ⚡ **Support RegMyAss:** [Donate on Ko-fi](https://ko-fi.com/ilyaorange).

> A Chrome Manifest V3 extension that helps register accounts using temporary or personal email, detects registration forms, generates account details, handles email verification, and stores credentials.

<img width="376" height="278" alt="image" src="https://github.com/user-attachments/assets/861b8cdb-bc18-4351-b448-4ff320c08d39" />

## Features

- Detects registration forms, including dynamic forms and forms inside frames, and fills them with generated account details.
- Supports Mail.tm, Mail.gw, DropMail.me, Guerrilla Mail, smails and Maildrop. You can also enter your own email address and check it manually.
- Use a separate mailbox for registrations. The extension does not request access to your personal inbox.
- Finds verification links and one-time codes in email; a confirmation link can be opened directly from the extension.
- Pauses for manual CAPTCHA completion and asks before submitting forms when configured.
- Can save account details with Chrome Password Manager or an encrypted local vault.
- Offers English, Spanish and Russian interface languages in **Settings → Language**. New installations default to English.
- On registration failure, **Report a problem** opens a prefilled GitHub issue draft with the site hostname, failure stage, error code, provider and extension version. Review and submit it yourself; credentials, email addresses and confirmation codes are excluded.

## Build and install

```bash
npm install
npm test
npm run build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the generated `dist` folder. Built files are excluded from Git.


## Русский

Язык интерфейса можно выбрать в настройках: английский, испанский или русский. При новой установке по умолчанию используется английский.

> Расширение для Google Chrome (Manifest V3), автоматизирующее процесс создания учетных записей на веб-сайтах при помощи временной электронной почты, умного анализа форм, генератора валидных адресов и ZIP-кодов, координации CAPTCHA и безопасного сохранения паролей.

---

## 📋 Оглавление
1. [Возможности](#-возможности)
2. [Архитектура проекта](#-архитектура-проекта)
3. [Установка и запуск](#-установка-и-запуск)
4. [Поддерживаемые провайдеры временной почты](#-поддерживаемые-провайдеры-временной-почты)
5. [Руководство: Добавление нового EmailProvider](#-руководство-добавление-нового-emailprovider)
6. [Тестирование и локальные сценарии](#-тестирование-и-локальные-сценарии)
7. [Безопасность и приватность](#-безопасность-и-приватность)
8. [Ограничения и известные особенности](#-ограничения-и-известные-особенности)

---

## 🚀 Возможности

- **1-Click регистрация:** Расширение обнаруживает форму, генерирует криптостойкий пароль и уникальный логин, запрашивает временный почтовый ящик и заполняет поля.
- **Поддержка современных SPA и фреймворков:** Работает с React, Vue, Angular, Svelte, динамическими модальными окнами и Shadow DOM благодаря прямому вызову нативных дескрипторов прототипа и генерации событий `input`, `change`, `blur`.
- **6 почтовых провайдеров:** Mail.tm, Mail.gw, DropMail.me, Guerrilla Mail, smails, Maildrop.
- **Собственная почта:** Введите любой адрес и проверяйте входящие вручную. Расширение не получает доступ к ящику.
- **Отдельный ящик для регистраций:** Рекомендуется использовать отдельный адрес вместо основной почты.
- **Сообщение о проблеме:** При неудачной регистрации кнопка **Report** открывает черновик GitHub Issue. В нём указаны домен сайта, этап, код ошибки, сервис почты и версия расширения. Перед отправкой можно добавить описание; адрес почты, пароль и код подтверждения не включаются.
- **Отказоустойчивость и автовыбор (Failover):** Если у выбранного провайдера исчерпана квота или недоступен API, расширение автоматически переключается на резервный сервис.
- **Умное подтверждение email:**
  - Извлечение verification link (ссылки активации) без выполнения небезопасного JavaScript.
  - Распознавание и автозаполнение 4–8-значных OTP-кодов.
- **Координация интерактивной CAPTCHA:**
  - Обнаружение Google reCAPTCHA v2, Cloudflare Turnstile, hCaptcha.
  - Автоматическая активация нужной вкладки и ожидание решения пользователем (никаких сторонних платных сервисов решения капч или обходов защиты).
  - Кнопка ручного подтверждения: *"Я прошёл проверку — продолжить"*.
- **Сохранение и повторное использование аккаунтов:**
  - Приоритетная интеграция со встроенным менеджером паролей **Google Password Manager**.
  - Альтернативное защищенное локальное хранилище с шифрованием **AES-256-GCM** и деривацией ключа **PBKDF2** (100,000 итераций SHA-256) через **Web Crypto API**.
  - Предотвращение дублирования: при повторном визите предлагается вход с сохраненными данными.
- **Manifest V3 устойчивость:**
  - Конечный автомат процессов (FSM) сохраняет состояние на каждом шаге в `chrome.storage.local`.
  - Устойчив к усыплению и перезапуску фонового Service Worker браузером.

---

## 🏗 Архитектура проекта

```text
RegMyAss/
├── dist/                     # Готовая сборка расширения для Chrome
├── public/
│   ├── icons/               # Иконки (16x16, 32x32, 48x48, 128x128)
│   └── manifest.json        # Манифест Chrome Extension V3
├── src/
│   ├── background/
│   │   ├── service-worker.ts   # Точка входа фонового Service Worker
│   │   └── workflow-manager.ts # Конечный автомат (FSM) регистрации
│   ├── content/
│   │   ├── content-script.ts   # Скрипт, внедряемый в веб-страницы
│   │   ├── form-detector.ts    # Детектор полей, меток и типов форм
│   │   ├── form-filler.ts      # Эмулятор ввода, совместимый с React/Vue
│   │   ├── login-detector.ts   # Определение сессий и форм входа
│   │   ├── captcha-detector.ts # Детектор reCAPTCHA, Turnstile, hCaptcha
│   │   └── dom-observer.ts     # MutationObserver для динамических SPA
│   ├── email/
│   │   ├── provider.interface.ts # Базовый контракт EmailProvider
│   │   ├── provider-manager.ts   # Менеджер провайдеров и failover
│   │   ├── message-parser.ts     # Безопасный парсер писем (ссылки и OTP)
│   │   ├── verification-manager.ts # Поллер писем и таймауты
│   │   └── providers/            # Адаптеры почтовых сервисов
│   │       ├── mail-tm.ts        # REST API Mail.tm
│   │       ├── mail-gw.ts        # REST API Mail.gw
│   │       ├── dropmail.ts       # GraphQL API DropMail.me
│   │       └── guerrilla.ts      # JSON API Guerrilla Mail
│   ├── accounts/
│   │   ├── account-generator.ts  # Генератор криптостойких паролей
│   │   └── account-manager.ts    # Менеджер аккаунтов и хранилища
│   ├── storage/
│   │   ├── database.ts           # Персистентное хранилище IndexedDB
│   │   └── encryption.ts         # AES-256-GCM / PBKDF2 Web Crypto
│   ├── ui/
│   │   ├── popup/                # Интерфейс попапа расширения (React)
│   │   └── options/              # Страница настроек и диагностика (React)
│   ├── shared/
│   │   ├── types.ts              # Строгие TypeScript интерфейсы
│   │   ├── messages.ts           # Типизированный IPC протокол
│   │   ├── errors.ts             # Каталог ошибок ошибок расширения
│   │   └── constants.ts          # Константы и настройки по умолчанию
│   └── tests/                    # Набор юнит- и интеграционных тестов
├── test-pages/                   # 10 локальных тестовых сценариев
├── package.json
├── tsconfig.json
└── scripts/
    └── build.ts                  # Модульный сборщик Vite для MV3
```

---

## 💻 Установка и запуск

### 1. Установка собранного расширения в Google Chrome

1. Откройте браузер Google Chrome.
2. Перейдите по адресу: `chrome://extensions/`
3. В правом верхнем углу включите тумблер **«Режим разработчика»** (Developer mode).
4. Нажмите кнопку **«Загрузить распакованное расширение»** (Load unpacked).
5. Соберите проект командой `npm run build` и выберите появившуюся папку `dist`.
6. Расширение **RegMyAss** появится в списке расширений и готово к работе!

### 2. Сборка из исходников

```bash
# Установка зависимостей
npm install

# Запуск тестов Vitest
npm test

# Сборка проекта
npm run build
```

---

## 📬 Поддерживаемые провайдеры временной почты

| Провайдер | Тип API | Требуется API-ключ | Домены | Особенности и ограничения |
| :--- | :--- | :---: | :--- | :--- |
| **Mail.tm** | REST / JSON | Нет (публичный) | `*.mail.tm` и пулы | Быстрый, создание ящиков по требованию, токены JWT. Лимит запросов ~8 req/s. |
| **Mail.gw** | REST / JSON | Нет (публичный) | Независимые домены | Зеркало Mail.tm с отдельным пулом адресов. Отличный резервный вариант. |
| **DropMail.me** | GraphQL | Нет | Разнообразные домены | Мгновенное создание сессии через GraphQL мутацию `introduceSession`. Высокая скорость доставки. |
| **Guerrilla Mail** | REST / JSON | Нет | `sharklasers.com` и др. | Классический сервис временной почты. Поддерживает опрос через `check_email` с `sid_token`. |
| **smails** | REST / JSON | Нет | `smails.dev` | Ящик создаётся через API, письма читаются по токену. |
| **Maildrop** | GraphQL | Нет | `maildrop.cc` | Публичный ящик. Новые отправители могут задерживаться из-за greylisting. |

---

## 🛠 Руководство: Добавление нового EmailProvider

Архитектура RegMyAss построена по принципу открытости/закрытости (Open-Closed Principle). Для добавления нового провайдера не требуется изменять логику `WorkflowManager` или интерфейс.

### Шаг 1: Реализуйте интерфейс `EmailProvider`
Создайте файл в `src/email/providers/my-provider.ts`:

```typescript
import { EmailProvider } from '../provider.interface';
import { EmailMessage, EmailProviderCapabilities, Mailbox } from '../../shared/types';
import { createError } from '../../shared/errors';

export class MyCustomEmailProvider implements EmailProvider {
  public readonly id = 'my-provider';
  public readonly name = 'My Custom TempMail';

  public readonly capabilities: EmailProviderCapabilities = {
    createMailbox: true,
    readMessages: true,
    deleteMailbox: false,
    customDomain: false,
    requiresApiKey: false,
    supportsPush: false,
  };

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('https://api.my-provider.com/ping');
      return res.ok;
    } catch {
      return false;
    }
  }

  public async createMailbox(): Promise<Mailbox> {
    const res = await fetch('https://api.my-provider.com/create');
    const data = await res.json();
    return {
      id: data.id,
      address: data.email,
      token: data.token,
      createdAt: Date.now(),
      providerId: this.id,
    };
  }

  public async getMessages(mailbox: Mailbox): Promise<EmailMessage[]> {
    const res = await fetch(`https://api.my-provider.com/inbox?id=${mailbox.id}`);
    const data = await res.json();
    return data.messages.map((m: any) => ({
      id: m.id,
      from: m.sender,
      to: mailbox.address,
      subject: m.subject,
      text: m.body_text,
      html: m.body_html,
      receivedAt: new Date(m.date).getTime(),
    }));
  }

  public async getMessage(mailbox: Mailbox, messageId: string): Promise<EmailMessage> {
    const messages = await this.getMessages(mailbox);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) throw createError('EMAIL_TIMEOUT', 'Message not found');
    return msg;
  }
}
```

### Шаг 2: Зарегистрируйте провайдер в `ProviderManager`
В `src/email/provider-manager.ts`:
```typescript
import { MyCustomEmailProvider } from './providers/my-provider';

// В конструкторе:
this.registerProvider(new MyCustomEmailProvider());
```

### Шаг 3: Добавьте домен в `host_permissions`
В `public/manifest.json`:
```json
"host_permissions": [
  "https://api.my-provider.com/*"
]
```

### Шаг 4: Выполните пересборку
```bash
npm run build
```

---

## 🧪 Тестирование и локальные сценарии

В проект включены **10 локальных тестовых страниц** в папке `test-pages/`:

1. `test-pages/1-simple-form.html` — Стандартная форма (Email + Пароль + Отправить).
2. `test-pages/2-confirm-password.html` — Форма с подтверждением пароля и чекбоксом согласия с правилами.
3. `test-pages/3-react-form.html` — Имитация React Synthetic Events с контролируемыми инпутами.
4. `test-pages/4-multi-step.html` — Многошаговая форма (Шаг 1: Контакты -> Шаг 2: Пароль).
5. `test-pages/5-dynamic-fields.html` — Появление формы в модальном окне через DOM Mutation.
6. `test-pages/6-captcha-form.html` — Интерактивная имитация reCAPTCHA с переходом во вкладку.
7. `test-pages/7-verify-link.html` — Ожидание и переход по ссылке подтверждения.
8. `test-pages/8-verify-otp.html` — Ввод 6-значного OTP-кода из письма в поле с `autocomplete="one-time-code"`.
9. `test-pages/9-existing-account.html` — Проверка повторного посещения и предложения входа.
10. `test-pages/10-registration-errors.html` — Обработка отказа сервера в регистрации.

Для запуска тестовой лаборатории откройте `test-pages/index.html` в браузере Chrome с установленным расширением.

### Автоматические модульные тесты:
```bash
npm test
```
Тестовый набор покрывает:
- `AccountGenerator`: криптостойкость, длина, проверка шаблонов.
- `FormDetector`: распознавание типов полей, селекторов и отделение регистрации от входа.
- `CaptchaDetector`: обнаружение reCAPTCHA v2, Turnstile, hCaptcha и проверка токенов.
- `MessageParser`: извлечение ссылок, санитизация опасных URI, парсинг OTP.
- `ProviderManager`: автовыбор, обработка ошибок, failover-переключение.
- `VaultEncryption`: AES-256-GCM шифрование/дешифрование и PBKDF2 деривация.
- `AppDatabase`: операции IndexedDB.
- `WorkflowManager`: переходы состояний и отмена.

---

## 🔐 Безопасность и приватность

1. **Никакого `Math.random()`:** Все пароли генерируются через криптостойкий ГПСЧ `crypto.getRandomValues()`.
2. **Безопасная обработка писем:** HTML входящих писем никогда не исполняется в браузере. DOMParser запускается без исполнения JavaScript; опасные ссылки (`javascript:`, `data:`) фильтруются.
3. **Хранение секретов:** Мастер-пароль никогда не сохраняется в открытом виде на диске. Ключи деривируются по стандарту PBKDF2 с 100,000 итераций и уникальной солью.
4. **Чувствительные сайты защищены:** В манифесте явно исключены домены интернет-банкинга и платежных систем (`paypal.com`, `stripe.com`, `sberbank.ru`, `tbank.ru` и др.).
5. **Анти-абьюз:** Расширение не предназначено для спама или массовой генерации аккаунтов. Все действия выполняются строго по явной команде пользователя в текущей вкладке.

---

## ⚠️ Ограничения и известные особенности

- **Встроенные CAPTCHA:** RegMyAss намеренно **не взламывает** капчи. При наличии интерактивной проверки расширение переводит пользователя на вкладку и возобновляет работу после ее прохождения.
- **Двухфакторная аутентификация (2FA / SMS):** Если сайт требует обязательного подтверждения по номеру телефона (SMS) или через физический ключ FIDO2/WebAuthn, такие шаги требуют ручного участия.
- **Временные почтовые ящики:** Письма во временных ящиках могут храниться от 10 минут до нескольких дней в зависимости от провайдера. Они не предназначены для критически важных личных сервисов.
