"""Feature-flag evaluation with user > role > store > default precedence."""

from platform_models import FeatureFlag, FeatureFlagTarget


DEFAULT_FLAGS = {
    'staff_platform': True,
    'shifts': True,
    'time_tracking': True,
    'tasks': True,
    'support_cases': True,
    'news': True,
    'income': False,
    'hr_services': False,
}


def flags_for_user(user):
    flags = dict(DEFAULT_FLAGS)
    models = FeatureFlag.query.all()
    if not models:
        return flags

    from services.permissions import scoped_store_ids
    allowed_stores = scoped_store_ids(user)
    user_store_ids = ({str(store_id) for store_id in allowed_stores}
                      if allowed_stores is not None else set())
    for flag in models:
        value = flag.enabled_by_default
        targets = FeatureFlagTarget.query.filter_by(flag_id=flag.id).all()
        store_targets = [t for t in targets if t.target_type == 'store' and t.target_value in user_store_ids]
        role_targets = [t for t in targets if t.target_type == 'role' and t.target_value == user.role]
        user_targets = [t for t in targets if t.target_type == 'user' and t.target_value == str(user.id)]
        for matches in (store_targets, role_targets, user_targets):
            if matches:
                value = matches[-1].enabled
        flags[flag.key] = value
    return flags


def feature_enabled_for_user(user, key):
    """Return the effective value for a feature, including platform shutdown."""
    flags = flags_for_user(user)
    if key != 'staff_platform' and not flags.get('staff_platform', False):
        return False
    return bool(flags.get(key, False))
