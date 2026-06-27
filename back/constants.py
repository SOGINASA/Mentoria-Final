"""Перечисления домена. Значения совпадают с константами фронтенда
(front/src/constants/roles.js, statuses.js, writeOffTypes.js)."""

# Роли пользователей
ROLE_SENDER = 'sender'        # Отправитель (сотрудник торговой точки)
ROLE_REVIEWER = 'reviewer'    # Проверяющий
ROLE_ADMIN = 'admin'          # Администратор (справочники, пользователи)
ROLES = {ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN}

# Статусы заявки на списание
STATUS_DRAFT = 'draft'        # Черновик (авто-создан по падению, ждёт подтверждения сотрудником)
STATUS_PENDING = 'pending'    # На проверке
STATUS_APPROVED = 'approved'  # Подтверждена
STATUS_REJECTED = 'rejected'  # Отклонена
STATUSES = {STATUS_DRAFT, STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED}

# Источник заявки
SOURCE_MANUAL = 'manual'        # Создана сотрудником вручную
SOURCE_AUTO_FALL = 'auto_fall'  # Авто-создана по детекции падения (камера + ML)
WRITEOFF_SOURCES = {SOURCE_MANUAL, SOURCE_AUTO_FALL}

# Типы списания
TYPE_NO_DEDUCTION = 'no_deduction'      # Без удержания с сотрудника
TYPE_WITH_DEDUCTION = 'with_deduction'  # С удержанием с сотрудника
WRITEOFF_TYPES = {TYPE_NO_DEDUCTION, TYPE_WITH_DEDUCTION}

# Виды уведомлений (лента для polling)
NOTIFY_FALL_DRAFT = 'fall_draft'          # сотруднику: зафиксировано падение → подтвердите черновик
NOTIFY_FALL_ALERT = 'fall_alert'          # админу/проверяющему: на точке зафиксировано падение (надзор)
NOTIFY_REVIEW_PENDING = 'review_pending'  # проверяющему: новая заявка ожидает проверки
NOTIFY_KINDS = {NOTIFY_FALL_DRAFT, NOTIFY_FALL_ALERT, NOTIFY_REVIEW_PENDING}

# Статус синхронизации с Iiko
IIKO_NONE = 'none'        # Ещё не отправлялось
IIKO_PENDING = 'pending'  # В процессе
IIKO_SYNCED = 'synced'    # Акт создан
IIKO_FAILED = 'failed'    # Ошибка синхронизации

# Минимальная длина обязательного комментария (требование ТЗ)
MIN_COMMENT_LENGTH = 10
