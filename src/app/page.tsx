// import LivenessCheck from './LivenessCheck';
// import LivenessCore from './LivenessCore';
// import LivenessOneStage from './LivenessOneStage';
import LivenessWidget from './LivenessWidget';
import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-liveness/styles.css';
import '@/styles/liveness-amplify-overrides.css';

export default function Page() {
  return (
     <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-50 to-neutral-200">
      {/* Centered content column */}
      <div className="mx-auto w-full max-w-2xl p-6">
        <LivenessWidget />
      </div>
    </main>
  );
}
