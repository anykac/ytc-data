import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const [{ data: { user } }, params] = await Promise.all([
    supabase.auth.getUser(),
    searchParams,
  ])
  const error = params.error

  if (user && error !== 'unauthorized') redirect('/dashboard')

  async function signIn() {
    'use server'
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) console.error('[signIn] OAuth error:', error.message)
    if (data.url) redirect(data.url)
    redirect('/login?error=auth_failed')
  }

  async function switchAccount() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: 'local' })
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) console.error('[switchAccount] OAuth error:', error.message)
    if (data.url) redirect(data.url)
    redirect('/login?error=auth_failed')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">YTC Production</h1>
        <p className="text-gray-600 text-sm">Supervisor / Admin login</p>
        {error === 'unauthorized' && (
          <div className="space-y-3">
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              This Google account hasn&apos;t been granted access. Try a different account or contact your administrator.
            </p>
            <form action={switchAccount}>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                Use a different account
              </button>
            </form>
          </div>
        )}
        {error && error !== 'unauthorized' && (
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            Authentication failed — please try again.
          </p>
        )}
        {error !== 'unauthorized' && (
          <form action={signIn}>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Sign in with Google
            </button>
          </form>
        )}
        <p className="text-xs text-gray-400 text-center">
          Line leads — go to <a href="/entry" className="underline">/entry</a>
        </p>
      </div>
    </main>
  )
}
