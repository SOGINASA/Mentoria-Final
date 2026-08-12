import { useCallback, useEffect, useState } from 'react';
import Tabs from '../../components/ui/Tabs';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import BottomSheet from '../../components/ui/BottomSheet';
import { useI18n } from '../../i18n/useI18n';
import { useUiStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import * as adminApi from '../../api/admin.api';
import { listUsers, listStores, listEmployees } from '../../api/admin.api';
import { initials } from '../../utils/format';
import {
  ROLE_SENDER, ROLE_MANAGER, ROLE_REVIEWER, ROLE_HR, ROLE_FINANCE,
  ROLE_OPERATIONS, ROLE_ADMIN,
} from '../../constants/roles';
import AdminAnalytics from './AdminAnalytics';
import AdminOverview from './AdminOverview';
import FeatureFlagsPanel from './FeatureFlagsPanel';
import AuditPanel from './AuditPanel';

const ROLE_BADGE = {
  [ROLE_ADMIN]: { bg: 'var(--orange-tint)', fg: 'var(--orange)' },
  [ROLE_REVIEWER]: { bg: 'var(--green-tint)', fg: 'var(--green)' },
  [ROLE_SENDER]: { bg: 'var(--surface2)', fg: 'var(--muted)' },
  [ROLE_MANAGER]: { bg: 'var(--green-tint)', fg: 'var(--green)' },
  [ROLE_HR]: { bg: 'var(--surface2)', fg: 'var(--text)' },
  [ROLE_FINANCE]: { bg: 'var(--orange-tint)', fg: 'var(--orange)' },
  [ROLE_OPERATIONS]: { bg: 'var(--green-tint)', fg: 'var(--green)' },
};

export default function AdminPage() {
  const { t } = useI18n();
  const showToast = useUiStore((s) => s.showToast);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [tab, setTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState(null); // { mode, entity }
  const [pendingDeactivate, setPendingDeactivate] = useState(null);

  const roleLabel = (r) => ({
    [ROLE_SENDER]: t.role_sender, [ROLE_MANAGER]: 'Менеджер',
    [ROLE_REVIEWER]: t.role_reviewer, [ROLE_HR]: 'HR',
    [ROLE_FINANCE]: 'Финансы', [ROLE_OPERATIONS]: 'Операции',
    [ROLE_ADMIN]: t.role_admin,
  }[r] || r);

  const loadStores = useCallback(async () => {
    const d = await listStores();
    setStores(d.stores || []);
  }, []);
  const loadEmployees = useCallback(async () => {
    const d = await listEmployees();
    setEmployees(d.employees || []);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'users') setUsers((await listUsers()).users || []);
      if (tab === 'stores') setStores((await listStores()).stores || []);
      if (tab === 'employees') setEmployees((await listEmployees()).employees || []);
    } catch (e) {
      showToast(e.message || t.error_toast);
    } finally {
      setLoading(false);
    }
  }, [tab, showToast, t.error_toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  // справочник точек нужен в формах пользователей/сотрудников
  useEffect(() => {
    loadStores();
    loadEmployees();
  }, [loadStores, loadEmployees]);

  async function onDeactivate(kind, id) {
    setPendingDeactivate({ kind, id });
  }

  async function confirmDeactivate() {
    const { kind, id } = pendingDeactivate;
    try {
      if (kind === 'users') await adminApi.deactivateUser(id);
      if (kind === 'stores') await adminApi.deactivateStore(id);
      if (kind === 'employees') await adminApi.deactivateEmployee(id);
      showToast(t.admin_inactive);
      setPendingDeactivate(null);
      reload();
    } catch (e) {
      showToast(e.message || t.error_toast);
    }
  }

  const tabs = [
    { key: 'overview', label: 'Обзор системы' },
    { key: 'users', label: 'Аккаунты и роли' },
    { key: 'stores', label: t.admin_stores },
    { key: 'employees', label: 'Справочник iiko' },
    { key: 'flags', label: 'Доступность функций' },
    { key: 'audit', label: 'Журнал действий' },
    { key: 'analytics', label: 'Аналитика списаний' },
  ];

  const addLabel = tab === 'users' ? t.admin_add_user : tab === 'stores' ? t.admin_add_store : t.admin_add_emp;
  const count = tab === 'users' ? users.length : tab === 'stores' ? stores.length : employees.length;
  const countWord = tab === 'users' ? t.cnt_users : tab === 'stores' ? t.cnt_stores : t.cnt_emps;
  const isDirectoryTab = ['users', 'stores', 'employees'].includes(tab);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((item) => [item.full_name, item.username, item.store?.name, roleLabel(item.role)].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)));
  const filteredStores = stores.filter((item) => [item.name, item.address, item.iiko_store_id].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)));
  const filteredEmployees = employees.filter((item) => [item.full_name, item.position, stores.find((store) => store.id === item.store_id)?.name].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)));

  return (
    <div className="p-5 max-w-[1080px] mx-auto">
      {isDirectoryTab && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="text-[13.5px] text-muted">
            {count} {countWord}
          </div>
          <button
            onClick={() => setSheet({ mode: 'create' })}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-green text-white font-semibold text-[13.5px] cursor-pointer hover:brightness-110 transition"
          >
            <Icon name="plus" size={18} strokeWidth={2.4} />
            {addLabel}
          </button>
        </div>
      )}

      <Tabs items={tabs} value={tab} onChange={(value) => { setTab(value); setSearch(''); }} />

      {isDirectoryTab && count > 0 && (
        <label className="relative mb-4 block max-w-[440px]">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'users' ? 'Найти аккаунт, роль или точку' : tab === 'stores' ? 'Найти торговую точку' : 'Найти сотрудника'} className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-text outline-none transition-colors focus:border-green" />
        </label>
      )}

      {tab === 'users' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-green bg-green-tint p-4">
          <Icon name="shieldCheck" size={20} className="mt-0.5 flex-none text-green" />
          <div>
            <div className="text-[13px] font-bold text-text">Здесь создаются аккаунты для входа</div>
            <div className="mt-1 text-[12px] leading-relaxed text-muted">Укажите логин, временный пароль, роль и торговую точку. Для менеджера точка обязательна.</div>
          </div>
        </div>
      )}
      {tab === 'employees' && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-orange bg-orange-tint p-4 sm:flex-row sm:items-center">
          <Icon name="info" size={20} className="flex-none text-orange" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-text">Это справочник сотрудников iiko, а не аккаунты</div>
            <div className="mt-1 text-[12px] leading-relaxed text-muted">Такая запись используется в списаниях и не может войти в Staff Platform.</div>
          </div>
          <button type="button" onClick={() => setTab('users')} className="min-h-11 flex-none rounded-xl border border-orange bg-surface px-4 text-[12px] font-bold text-orange transition-colors hover:bg-orange-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange">Создать аккаунт</button>
        </div>
      )}

      {tab === 'overview' ? (
        <AdminOverview onNavigate={setTab} />
      ) : tab === 'flags' ? (
        <FeatureFlagsPanel />
      ) : tab === 'audit' ? (
        <AuditPanel />
      ) : tab === 'analytics' ? (
        <AdminAnalytics />
      ) : loading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : count === 0 || (normalizedSearch && ((tab === 'users' && filteredUsers.length === 0) || (tab === 'stores' && filteredStores.length === 0) || (tab === 'employees' && filteredEmployees.length === 0))) ? (
        <EmptyState
          icon={tab === 'users' ? 'users' : tab === 'stores' ? 'store' : 'user'}
          title={normalizedSearch ? 'Ничего не найдено' : tab === 'users' ? t.empty_users : tab === 'stores' ? t.empty_stores : t.empty_emps}
        />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
          {tab === 'users' &&
            filteredUsers.map((u) => (
              <Row
                key={u.id}
                active={u.is_active}
                avatar={initials(u.full_name)}
                title={u.full_name}
                sub={`@${u.username}${u.store?.name ? ` · ${u.store.name}` : ''}`}
                badge={{ label: roleLabel(u.role), ...ROLE_BADGE[u.role] }}
                onEdit={() => setSheet({ mode: 'edit', entity: u })}
                onDeactivate={u.is_active && u.id !== currentUserId ? () => onDeactivate('users', u.id) : null}
              />
            ))}
          {tab === 'stores' &&
            filteredStores.map((s) => (
              <Row
                key={s.id}
                active={s.is_active}
                icon="store"
                title={s.name}
                sub={s.address || s.iiko_store_id || '—'}
                onEdit={() => setSheet({ mode: 'edit', entity: s })}
                onDeactivate={s.is_active ? () => onDeactivate('stores', s.id) : null}
              />
            ))}
          {tab === 'employees' &&
            filteredEmployees.map((e) => (
              <Row
                key={e.id}
                active={e.is_active}
                avatar={initials(e.full_name)}
                title={e.full_name}
                sub={[e.position, stores.find((s) => s.id === e.store_id)?.name].filter(Boolean).join(' · ') || '—'}
                onEdit={() => setSheet({ mode: 'edit', entity: e })}
                onDeactivate={e.is_active ? () => onDeactivate('employees', e.id) : null}
              />
            ))}
        </div>
      )}

      {sheet && (
        <AdminForm
          tab={tab}
          mode={sheet.mode}
          entity={sheet.entity}
          stores={stores}
          employees={employees}
          currentUserId={currentUserId}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            reload();
          }}
        />
      )}
      {pendingDeactivate && (
        <BottomSheet open onClose={() => setPendingDeactivate(null)}>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-tint text-orange"><Icon name="alertTriangle" size={23} /></div>
          <h3 className="mt-4 text-center font-head text-[21px] font-semibold text-text">Отключить запись?</h3>
          <p className="mt-2 text-center text-[12.5px] leading-relaxed text-muted">Запись останется в истории и её можно будет снова активировать через редактирование.</p>
          <div className="mt-5 flex gap-3"><button type="button" onClick={() => setPendingDeactivate(null)} className="h-12 flex-1 rounded-xl border border-line bg-surface text-sm font-bold text-text">Отмена</button><button type="button" onClick={confirmDeactivate} className="h-12 flex-[1.2] rounded-xl bg-orange text-sm font-bold text-white">Отключить</button></div>
        </BottomSheet>
      )}
    </div>
  );
}

function Row({ active, avatar, icon, title, sub, badge, onEdit, onDeactivate }) {
  return (
    <div
      className="flex items-center gap-3.5 bg-surface border border-line rounded-2xl p-3 shadow-card-sm"
      style={{ opacity: active ? 1 : 0.55 }}
    >
      <div className="w-11 h-11 flex-none rounded-full bg-surface2 text-text grid place-items-center font-head font-semibold text-sm">
        {icon ? <Icon name={icon} size={20} className="text-green" /> : avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[14.5px] text-text truncate">{title}</div>
        <div className="text-[12.5px] text-muted truncate mt-0.5">{sub}</div>
      </div>
      {badge && (
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.fg }}>
          {badge.label}
        </span>
      )}
      <div className="flex gap-1.5">
        <button onClick={onEdit} className="w-11 h-11 grid place-items-center rounded-xl border border-line bg-surface text-muted cursor-pointer hover:text-green hover:border-green transition" aria-label="Редактировать">
          <Icon name="edit" size={17} />
        </button>
        {onDeactivate && (
          <button onClick={onDeactivate} className="w-11 h-11 grid place-items-center rounded-xl border border-line bg-surface text-muted cursor-pointer hover:text-red hover:border-red transition" aria-label="Деактивировать">
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Форма создания/редактирования ----------
function AdminForm({ tab, mode, entity, stores, employees, currentUserId, onClose, onSaved }) {
  const { t } = useI18n();
  const showToast = useUiStore((s) => s.showToast);
  const isEdit = mode === 'edit';
  const isCurrentAdmin = tab === 'users' && isEdit
    && entity?.id === currentUserId && entity?.role === ROLE_ADMIN;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState(() => {
    if (tab === 'users')
      return {
        full_name: entity?.full_name || '',
        username: entity?.username || '',
        password: '',
        role: entity?.role || ROLE_SENDER,
        store_id: entity?.store_id || '',
        employee_id: entity?.employee_id || '',
        email: entity?.email || '',
        phone: entity?.phone || '',
        supervised_store_ids: entity?.supervised_store_ids || [],
        scope_store_ids: entity?.store_scopes?.map((item) => item.store_id) || entity?.supervised_store_ids || [],
        is_active: entity ? entity.is_active : true,
      };
    if (tab === 'stores')
      return {
        name: entity?.name || '',
        address: entity?.address || '',
        iiko_store_id: entity?.iiko_store_id || '',
        is_active: entity ? entity.is_active : true,
      };
    return {
      full_name: entity?.full_name || '',
      position: entity?.position || '',
      store_id: entity?.store_id || '',
      iiko_employee_id: entity?.iiko_employee_id || '',
      is_active: entity ? entity.is_active : true,
    };
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFieldErrors((current) => ({ ...current, [k]: null }));
  };

  function validateUser() {
    const errors = {};
    if (!form.full_name.trim()) errors.full_name = 'Укажите ФИО';
    if (!isEdit && !/^[A-Za-z0-9._-]{3,30}$/.test(form.username.trim())) errors.username = '3–30 символов: латиница, цифры, точка, _ или -';
    if (!isEdit && form.password.length < 6) errors.password = 'Минимум 6 символов';
    if (isEdit && form.password && form.password.length < 6) errors.password = 'Минимум 6 символов';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Укажите корректный email';
    if ([ROLE_SENDER, ROLE_MANAGER].includes(form.role) && !form.store_id) errors.store_id = 'Для сотрудника и менеджера выберите торговую точку';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const storeId = form.store_id === '' ? null : Number(form.store_id);
      if (tab === 'users') {
        if (!validateUser()) {
          setSaving(false);
          return;
        }
        const payload = {
          full_name: form.full_name,
          role: form.role,
          store_id: storeId,
          employee_id: form.role === ROLE_SENDER && form.employee_id !== '' ? Number(form.employee_id) : null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          supervised_store_ids: form.role === ROLE_REVIEWER ? form.scope_store_ids : [],
          is_active: form.is_active,
        };
        if (form.password) payload.password = form.password;
        const result = isEdit
          ? await adminApi.updateUser(entity.id, payload)
          : await adminApi.createUser({ ...payload, username: form.username, password: form.password });
        const scopeByRole = { [ROLE_SENDER]: 'employee', [ROLE_MANAGER]: 'manager', [ROLE_REVIEWER]: 'supervisor' };
        const scope = scopeByRole[form.role];
        const scopeStoreIds = [...new Set([
          ...form.scope_store_ids,
          ...([ROLE_SENDER, ROLE_MANAGER].includes(form.role) && storeId ? [storeId] : []),
        ])];
        await adminApi.replaceUserScopes(result.user.id, scope ? scopeStoreIds.map((storeIdValue) => ({ store_id: storeIdValue, scope })) : []);
      } else if (tab === 'stores') {
        const payload = { name: form.name, address: form.address, iiko_store_id: form.iiko_store_id };
        if (isEdit) await adminApi.updateStore(entity.id, { ...payload, is_active: form.is_active });
        else await adminApi.createStore(payload);
      } else {
        const payload = {
          full_name: form.full_name,
          position: form.position,
          store_id: storeId,
          iiko_employee_id: form.iiko_employee_id,
        };
        if (isEdit) await adminApi.updateEmployee(entity.id, { ...payload, is_active: form.is_active });
        else await adminApi.createEmployee(payload);
      }
      showToast(t.save);
      onSaved();
    } catch (e) {
      setError(e.message || t.error_toast);
    } finally {
      setSaving(false);
    }
  }

  const title =
    tab === 'users'
      ? isEdit
        ? t.admin_edit_user
        : t.admin_add_user
      : tab === 'stores'
      ? isEdit
        ? t.admin_edit_store
        : t.admin_add_store
      : isEdit
      ? t.admin_edit_emp
      : t.admin_add_emp;

  const storeRequired = tab === 'users' && [ROLE_SENDER, ROLE_MANAGER].includes(form.role);
  const storeOptions = (
    <Select label={storeRequired ? 'Торговая точка *' : t.f_store_opt} value={form.store_id} onChange={set('store_id')} error={fieldErrors.store_id}>
      <option value="">{t.no_store}</option>
      {stores.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );

  return (
    <BottomSheet open onClose={onClose}>
      <h3 className="font-head font-semibold text-[20px] text-text m-0 mb-4">{title}</h3>
      {error && (
        <div className="text-[13px] font-medium rounded-xl px-3.5 py-2.5 mb-3" style={{ background: 'var(--red-tint)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 max-h-[60vh] overflow-auto pr-0.5">
        {tab === 'users' && (
          <>
            <div className="rounded-2xl bg-surface2 p-4 text-[12px] leading-relaxed text-muted"><strong className="text-text">Данные для входа.</strong> Передайте сотруднику логин и временный пароль безопасным способом. Пароль можно сменить позже.</div>
            <Field label={`${t.f_fullname} *`} value={form.full_name} onChange={set('full_name')} error={fieldErrors.full_name} autoComplete="name" />
            {!isEdit && <Field label={`${t.f_username} *`} value={form.username} onChange={set('username')} error={fieldErrors.username} hint="Например: manager.almaty01" autoComplete="off" />}
            <Field
              label={`${t.f_password}${isEdit ? '' : ' *'}`}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              error={fieldErrors.password}
              hint={isEdit ? t.password_keep : 'Минимум 6 символов. Это временный пароль для первого входа.'}
              autoComplete="new-password"
              action={<button type="button" onClick={() => setShowPassword((value) => !value)} className="min-h-11 rounded-xl px-3 text-[12px] font-bold text-green hover:bg-green-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">{showPassword ? 'Скрыть' : 'Показать'}</button>}
            />
            <RoleChips value={form.role} onChange={(r) => setForm((f) => ({ ...f, role: r }))} t={t} disabled={isCurrentAdmin} />
            {storeOptions}
            {form.role === ROLE_SENDER && (
              <Select label={t.f_self_employee} value={form.employee_id} onChange={set('employee_id')}>
                <option value="">{t.no_employee_link}</option>
                {employees.filter((e) => !form.store_id || e.store_id === Number(form.store_id)).map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </Select>
            )}
            {[ROLE_SENDER, ROLE_MANAGER, ROLE_REVIEWER].includes(form.role) && (
              <StoreScopePicker
                stores={stores}
                value={form.scope_store_ids}
                primaryStoreId={form.store_id ? Number(form.store_id) : null}
                role={form.role}
                onChange={(scopeStoreIds) => setForm((current) => ({ ...current, scope_store_ids: scopeStoreIds }))}
              />
            )}
            <Field label={t.f_email} value={form.email} onChange={set('email')} error={fieldErrors.email} />
            <Field label={t.f_phone} value={form.phone} onChange={set('phone')} />
            {isEdit && <ActiveToggle label={t.admin_active} checked={form.is_active} disabled={isCurrentAdmin} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />}
          </>
        )}

        {tab === 'stores' && (
          <>
            <Field label={t.f_name} value={form.name} onChange={set('name')} />
            <Field label={t.f_address} value={form.address} onChange={set('address')} />
            <Field label={t.f_iiko_store} value={form.iiko_store_id} onChange={set('iiko_store_id')} />
            {isEdit && <ActiveToggle label={t.admin_active} checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />}
          </>
        )}

        {tab === 'employees' && (
          <>
            <Field label={t.f_fullname} value={form.full_name} onChange={set('full_name')} />
            <Field label={t.f_position} value={form.position} onChange={set('position')} />
            {storeOptions}
            <Field label={t.f_iiko_emp} value={form.iiko_employee_id} onChange={set('iiko_employee_id')} />
            {isEdit && <ActiveToggle label={t.admin_active} checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />}
          </>
        )}
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 h-[50px] rounded-xl border-[1.5px] border-line bg-surface text-text font-semibold text-[14.5px] cursor-pointer">
          {t.cancel}
        </button>
        <button onClick={save} disabled={saving} className="flex-[1.3] h-[50px] rounded-xl border-none bg-green text-white font-head font-semibold text-base cursor-pointer grid place-items-center">
          {saving ? <Spinner size={20} /> : isEdit ? t.save : t.create}
        </button>
      </div>
    </BottomSheet>
  );
}

function Field({ label, value, onChange, type = 'text', hint, error, action, ...props }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">{label}</span>
      <span className="flex gap-2">
        <input
          type={type}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className={`h-12 min-w-0 flex-1 bg-surface border-[1.5px] rounded-xl px-3.5 outline-none text-[15px] text-text focus:border-green transition-colors ${error ? 'border-red' : 'border-line'}`}
          {...props}
        />
        {action}
      </span>
      {(error || hint) && <span role={error ? 'alert' : undefined} className={`text-[11.5px] ${error ? 'text-red' : 'text-faint'}`}>{error || hint}</span>}
    </label>
  );
}

// Явный выбор роли пользователя — чипы (создание и редактирование).
function RoleChips({ value, onChange, t, disabled = false }) {
  const roles = [
    { key: ROLE_SENDER, label: t.role_sender },
    { key: ROLE_MANAGER, label: 'Менеджер' },
    { key: ROLE_REVIEWER, label: t.role_reviewer },
    { key: ROLE_HR, label: 'HR' },
    { key: ROLE_FINANCE, label: 'Финансы' },
    { key: ROLE_OPERATIONS, label: 'Операции' },
    { key: ROLE_ADMIN, label: t.role_admin },
  ];
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">{t.f_role}</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {roles.map((r) => {
          const active = value === r.key;
          const c = ROLE_BADGE[r.key];
          return (
            <button
              key={r.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(r.key)}
              className="h-10 rounded-xl border-[1.5px] font-semibold text-[12px] leading-tight px-1 cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: active ? c.bg : 'var(--surface)',
                color: active ? c.fg : 'var(--muted)',
                borderColor: active ? c.fg : 'var(--line)',
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </label>
  );
}

function ActiveToggle({ label, checked, onChange, disabled = false }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer mt-1">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[var(--green)]"
      />
      <span className="text-sm text-text">{label}</span>
    </label>
  );
}

function StoreScopePicker({ stores, value, primaryStoreId, role, onChange }) {
  const label = role === ROLE_REVIEWER ? 'Доступ к точкам платформы' : 'Дополнительный доступ к точкам';
  const available = stores.filter((store) => store.is_active && store.id !== primaryStoreId);
  return (
    <fieldset className="rounded-2xl border border-line p-3">
      <legend className="px-1 text-[12.5px] font-semibold text-text">{label}</legend>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">Основная точка доступна по роли автоматически. Здесь можно выдать доступ к другим точкам.</p>
      {available.length === 0 ? <div className="text-[12px] text-faint">Других активных точек нет</div> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((store) => {
            const selected = value.includes(store.id);
            return (
              <label key={store.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition-colors ${selected ? 'border-green bg-green-tint text-green' : 'border-line bg-surface text-text'}`}>
                <input type="checkbox" checked={selected} onChange={() => onChange(selected ? value.filter((id) => id !== store.id) : [...value, store.id])} className="h-4 w-4 accent-[var(--green)]" />
                <span className="truncate">{store.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function Select({ label, value, onChange, children, error }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">{label}</span>
      <select
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        className={`h-12 bg-surface border-[1.5px] rounded-xl px-3 outline-none text-[15px] text-text focus:border-green transition-colors cursor-pointer ${error ? 'border-red' : 'border-line'}`}
      >
        {children}
      </select>
      {error && <span role="alert" className="text-[11.5px] text-red">{error}</span>}
    </label>
  );
}
