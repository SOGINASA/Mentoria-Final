import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Logo from '../../components/ui/Logo';
import { useI18n } from '../../i18n/useI18n';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center bg-bg">
      <Logo size="md" />
      <div className="font-head font-semibold text-[64px] leading-none text-green">404</div>
      <p className="text-muted m-0">{t.not_found}</p>
      <Button onClick={() => navigate('/')}>{t.back_home}</Button>
    </div>
  );
}
