"""Хелперы для работы с request-контекстом."""


def get_client_ip(request):
    """IP клиента с учётом обратного прокси."""
    fwd = request.headers.get('X-Forwarded-For')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.remote_addr or '0.0.0.0'


def get_pagination(request, default_per_page=20, max_per_page=100):
    """Прочитать page/per_page из query-параметров с безопасными границами."""
    try:
        page = max(1, int(request.args.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(request.args.get('per_page', default_per_page))
    except (TypeError, ValueError):
        per_page = default_per_page
    per_page = max(1, min(per_page, max_per_page))
    return page, per_page
