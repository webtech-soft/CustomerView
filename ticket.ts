export type TicketType = "W" | "I" | "B" | "Q" // Workorder, Invoice, Batch, Quote

export type VehicleStatus =
  | "Not Started"
  | "Online Appointment"
  | "Not Here Yet"
  | "Check In"
  | "On Lot"
  | "In Shop"
  | "Inspection Complete"
  | "Awaiting Callback"
  | "Awaiting Parts"
  | "Out For Sublet"
  | "Ready"
  | ""

export interface Ticket {
  id: number
  ticketNumber: number
  date: string
  type: TicketType
  salesrep: string
  technician: string
  name: string
  vehicle: string
  total: number
  vehicleStatus: VehicleStatus
  inspectionStatus?: "complete" | "incomplete" | "none"
  inspectionId?: string // Format: INS-{timestamp}-{random}
  /** Promised completion or appointment time, as a raw string from the API */
  promisedTime?: string
  /** Appointment duration in minutes (from ApptDuration); used with promisedTime for due-time calculation */
  apptDurationMinutes?: number
  mileage?: number
  phone?: string
  email?: string
}

export interface TicketFilters {
  dateRange: string
  customFromDate?: string // MM/DD/YYYY format
  customToDate?: string // MM/DD/YYYY format
  workorder: boolean
  invoice: boolean
  batch: boolean
  quote: boolean
  ticketNumber?: string
  status?: string
  search?: string
  salesrep?: string
  technician?: string
}

// Inner payload structure (the JSON string inside the wrapper)
export interface TicketApiPayload {
  searchMode: string
  searchValue: string
  types: string
  partialFill: number
  backOrder: number
  natAcct: number
  fromDate: string
  toDate: string
  inclCarryOver: string // "true" or "false" as string
  storeNum: number
  salesRep: string
  routeNum: string
  vehStatus: number
  printStatus: number
  exactMatch: string // "true" or "false" as string
  maxResults: number
  skipDetail: string // "true" or "false" as string
}

// Wrapper request structure
export interface TicketApiRequest {
  integratorId: string
  account: string
  timestamp: string
  signature: string
  funcName: string
  payload: string // JSON string of TicketApiPayload
}

// API Response Invoice structure
export interface Invoice {
  InvoiceNum: number
  InvoiceVersion: number
  StoreNum: number
  StoreName: string
  VehicleBarCode: string
  Delivery: string
  Salesrep: string
  SalesrepName: string
  Route: string
  RouteName: string
  CustomerTaxCode: string
  CustomerSalesRep: string
  CustomerSalesRepName: string
  Taxable: "Y" | "N"
  SalesTax: string
  SoldPastDue: string
  CustomerType: string
  CustNoFET: "Y" | "N"
  CustNoFETTax: "Y" | "N"
  COD: string
  Name: string
  Address: string
  City: string
  State: string
  Zip: string
  PO: string
  AutoTag: string
  AutoTagState: string
  AutoMake: string
  AutoModel: string
  AutoYear: string
  VIN: string
  Mileage: number
  Cost: string
  Subtotal: string
  Amount: string
  Adjustment: string
  DateSold: string
  CustomerNum: number
  ApptActive: string
  ApptDateTime: string
  ApptDuration: string
  ApptCode: string
  ApptText: string
  BayCode: string
  BayText: string
  OpenStatus: string
  TicketType: string
  ApptVehicleStatus: string | number
  ServiceReminder: string
  Phone: string
  Email: string
  LastEditedBy: string
  LastEditedDateTime: string
  TechnicianCode: string
  TechnicianName: string
  TicketMemo: string
  PendingNotifications: string
  BillToNum: string
  BillToName: string
  ApptID: number
  Items: any[]
  Payments: any[]
}

// API Response structure
export interface TicketApiResponse {
  errorCode: number
  errorText: string
  payload: {
    Account: string
    TimeStamp: string
    Signature: string
    FullDate: string
    ServerNum: number
    Invoices: {
      Insert: Invoice[]
      Delete: any[]
    }
    Receipts: {
      Insert: any[]
      Delete: any[]
    }
    ROAs: {
      Insert: any[]
      Delete: any[]
    }
    EndOfDays: {
      Insert: any[]
      Delete: any[]
    }
  }
}

// Helper functions for status mapping
export function mapVehicleStatusToApi(status: VehicleStatus): number {
  switch (status) {
    case "Online Appointment":
      return 65
    case "Not Here Yet":
      return 0
    case "Check In":
      return 66
    case "On Lot":
      return 2
    case "In Shop":
      return 4
    case "Inspection Complete":
      return 67
    case "Awaiting Callback":
      return 64
    case "Awaiting Parts":
      return 16
    case "Out For Sublet":
      return 32
    case "Ready":
      return 8
    case "Not Started":
    case "":
      return -1 // All statuses
    default:
      return -1
  }
}

export function mapApiStatusToVehicleStatus(apiStatus: string | number): VehicleStatus {
  // Handle numeric status codes from API
  if (typeof apiStatus === 'number') {
    const statusMap: Record<number, VehicleStatus> = {
      65: "Online Appointment",
      0: "Not Here Yet",
      66: "Check In",
      2: "On Lot",
      4: "In Shop",
      67: "Inspection Complete",
      64: "Awaiting Callback",
      16: "Awaiting Parts",
      32: "Out For Sublet",
      8: "Ready",
      [-1]: "", // All statuses
    }
    return statusMap[apiStatus] || ""
  }

  // Handle string status from API
  const statusMap: Record<string, VehicleStatus> = {
    "Not Started": "Not Started",
    "Online Appointment": "Online Appointment",
    "Not Here Yet": "Not Here Yet",
    "Check In": "Check In",
    "On Lot": "On Lot",
    "In Shop": "In Shop",
    "Inspection Complete": "Inspection Complete",
    "Awaiting Callback": "Awaiting Callback",
    "Awaiting Parts": "Awaiting Parts",
    "Out For Sublet": "Out For Sublet",
    "Ready": "Ready",
  }
  return statusMap[apiStatus] || ""
}

// Invoice Detail API Interfaces
export interface InvoiceDetailParams {
  invoiceNum: number
  includeRawData?: boolean | string
  includeSchema?: boolean | string
}

export interface InvoiceDetailResponse {
  success: boolean
  errorCode?: number
  errorText?: string
  invoiceRow?: InvoiceRow
  detailRows?: DetailRow[]
  /** Raw API invoice for building Ticket via buildTicketFromInvoiceDetail */
  invoice?: Invoice
  errors?: string[]
  warnings?: string[]
  error?: string
}

export interface InvoiceRow {
  InvoiceNum: number
  Merchandise?: string
  FET?: string
  Services?: string
  Subtotal?: string
  Cost?: string
  SalesTax?: string
  Total?: string
  Units?: string
  Weight?: string
  CubicSize?: string
  TrailerFeet?: string
  kitTotal?: string
  // Vehicle information (from raw data)
  AutoTag?: string
  AutoTagState?: string
  AutoMake?: string
  AutoModel?: string
  AutoYear?: string
  VIN?: string
  Mileage?: number
}

export interface DetailRow {
  InvoiceNum: number
  LineNum: number
  ProductNum?: string
  Description?: string
  Quantity?: string
  PriceCode?: string
  RegularPrice?: string
  UnitPrice?: string
  UnitFet?: string
  Total?: string
  UT1?: string
  Package?: number // Package ID for grouping items
  Rawsize?: string // Raw size field for special handling (e.g., "OIL FILTER", "OIL")
  Goods?: string // "S" (Service) or "G" (Goods) - if "S", hide Quantity on customer view
  Props?: {
    IsDeclined?: boolean
    IsComment?: boolean
    IsKit?: boolean
    IsKitTotaler?: boolean
    IsHeaderItem?: boolean
  }
}
