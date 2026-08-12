"""HR workspace: workforce directory, requests and learning compliance."""

from datetime import timedelta

from flask import Blueprint, jsonify, request

from constants import ROLE_MANAGER, ROLE_SENDER
from models import Store, User
from platform_models import (
    EmployeeDocumentRequest, LearningProgress, LeaveRequest, SupportCase, Timecard,
)
from services.employee_services import LEARNING_CATALOG
from services.permissions import can_access_store, scoped_store_ids
from utils.auth_helpers import get_current_user, permission_required
from utils.platform_helpers import utcnow

hr_bp = Blueprint('hr', __name__)

REQUIRED_COURSE_IDS = ('service-standards', 'kitchen-safety')


@hr_bp.get('/workspace')
@permission_required('hr.workspace')
def workspace():
    hr_user = get_current_user()
    requested_store_id = request.args.get('store_id', type=int)
    if requested_store_id and not can_access_store(hr_user, requested_store_id):
        return jsonify({'error': 'Нет доступа к торговой точке'}), 403

    allowed_store_ids = scoped_store_ids(hr_user)
    selected_ids = {requested_store_id} if requested_store_id else allowed_store_ids

    def within_scope(store_id):
        return selected_ids is None or store_id in selected_ids

    stores_query = Store.query.filter_by(is_active=True).order_by(Store.name)
    if allowed_store_ids is not None:
        stores_query = stores_query.filter(Store.id.in_(list(allowed_store_ids)))
    stores = stores_query.all()

    users = [item for item in User.query.filter(
        User.is_active.is_(True), User.role.in_((ROLE_SENDER, ROLE_MANAGER)),
    ).order_by(User.full_name).all() if within_scope(item.store_id)]
    user_ids = [item.id for item in users]
    progress_rows = LearningProgress.query.filter(LearningProgress.user_id.in_(user_ids)).all() if user_ids else []
    progress_by_user = {}
    for item in progress_rows:
        progress_by_user.setdefault(item.user_id, {})[item.course_id] = item

    today = utcnow().date()
    active_leave = [item for item in LeaveRequest.query.filter_by(status='approved').all()
                    if within_scope(item.store_id) and item.starts_on <= today <= item.ends_on]
    active_leave_ids = {item.requester_id for item in active_leave}

    employees = []
    for item in users:
        user_progress = progress_by_user.get(item.id, {})
        required_complete = sum(
            1 for course_id in REQUIRED_COURSE_IDS
            if user_progress.get(course_id) and user_progress[course_id].assessment_passed
        )
        employees.append({
            'id': item.id,
            'full_name': item.full_name,
            'role': item.role,
            'store_id': item.store_id,
            'email': item.email,
            'phone': item.phone,
            'last_login': item.to_dict()['last_login'],
            'on_leave': item.id in active_leave_ids,
            'learning': {
                'completed_courses': sum(1 for row in user_progress.values() if row.assessment_passed),
                'required_completed': required_complete,
                'required_total': len(REQUIRED_COURSE_IDS),
                'compliance_percent': round(required_complete * 100 / len(REQUIRED_COURSE_IDS)),
            },
        })

    documents = [item for item in EmployeeDocumentRequest.query.filter_by(status='processing')
                 .order_by(EmployeeDocumentRequest.created_at).all() if within_scope(item.store_id)]
    leave = [item for item in LeaveRequest.query.filter_by(status='pending')
             .order_by(LeaveRequest.created_at).all() if within_scope(item.store_id)]
    upcoming_leave = [item for item in LeaveRequest.query.filter_by(status='approved')
                      .order_by(LeaveRequest.starts_on).all()
                      if within_scope(item.store_id) and today <= item.starts_on <= today + timedelta(days=30)]
    cases = [item for item in SupportCase.query.filter(
        SupportCase.status.in_(('open', 'in_progress')), SupportCase.category == 'hr',
    ).all() if within_scope(item.store_id)]
    recent_cards = [item for item in Timecard.query.filter(
        Timecard.clock_in_at >= utcnow() - timedelta(days=30),
    ).all() if within_scope(item.store_id)]

    names = {item.id: item.full_name for item in users}
    store_summaries = []
    for store in stores:
        if requested_store_id and store.id != requested_store_id:
            continue
        members = [item for item in employees if item['store_id'] == store.id]
        store_summaries.append({
            'store_id': store.id,
            'name': store.name,
            'team': len(members),
            'on_leave': len([item for item in members if item['on_leave']]),
            'learning_compliant': len([item for item in members if item['learning']['compliance_percent'] == 100]),
        })

    course_stats = []
    for course_id in LEARNING_CATALOG:
        completed = len([item for item in progress_rows if item.course_id == course_id and item.assessment_passed])
        course_stats.append({
            'course_id': course_id,
            'completed': completed,
            'total': len(users),
            'percent': round(completed * 100 / len(users)) if users else 0,
            'required': course_id in REQUIRED_COURSE_IDS,
        })

    def enriched(item, owner_id):
        payload = item.to_dict()
        payload['employee_name'] = names.get(owner_id, f'Сотрудник #{owner_id}')
        return payload

    return jsonify({
        'stores': [item.to_dict() for item in stores],
        'employees': employees,
        'requests': {
            'documents': [enriched(item, item.user_id) for item in documents],
            'leave': [enriched(item, item.requester_id) for item in leave],
            'upcoming_leave': [enriched(item, item.requester_id) for item in upcoming_leave],
            'open_hr_cases': len(cases),
        },
        'analytics': {
            'active_employees': len(users),
            'on_leave': len(active_leave_ids),
            'pending_documents': len(documents),
            'pending_leave': len(leave),
            'worked_minutes_30d': sum(item.worked_minutes or 0 for item in recent_cards),
            'learning_compliance': round(sum(item['learning']['compliance_percent'] for item in employees) / len(employees)) if employees else 0,
            'courses': course_stats,
            'stores': store_summaries,
        },
        'generated_at': utcnow().isoformat() + 'Z',
    })
