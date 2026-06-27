"""Перечисления домена. Значения совпадают с константами фронтенда
(front/src/constants/roles.js, statuses.js, writeOffTypes.js)."""

# Роли пользователей
ROLE_SENDER = 'sender'        # Отправитель (сотрудник торговой точки)
ROLE_REVIEWER = 'reviewer'    # Проверяющий
ROLE_ADMIN = 'admin'          # Администратор (справочники, пользователи)
ROLES = {ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN}

# Статусы заявки на списание
STATUS_PENDING = 'pending'    # На проверке
STATUS_APPROVED = 'approved'  # Подтверждена
STATUS_REJECTED = 'rejected'  # Отклонена
STATUSES = {STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED}

# Типы списания
TYPE_NO_DEDUCTION = 'no_deduction'      # Без удержания с сотрудника
TYPE_WITH_DEDUCTION = 'with_deduction'  # С удержанием с сотрудника
WRITEOFF_TYPES = {TYPE_NO_DEDUCTION, TYPE_WITH_DEDUCTION}

# Статус синхронизации с Iiko
IIKO_NONE = 'none'        # Ещё не отправлялось
IIKO_PENDING = 'pending'  # В процессе
IIKO_SYNCED = 'synced'    # Акт создан
IIKO_FAILED = 'failed'    # Ошибка синхронизации

# Минимальная длина обязательного комментария (требование ТЗ)
MIN_COMMENT_LENGTH = 10
