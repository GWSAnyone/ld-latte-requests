# LD LATTE | Заявки на автоматизацию

React 19, TypeScript, Vite и Supabase Auth/PostgreSQL. Интерфейс адаптирован для компьютера и телефона.

[Приложение заявок](https://gwsanyone.github.io/ld-latte-requests/) · [Презентация: статистика Instagram](https://gwsanyone.github.io/ld-latte-requests/instagram/) (без входа).

## Локальный запуск

```sh
git clone https://github.com/GWSAnyone/ld-latte-requests.git
cd ld-latte-requests
bun install --frozen-lockfile
cp .env.example .env.local
```

В `.env.local` укажите URL Supabase и publishable key.

Создайте новый проект Supabase. В его SQL Editor выполните по порядку файлы из папки `supabase`: сначала `schema.sql`, затем файлы `002`–`006`. Это создаст таблицу заявок, хранилище изображений и правила доступа, благодаря которым каждый пользователь работает только со своими заявками. Для уже настроенного проекта повторно выполнять файлы не нужно.

В Supabase Auth настроить email/password, Site URL и разрешённые Redirect URLs для локального и опубликованного адресов.

После настройки запустить приложение:

```sh
bun run dev
```

## Проверки

- `bun run build` — проверка TypeScript и production-сборка.
- `bun test` — unit-тесты валидации, фильтрации и сохранения.
- `tests/rls.sql` — проверка доступа двух пользователей в БД с откатом изменений; запуск через `psql -v ON_ERROR_STOP=1` с TLS и проверенным сертификатом.

## Известные ограничения

При сбое или закрытии браузера в приватном Storage могут остаться отсоединённые файлы; автоматической уборки и общей квоты нет. Одновременное редактирование использует последнюю сохранённую версию. Письма и их лимиты зависят от настроек Supabase. Приватные изображения выдаются по временным ссылкам; их содержимое отдельно на сервере не сканируется.
