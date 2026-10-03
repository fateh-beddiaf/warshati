import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { slideDown } from '../../../lib/motion'

interface FeedbackBannersProps {
  errorMessage: string | null
  successMessage: string | null
}

/** Error / success alert strip. Only the top-most dialog renders it, so the test ids stay unique. */
export function FeedbackBanners({ errorMessage, successMessage }: FeedbackBannersProps): React.JSX.Element {
  return (
    <AnimatePresence initial={false}>
      {errorMessage && (
        <motion.div
          key="error"
          {...slideDown}
          role="alert"
          data-testid="details-error"
          className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-xs font-semibold text-danger-soft-foreground"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </motion.div>
      )}
      {successMessage && (
        <motion.div
          key="success"
          {...slideDown}
          role="status"
          data-testid="details-success"
          className="flex items-center gap-2 rounded-xl border border-success/25 bg-success-soft p-3 text-xs font-semibold text-success-soft-foreground"
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
