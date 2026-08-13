"""Regression tests for browser CORS preflight on protected blueprints."""

import pytest


@pytest.mark.parametrize('path', [
    '/api/platform/bootstrap',
    '/api/shifts?open=1',
    '/api/time/current',
    '/api/tasks',
    '/api/cases',
    '/api/news',
    '/api/manager/workspace',
    '/api/employee-services',
    '/api/hr/workspace',
    '/api/finance/workspace',
    '/api/operations/workspace',
])
def test_protected_platform_endpoints_allow_cors_preflight(client, path):
    response = client.options(path, headers={
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
    })

    assert response.status_code == 200
    assert response.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000'
    allowed_headers = response.headers.get('Access-Control-Allow-Headers', '').lower()
    assert 'authorization' in allowed_headers
