/**
 * Invoice View Tracker - Tracks customer invoice views and related events
 */

export interface InvoiceViewStatus {
  isViewed: boolean
  firstViewed: number
  lastActive: number
  token?: string
}

export interface VehicleStatusChange {
  status: string
  timestamp: number
}

export interface TrackVehicleStatusOptions {
  user?: string
  ticketTotal?: number
}

/**
 * Track a vehicle status change for a ticket
 * Stores the change in localStorage for timeline display.
 * Optional options (user, ticketTotal) are for building the flat timeline row when persisting to API.
 */
export function trackVehicleStatusChange(
  ticketNumber: number,
  newStatus: string,
  _options?: TrackVehicleStatusOptions
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = `vehicle_status_changes_${ticketNumber}`
    const timestamp = Date.now()

    // Get existing changes
    const stored = localStorage.getItem(key)
    let changes: VehicleStatusChange[] = []

    if (stored) {
      try {
        changes = JSON.parse(stored)
        if (!Array.isArray(changes)) {
          changes = []
        }
      } catch {
        changes = []
      }
    }

    // Do not add a new event if the status is the same as the last logged event
    const lastChange = changes[changes.length - 1]
    if (lastChange && lastChange.status === newStatus) {
      return
    }

    changes.push({
      status: newStatus,
      timestamp,
    })

    // Store back to localStorage
    localStorage.setItem(key, JSON.stringify(changes))

    // Dispatch storage event for cross-tab updates
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue: JSON.stringify(changes),
        oldValue: stored,
        storageArea: localStorage,
      })
    )

    // Dispatch custom event for same-tab updates
    window.dispatchEvent(
      new CustomEvent('vehicle-status-changed', {
        detail: { ticketNumber, status: newStatus },
      })
    )
  } catch (error) {
    console.error('Error tracking vehicle status change:', error)
  }
}

/**
 * Get all vehicle status changes for a ticket
 */
export function getVehicleStatusChanges(ticketNumber: number): VehicleStatusChange[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const key = `vehicle_status_changes_${ticketNumber}`
    const stored = localStorage.getItem(key)

    if (!stored) {
      return []
    }

    const changes = JSON.parse(stored)
    if (!Array.isArray(changes)) {
      return []
    }

    // Ensure all entries have required fields
    return changes
      .filter((change): change is VehicleStatusChange => {
        return (
          typeof change === 'object' &&
          change !== null &&
          typeof change.status === 'string' &&
          typeof change.timestamp === 'number'
        )
      })
      .sort((a, b) => a.timestamp - b.timestamp) // Sort by timestamp (oldest first)
  } catch (error) {
    console.error('Error getting vehicle status changes:', error)
    return []
  }
}

/**
 * Get invoice view status for a ticket
 */
export function getInvoiceViewStatus(ticketNumber: number): InvoiceViewStatus | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const key = `invoice_view_status_${ticketNumber}`
    const stored = localStorage.getItem(key)

    if (!stored) {
      return null
    }

    const status = JSON.parse(stored)
    if (
      typeof status === 'object' &&
      status !== null &&
      typeof status.isViewed === 'boolean' &&
      typeof status.firstViewed === 'number'
    ) {
      return {
        isViewed: status.isViewed,
        firstViewed: status.firstViewed,
        lastActive: status.lastActive || status.firstViewed,
        token: status.token,
      }
    }

    return null
  } catch (error) {
    console.error('Error getting invoice view status:', error)
    return null
  }
}

export interface MarkInvoiceViewAccessedOptions {
  ticketTotal?: number
}

/**
 * Mark invoice as viewed/accessed
 * Optional ticketTotal is for building the flat timeline row when persisting to API.
 */
export function markInvoiceViewAccessed(
  ticketNumber: number,
  token: string,
  _options?: MarkInvoiceViewAccessedOptions
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = `invoice_view_status_${ticketNumber}`
    const now = Date.now()

    const status: InvoiceViewStatus = {
      isViewed: true,
      firstViewed: now,
      lastActive: now,
      token,
    }

    localStorage.setItem(key, JSON.stringify(status))

    // Dispatch storage event for cross-tab updates
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue: JSON.stringify(status),
        oldValue: null,
        storageArea: localStorage,
      })
    )

    // Also dispatch custom event for same-tab updates
    window.dispatchEvent(
      new CustomEvent('invoice-view-status-changed', {
        detail: { ticketNumber },
      })
    )
  } catch (error) {
    console.error('Error marking invoice as viewed:', error)
  }
}

/**
 * Update lastActive to now for an already-viewed ticket (e.g. customer view is open).
 * Use when the customer view is shown so "actively viewing" / timeline pulse stays on.
 * Does nothing if the ticket has no view status yet (use markInvoiceViewAccessed for first view).
 */
export function touchInvoiceViewActive(ticketNumber: number): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const status = getInvoiceViewStatus(ticketNumber)
    if (!status || !status.isViewed) {
      return
    }

    const key = `invoice_view_status_${ticketNumber}`
    const now = Date.now()
    const updated: InvoiceViewStatus = {
      ...status,
      lastActive: now,
    }
    const newValue = JSON.stringify(updated)
    const oldValue = localStorage.getItem(key)

    localStorage.setItem(key, newValue)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue,
        oldValue,
        storageArea: localStorage,
      })
    )
    window.dispatchEvent(
      new CustomEvent('invoice-view-status-changed', {
        detail: { ticketNumber },
      })
    )
  } catch (error) {
    console.error('Error touching invoice view active:', error)
  }
}

/**
 * Get all ticket sent events for a ticket
 */
export function getAllTicketSentEvents(
  ticketNumber: number
): Array<{ timestamp: number; sentBy?: string }> {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const key = `ticket_sent_${ticketNumber}`
    const stored = localStorage.getItem(key)

    if (!stored) {
      return []
    }

    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is { timestamp: number; sentBy?: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.timestamp === 'number'
      )
    } else if (typeof parsed === 'object' && parsed.timestamp) {
      return [parsed]
    } else {
      const timestamp = parseInt(stored)
      if (!isNaN(timestamp)) {
        return [{ timestamp }]
      }
    }

    return []
  } catch (error) {
    console.error('Error getting ticket sent events:', error)
    return []
  }
}

/**
 * Check if an invoice has been viewed at all
 */
export function hasInvoiceBeenViewed(ticketNumber: number): boolean {
  const status = getInvoiceViewStatus(ticketNumber)
  return status !== null && status.isViewed === true
}

/**
 * Check if an invoice is currently being actively viewed
 * An invoice is considered "actively viewed" if it was viewed within the last 5 minutes
 */
export function isInvoiceActivelyViewed(ticketNumber: number): boolean {
  const status = getInvoiceViewStatus(ticketNumber)
  if (!status || !status.isViewed) {
    return false
  }

  // After a customer opens the invoice view, keep the button "active" (pulsing) for 5 minutes,
  // then let it become solid red without polling for inactivity.
  const VIEW_BUTTON_SOLID_AFTER_MS = 5 * 60 * 1000
  const now = Date.now()
  const timeSinceLastActive = now - status.lastActive

  return timeSinceLastActive <= VIEW_BUTTON_SOLID_AFTER_MS
}

/**
 * Reset/clear the invoice view status for a ticket
 */
export function resetInvoiceViewStatus(ticketNumber: number): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = `invoice_view_status_${ticketNumber}`
    const oldValue = localStorage.getItem(key)
    
    localStorage.removeItem(key)

    // Dispatch storage event for cross-tab updates
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue: null,
        oldValue,
        storageArea: localStorage,
      })
    )

    // Also dispatch custom event for same-tab updates
    window.dispatchEvent(
      new CustomEvent('invoice-view-status-changed', {
        detail: { ticketNumber },
      })
    )
  } catch (error) {
    console.error('Error resetting invoice view status:', error)
  }
}

export interface MarkTicketSentOptions {
  ticketTotal?: number
}

/**
 * Mark that a ticket was sent to the customer
 * Optional ticketTotal is for building the flat timeline row when persisting to API.
 */
export function markTicketSent(
  ticketNumber: number,
  sentBy?: string,
  _options?: MarkTicketSentOptions
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = `ticket_sent_${ticketNumber}`
    const timestamp = Date.now()

    // Get existing sent events
    const existingEvents = getAllTicketSentEvents(ticketNumber)
    
    // Add new sent event
    const newEvent: { timestamp: number; sentBy?: string } = {
      timestamp,
      ...(sentBy && { sentBy }),
    }
    
    existingEvents.push(newEvent)

    // Store back to localStorage
    localStorage.setItem(key, JSON.stringify(existingEvents))

    // Dispatch storage event for cross-tab updates
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue: JSON.stringify(existingEvents),
        oldValue: JSON.stringify(existingEvents.slice(0, -1)),
        storageArea: localStorage,
      })
    )
  } catch (error) {
    console.error('Error marking ticket as sent:', error)
  }
}
