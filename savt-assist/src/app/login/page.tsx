import { LoginForm } from '@/components/shared/login-form'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#4A8FE7] to-[#1B3A72]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-10">
          <div className='flex justify-center pb-2'>
            <Image 
            src="/logo-small.png"
            width={300}
            height={300}
            alt='SAVT'/>
          </div>
          <p className="text-white/80 mt-2 text-sm">Добро пожаловать в SAVT Assist</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
