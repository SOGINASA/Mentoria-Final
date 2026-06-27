"""Валидаторы данных API."""

import re
from datetime import date, datetime
from typing import Optional, Tuple

DATE_REGEX = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def parse_date(date_str: Optional[str]) -> Tuple[Optional[date], Optional[str]]:
    """Парсит строку YYYY-MM-DD. Возвращает (date|None, error|None)."""
    if not date_str or (isinstance(date_str, str) and date_str.strip() == ''):
        return None, None
    if not isinstance(date_str, str) or not DATE_REGEX.match(date_str.strip()):
        return None, 'Неверный формат даты (ожидается ГГГГ-ММ-ДД)'
    try:
        return datetime.strptime(date_str.strip(), '%Y-%m-%d').date(), None
    except ValueError:
        return None, 'Некорректная дата'


def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_username(username: str) -> bool:
    """3-30 символов: буквы, цифры, точки, подчёркивания, дефисы."""
    return bool(re.match(r'^[a-zA-Z0-9._-]{3,30}$', username))


def is_email(identifier: str) -> bool:
    return '@' in identifier and '.' in identifier
