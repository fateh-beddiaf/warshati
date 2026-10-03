import { toast } from '../../components/ui/Sonner'
import type { Notify } from './types'

/** Transient feedback for settings actions (replaces the old in-page banner). */
export const notify: Notify = (type, message) => {
  const options = { duration: 6000 }
  if (type === 'success') toast.success(message, options)
  else if (type === 'warning') toast.warning(message, options)
  else toast.error(message, options)
}
