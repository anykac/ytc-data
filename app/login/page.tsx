import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const params = await searchParams
  const error = params.error

  async function signIn() {
    'use server'
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/auth/callback`,
      },
    })
    if (data.url) redirect(data.url)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">YTC Production</h1>
        <p className="text-gray-600 text-sm">Supervisor / Admin login</p>
        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            Authentication failed — please try again.
          </p>
        )}
        <form action={signIn}>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Sign in with Google
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center">
          Line leads — go to <a href="/entry" className="underline">/entry</a>
        </p>
      </div>
    </main>
  )
}
