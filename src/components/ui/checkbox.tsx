import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  const [visualState, setVisualState] = React.useState<CheckboxPrimitive.CheckedState>(
    checked ?? defaultChecked ?? false,
  )

  React.useEffect(() => {
    if (checked !== undefined) {
      setVisualState(checked)
    }
  }, [checked])

  const isChecked = visualState === true || visualState === 'indeterminate'

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(nextState) => {
        setVisualState(nextState)
        onCheckedChange?.(nextState)
      }}
      className={cn(
        'peer h-4 w-4 shrink-0 rounded-sm border border-muted-foreground/50 bg-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white dark:data-[state=checked]:border-emerald-500 dark:data-[state=checked]:bg-emerald-500',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        forceMount
        className={cn('flex items-center justify-center text-current')}
      >
        <AnimatePresence initial={false}>
          {isChecked ? (
            <motion.span
              key="checkbox-check"
              initial={{ scale: 0.35, rotate: -18, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.45, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 700, damping: 28, mass: 0.45 }}
              className="flex items-center justify-center"
            >
              <Check className="h-3.5 w-3.5" />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
