"""HTTP-мост между ML-пайплайном детекции падений и Flask-бэкендом.

Камера/пайплайн логинится как ОТПРАВИТЕЛЬ точки и при падении продукта
шлёт скриншот кадра на POST /api/write-offs/auto-fall — бэкенд создаёт
ЧЕРНОВИК заявки на списание и уведомляет сотрудника подтвердить его.
"""

import requests


class WriteoffBackendClient:
    """Тонкий клиент к бэкенду списаний. Логинится лениво, повторяет
    запрос один раз при 401 (истёк токен)."""

    def __init__(self, base_url, login, password, timeout=10):
        self.base_url = base_url.rstrip('/')
        self.login_name = login
        self.password = password
        self.timeout = timeout
        self._token = None
        self._session = requests.Session()

    # -- авторизация ------------------------------------------------------- #
    def login(self):
        r = self._session.post(
            f"{self.base_url}/api/auth/login",
            json={'identifier': self.login_name, 'password': self.password},
            timeout=self.timeout,
        )
        r.raise_for_status()
        self._token = r.json()['access_token']
        return self._token

    def _auth_headers(self):
        if not self._token:
            self.login()
        return {'Authorization': f'Bearer {self._token}'}

    # -- отправка события падения ------------------------------------------ #
    def post_fall(self, image_jpeg, product, product_ru=None, reason=None,
                  track_id=None, confidence=None, quantity=1, unit='шт'):
        """Отправляет падение на бэкенд. image_jpeg — bytes JPEG скриншота.
        Возвращает requests.Response."""
        data = {'product': product, 'quantity': str(quantity), 'unit': unit}
        if product_ru:
            data['product_ru'] = product_ru
        if reason:
            data['reason'] = reason
        if track_id is not None:
            data['track_id'] = str(track_id)
        if confidence is not None:
            data['confidence'] = f'{float(confidence):.3f}'

        files = {'file': ('fall.jpg', image_jpeg, 'image/jpeg')}
        url = f"{self.base_url}/api/write-offs/auto-fall"

        r = self._session.post(url, headers=self._auth_headers(),
                               data=data, files=files, timeout=self.timeout)
        if r.status_code == 401:  # токен истёк → перелогин и один повтор
            self._token = None
            r = self._session.post(url, headers=self._auth_headers(),
                                   data=data, files=files, timeout=self.timeout)
        return r
