'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
  multiline?: boolean
  type?: string
  autoComplete?: string
  required?: boolean
}

// Подписанный инпут (label + поле + текст ошибки) — раньше было минимум две
// независимые копии (форма ШУ и формы создания оператора/админа/пользователя)
// с почти одинаковой разметкой.
export function FormField({
  label, hint, value, onChange, placeholder, error, multiline, type = 'text', autoComplete, required,
}: FormFieldProps) {
  const base = cn(
    'w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400',
    error
      ? 'border-red-400 focus:border-red-500 dark:border-red-500'
      : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
  )
  return (
    <div>
      <label className={cn('text-xs font-medium block mb-1.5', error ? 'text-red-500' : 'text-slate-500')}>
        {label}{required && <span className="text-red-500"> *</span>}{hint && <span className="text-slate-400 font-normal ml-1">({hint})</span>}
      </label>
      {multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className={cn(base, 'resize-none')} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className={base} />
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function PasswordField({ label, hint, value, onChange, error }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; error?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className={cn('text-xs font-medium block mb-1.5', error ? 'text-red-500' : 'text-slate-500')}>
        {label}{hint && <span className="text-slate-400 font-normal ml-1">({hint})</span>}
      </label>
      <div className="relative">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          type={show ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="new-password"
          className={cn(
            'w-full px-3 py-2 pr-10 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none',
            error ? 'border-red-400 focus:border-red-500 dark:border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
          )}
        />
        <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
