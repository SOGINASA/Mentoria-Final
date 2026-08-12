"""Operational tasks and checklist execution."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from models import User, db
from platform_models import (
    PlatformTask, TaskStepResult, TaskTemplate, TaskTemplateStep,
)
from services.audit import audit
from services.notifications import notify
from services.permissions import can_access_store
from utils.auth_helpers import get_current_user, permission_required
from utils.platform_helpers import expected_version, parse_datetime, utcnow

tasks_bp = Blueprint('tasks', __name__)


def _visible_to(task, user):
    return task.assignee_id == user.id or (task.assignee_id is None and task.store_id == user.store_id)


@tasks_bp.get('')
@tasks_bp.get('/')
@jwt_required()
def list_tasks():
    user = get_current_user()
    query = PlatformTask.query.filter(db.or_(PlatformTask.assignee_id == user.id,
                                             db.and_(PlatformTask.assignee_id.is_(None),
                                                     PlatformTask.store_id == user.store_id)))
    status = request.args.get('status')
    if status:
        query = query.filter_by(status=status)
    items = query.order_by(PlatformTask.due_at.asc(), PlatformTask.id.desc()).all()
    return jsonify({'tasks': [item.to_dict() for item in items]})


@tasks_bp.patch('/<int:task_id>/steps/<int:step_id>')
@permission_required('tasks.complete_own')
def update_step(task_id, step_id):
    user = get_current_user()
    task = PlatformTask.query.get_or_404(task_id)
    if not _visible_to(task, user) or task.status in ('approved', 'cancelled'):
        return jsonify({'error': 'Задача недоступна'}), 403
    step = TaskStepResult.query.filter_by(id=step_id, task_id=task.id).first_or_404()
    data = request.get_json(silent=True) or {}
    if 'done' in data:
        step.is_done = bool(data['done'])
        step.completed_at = utcnow() if step.is_done else None
    if 'comment' in data:
        step.comment = str(data['comment']).strip() or None
    if 'evidence_url' in data:
        step.evidence_url = str(data['evidence_url']).strip() or None
    task.status = 'in_progress' if any(s.is_done for s in task.step_results) else 'active'
    task.version += 1
    audit(user, 'task.step_updated', 'task', task.id, task.store_id, {'step_id': step.id})
    db.session.commit()
    return jsonify({'task': task.to_dict()})


@tasks_bp.post('/<int:task_id>/complete')
@permission_required('tasks.complete_own')
def complete_task(task_id):
    user = get_current_user()
    task = PlatformTask.query.get_or_404(task_id)
    if not _visible_to(task, user):
        return jsonify({'error': 'Задача недоступна'}), 403
    if task.status in ('approved', 'cancelled'):
        return jsonify({'error': 'Задачу нельзя изменить в текущем состоянии'}), 409
    if task.step_results and any(not step.is_done for step in task.step_results):
        return jsonify({'error': 'Сначала выполните все пункты чек-листа'}), 409
    task.status = 'completed'
    task.completed_at = utcnow()
    task.version += 1
    audit(user, 'task.completed', 'task', task.id, task.store_id)
    db.session.commit()
    return jsonify({'task': task.to_dict()})


@tasks_bp.post('/<int:task_id>/reopen')
@permission_required('tasks.complete_own')
def reopen_task(task_id):
    user = get_current_user()
    task = PlatformTask.query.get_or_404(task_id)
    if not _visible_to(task, user) or task.status != 'completed':
        return jsonify({'error': 'Задачу нельзя переоткрыть'}), 409
    task.status = 'in_progress' if task.step_results else 'active'
    task.completed_at = None
    task.version += 1
    audit(user, 'task.reopened', 'task', task.id, task.store_id)
    db.session.commit()
    return jsonify({'task': task.to_dict()})


@tasks_bp.post('/manager/templates')
@permission_required('tasks.manage')
def create_template():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    title = str(data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Название обязательно'}), 400
    store_id = data.get('store_id')
    if store_id and not can_access_store(user, int(store_id), 'tasks.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    template = TaskTemplate(title=title, description=data.get('description'),
                            task_type=data.get('task_type', 'operation'), store_id=store_id,
                            created_by_id=user.id)
    db.session.add(template)
    db.session.flush()
    for position, value in enumerate(data.get('steps') or []):
        title_value = value.get('title') if isinstance(value, dict) else value
        db.session.add(TaskTemplateStep(template_id=template.id, title=str(title_value).strip(),
                                        position=position,
                                        evidence_required=bool(value.get('evidence_required'))
                                        if isinstance(value, dict) else False))
    audit(user, 'task_template.created', 'task_template', template.id, store_id)
    db.session.commit()
    return jsonify({'template': {'id': template.id, 'title': template.title}}), 201


@tasks_bp.post('/manager')
@permission_required('tasks.manage')
def create_task():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    title = str(data.get('title') or '').strip()
    try:
        store_id = int(data['store_id'])
        due_at = parse_datetime(data.get('due_at'), 'due_at')
    except (KeyError, TypeError, ValueError) as exc:
        return jsonify({'error': str(exc)}), 400
    if not title or not can_access_store(user, store_id, 'tasks.manage'):
        return jsonify({'error': 'Название обязательно или точка недоступна'}), 403
    assignee_id = data.get('assignee_id')
    assignee = User.query.get(assignee_id) if assignee_id else None
    if assignee_id and (not assignee or not can_access_store(assignee, store_id)):
        return jsonify({'error': 'Исполнитель недоступен для этой точки'}), 400
    template = TaskTemplate.query.get(data.get('template_id')) if data.get('template_id') else None
    item = PlatformTask(template_id=template.id if template else None, title=title,
                        description=data.get('description'), task_type=data.get('task_type', 'operation'),
                        store_id=store_id, assignee_id=assignee_id, shift_id=data.get('shift_id'),
                        due_at=due_at, created_by_id=user.id)
    db.session.add(item)
    db.session.flush()
    raw_steps = data.get('steps')
    if raw_steps is None and template:
        raw_steps = [{'title': step.title, 'template_step_id': step.id}
                     for step in template.steps]
    for position, value in enumerate(raw_steps or []):
        title_value = value.get('title') if isinstance(value, dict) else value
        db.session.add(TaskStepResult(task_id=item.id, title=str(title_value).strip(), position=position,
                                      template_step_id=value.get('template_step_id')
                                      if isinstance(value, dict) else None))
    if assignee_id:
        notify(assignee_id, 'task_assigned', 'Новая задача', body=item.title,
               entity_type='task', entity_id=item.id, action_url='/app/tasks', commit=False)
    audit(user, 'task.created', 'task', item.id, store_id, {'assignee_id': assignee_id})
    db.session.commit()
    return jsonify({'task': item.to_dict()}), 201


@tasks_bp.patch('/manager/<int:task_id>')
@permission_required('tasks.manage')
def update_managed_task(task_id):
    manager = get_current_user()
    item = PlatformTask.query.get_or_404(task_id)
    if not can_access_store(manager, item.store_id, 'tasks.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    if item.status in ('approved', 'cancelled', 'completed'):
        return jsonify({'error': 'Задачу нельзя редактировать в текущем состоянии'}), 409
    data = request.get_json(silent=True) or {}
    try:
        expected_version(data, item.version)
        due_at = parse_datetime(data.get('due_at'), 'due_at') if 'due_at' in data else item.due_at
    except (ValueError, RuntimeError) as exc:
        return jsonify({'error': str(exc)}), 409 if isinstance(exc, RuntimeError) else 400
    title = str(data.get('title', item.title) or '').strip()
    if not title:
        return jsonify({'error': 'Название обязательно'}), 400
    assignee_id = data.get('assignee_id', item.assignee_id)
    assignee = User.query.get(assignee_id) if assignee_id else None
    if assignee_id and (not assignee or not can_access_store(assignee, item.store_id)):
        return jsonify({'error': 'Исполнитель недоступен для этой точки'}), 400
    previous_assignee_id = item.assignee_id
    item.title = title
    item.description = data.get('description', item.description)
    item.task_type = data.get('task_type', item.task_type)
    item.assignee_id = assignee_id
    item.due_at = due_at
    if 'steps' in data:
        if any(step.is_done for step in item.step_results):
            return jsonify({'error': 'Нельзя менять чек-лист после начала выполнения'}), 409
        item.step_results.clear()
        for position, value in enumerate(data.get('steps') or []):
            title_value = value.get('title') if isinstance(value, dict) else value
            title_value = str(title_value or '').strip()
            if title_value:
                item.step_results.append(TaskStepResult(title=title_value, position=position))
    item.version += 1
    if item.assignee_id:
        notify(item.assignee_id, 'task_updated',
               'Задача назначена' if item.assignee_id != previous_assignee_id else 'Задача изменена',
               body=item.title, entity_type='task', entity_id=item.id,
               action_url='/app/tasks', commit=False)
    audit(manager, 'task.updated', 'task', item.id, item.store_id,
          {'previous_assignee_id': previous_assignee_id, 'assignee_id': item.assignee_id})
    db.session.commit()
    return jsonify({'task': item.to_dict()})


@tasks_bp.delete('/manager/<int:task_id>')
@permission_required('tasks.manage')
def cancel_managed_task(task_id):
    manager = get_current_user()
    item = PlatformTask.query.get_or_404(task_id)
    if not can_access_store(manager, item.store_id, 'tasks.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    try:
        expected_version(data, item.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    if item.status in ('approved', 'cancelled'):
        return jsonify({'error': 'Задачу нельзя удалить в текущем состоянии'}), 409
    reason = str(data.get('reason') or '').strip()
    item.status = 'cancelled'
    item.version += 1
    if item.assignee_id:
        notify(item.assignee_id, 'task_cancelled', 'Задача отменена',
               body=reason or item.title, entity_type='task', entity_id=item.id,
               action_url='/app/tasks', commit=False)
    audit(manager, 'task.cancelled', 'task', item.id, item.store_id, {'reason': reason})
    db.session.commit()
    return jsonify({'task': item.to_dict()})


@tasks_bp.get('/manager')
@permission_required('tasks.manage')
def manager_tasks():
    user = get_current_user()
    items = [item for item in PlatformTask.query.order_by(PlatformTask.due_at.asc()).all()
             if can_access_store(user, item.store_id, 'tasks.manage')]
    return jsonify({'tasks': [item.to_dict() for item in items]})


@tasks_bp.post('/manager/<int:task_id>/review')
@permission_required('tasks.manage')
def review_task(task_id):
    user = get_current_user()
    item = PlatformTask.query.get_or_404(task_id)
    if not can_access_store(user, item.store_id, 'tasks.manage'):
        return jsonify({'error': 'Нет доступа к точке'}), 403
    data = request.get_json(silent=True) or {}
    try:
        expected_version(data, item.version)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 409
    decision = data.get('decision')
    if item.status != 'completed' or decision not in ('approved', 'rejected'):
        return jsonify({'error': 'Недопустимое решение или состояние задачи'}), 409
    item.status = 'approved' if decision == 'approved' else 'in_progress'
    item.reviewed_by_id = user.id
    item.reviewed_at = utcnow()
    item.version += 1
    if item.assignee_id:
        notify(item.assignee_id, 'task_reviewed', 'Задача проверена',
               body='Принята' if decision == 'approved' else 'Возвращена на доработку',
               entity_type='task', entity_id=item.id, action_url='/app/tasks', commit=False)
    audit(user, f'task.{decision}', 'task', item.id, item.store_id)
    db.session.commit()
    return jsonify({'task': item.to_dict()})
