import { LoginForm } from '@/components/shared/login-form'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#4A8FE7] to-[#1B3A72]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-10">
          <h1 className="text-6xl font-black text-white tracking-[0.3em]">SAVT</h1>
          <p className="text-white/80 mt-2 text-sm">Добро пожаловать в SAVT Assist</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
