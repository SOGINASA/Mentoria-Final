"""Manager workspace, decision queue and store-scoped operational analytics."""

from datetime import timedelta

from flask import Blueprint, jsonify, request

from models import Store, User, WriteOff
from platform_models import (
    EmployeeDocumentRequest, LeaveRequest, PlatformTask, Shift, ShiftRequest,
    SupportCase, TimeCorrectionRequest, Timecard,
)
from services.permissions import can_access_store, has_permission, scoped_store_ids
from utils.auth_helpers import feature_required, get_current_user, permission_required
from utils.platform_helpers import utcnow

manager_bp = Blueprint('manager', __name__)


@manager_bp.before_request
@feature_required('staff_platform')
def require_staff_platform():
    pass


def _can_manage_employee_service(user, item):
    if not has_permission(user, 'employee_services.manage'):
        return False
    if item.store_id is None:
        return scoped_store_ids(user) is None
    return can_access_store(user, item.store_id, 'employee_services.manage')


@manager_bp.get('/workspace')
@permission_required('manager.queue')
def workspace():
    """Return the scoped operational data needed by the manager frontend."""
    manager = get_current_user()
    allowed_store_ids = scoped_store_ids(manager)

    stores_query = Store.query.filter_by(is_active=True).order_by(Store.name)
    users_query = User.query.filter(User.is_active.is_(True), User.role.in_(('sender', 'manager')))
    shifts_query = Shift.query.order_by(Shift.starts_at.desc())
    tasks_query = PlatformTask.query.order_by(PlatformTask.due_at.asc())

    if allowed_store_ids is not None:
        ids = list(allowed_store_ids)
        stores_query = stores_query.filter(Store.id.in_(ids))
        users_query = users_query.filter(User.store_id.in_(ids))
        shifts = shifts_query.filter(Shift.store_id.in_(ids)).limit(200).all()
        tasks = tasks_query.filter(PlatformTask.store_id.in_(ids)).limit(250).all()
    else:
        shifts = shifts_query.limit(200).all()
        tasks = tasks_query.limit(250).all()

    return jsonify({
        'stores': [item.to_dict() for item in stores_query.all()],
        'team': [{
            'id': item.id,
            'full_name': item.full_name,
            'role': item.role,
            'store_id': item.store_id,
            'employee_id': item.employee_id,
        } for item in users_query.order_by(User.full_name).all()],
        'shifts': [item.to_dict() for item in shifts],
        'tasks': [item.to_dict() for item in tasks],
    })


@manager_bp.get('/analytics')
@permission_required('manager.queue')
def analytics():
    manager = get_current_user()
    days = min(90, max(7, request.args.get('days', 30, type=int) or 30))
    requested_store_id = request.args.get('store_id', type=int)
    if requested_store_id and not can_access_store(manager, requested_store_id):
        return jsonify({'error': 'Нет доступа к торговой точке'}), 403
    allowed_store_ids = scoped_store_ids(manager)
    store_ids = ({requested_store_id} if requested_store_id else allowed_store_ids)

    def scoped(items, store_attr='store_id'):
        if store_ids is None:
            return list(items)
        return [item for item in items if getattr(item, store_attr, None) in store_ids]

    now = utcnow()
    start = now - timedelta(days=days - 1)
    shifts = scoped(Shift.query.filter(Shift.starts_at >= start, Shift.starts_at <= now + timedelta(days=days)).all())
    period_shifts = [item for item in shifts if item.starts_at <= now]
    tasks = scoped(PlatformTask.query.filter(PlatformTask.created_at >= start).all())
    timecards = scoped(Timecard.query.filter(Timecard.clock_in_at >= start).all())
    cases = scoped(SupportCase.query.filter(SupportCase.updated_at >= start).all())
    writeoffs = scoped(WriteOff.query.filter(WriteOff.created_at >= start, WriteOff.status != 'draft').all())
    team_query = User.query.filter(User.is_active.is_(True), User.role.in_(('sender', 'manager')))
    team = scoped(team_query.all())

    scheduled_minutes = 0
    for shift in period_shifts:
        assigned = len([item for item in shift.assignments if item.status == 'confirmed'])
        duration = max(0, int((shift.ends_at - shift.starts_at).total_seconds() // 60) - shift.break_minutes)
        scheduled_minutes += duration * assigned

    series = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).date()
        day_shifts = [item for item in period_shifts if item.starts_at.date() == day]
        day_tasks = [item for item in tasks if item.completed_at and item.completed_at.date() == day]
        day_timecards = [item for item in timecards if item.clock_in_at.date() == day]
        series.append({
            'date': day.isoformat(),
            'shifts': len(day_shifts),
            'completed_tasks': len(day_tasks),
            'worked_minutes': sum(item.worked_minutes or 0 for item in day_timecards),
        })

    return jsonify({
        'period': {'days': days, 'from': start.date().isoformat(), 'to': now.date().isoformat()},
        'totals': {
            'team': len(team),
            'shifts': len(period_shifts),
            'scheduled_minutes': scheduled_minutes,
            'worked_minutes': sum(item.worked_minutes or 0 for item in timecards),
            'tasks_created': len(tasks),
            'tasks_completed': len([item for item in tasks if item.status in ('completed', 'approved')]),
            'tasks_overdue': len([item for item in tasks if item.due_at and item.due_at < now and item.status in ('active', 'in_progress')]),
            'open_cases': len([item for item in cases if item.status in ('open', 'in_progress')]),
            'writeoffs': len(writeoffs),
        },
        'task_statuses': {status: len([item for item in tasks if item.status == status])
                          for status in ('active', 'in_progress', 'completed', 'approved', 'cancelled')},
        'case_statuses': {status: len([item for item in cases if item.status == status])
                          for status in ('open', 'in_progress', 'resolved', 'closed')},
        'series': series,
        'generated_at': now.isoformat() + 'Z',
    })


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
        'shift_requests': [{**item.to_dict(), 'store_id': item.shift.store_id}
                           for item in shift_requests],
        'time_corrections': [{**item.to_dict(), 'store_id': item.timecard.store_id}
                             for item in corrections],
        'timecards': [item.to_dict() for item in timecards],
        'tasks': [item.to_dict() for item in tasks],
        'document_requests': [item.to_dict() for item in document_requests],
        'leave_requests': [item.to_dict() for item in leave_requests],
    })
