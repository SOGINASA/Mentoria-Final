import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import BottomSheet from '../../components/ui/BottomSheet';
import { listFeatureFlags, listStores, listUsers, updateFeatureFlag } from '../../api/admin.api';
import { useUiStore } from '../../store/uiStore';

const FLAG_NAMES = {
  staff_platform: 'Платформа сотрудника', shifts: 'Смены', time_tracking: 'Учёт времени',
  tasks: 'Задачи', support_cases: 'Обращения', news: 'Новости', income: 'Доход', hr_services: 'HR-сервисы',
};

export default function FeatureFlagsPanel() {
  const showToast = useUiStore((state) => state.showToast);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [editor, setEditor] = useState(null);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [flagData, userData, storeData] = await Promise.all([listFeatureFlags(), listUsers(), listStores()]);
      setFlags(flagData.feature_flags || []);
      setUsers(userData.users || []);
      setStores(storeData.stores || []);
    }
    catch (error) { showToast(error.message || 'Не удалось загрузить функции'); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  async function toggle(flag) {
    setSavingKey(flag.key);
    try {
      const enabled = !flag.enabled_by_default;
      await updateFeatureFlag(flag.key, { enabled_by_default: enabled, description: flag.description, targets: flag.targets });
      setFlags((current) => current.map((item) => item.key === flag.key ? { ...item, enabled_by_default: enabled } : item));
      showToast(enabled ? 'Функция включена' : 'Функция выключена');
    } catch (error) { showToast(error.message || 'Не удалось изменить функцию'); }
    finally { setSavingKey(null); }
  }

  async function saveTargets() {
    setSavingKey(editor.key);
    try {
      const result = await updateFeatureFlag(editor.key, {
        enabled_by_default: editor.enabled_by_default,
        description: editor.description,
        targets: editor.targets,
      });
      setFlags((current) => current.map((item) => item.key === editor.key ? result.feature_flag : item));
      setEditor(null);
      showToast('Правила доступа сохранены');
    } catch (error) { showToast(error.message || 'Не удалось сохранить правила'); }
    finally { setSavingKey(null); }
  }

  if (loading) return <div className="grid place-items-center py-20"><Spinner /></div>;
  return (
    <div>
      <div className="mb-4 rounded-2xl border border-orange bg-orange-tint p-4 text-[12.5px] leading-relaxed text-text"><strong>Осторожно:</strong> глобальное выключение скрывает сервис у всех сотрудников, кроме явно настроенных исключений. Изменение применяется при следующем обновлении данных платформы.</div>
      <div className="grid gap-3 md:grid-cols-2">
        {flags.map((flag) => (
          <article key={flag.key} className="flex min-h-[142px] flex-col rounded-2xl border border-line bg-surface p-4 shadow-card-sm">
            <div className="flex items-start gap-3">
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${flag.enabled_by_default ? 'bg-green-tint text-green' : 'bg-surface2 text-muted'}`}><Icon name={flag.enabled_by_default ? 'checkCircle' : 'lock'} size={20} /></span>
              <div className="min-w-0 flex-1"><h3 className="text-[14px] font-bold text-text">{FLAG_NAMES[flag.key] || flag.key}</h3><p className="mt-1 text-[11.5px] leading-relaxed text-muted">{flag.description}</p></div>
              <button type="button" role="switch" aria-checked={flag.enabled_by_default} aria-label={`${FLAG_NAMES[flag.key] || flag.key}: ${flag.enabled_by_default ? 'включено' : 'выключено'}`} disabled={savingKey === flag.key} onClick={() => toggle(flag)} className={`relative h-11 w-[62px] flex-none rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green ${flag.enabled_by_default ? 'border-green bg-green' : 'border-line bg-surface2'}`}>
                <span className={`absolute top-[7px] h-7 w-7 rounded-full bg-white shadow transition-transform ${flag.enabled_by_default ? 'translate-x-[27px]' : 'translate-x-[6px]'}`} />
              </button>
            </div>
            <div className="mt-auto flex items-end justify-between gap-3 pt-3">
              <div className="text-[11px] text-faint">Ключ: <code>{flag.key}</code>{flag.targets.length ? ` · правил: ${flag.targets.length}` : ''}</div>
              <button type="button" onClick={() => setEditor({ ...flag, targets: flag.targets.map((target) => ({ ...target })) })} className="min-h-11 flex-none rounded-xl px-3 text-[11.5px] font-bold text-green transition hover:bg-green-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green">Исключения</button>
            </div>
          </article>
        ))}
      </div>
      {editor && <TargetEditor flag={editor} users={users} stores={stores} saving={savingKey === editor.key} onChange={setEditor} onClose={() => setEditor(null)} onSave={saveTargets} />}
    </div>
  );
}

const ROLE_OPTIONS = [
  ['sender', 'Сотрудник'], ['manager', 'Менеджер'], ['reviewer', 'Проверяющий'],
  ['hr', 'HR'], ['finance', 'Финансы'], ['operations', 'Операции'], ['admin', 'Администратор'],
];

function TargetEditor({ flag, users, stores, saving, onChange, onClose, onSave }) {
  function updateTarget(index, patch) {
    onChange({ ...flag, targets: flag.targets.map((target, targetIndex) => targetIndex === index ? { ...target, ...patch } : target) });
  }
  function changeType(index, targetType) {
    const firstValue = targetType === 'role' ? ROLE_OPTIONS[0][0] : targetType === 'store' ? String(stores[0]?.id || '') : String(users[0]?.id || '');
    updateTarget(index, { target_type: targetType, target_value: firstValue });
  }
  return (
    <BottomSheet open onClose={onClose}>
      <h3 className="font-head text-[20px] font-semibold text-text">Исключения: {FLAG_NAMES[flag.key] || flag.key}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">Правило пользователя имеет приоритет над ролью, а роль — над торговой точкой.</p>
      <div className="mt-4 max-h-[52vh] space-y-3 overflow-auto pr-0.5">
        {flag.targets.length === 0 && <div className="rounded-xl bg-surface2 p-4 text-center text-[12px] text-muted">Исключений пока нет. Функция работает по глобальному переключателю.</div>}
        {flag.targets.map((target, index) => (
          <div key={`${target.target_type}-${index}`} className="rounded-2xl border border-line p-3">
            <div className="grid grid-cols-[.8fr_1.2fr] gap-2">
              <select value={target.target_type} onChange={(event) => changeType(index, event.target.value)} className="h-11 min-w-0 rounded-xl border border-line bg-surface px-2 text-[12px] text-text outline-none focus:border-green"><option value="role">Роль</option><option value="store">Точка</option><option value="user">Аккаунт</option></select>
              <select value={target.target_value} onChange={(event) => updateTarget(index, { target_value: event.target.value })} className="h-11 min-w-0 rounded-xl border border-line bg-surface px-2 text-[12px] text-text outline-none focus:border-green">
                {target.target_type === 'role' && ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                {target.target_type === 'store' && stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                {target.target_type === 'user' && users.map((user) => <option key={user.id} value={user.id}>{user.full_name} · @{user.username}</option>)}
              </select>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[12px] font-semibold text-text"><input type="checkbox" checked={target.enabled} onChange={(event) => updateTarget(index, { enabled: event.target.checked })} className="h-4 w-4 accent-[var(--green)]" /> Доступ включён</label>
              <button type="button" onClick={() => onChange({ ...flag, targets: flag.targets.filter((_, targetIndex) => targetIndex !== index) })} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-red transition hover:border-red" aria-label="Удалить правило"><Icon name="trash" size={17} /></button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange({ ...flag, targets: [...flag.targets, { target_type: 'role', target_value: 'sender', enabled: true }] })} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-green bg-surface text-[12px] font-bold text-green hover:bg-green-tint"><Icon name="plus" size={17} /> Добавить правило</button>
      <div className="mt-4 flex gap-3"><button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-line bg-surface text-sm font-bold text-text">Отмена</button><button type="button" disabled={saving} onClick={onSave} className="grid h-12 flex-[1.25] place-items-center rounded-xl bg-green text-sm font-bold text-white disabled:opacity-60">{saving ? <Spinner size={19} /> : 'Сохранить'}</button></div>
    </BottomSheet>
  );
}
