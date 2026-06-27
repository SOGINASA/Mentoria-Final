import { useCallback, useEffect, useState } from 'react';
import Tabs from '../../components/ui/Tabs';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import BottomSheet from '../../components/ui/BottomSheet';
import { useI18n } from '../../i18n/useI18n';
import { useUiStore } from '../../store/uiStore';
import * as adminApi from '../../api/admin.api';
import { getStores, getEmployees } from '../../api/stores.api';
import { listUsers } from '../../api/admin.api';
import { initials } from '../../utils/format';
import { ROLE_SENDER, ROLE_REVIEWER, ROLE_ADMIN } from '../../constants/roles';

const ROLE_BADGE = {
  [ROLE_ADMIN]: { bg: 'var(--orange-tint)', fg: 'var(--orange)' },
  [ROLE_REVIEWER]: { bg: 'var(--green-tint)', fg: 'var(--green)' },
  [ROLE_SENDER]: { bg: 'var(--surface2)', fg: 'var(--muted)' },
};

export default function AdminPage() {
  const { t } = useI18n();
  const showToast = useUiStore((s) => s.showToast);

  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(null); // { mode, entity }

  const roleLabel = (r) => (r === ROLE_REVIEWER ? t.role_reviewer : r === ROLE_ADMIN ? t.role_admin : t.role_sender);

  const loadStores = useCallback(async () => {
    const d = await getStores();
    setStores(d.stores || []);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'users') setUsers((await listUsers()).users || []);
      if (tab === 'stores') setStores((await getStores()).stores || []);
      if (tab === 'employees') setEmployees((await getEmployees()).employees || []);
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
  }, [loadStores]);

  async function onDeactivate(kind, id) {
    if (!window.confirm(t.admin_deactivate_q)) return;
    try {
      if (kind === 'users') await adminApi.deactivateUser(id);
      if (kind === 'stores') await adminApi.deactivateStore(id);
      if (kind === 'employees') await adminApi.deactivateEmployee(id);
      showToast(t.admin_inactive);
      reload();
    } catch (e) {
      showToast(e.message || t.error_toast);
    }
  }

  const tabs = [
    { key: 'users', label: t.admin_users },
    { key: 'stores', label: t.admin_stores },
    { key: 'employees', label: t.admin_employees },
  ];

  const addLabel = tab === 'users' ? t.admin_add_user : tab === 'stores' ? t.admin_add_store : t.admin_add_emp;
  const count = tab === 'users' ? users.length : tab === 'stores' ? stores.length : employees.length;
  const countWord = tab === 'users' ? t.cnt_users : tab === 'stores' ? t.cnt_stores : t.cnt_emps;

  return (
    <div className="p-5 max-w-[1080px] mx-auto">
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

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {loading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : count === 0 ? (
        <EmptyState
          icon={tab === 'users' ? 'users' : tab === 'stores' ? 'store' : 'user'}
          title={tab === 'users' ? t.empty_users : tab === 'stores' ? t.empty_stores : t.empty_emps}
        />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
          {tab === 'users' &&
            users.map((u) => (
              <Row
                key={u.id}
                active={u.is_active}
                avatar={initials(u.full_name)}
                title={u.full_name}
                sub={`@${u.username}${u.store?.name ? ` · ${u.store.name}` : ''}`}
                badge={{ label: roleLabel(u.role), ...ROLE_BADGE[u.role] }}
                onEdit={() => setSheet({ mode: 'edit', entity: u })}
                onDeactivate={u.is_active ? () => onDeactivate('users', u.id) : null}
              />
            ))}
          {tab === 'stores' &&
            stores.map((s) => (
              <Row
                key={s.id}
                active={s.is_active}
                icon="store"
                title={s.name}
                sub={s.address || s.iiko_store_id || '—'}
                onEdit={() => setSheet({ mode: 'edit', entity: s })}
                onDeactivate={() => onDeactivate('stores', s.id)}
              />
            ))}
          {tab === 'employees' &&
            employees.map((e) => (
              <Row
                key={e.id}
                active={e.is_active}
                avatar={initials(e.full_name)}
                title={e.full_name}
                sub={[e.position, stores.find((s) => s.id === e.store_id)?.name].filter(Boolean).join(' · ') || '—'}
                onEdit={() => setSheet({ mode: 'edit', entity: e })}
                onDeactivate={() => onDeactivate('employees', e.id)}
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
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            reload();
          }}
        />
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
        <button onClick={onEdit} className="w-9 h-9 grid place-items-center rounded-lg border border-line bg-surface text-muted cursor-pointer hover:text-green hover:border-green transition" aria-label="edit">
          <Icon name="edit" size={17} />
        </button>
        {onDeactivate && (
          <button onClick={onDeactivate} className="w-9 h-9 grid place-items-center rounded-lg border border-line bg-surface text-muted cursor-pointer hover:text-red hover:border-red transition" aria-label="deactivate">
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Форма создания/редактирования ----------
function AdminForm({ tab, mode, entity, stores, onClose, onSaved }) {
  const { t } = useI18n();
  const showToast = useUiStore((s) => s.showToast);
  const isEdit = mode === 'edit';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(() => {
    if (tab === 'users')
      return {
        full_name: entity?.full_name || '',
        username: entity?.username || '',
        password: '',
        role: entity?.role || ROLE_SENDER,
        store_id: entity?.store_id || '',
        email: entity?.email || '',
        phone: entity?.phone || '',
        is_active: entity ? entity.is_active : true,
      };
    if (tab === 'stores')
      return {
        name: entity?.name || '',
        address: entity?.address || '',
        iiko_store_id: entity?.iiko_store_id || '',
      };
    return {
      full_name: entity?.full_name || '',
      position: entity?.position || '',
      store_id: entity?.store_id || '',
      iiko_employee_id: entity?.iiko_employee_id || '',
    };
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const storeId = form.store_id === '' ? null : Number(form.store_id);
      if (tab === 'users') {
        const payload = {
          full_name: form.full_name,
          role: form.role,
          store_id: storeId,
          email: form.email || undefined,
          phone: form.phone || undefined,
          is_active: form.is_active,
        };
        if (form.password) payload.password = form.password;
        if (isEdit) await adminApi.updateUser(entity.id, payload);
        else await adminApi.createUser({ ...payload, username: form.username, password: form.password });
      } else if (tab === 'stores') {
        const payload = { name: form.name, address: form.address, iiko_store_id: form.iiko_store_id };
        if (isEdit) await adminApi.updateStore(entity.id, payload);
        else await adminApi.createStore(payload);
      } else {
        const payload = {
          full_name: form.full_name,
          position: form.position,
          store_id: storeId,
          iiko_employee_id: form.iiko_employee_id,
        };
        if (isEdit) await adminApi.updateEmployee(entity.id, payload);
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

  const storeOptions = (
    <Select label={tab === 'users' ? t.f_store_opt : t.f_store_opt} value={form.store_id} onChange={set('store_id')}>
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
            <Field label={t.f_fullname} value={form.full_name} onChange={set('full_name')} />
            {!isEdit && <Field label={t.f_username} value={form.username} onChange={set('username')} />}
            <Field
              label={t.f_password}
              type="password"
              value={form.password}
              onChange={set('password')}
              hint={isEdit ? t.password_keep : undefined}
            />
            <Select label={t.f_role} value={form.role} onChange={set('role')}>
              <option value={ROLE_SENDER}>{t.role_sender}</option>
              <option value={ROLE_REVIEWER}>{t.role_reviewer}</option>
              <option value={ROLE_ADMIN}>{t.role_admin}</option>
            </Select>
            {storeOptions}
            <Field label={t.f_email} value={form.email} onChange={set('email')} />
            <Field label={t.f_phone} value={form.phone} onChange={set('phone')} />
            {isEdit && (
              <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-[var(--green)]" />
                <span className="text-sm text-text">{t.admin_active}</span>
              </label>
            )}
          </>
        )}

        {tab === 'stores' && (
          <>
            <Field label={t.f_name} value={form.name} onChange={set('name')} />
            <Field label={t.f_address} value={form.address} onChange={set('address')} />
            <Field label={t.f_iiko_store} value={form.iiko_store_id} onChange={set('iiko_store_id')} />
          </>
        )}

        {tab === 'employees' && (
          <>
            <Field label={t.f_fullname} value={form.full_name} onChange={set('full_name')} />
            <Field label={t.f_position} value={form.position} onChange={set('position')} />
            {storeOptions}
            <Field label={t.f_iiko_emp} value={form.iiko_employee_id} onChange={set('iiko_employee_id')} />
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

function Field({ label, value, onChange, type = 'text', hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="h-12 bg-surface border-[1.5px] border-line rounded-xl px-3.5 outline-none text-[15px] text-text focus:border-green transition-colors"
      />
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
    </label>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-text">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="h-12 bg-surface border-[1.5px] border-line rounded-xl px-3 outline-none text-[15px] text-text focus:border-green transition-colors cursor-pointer"
      >
        {children}
      </select>
    </label>
  );
}
