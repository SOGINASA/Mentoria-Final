import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { useWriteOffStore } from '../../store/writeOffStore';
import { uploadPhoto } from '../../api/uploads.api';
import { TYPE_NO_DEDUCTION, TYPE_WITH_DEDUCTION, MIN_COMMENT_LENGTH, MAX_PHOTOS } from '../../constants/writeOffTypes';
import { initials } from '../../utils/format';

export default function CreateWriteOffPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const showToast = useUiStore((s) => s.showToast);
  const { stores, employees, loadStores, loadEmployees, create, acting } = useWriteOffStore();

  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState([]); // [{ url }]
  const [uploading, setUploading] = useState(false);
  const [storeId, setStoreId] = useState(null);
  const [wtype, setWtype] = useState('');
  const [employeeId, setEmployeeId] = useState(null);
  const [comment, setComment] = useState('');
  const [empQuery, setEmpQuery] = useState('');
  const [error, setError] = useState(null);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  // предзаполнить точку отправителя
  useEffect(() => {
    if (storeId == null && user?.store?.id) setStoreId(user.store.id);
  }, [user, storeId]);

  // подгрузить сотрудников выбранной точки для шага удержания
  useEffect(() => {
    if (wtype === TYPE_WITH_DEDUCTION && storeId) loadEmployees(storeId);
  }, [wtype, storeId, loadEmployees]);

  const steps = useMemo(() => {
    const base = ['photo', 'point', 'type'];
    if (wtype === TYPE_WITH_DEDUCTION) base.push('employee');
    base.push('comment');
    return base;
  }, [wtype]);

  const cur = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;
  const commentLen = comment.trim().length;
  const store = stores.find((s) => s.id === storeId);
  const employee = employees.find((e) => e.id === employeeId);

  const valid = (() => {
    if (cur === 'photo') return photos.length > 0;
    if (cur === 'point') return !!storeId;
    if (cur === 'type') return !!wtype;
    if (cur === 'employee') return !!employeeId;
    if (cur === 'comment') return commentLen >= MIN_COMMENT_LENGTH;
    return false;
  })();

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        if (photos.length >= MAX_PHOTOS) break;
        const { url } = await uploadPhoto(file);
        setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, { url }]));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function next() {
    if (!valid) return;
    if (isLast) return submit();
    setStepIndex((i) => i + 1);
  }
  function prev() {
    if (stepIndex === 0) navigate('/');
    else setStepIndex((i) => i - 1);
  }

  async function submit() {
    setError(null);
    try {
      await create({
        store_id: storeId,
        type: wtype,
        deduction_employee_id: wtype === TYPE_WITH_DEDUCTION ? employeeId : undefined,
        comment: comment.trim(),
        photo_urls: photos.map((p) => p.url),
      });
      showToast(t.sent_toast);
      navigate('/my-requests', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  const titles = { photo: t.step_photo, point: t.step_point, type: t.step_type, employee: t.step_emp, comment: t.step_comment };
  const hints = { photo: t.step_photo_h, point: t.step_point_h, type: t.step_type_h, employee: t.step_emp_h, comment: t.step_comment_h };

  const filteredEmps = employees.filter((e) => e.full_name.toLowerCase().includes(empQuery.toLowerCase()));

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 w-full p-5 pb-8 max-w-[620px] mx-auto">
        {/* прогресс */}
        <div className="flex gap-1.5 mb-5">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 h-1.5 rounded-md overflow-hidden bg-line">
              <div
                className="h-full bg-green rounded-md transition-all duration-500"
                style={{ width: i < stepIndex ? '100%' : i === stepIndex ? '50%' : '0%' }}
              />
            </div>
          ))}
        </div>

        <p className="text-green font-semibold text-[12.5px] tracking-wide mb-1.5">
          {t.step} {stepIndex + 1} / {steps.length}
        </p>
        <h2 className="font-head font-semibold text-[23px] text-text m-0 mb-1">{titles[cur]}</h2>
        <p className="text-muted text-[13.5px] m-0 mb-5">{hints[cur]}</p>

        {error && (
          <div className="text-[13px] font-medium rounded-xl px-3.5 py-2.5 mb-4" style={{ background: 'var(--red-tint)', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {/* ШАГ: фото */}
        {cur === 'photo' && (
          <div className="flex flex-col gap-3.5">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
            <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
            <div className="flex gap-3 flex-wrap">
              {photos.map((p, i) => (
                <div key={p.url} className="relative w-[104px] h-[104px] rounded-2xl overflow-hidden animate-pop tile-base">
                  <img src={p.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1.5 right-1.5 w-[26px] h-[26px] rounded-full grid place-items-center text-white cursor-pointer z-[2]"
                    style={{ background: 'rgba(20,12,6,.55)', backdropFilter: 'blur(4px)', border: '1.5px solid rgba(255,255,255,.35)' }}
                    aria-label="remove"
                  >
                    <Icon name="close" size={13} strokeWidth={2.6} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="w-[104px] h-[104px] rounded-2xl border-2 border-dashed border-line bg-surface flex flex-col items-center justify-center gap-1.5 cursor-pointer text-green hover:border-green hover:bg-green-tint transition"
                >
                  {uploading ? <Spinner size={24} /> : <Icon name="camera" size={26} />}
                  <span className="text-[11.5px] font-semibold">{uploading ? t.uploading : t.add_photo}</span>
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex-1 h-[50px] rounded-xl border-none bg-green text-white font-semibold text-sm cursor-pointer flex items-center justify-center gap-2.5"
              >
                <Icon name="camera" size={19} />
                {t.take_photo}
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex-1 h-[50px] rounded-xl border-[1.5px] border-line bg-surface text-text font-semibold text-sm cursor-pointer flex items-center justify-center gap-2.5"
              >
                <Icon name="image" size={19} />
                {t.from_gallery}
              </button>
            </div>
          </div>
        )}

        {/* ШАГ: точка */}
        {cur === 'point' && (
          <div className="flex flex-col gap-2.5">
            {stores.map((s) => {
              const checked = storeId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStoreId(s.id)}
                  className="flex items-center gap-3.5 p-4 rounded-2xl cursor-pointer text-left bg-surface border-[1.5px] transition"
                  style={{ borderColor: checked ? 'var(--green)' : 'var(--line)' }}
                >
                  <div
                    className="w-[42px] h-[42px] flex-none rounded-xl grid place-items-center"
                    style={{ background: checked ? 'var(--green-tint)' : 'var(--surface2)', color: checked ? 'var(--green)' : 'var(--faint)' }}
                  >
                    <Icon name="store" size={20} />
                  </div>
                  <span className="flex-1 font-semibold text-[14.5px] text-text">{s.name}</span>
                  {checked && <CheckDot />}
                </button>
              );
            })}
          </div>
        )}

        {/* ШАГ: тип */}
        {cur === 'type' && (
          <div className="flex flex-col gap-3">
            <TypeCard
              active={wtype === TYPE_NO_DEDUCTION}
              icon="shieldCheck"
              tint="var(--gst-tint)"
              fg="var(--gst)"
              title={t.type_nohold}
              sub={t.type_nohold_sub}
              onClick={() => {
                setWtype(TYPE_NO_DEDUCTION);
                setEmployeeId(null);
              }}
            />
            <TypeCard
              active={wtype === TYPE_WITH_DEDUCTION}
              icon="userCheck"
              tint="var(--orange-tint)"
              fg="var(--orange)"
              activeBorder="var(--orange)"
              activeBg="var(--orange-tint)"
              title={t.type_hold}
              sub={t.type_hold_sub}
              onClick={() => setWtype(TYPE_WITH_DEDUCTION)}
            />
          </div>
        )}

        {/* ШАГ: сотрудник */}
        {cur === 'employee' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5 bg-surface border-[1.5px] border-line rounded-xl px-3.5 h-12 mb-1">
              <Icon name="search" size={17} className="text-faint" />
              <input
                value={empQuery}
                onChange={(e) => setEmpQuery(e.target.value)}
                placeholder={t.search_emp}
                className="flex-1 border-none outline-none bg-transparent text-sm text-text"
              />
            </div>
            {filteredEmps.map((e) => {
              const checked = employeeId === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => setEmployeeId(e.id)}
                  className="flex items-center gap-3.5 p-3 rounded-2xl cursor-pointer text-left bg-surface border-[1.5px] transition"
                  style={{ borderColor: checked ? 'var(--green)' : 'var(--line)' }}
                >
                  <div className="w-10 h-10 flex-none rounded-full bg-surface2 text-text grid place-items-center font-head font-semibold text-sm">
                    {initials(e.full_name)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[14.5px] text-text">{e.full_name}</div>
                    {e.position && <div className="text-xs text-muted">{e.position}</div>}
                  </div>
                  {checked && <CheckDot />}
                </button>
              );
            })}
          </div>
        )}

        {/* ШАГ: комментарий + сводка */}
        {cur === 'comment' && (
          <div>
            <div className="bg-surface border-[1.5px] border-line rounded-2xl p-3.5 focus-within:border-green transition-colors">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.comment_ph}
                className="w-full min-h-[120px] border-none outline-none resize-none bg-transparent text-[15px] leading-relaxed text-text"
              />
              <div className="flex items-center justify-between mt-2 border-t border-line2 pt-2.5">
                <span className="text-xs font-medium" style={{ color: commentLen >= MIN_COMMENT_LENGTH ? 'var(--gst)' : 'var(--muted)' }}>
                  {commentLen >= MIN_COMMENT_LENGTH ? t.comment_ok : t.comment_need}
                </span>
                <span className="text-xs text-faint tabular-nums">
                  {commentLen} / {MIN_COMMENT_LENGTH}
                </span>
              </div>
            </div>

            <div className="mt-4 bg-surface2 rounded-2xl p-4">
              <div className="text-xs text-faint font-semibold tracking-wide uppercase mb-2.5">{t.summary}</div>
              <div className="flex flex-col gap-2.5">
                <SummaryRow label={t.f_point} value={store?.name || '—'} />
                <SummaryRow label={t.f_type} value={wtype === TYPE_WITH_DEDUCTION ? t.type_hold : t.type_nohold} />
                {wtype === TYPE_WITH_DEDUCTION && <SummaryRow label={t.f_emp} value={employee?.full_name || '—'} />}
                <SummaryRow label={t.f_photos} value={`${photos.length} ${t.photos_n}`} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* футер мастера */}
      <div className="sticky bottom-0 border-t border-line bg-surface px-5 py-3.5">
        <div className="max-w-[620px] mx-auto flex gap-3">
          <button onClick={prev} className="flex-none w-[54px] h-[52px] rounded-2xl border-[1.5px] border-line bg-surface text-text cursor-pointer grid place-items-center">
            <Icon name="chevronLeft" size={20} strokeWidth={2.2} />
          </button>
          <button
            onClick={next}
            disabled={!valid || acting}
            className="flex-1 h-[52px] rounded-2xl border-none font-head font-semibold text-[17px] tracking-wide cursor-pointer flex items-center justify-center gap-2.5 transition disabled:cursor-not-allowed"
            style={{ background: valid ? 'var(--green)' : 'var(--line)', color: valid ? '#fff' : 'var(--faint)' }}
          >
            {acting ? <Spinner size={22} /> : (
              <>
                {isLast ? t.submit : t.next}
                {!isLast && <Icon name="chevronRight" size={19} strokeWidth={2.4} />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckDot() {
  return (
    <span className="w-6 h-6 rounded-full bg-green grid place-items-center flex-none">
      <Icon name="check" size={14} strokeWidth={3} className="text-white" />
    </span>
  );
}

function TypeCard({ active, icon, tint, fg, title, sub, onClick, activeBorder = 'var(--gst)', activeBg = 'var(--gst-tint)' }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3.5 p-[18px] rounded-2xl cursor-pointer text-left border-2 transition"
      style={{ background: active ? activeBg : 'var(--surface)', borderColor: active ? activeBorder : 'var(--line)' }}
    >
      <div className="w-[46px] h-[46px] flex-none rounded-[13px] grid place-items-center" style={{ background: tint, color: fg }}>
        <Icon name={icon} size={22} />
      </div>
      <div className="flex-1">
        <div className="font-head font-semibold text-[17px] text-text">{title}</div>
        <div className="text-[13px] text-muted mt-0.5">{sub}</div>
      </div>
    </button>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[13px] text-text font-semibold text-right">{value}</span>
    </div>
  );
}
