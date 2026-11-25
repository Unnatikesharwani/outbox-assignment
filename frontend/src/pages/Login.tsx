export function Login() {
  const failed = new URLSearchParams(window.location.search).get('error') === 'login_failed';
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ink-100">
        <h1 className="text-2xl font-bold tracking-tight text-brand-700">Outbox</h1>
        <p className="mt-2 text-sm text-ink-500">Schedule outreach once. It sends itself, at the pace you set.</p>
        {failed && <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">Google sign-in didn’t complete. Please try again.</p>}
        <a
          href="/auth/google"
          className="mt-6 flex items-center justify-center gap-3 rounded-lg border border-ink-300 px-4 py-2.5 text-sm font-semibold hover:bg-ink-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
            <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Continue with Google
        </a>
      </div>
    </main>
  );
}
