"""Validation helpers shared by staff-platform blueprints."""

from datetime import datetime, timezone


def parse_datetime(value, field='datetime', required=False):
    if value in (None, ''):
        if required:
            raise ValueError(f'Поле {field} обязательно')
        return None
    if not isinstance(value, str):
        raise ValueError(f'Поле {field} должно быть строкой ISO 8601')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError(f'Некорректное значение {field}') from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    # SQLAlchemy's SQLite DateTime returns naive values.  Persist UTC as naive
    # consistently and add the ``Z`` suffix only at the API boundary.
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def expected_version(payload, current):
    version = payload.get('version')
    if version is not None and version != current:
        raise RuntimeError('Объект уже изменён. Обновите данные и повторите действие')
