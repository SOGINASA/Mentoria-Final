"""Shared catalog and payload helpers for employee self-service workflows.

The catalog mirrors stable identifiers used by the current web client.  Course
content and official HR records remain external concerns; this module owns only
validated progress and request workflow state.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import current_app

from platform_models import EmployeeDocumentRequest, LearningProgress, LeaveRequest


LEARNING_CATALOG = {
    'service-standards': {
        'modules': ('welcome', 'order', 'handoff', 'feedback'),
        'correct_option_id': 'a',
    },
    'kitchen-safety': {
        'modules': ('temperature', 'equipment', 'incident'),
        'correct_option_id': 'b',
    },
    'shift-lead': {
        'modules': ('briefing', 'peak', 'handover'),
        'correct_option_id': 'a',
    },
}

DOCUMENT_CATALOG = {
    'contract': 'Трудовой договор',
    'payslip': 'Расчётный лист',
    'employment': 'Справка с места работы',
    'income': 'Справка о доходах',
}

LEAVE_TYPES = {'annual', 'unpaid', 'sick', 'other'}


def local_today(user):
    timezone_name = getattr(getattr(user, 'store', None), 'timezone', None) or 'Asia/Almaty'
    try:
        return datetime.now(ZoneInfo(timezone_name)).date()
    except ZoneInfoNotFoundError:
        return datetime.now(timezone.utc).date()


def leave_balance(user, year=None):
    """Return a deliberately preliminary balance until an HR source is wired."""
    year = year or local_today(user).year
    allowance = int(current_app.config.get('ANNUAL_LEAVE_ALLOWANCE_DAYS', 24))
    external_used = int(current_app.config.get('ANNUAL_LEAVE_USED_DAYS', 0))
    approved = LeaveRequest.query.filter_by(
        requester_id=user.id, leave_type='annual', status='approved',
    ).all()
    approved_days = sum(item.days for item in approved if item.starts_on.year == year)
    return {
        'year': year,
        'annual_allowance_days': allowance,
        'external_used_days': external_used,
        'approved_days': approved_days,
        'available_days': max(0, allowance - external_used - approved_days),
        'preliminary': True,
        'source': 'configured_allowance_and_platform_requests',
    }


def employee_services_payload(user):
    progress = LearningProgress.query.filter_by(user_id=user.id).order_by(
        LearningProgress.course_id,
    ).all()
    documents = EmployeeDocumentRequest.query.filter_by(user_id=user.id).order_by(
        EmployeeDocumentRequest.created_at.desc(), EmployeeDocumentRequest.id.desc(),
    ).all()
    leave = LeaveRequest.query.filter_by(requester_id=user.id).order_by(
        LeaveRequest.created_at.desc(), LeaveRequest.id.desc(),
    ).all()
    return {
        'learning_progress': [item.to_dict() for item in progress],
        'document_requests': [item.to_dict() for item in documents],
        'leave_requests': [item.to_dict() for item in leave],
        'leave_balance': leave_balance(user),
    }
