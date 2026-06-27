"""Интеграция с Iiko: создание акта списания.

РЕЖИМЫ (config.IIKO_MODE):
  - 'mock' (по умолчанию): имитирует создание акта — генерирует фиктивный
    iiko_act_id, ничего наружу не отправляет. Используется для разработки/демо.
  - 'real': реальные вызовы Iiko API (см. TODO ниже). Требует кред в окружении.

Обе ветки возвращают единый результат IikoResult, поэтому вызывающий код
(routes/writeoffs.py -> approve) не зависит от режима.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from flask import current_app


@dataclass
class IikoResult:
    success: bool
    act_id: Optional[str] = None
    error: Optional[str] = None


def create_writeoff_act(write_off) -> IikoResult:
    """Создать акт списания в Iiko на основе подтверждённой заявки.

    Args:
        write_off: экземпляр models.WriteOff (уже со связями store/items).

    Returns:
        IikoResult: success + act_id, либо success=False + error.
    """
    mode = current_app.config.get('IIKO_MODE', 'mock')
    if mode == 'real':
        return _create_act_real(write_off)
    return _create_act_mock(write_off)


# --------------------------------------------------------------------------- #
# MOCK
# --------------------------------------------------------------------------- #
def _create_act_mock(write_off) -> IikoResult:
    """Имитация: генерируем правдоподобный идентификатор акта.
    Здесь же удобно логировать, что именно «ушло бы» в Iiko."""
    act_id = f"MOCK-ACT-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}"
    current_app.logger.info(
        "[IIKO:mock] Создан фиктивный акт списания %s для заявки #%s "
        "(точка iiko_store_id=%s, позиций=%s)",
        act_id,
        write_off.id,
        write_off.store.iiko_store_id if write_off.store else None,
        len(write_off.items),
    )
    return IikoResult(success=True, act_id=act_id)


# --------------------------------------------------------------------------- #
# REAL — заглушка под реальную интеграцию
# --------------------------------------------------------------------------- #
def _create_act_real(write_off) -> IikoResult:
    """Реальная интеграция с Iiko.

    TODO (когда появятся доступы):
      1. Получить токен:
           POST {IIKO_BASE_URL}/api/1/access_token  (Iiko Transport / Cloud API)
           тело: {"apiLogin": IIKO_API_LOGIN}
         или для Iiko Server (resto) — /resto/api/auth?login=...&pass=...
      2. Сформировать документ акта списания (writeoffDocument):
           - dateIncoming, storeId = write_off.store.iiko_store_id
           - items: [{ productId = item.iiko_product_id, amount = item.quantity }]
           - при type == with_deduction — привязать сотрудника
             (write_off.deduction_employee.iiko_employee_id)
           - comment = write_off.comment
      3. Отправить документ:
           POST {IIKO_BASE_URL}/api/1/documents/writeoff   (или resto-эндпоинт)
      4. Распарсить ответ, вернуть IikoResult(success=True, act_id=<id из ответа>).
      5. Ошибки сети/валидации -> IikoResult(success=False, error=...).

    Пример каркаса HTTP-вызова (requests уже в зависимостях):

        import requests
        base = current_app.config['IIKO_BASE_URL']
        token = _get_token()
        payload = _build_writeoff_payload(write_off)
        resp = requests.post(f"{base}/api/1/documents/writeoff",
                             json=payload,
                             headers={'Authorization': f'Bearer {token}'},
                             timeout=30)
        resp.raise_for_status()
        return IikoResult(success=True, act_id=resp.json().get('id'))
    """
    base = current_app.config.get('IIKO_BASE_URL')
    if not base:
        return IikoResult(
            success=False,
            error='IIKO_MODE=real, но IIKO_BASE_URL/кредиты не настроены',
        )
    # Реальный код появится здесь после получения доступов к Iiko.
    return IikoResult(success=False, error='Реальная интеграция с Iiko ещё не реализована')
