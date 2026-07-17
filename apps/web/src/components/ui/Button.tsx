import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-flame to-punch text-plum shadow-[0_0_1.5rem_rgb(236_72_153/30%)] hover:brightness-110 disabled:from-stage disabled:to-stage disabled:text-mist disabled:shadow-none',
  secondary: 'border border-chalk/25 bg-chalk/5 text-chalk hover:bg-chalk/10',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  size?: 'md' | 'lg'
}

/**
 * Themed pill-shaped action button. `primary` is the flame→punch gradient
 * with dark plum text; `secondary` is a translucent bordered pill. Extra
 * classes may be appended via `className`; all native button props pass
 * through.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const sizing = size === 'lg' ? 'px-8 py-4 text-xl' : 'px-6 py-3 text-lg'
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full font-bold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${sizing} ${className}`}
    />
  )
}
