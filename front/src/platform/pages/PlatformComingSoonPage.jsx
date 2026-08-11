import { useNavigate } from 'react-router-dom';
import { usePlatformCopy } from '../platformCopy';
import { EmptyPlatformState, PlatformButton } from '../components/PlatformUi';

export default function PlatformComingSoonPage() {
  const navigate = useNavigate();
  const { p } = usePlatformCopy();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <EmptyPlatformState icon="grid" title={p.coming_soon} subtitle={p.coming_soon_sub} />
      <div className="mt-4 flex justify-center">
        <PlatformButton variant="secondary" icon="chevronLeft" onClick={() => navigate('/app')}>{p.back}</PlatformButton>
      </div>
    </div>
  );
}
