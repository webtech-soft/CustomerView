/**
 * Timeline event type codes (flat table Type column).
 * 1 = Vehicle Status, 2 = Sent, 3 = Viewed, 4 = Approval.
 */
export const TimelineEventType = {
  VehicleStatus: 1,
  Sent: 2,
  Viewed: 3,
  Approval: 4,
} as const

export type TimelineEventTypeValue = (typeof TimelineEventType)[keyof typeof TimelineEventType]

/**
 * Timeline row matching the 13-column schema (timeline_events).
 * Used when reading from DB or building payloads for the timeline API.
 */
export interface TimelineEventRow {
  id?: number
  TicketNum: number
  Type: TimelineEventTypeValue
  User?: string | null
  Datetime: string
  TicketTotal?: number | null
  VehicleStatus?: number | null
  IPaddress?: string | null
  ApprovalName?: string | null
  ApprovalTotal?: number | null
  ApprovalDetails?: string | null
  ApprovalSignature?: string | null
  /** Approval link for attrLink in HITS notification; backend includes when sending */
  ApprovalLink?: string | null
  /** Same as ApprovalLink; some backends expect attrLink by name */
  attrLink?: string | null
  Hide: number
}

/**
 * Payload for inserting a timeline event (omit id; server generates).
 */
export type TimelineEventInsert = Omit<TimelineEventRow, 'id'> & { id?: never }

function toIsoNow(): string {
  return new Date().toISOString()
}

/** Build Type 1 (Vehicle Status) row for API. VehicleStatusNumeric from mapVehicleStatusToApi. */
export function buildTimelineEventForVehicleStatus(
  ticketNum: number,
  vehicleStatusNumeric: number,
  options?: { user?: string; ticketTotal?: number; hide?: number }
): TimelineEventInsert {
  return {
    TicketNum: ticketNum,
    Type: TimelineEventType.VehicleStatus,
    User: options?.user ?? null,
    Datetime: toIsoNow(),
    TicketTotal: options?.ticketTotal ?? null,
    VehicleStatus: vehicleStatusNumeric,
    IPaddress: null,
    ApprovalName: null,
    ApprovalTotal: null,
    ApprovalDetails: null,
    ApprovalSignature: null,
    Hide: options?.hide ?? 0,
  }
}

/** Build Type 2 (Sent) row for API. IPaddress set server-side. */
export function buildTimelineEventForSent(
  ticketNum: number,
  options?: { user?: string; ticketTotal?: number; hide?: number }
): TimelineEventInsert {
  return {
    TicketNum: ticketNum,
    Type: TimelineEventType.Sent,
    User: options?.user ?? null,
    Datetime: toIsoNow(),
    TicketTotal: options?.ticketTotal ?? null,
    VehicleStatus: null,
    IPaddress: null,
    ApprovalName: null,
    ApprovalTotal: null,
    ApprovalDetails: null,
    ApprovalSignature: null,
    Hide: options?.hide ?? 0,
  }
}

/** Build Type 3 (Viewed) row for API. IPaddress set server-side. */
export function buildTimelineEventForViewed(
  ticketNum: number,
  options?: { ticketTotal?: number; hide?: number }
): TimelineEventInsert {
  return {
    TicketNum: ticketNum,
    Type: TimelineEventType.Viewed,
    User: null,
    Datetime: toIsoNow(),
    TicketTotal: options?.ticketTotal ?? null,
    VehicleStatus: null,
    IPaddress: null,
    ApprovalName: null,
    ApprovalTotal: null,
    ApprovalDetails: null,
    ApprovalSignature: null,
    Hide: options?.hide ?? 0,
  }
}

/** Build Type 4 (Approval) row for API. ApprovalName from verbal-approval "Approver name" (approverName). */
export function buildTimelineEventForApproval(
  ticketNum: number,
  approvalTotal: number,
  approvalDetails: string,
  approvalSignature: string,
  options?: { approvalName?: string; datetime?: string; hide?: number; approvalLink?: string }
): TimelineEventInsert {
  return {
    TicketNum: ticketNum,
    Type: TimelineEventType.Approval,
    User: null,
    Datetime: options?.datetime ?? toIsoNow(),
    TicketTotal: null,
    VehicleStatus: null,
    IPaddress: null,
    ApprovalName: options?.approvalName ?? null,
    ApprovalTotal: approvalTotal,
    ApprovalDetails: approvalDetails,
    ApprovalSignature: approvalSignature,
    ApprovalLink: options?.approvalLink ?? null,
    attrLink: options?.approvalLink ?? null,
    Hide: options?.hide ?? 0,
  }
}
