;
import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-liveness/styles.css';
import '@/styles/liveness-amplify-overrides.css';
import Link from 'next/link';


export default function Page() {
  return (
     <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-50 to-neutral-200">
      {/* Centered content column */}
      <div className="mx-auto w-full max-w-2xl p-6">
        <div className="flex flex-col gap-4">
          {/* Give a message and link to the verification page */}
          <p className="text-lg">
            To verify your identity, please proceed to the verification page.
          </p>
          <Link href="/verify" className="text-blue-500 hover:underline">
            Go to Verification Page
          </Link>
        </div>
      </div>
    </main>
  );
}
