"""One decision queue for a manager's operational day."""

from flask import Blueprint, jsonify

from platform_models import (
    EmployeeDocumentRequest, LeaveRequest, PlatformTask, ShiftRequest,
    TimeCorrectionRequest, Timecard,
)
from services.permissions import can_access_store, has_permission, scoped_store_ids
from utils.auth_helpers import get_current_user, permission_required

manager_bp = Blueprint('manager', __name__)


def _can_manage_employee_service(user, item):
    if not has_permission(user, 'employee_services.manage'):
        return False
    if item.store_id is None:
        return scoped_store_ids(user) is None
    return can_access_store(user, item.store_id, 'employee_services.manage')


@manager_bp.get('/today')
@permission_required('manager.queue')
def today():
    user = get_current_user()
    shift_requests = [item for item in ShiftRequest.query.filter_by(status='pending').all()
                      if can_access_store(user, item.shift.store_id)]
    corrections = [item for item in TimeCorrectionRequest.query.filter_by(status='pending').all()
                   if can_access_store(user, item.timecard.store_id)]
    timecards = [item for item in Timecard.query.filter_by(status='submitted').all()
                 if can_access_store(user, item.store_id)]
    tasks = [item for item in PlatformTask.query.filter_by(status='completed').all()
             if can_access_store(user, item.store_id)]
    document_requests = [
        item for item in EmployeeDocumentRequest.query.filter_by(status='processing').all()
        if _can_manage_employee_service(user, item)
    ]
    leave_requests = [
        item for item in LeaveRequest.query.filter_by(status='pending').all()
        if _can_manage_employee_service(user, item)
    ]
    return jsonify({
        'counts': {'shift_requests': len(shift_requests), 'time_corrections': len(corrections),
                   'timecards': len(timecards), 'tasks': len(tasks),
                   'document_requests': len(document_requests),
                   'leave_requests': len(leave_requests)},
        'shift_requests': [item.to_dict() for item in shift_requests],
        'time_corrections': [item.to_dict() for item in corrections],
        'timecards': [item.to_dict() for item in timecards],
        'tasks': [item.to_dict() for item in tasks],
        'document_requests': [item.to_dict() for item in document_requests],
        'leave_requests': [item.to_dict() for item in leave_requests],
    })
