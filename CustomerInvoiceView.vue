<template>
  <div class="min-h-screen" style="background-color: #EAEBF0;">
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <p class="text-slate-600">{{ getLoadingDocumentLabel(loadingDocumentType) }}</p>
    </div>
    <div v-else-if="error" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <p class="text-red-600 text-lg mb-2">{{ error }}</p>
        <p class="text-slate-600 text-sm">This invoice link may have expired or is invalid.</p>
      </div>
    </div>
    <div v-else-if="invoiceData" class="min-h-screen overflow-y-auto" :style="{ backgroundColor: '#EAEBF0', paddingBottom: (showAdvisorLayout || isPreviewMode) ? '80px' : '0' }">
      <!-- Desktop: Three-column layout with cards, Mobile: Single column with slide-out panels -->
      <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div class="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
          <!-- Left spacer: reserve space when shop history is hidden in preview -->
          <div
            v-if="isPreviewMode && !(showShopHistoryPanel || showShopHistoryPanelMobile)"
            class="hidden lg:block lg:w-[300px] lg:flex-shrink-0"
            aria-hidden="true"
          ></div>
          <!-- Shop History Panel (Left) - Desktop: card, Mobile: slide-out -->
          <div
            v-if="isPreviewMode ? (showShopHistoryPanel || showShopHistoryPanelMobile) : (isAdvisorView ? showShopHistoryPanel : true)"
            :class="[
              'bg-white rounded-lg shadow-sm flex flex-col transition-transform duration-300 ease-in-out',
              'lg:w-[300px] lg:relative lg:flex-shrink-0 lg:self-start',
              'fixed inset-y-0 left-0 z-40 w-[300px] lg:inset-auto lg:z-auto',
              showShopHistoryPanelMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            ]"
          >
            <ShopHistoryPanel
              :entries="shopHistoryEntries"
              :loading="shopHistoryLoading"
              :error="shopHistoryError"
              :selected-ticket-number="selectedShopHistoryTicketNumber"
              :current-ticket="currentTicketForShopHistory"
              @select-invoice="handleSelectHistoricalInvoice"
            />
          </div>
          
          <!-- Mobile overlay for shop history -->
          <div
            v-if="showShopHistoryPanelMobile"
            class="fixed inset-0 bg-black/50 z-30 lg:hidden"
            @click="showShopHistoryPanelMobile = false"
          ></div>

          <!-- Center: Invoice Content -->
          <div class="flex-1 flex flex-col min-w-0 lg:self-start">
            <div id="invoice-print-area" class="bg-white rounded-lg shadow-sm p-4 sm:p-6 lg:p-8 w-full">
        <!-- Current Invoice View -->
        <div v-if="!isViewingHistoricalInvoice">
        <!-- Shop Header with Logo (hide sections when missing) -->
        <div v-if="hasAnyShopHeaderInfo" class="border-b border-slate-200 pb-4 mb-6">
          <div class="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div v-if="showShopLogo" class="flex-shrink-0 self-center sm:self-start order-1 sm:order-2">
              <img
                :src="shopLogoUrl"
                :alt="shopName ? (shopName + ' Logo') : 'Shop Logo'"
                class="h-[115.2px] sm:h-[144px] w-auto object-contain"
                @error="hideShopLogo = true"
              />
            </div>
            <div v-if="hasAnyShopTextInfo" class="flex-1 order-2 sm:order-1">
              <h2 v-if="shopName" class="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{{ shopName }}</h2>
              <div class="space-y-1 text-sm text-slate-600">
                <div v-if="shopAddressLine1">{{ shopAddressLine1 }}</div>
                <div v-if="shopAddressLine2">{{ shopAddressLine2 }}</div>
                <div v-if="hasAnyShopContactInfo" class="pt-2">
                  <div v-if="shopPhone">Phone: {{ shopPhone }}</div>
                  <div v-if="shopEmail">Email: {{ shopEmail }}</div>
                  <div v-if="shopWebsite">Website: {{ shopWebsite }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Invoice Header -->
        <div class="bg-slate-50 rounded-lg p-4 space-y-3 mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-semibold text-slate-900">
                {{ getTypeLabel(invoiceData.ticket.type) }} #{{ invoiceData.ticket.ticketNumber }}
              </h3>
              <p class="text-sm text-slate-600">Date: {{ invoiceData.ticket.date }}</p>
            </div>
            <button
              type="button"
              class="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
              :disabled="refreshing"
              :aria-label="refreshing ? 'Refreshing...' : 'Refresh invoice'"
              @click="refreshInvoice"
            >
              <PhArrowClockwise :size="20" weight="regular" :class="{ 'animate-spin': refreshing }" />
            </button>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-slate-600">Customer:</span>
              <span class="ml-2 font-medium text-slate-900">{{ invoiceData.ticket.name || '—' }}</span>
            </div>
            <!-- Vehicle Status (ticket/customer info card, same as mobile; uses timeline source so badge stays in sync) -->
            <!-- Internal view: clickable badge opens dropdown; customer view: read-only badge -->
            <div v-if="displayedVehicleStatus || showAdvisorLayout">
              <span class="text-slate-600">Vehicle Status:</span>
              <span class="ml-2">
                <div class="relative inline-block" :ref="statusBadgeRef">
                  <span
                    :class="cn(
                      'inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border',
                      showAdvisorLayout && 'cursor-pointer hover:opacity-80 transition-opacity',
                      getVehicleStatusColor(displayedVehicleStatus || 'Not Started')
                    )"
                    @click="isAdvisorView && toggleStatusPopover($event)"
                  >
                    {{ displayedVehicleStatus || 'Not Started' }}
                  </span>
                  <Teleport v-if="showAdvisorLayout" to="body">
                    <!-- Transparent backdrop: clicking it closes the popover (reliable click-outside) -->
                    <div
                      v-if="showStatusPopover"
                      class="fixed inset-0 z-[99]"
                      aria-hidden="true"
                      @mousedown="showStatusPopover = false"
                    />
                    <div
                      v-if="showStatusPopover"
                      :ref="popoverRef"
                      class="fixed z-[100] w-56 max-w-sm rounded-md border bg-white shadow-lg p-1 overflow-hidden"
                      :style="popoverStyle"
                    >
                      <div class="space-y-1 overflow-y-auto max-h-80">
                        <button
                          v-for="status in VEHICLE_STATUSES"
                          :key="status"
                          @click="handleVehicleStatusChange(status)"
                          :class="cn(
                            'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                            status === (displayedVehicleStatus || 'Not Started')
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'hover:bg-accent hover:text-accent-foreground'
                          )"
                        >
                          {{ status }}
                        </button>
                      </div>
                    </div>
                  </Teleport>
                </div>
              </span>
            </div>
          </div>
          
          <!-- Vehicle Information - Separated -->
          <div v-if="invoiceData.ticket.vehicle" class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2 border-t border-slate-200">
            <div>
              <span class="text-slate-600">License Plate:</span>
              <span class="ml-2 font-medium text-slate-900">{{ formatLicensePlateDisplay(getVehicleLicensePlate(invoiceData.ticket.vehicle), invoiceData.invoiceDetail?.invoiceRow?.AutoTagState) }}</span>
            </div>
            <div>
              <span class="text-slate-600">Vehicle:</span>
              <span class="ml-2 font-medium text-slate-900">{{ getVehicleMakeModelYear(invoiceData.ticket.vehicle) || '—' }}</span>
            </div>
            <div v-if="getVehicleMileage() !== undefined">
              <span class="text-slate-600">Mileage:</span>
              <span class="ml-2 font-medium text-slate-900">{{ formatMileage(getVehicleMileage()!) }}</span>
            </div>
            <div v-if="getVehicleVIN()">
              <span class="text-slate-600">VIN:</span>
              <span class="ml-2 font-medium text-slate-900">{{ getVehicleVIN() }}</span>
            </div>
          </div>
          
          <!-- Customer View: Buttons (only show when not viewing historical). Order: History, Timeline, Approve. -->
          <div v-if="(isCustomerView || isPreviewMode) && !isViewingHistoricalInvoice" class="border-t border-slate-200 pt-4 mt-4 space-y-3">
            <div class="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                class="min-h-[44px] px-3 sm:px-4 py-2 inline-flex items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation flex-shrink-0"
                @click="handleShopHistoryButton"
                :disabled="shopHistoryLoading"
              >
                <span v-if="shopHistoryLoading">Loading…</span>
                <template v-else>
                  <span class="inline sm:hidden">History</span>
                  <span class="hidden sm:inline">Shop history</span>
                </template>
              </button>
              <button
                v-if="hasCustomerVisibleTimelineContent"
                type="button"
                class="min-h-[44px] px-3 sm:px-4 py-2 inline-flex items-center justify-center rounded-md bg-slate-700 text-sm font-semibold text-white shadow-sm hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation flex-shrink-0"
                @click="handleTimelineButton"
              >
                Timeline
              </button>
              <button
                v-if="showApproveWorkButton"
                type="button"
                class="min-h-[44px] px-3 sm:px-4 py-2 inline-flex items-center justify-center rounded-md bg-[#68b045] text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation flex-shrink-0"
                @click="openApproveDialog"
              >
                <span class="inline sm:hidden">Approve</span>
                <span class="hidden sm:inline">Approve work</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Line Items -->
        <div v-if="invoiceData.invoiceDetail.detailRows && invoiceData.invoiceDetail.detailRows.length > 0" class="mb-6">
          <div class="space-y-2">
            <template v-for="packageGroup in getCustomerPreviewLineItems" :key="'package-' + packageGroup.packageId + '-' + packageGroup.headerItem.LineNum">
              <div class="bg-white border border-slate-200 rounded p-4">
                <!-- Header Item (first item in package) -->
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900">
                      {{ packageGroup.headerItem.Description || '—' }}
                    </p>
                    <div class="flex items-center gap-3 text-xs text-slate-600 mt-1">
                      <span v-if="packageGroup.headerItem.Quantity && packageGroup.headerItem.Quantity !== '0' && packageGroup.headerItem.Goods !== 'S'">Quantity: {{ packageGroup.headerItem.Quantity }}</span>
                    </div>
                    <!-- Other items in package as sub-items -->
                    <div v-if="packageGroup.items && packageGroup.items.length > 0" class="mt-2 ml-4 space-y-1 border-l-2 border-slate-300 pl-4">
                      <div
                        v-for="item in packageGroup.items"
                        :key="item.LineNum"
                        class="text-xs text-slate-600"
                      >
                        <p>{{ item.Description || '—' }}</p>
                        <div class="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span v-if="item.Quantity && item.Quantity !== '0' && item.Goods !== 'S'">Quantity: {{ item.Quantity }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-sm font-semibold text-slate-900">
                      {{ formatCurrency(getGroupTotal(packageGroup)) }}
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Declined Items (only show for current invoice, not historical) -->
        <div v-if="!isViewingHistoricalInvoice && getCustomerPreviewDeclinedItems.length > 0" class="mb-6">
          <h4 class="font-semibold text-red-700 mb-3 text-lg">DECLINED SERVICES</h4>
          <div class="space-y-2">
            <template v-for="packageGroup in getCustomerPreviewDeclinedItems" :key="'package-declined-' + packageGroup.packageId + '-' + packageGroup.headerItem.LineNum">
              <div class="bg-red-50 border border-red-200 rounded p-4">
                <!-- Header Item (first item in package) -->
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900">
                      {{ packageGroup.headerItem.Description || '—' }}
                    </p>
                    <div class="flex items-center gap-3 text-xs text-slate-600 mt-1">
                      <span v-if="packageGroup.headerItem.Quantity && packageGroup.headerItem.Quantity !== '0' && packageGroup.headerItem.Goods !== 'S'">Quantity: {{ packageGroup.headerItem.Quantity }}</span>
                    </div>
                    <!-- Other items in package as sub-items -->
                    <div v-if="packageGroup.items && packageGroup.items.length > 0" class="mt-2 ml-4 space-y-1 border-l-2 border-red-300 pl-4">
                      <div
                        v-for="item in packageGroup.items"
                        :key="item.LineNum"
                        class="text-xs text-slate-600"
                      >
                        <p>{{ item.Description || '—' }}</p>
                        <div class="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span v-if="item.Quantity && item.Quantity !== '0' && item.Goods !== 'S'">Quantity: {{ item.Quantity }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-sm font-semibold text-slate-900">
                      {{ formatCurrency(getGroupTotal(packageGroup)) }}
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Invoice Summary -->
        <div v-if="invoiceData.invoiceDetail.invoiceRow" class="bg-slate-50 rounded-lg p-4 border-t-2 border-slate-300 mb-6">
          <div class="space-y-2 text-sm">
            <div v-if="getCustomerPreviewSubtotal() !== undefined" class="flex justify-between">
              <span class="text-slate-600">Subtotal:</span>
              <span class="font-medium text-slate-900">{{ formatCurrency(getCustomerPreviewSubtotal()!) }}</span>
            </div>
            <div v-if="getCustomerPreviewShopSuppliesTotal > 0" class="flex justify-between">
              <span class="text-slate-600">Shop Supplies:</span>
              <span class="font-medium text-slate-900">{{ formatCurrency(getCustomerPreviewShopSuppliesTotal) }}</span>
            </div>
            <div v-if="invoiceData.invoiceDetail.invoiceRow.SalesTax" class="flex justify-between">
              <span class="text-slate-600">Sales Tax:</span>
              <span class="font-medium text-slate-900">{{ formatCurrency(invoiceData.invoiceDetail.invoiceRow.SalesTax) }}</span>
            </div>
            <div v-if="getCustomerPreviewTotal() !== undefined" class="flex justify-between pt-2 border-t border-slate-300">
              <span class="text-slate-900 font-semibold text-base">Total:</span>
              <span class="font-bold text-lg text-slate-900">{{ formatCurrency(getCustomerPreviewTotal()!) }}</span>
            </div>
          </div>
        </div>

        <!-- Contact Information Footer (hide when missing, only show for current invoice) -->
        <div v-if="hasFooterContactInfo" class="border-t border-slate-200 pt-4">
          <div class="text-center space-y-2 text-sm text-slate-600">
            <p class="font-semibold text-slate-900">Questions? Contact Us</p>
            <div class="flex flex-wrap items-center justify-center gap-4">
              <div v-if="shopPhone">Phone: {{ shopPhone }}</div>
              <div v-if="shopEmail">Email: {{ shopEmail }}</div>
            </div>
            <p class="text-xs text-slate-500 mt-4">
              Thank you for your business!
            </p>
          </div>
        </div>

        <!-- Print-only disclaimer (workorders and quotes) -->
        <div
          v-if="invoiceData.ticket.type === 'W' || invoiceData.ticket.type === 'Q'"
          class="hidden print:block mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600"
        >
          <p v-if="invoiceData.ticket.type === 'W'">This work order is not an invoice or proof of payment and is not valid for warranty, reimbursement, or accounting purposes. Final charges will appear on the official invoice.</p>
          <p v-else>This is an estimate only and not an invoice or proof of payment. Pricing and availability are subject to change.</p>
        </div>

        <div class="no-print flex justify-end mt-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            aria-label="Print invoice"
            class="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 touch-manipulation"
            @click="handlePrint"
          >
            <PhPrinter :size="20" weight="regular" />
          </button>
        </div>
        </div>

        <!-- Historical Invoice View -->
        <div v-else-if="isViewingHistoricalInvoice && selectedShopHistoryEntry">
          <div :key="'historical-' + selectedShopHistoryTicketNumber">
          <!-- Back to Current Invoice Button -->
          <div class="mb-6">
            <button
              type="button"
              class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md bg-slate-900 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 touch-manipulation"
              @click="backToCurrentInvoice"
            >
              ← Back to current invoice
            </button>
          </div>

          <!-- Loading Indicator -->
          <div v-if="loadingHistoricalInvoiceDetail" class="flex items-center justify-center py-12 mb-6">
            <div class="flex flex-col items-center gap-3">
              <span class="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin inline-block"></span>
              <p class="text-slate-600 text-sm">{{ getLoadingDocumentLabel(selectedShopHistoryEntry?.ticket?.type ?? null, true) }}</p>
            </div>
          </div>

          <!-- Error Message -->
          <div v-else-if="historicalInvoiceDetailError" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p class="text-red-600 text-sm">{{ historicalInvoiceDetailError }}</p>
          </div>

          <!-- Shop Header with Logo (same as current invoice) -->
          <div v-if="hasAnyShopHeaderInfo" class="border-b border-slate-200 pb-4 mb-6">
            <div class="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div v-if="showShopLogo" class="flex-shrink-0 self-center sm:self-start order-1 sm:order-2">
                <img
                  :src="shopLogoUrl"
                  :alt="shopName ? (shopName + ' Logo') : 'Shop Logo'"
                  class="h-[115.2px] sm:h-[144px] w-auto object-contain"
                  @error="hideShopLogo = true"
                />
              </div>
              <div v-if="hasAnyShopTextInfo" class="flex-1 order-2 sm:order-1">
                <h2 v-if="shopName" class="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{{ shopName }}</h2>
                <div class="space-y-1 text-sm text-slate-600">
                  <div v-if="shopAddressLine1">{{ shopAddressLine1 }}</div>
                  <div v-if="shopAddressLine2">{{ shopAddressLine2 }}</div>
                  <div v-if="hasAnyShopContactInfo" class="pt-2">
                    <div v-if="shopPhone">Phone: {{ shopPhone }}</div>
                    <div v-if="shopEmail">Email: {{ shopEmail }}</div>
                    <div v-if="shopWebsite">Website: {{ shopWebsite }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Historical Invoice Header -->
          <div v-if="selectedShopHistoryEntryWithDetails" class="bg-slate-50 rounded-lg p-4 space-y-3 mb-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <h3 class="text-lg font-semibold text-slate-900">
                  {{ getTypeLabel(selectedShopHistoryEntryWithDetails.ticket.type) }} #{{ selectedShopHistoryEntryWithDetails.ticket.ticketNumber }}
                </h3>
                <p class="text-sm text-slate-600">Date: {{ selectedShopHistoryEntryWithDetails.ticket.date }}</p>
              </div>
              <button
                type="button"
                class="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
                :disabled="refreshing"
                :aria-label="refreshing ? 'Refreshing...' : 'Refresh invoice'"
                @click="refreshInvoice"
              >
                <PhArrowClockwise :size="20" weight="regular" :class="{ 'animate-spin': refreshing }" />
              </button>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-slate-600">Customer:</span>
                <span class="ml-2 font-medium text-slate-900">{{ selectedShopHistoryEntryWithDetails.ticket.name || '—' }}</span>
              </div>
            </div>
            
            <!-- Vehicle Information -->
            <div v-if="selectedShopHistoryEntryWithDetails.ticket.vehicle" class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2 border-t border-slate-200">
              <div>
                <span class="text-slate-600">License Plate:</span>
                <span class="ml-2 font-medium text-slate-900">{{ formatLicensePlateDisplay(getVehicleLicensePlate(selectedShopHistoryEntryWithDetails.ticket.vehicle), selectedShopHistoryEntryWithDetails.invoiceRow?.AutoTagState) }}</span>
              </div>
              <div>
                <span class="text-slate-600">Vehicle:</span>
                <span class="ml-2 font-medium text-slate-900">{{ getVehicleMakeModelYear(selectedShopHistoryEntryWithDetails.ticket.vehicle) || '—' }}</span>
              </div>
              <div v-if="selectedShopHistoryEntryWithDetails.invoiceRow?.Mileage !== undefined">
                <span class="text-slate-600">Mileage:</span>
                <span class="ml-2 font-medium text-slate-900">{{ formatMileage(selectedShopHistoryEntryWithDetails.invoiceRow.Mileage) }}</span>
              </div>
              <div v-if="selectedShopHistoryEntryWithDetails.invoiceRow?.VIN">
                <span class="text-slate-600">VIN:</span>
                <span class="ml-2 font-medium text-slate-900">{{ selectedShopHistoryEntryWithDetails.invoiceRow.VIN }}</span>
              </div>
            </div>
          </div>

          <!-- Historical Invoice Line Items -->
          <div v-if="selectedShopHistoryEntryWithDetails && getCustomerPreviewLineItemsForHistory(selectedShopHistoryEntryWithDetails).length > 0" class="mb-6">
            <div class="space-y-2">
              <template
                v-for="packageGroup in getCustomerPreviewLineItemsForHistory(selectedShopHistoryEntryWithDetails)"
                :key="'history-package-' + selectedShopHistoryEntryWithDetails.ticket.ticketNumber + '-' + packageGroup.packageId + '-' + packageGroup.headerItem.LineNum"
              >
                <div class="bg-white border border-slate-200 rounded p-4">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-900">
                        {{ packageGroup.headerItem.Description || '—' }}
                      </p>
                      <div class="flex items-center gap-3 text-xs text-slate-600 mt-1">
                        <span
                          v-if="packageGroup.headerItem.Quantity && packageGroup.headerItem.Quantity !== '0' && packageGroup.headerItem.Goods !== 'S'"
                        >
                          Quantity: {{ packageGroup.headerItem.Quantity }}
                        </span>
                      </div>
                      <div
                        v-if="packageGroup.items && packageGroup.items.length > 0"
                        class="mt-2 ml-4 space-y-1 border-l-2 border-slate-300 pl-4"
                      >
                        <div
                          v-for="item in packageGroup.items"
                          :key="item.LineNum"
                          class="text-xs text-slate-600"
                        >
                          <p>{{ item.Description || '—' }}</p>
                          <div class="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span v-if="item.Quantity && item.Quantity !== '0' && item.Goods !== 'S'">
                              Quantity: {{ item.Quantity }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                      <p class="text-sm font-semibold text-slate-900">
                        {{ formatCurrency(getGroupTotal(packageGroup)) }}
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Historical Invoice Summary -->
          <div v-if="selectedShopHistoryEntryWithDetails?.invoiceRow" class="bg-slate-50 rounded-lg p-4 border-t-2 border-slate-300 mb-6">
            <div class="space-y-2 text-sm">
              <div v-if="selectedShopHistoryEntryWithDetails.invoiceRow.Subtotal" class="flex justify-between">
                <span class="text-slate-600">Subtotal:</span>
                <span class="font-medium text-slate-900">{{ formatCurrency(selectedShopHistoryEntryWithDetails.invoiceRow.Subtotal) }}</span>
              </div>
              <div v-if="selectedShopHistoryEntryWithDetails.invoiceRow.SalesTax" class="flex justify-between">
                <span class="text-slate-600">Sales Tax:</span>
                <span class="font-medium text-slate-900">{{ formatCurrency(selectedShopHistoryEntryWithDetails.invoiceRow.SalesTax) }}</span>
              </div>
              <div v-if="selectedShopHistoryEntryWithDetails.invoiceRow.Total" class="flex justify-between pt-2 border-t border-slate-300">
                <span class="text-slate-900 font-semibold text-base">Total:</span>
                <span class="font-bold text-lg text-slate-900">{{ formatCurrency(selectedShopHistoryEntryWithDetails.invoiceRow.Total) }}</span>
              </div>
            </div>
          </div>

          <!-- Print-only disclaimer (workorders and quotes) -->
          <div
            v-if="selectedShopHistoryEntryWithDetails && (selectedShopHistoryEntryWithDetails.ticket.type === 'W' || selectedShopHistoryEntryWithDetails.ticket.type === 'Q')"
            class="hidden print:block mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600"
          >
            <p v-if="selectedShopHistoryEntryWithDetails.ticket.type === 'W'">This work order is not an invoice or proof of payment and is not valid for warranty, reimbursement, or accounting purposes. Final charges will appear on the official invoice.</p>
            <p v-else>This is an estimate only and not an invoice or proof of payment. Pricing and availability are subject to change.</p>
          </div>
          </div>

        <div class="no-print flex justify-end mt-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            aria-label="Print invoice"
            class="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 touch-manipulation"
            @click="handlePrint"
          >
            <PhPrinter :size="20" weight="regular" />
          </button>
        </div>
        </div>

            </div>
          </div>

          <!-- Right spacer: reserve space when timeline is hidden in preview -->
          <div
            v-if="isPreviewMode && !(showTimelinePanel || showTimelinePanelMobile)"
            class="hidden lg:block lg:w-[300px] lg:flex-shrink-0"
            aria-hidden="true"
          ></div>
          <!-- Timeline Panel (Right) - Desktop: card, Mobile: slide-out -->
          <div
            v-if="showAdvisorLayout ? showTimelinePanel : (isPreviewMode ? (showTimelinePanel || showTimelinePanelMobile) : true)"
            :class="[
              'bg-white rounded-lg shadow-sm flex flex-col transition-transform duration-300 ease-in-out',
              'lg:w-[300px] lg:relative lg:flex-shrink-0 lg:self-start',
              'fixed inset-y-0 right-0 z-40 w-[300px] lg:inset-auto lg:z-auto',
              showTimelinePanelMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
            ]"
          >
            <TimelinePanel
              :timeline-data="timelineData"
              :has-approvals="hasAnyApprovals"
              :is-advisor-view="showAdvisorLayout"
              :is-ticket-viewed-pulsing="isTicketViewedPulsing"
              @show-approvals="showApprovalsModal = true"
            />
          </div>

          <!-- Mobile overlay for timeline -->
          <div
            v-if="showTimelinePanelMobile"
            class="fixed inset-0 bg-black/50 z-30 lg:hidden"
            @click="showTimelinePanelMobile = false"
          ></div>
        </div>
      </div>

      <!-- Advisor / Preview: Fixed Footer -->
      <div v-if="showAdvisorLayout || isPreviewMode" class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <button
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 touch-manipulation"
                @click="router.push('/tickets')"
              >
                ← Back to Tickets
              </button>
              <button
                v-if="showAdvisorLayout"
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 touch-manipulation"
                @click="openPreviewCustomerView"
              >
                <PhEye :size="16" weight="regular" class="mr-2" />
                Preview customer view
              </button>
              <button
                v-else-if="isPreviewMode"
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 touch-manipulation"
                @click="goBackToAdvisorView"
              >
                ← Back to advisor view
              </button>
            </div>
            <div v-if="showAdvisorLayout || isPreviewMode" class="flex items-center gap-3">
              <button
                v-if="showAdvisorLayout && showAdvisorApproveWorkButton"
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md border border-[#68b045] bg-white text-sm font-semibold text-[#68b045] shadow-sm hover:bg-[#68b045]/5 touch-manipulation"
                @click="openApproveDialog"
              >
                Approve work
              </button>
              <button
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md bg-[#68b045] text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                @click="handleSend"
                :disabled="!invoiceData"
              >
                <PhChatCircle :size="16" weight="regular" class="mr-2" />
                Send customer view
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dialogs (outside main layout) -->
    <!-- Approve Work: selection dialog -->
    <Dialog v-model="showApproveSelectDialog">
      <DialogContent class="w-full h-full sm:max-w-3xl sm:max-h-[80vh] sm:h-auto overflow-hidden flex flex-col m-0 sm:m-auto rounded-none sm:rounded-lg">
            <DialogHeader>
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <DialogTitle class="truncate">Approve services</DialogTitle>
                  <p class="text-xs text-slate-500 truncate">
                    Select the services you’d like to approve, or choose approve all.
                  </p>
                </div>
                <button
                  type="button"
                  class="min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors touch-manipulation"
                  @click="showApproveSelectDialog = false"
                >
                  Close
                </button>
              </div>
            </DialogHeader>

            <div class="flex-1 overflow-y-auto space-y-4 px-1 pb-2 -mx-1" style="scrollbar-width: thin;">
              <div v-if="eligibleApprovalGroups.length === 0" class="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p class="text-sm text-slate-700">All available services have already been approved.</p>
              </div>

              <div v-else class="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div class="flex items-center gap-3">
                  <Checkbox :checked="isAllEligibleSelected" @update:checked="setAllEligibleSelected" />
                  <div>
                    <p class="text-sm font-medium text-slate-900">Approve all available services</p>
                    <p class="text-xs text-slate-500">{{ eligibleApprovalGroups.length }} service(s) available</p>
                  </div>
                </div>
                <p class="text-sm font-semibold text-slate-900">{{ formatCurrency(eligibleApprovalTotal) }}</p>
              </div>

              <div class="space-y-2">
                <div
                  v-for="group in approvalGroups"
                  :key="getServiceGroupKey(group)"
                  :class="[
                    'flex items-start justify-between gap-4 rounded-md border p-3',
                    isServiceGroupApproved(group)
                      ? 'border-[#68b045]/30 bg-[#68b045]/10'
                      : 'border-slate-200 bg-white'
                  ]"
                >
                  <div class="flex items-start gap-3 min-w-0">
                    <Checkbox
                      :checked="isServiceGroupApproved(group) || isServiceGroupSelected(group)"
                      @update:checked="(v) => setServiceGroupSelected(group, v)"
                      :disabled="isServiceGroupApproved(group)"
                    />
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-slate-900 truncate">
                        {{ group.headerItem.Description || '—' }}
                      </p>
                      <p v-if="isServiceGroupApproved(group)" class="text-xs text-[#2d6b1f] mt-0.5 font-medium">
                        Approved
                      </p>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-sm font-semibold text-slate-900">
                      {{ formatCurrency(getGroupTotal(group)) }}
                    </p>
                  </div>
                </div>
              </div>

              <div class="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p class="text-xs font-semibold text-slate-900 mb-2">Total approved</p>
                <div class="space-y-1 text-xs text-slate-700">
                  <div class="flex justify-between gap-2">
                    <span class="text-slate-500">Already approved</span>
                    <span class="font-semibold text-slate-900">{{ formatCurrency(existingApprovedTotal) }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-slate-500">Selected to add</span>
                    <span class="font-semibold text-slate-900">{{ formatCurrency(newSelectedApprovalTotal) }}</span>
                  </div>
                  <div class="flex justify-between gap-2 pt-2 border-t border-slate-200">
                    <span class="text-slate-900 font-semibold">After approval</span>
                    <span class="font-bold text-slate-900">{{ formatCurrency(totalApprovedAfterSelection) }}</span>
                  </div>
                </div>
                <p class="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200">
                  Note: Totals shown are pre-tax and exclude shop supplies.
                </p>
              </div>

              <!-- Advisor: verbal approval option -->
              <div v-if="isAdvisorView" class="rounded-md border border-slate-200 bg-white p-3 space-y-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <Checkbox :checked="verbalApproval" @update:checked="verbalApproval = $event" />
                  <span class="text-sm font-medium text-slate-700">Approval was made verbally</span>
                </label>
                <div v-if="verbalApproval" class="pt-1">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Approver name</label>
                  <Input
                    v-model="verbalApproverName"
                    type="text"
                    placeholder="Name of person who approved the service"
                    class="w-full"
                  />
                </div>
              </div>

              <p v-if="approveUiError" class="text-sm text-red-600">{{ approveUiError }}</p>
        </div>

        <div class="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0 bg-white">
              <button
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 touch-manipulation"
                @click="showApproveSelectDialog = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md bg-[#68b045] text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                :disabled="newSelectedApprovalGroups.length === 0"
                @click="handleApproveContinue"
              >
                Continue
              </button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Approve Work: confirmation + signature dialog -->
    <Dialog v-model="showApproveConfirmDialog">
      <DialogContent class="w-full h-full sm:max-w-3xl sm:max-h-[85vh] sm:h-auto overflow-hidden flex flex-col m-0 sm:m-auto rounded-none sm:rounded-lg">
        <DialogHeader>
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <DialogTitle class="truncate">Confirm approval</DialogTitle>
                  <p class="text-xs text-slate-500 truncate">
                    Review approved services, then sign to authorize.
                  </p>
                </div>
                <button
                  type="button"
                  class="min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors touch-manipulation"
                  @click="showApproveConfirmDialog = false"
                >
                  Close
                </button>
              </div>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-4 px-1 pb-2 -mx-1" style="scrollbar-width: thin;">
          <div class="rounded-md border border-slate-200 p-3">
                <p class="text-sm font-semibold text-slate-900 mb-2">Approved services</p>
                <div class="space-y-2">
                  <div
                    v-for="group in newSelectedApprovalGroups"
                    :key="getServiceGroupKey(group)"
                    class="flex items-start justify-between gap-4"
                  >
                    <p class="text-sm text-slate-700 flex-1 min-w-0">
                      {{ group.headerItem.Description || '—' }}
                    </p>
                    <p class="text-sm font-semibold text-slate-900 flex-shrink-0">
                      {{ formatCurrency(getGroupTotal(group)) }}
                    </p>
                  </div>
                </div>
                <div class="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <p class="text-sm font-semibold text-slate-900">Total approved</p>
                  <p class="text-sm font-bold text-slate-900">{{ formatCurrency(newSelectedApprovalTotal) }}</p>
                </div>
              </div>

              <div class="rounded-md border border-slate-200 p-3">
                <p class="text-sm font-semibold text-slate-900 mb-2">Signature</p>
                <SignaturePad v-model="signatureDataUrl" />
                <p v-if="approveUiError" class="text-sm text-red-600 mt-2">{{ approveUiError }}</p>
                <p v-if="approveUiWarning" class="text-sm text-amber-700 mt-2">{{ approveUiWarning }}</p>
              </div>
            </div>

            <div class="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0 bg-white">
              <button
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 touch-manipulation"
                @click="showApproveConfirmDialog = false"
                :disabled="approvingWork"
              >
                Back
              </button>
              <button
                type="button"
                class="min-h-[44px] px-4 py-2 inline-flex items-center rounded-md bg-[#68b045] text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
                :disabled="approvingWork"
                @click="submitApproval"
              >
                <span v-if="approvingWork">Approving…</span>
                <span v-else>Approve</span>
              </button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Approvals Modal (shows approved services) -->
    <Dialog v-model="showApprovalsModal">
      <DialogContent class="w-full h-full sm:max-w-3xl sm:max-h-[80vh] sm:h-auto overflow-hidden flex flex-col m-0 sm:m-auto rounded-none sm:rounded-lg">
        <DialogHeader>
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <DialogTitle class="truncate">Approved Services</DialogTitle>
                </div>
                <button
                  type="button"
                  class="min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors touch-manipulation"
                  @click="showApprovalsModal = false"
                >
                  Close
                </button>
              </div>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto p-4 space-y-4" style="scrollbar-width: thin;">
              <div v-if="!approvalRecord || approvalRecord.items.length === 0" class="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p class="text-sm text-slate-700">No approvals recorded.</p>
              </div>
              <div v-else class="space-y-4">
                <div class="rounded-md border border-slate-200 p-3">
                  <p class="text-xs font-semibold text-slate-900">Ticket approval</p>
                  <div class="mt-2 space-y-1 text-xs text-slate-700">
                    <div class="flex justify-between gap-2">
                      <span class="text-slate-500">Total approved</span>
                      <span class="font-semibold text-slate-900">{{ formatCurrency(advisorApprovedTotal) }}</span>
                    </div>
                    <div class="flex justify-between gap-2">
                      <span class="text-slate-500">Approval date(s)</span>
                      <span class="text-slate-900">
                        <template v-if="approvalDateRange">
                          <template v-if="typeof approvalDateRange === 'string'">{{ approvalDateRange }}</template>
                          <template v-else>First: {{ approvalDateRange.first }} · Latest: {{ approvalDateRange.latest }}</template>
                        </template>
                        <template v-else>—</template>
                      </span>
                    </div>
                  </div>
                </div>

                <div class="rounded-md border border-slate-200 p-3">
                  <p class="text-xs font-semibold text-slate-900">Signature</p>
                  <div class="mt-2">
                    <img
                      v-if="advisorSignatureDataUrl"
                      :src="advisorSignatureDataUrl"
                      alt="Customer signature"
                      class="w-full h-28 object-contain bg-white border border-slate-200 rounded"
                    />
                    <p v-else class="text-xs text-slate-500">—</p>
                    <p v-if="advisorSignatureDataUrl && sortedApprovalItems.some(i => i.verbalApproval)" class="text-[11px] text-slate-500 mt-1">
                      Some items were approved verbally.
                    </p>
                  </div>
                </div>

                <div class="rounded-md border border-slate-200 p-3">
                  <p class="text-xs font-semibold text-slate-900 mb-2">Approved services</p>
                  <div v-if="sortedApprovalItems.length === 0" class="text-xs text-slate-500">
                    —
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="item in sortedApprovalItems"
                      :key="item.key"
                      class="flex items-start justify-between gap-3"
                    >
                      <div class="min-w-0">
                        <p class="text-xs font-medium text-slate-900 truncate">
                          {{ item.description || '—' }}
                        </p>
                        <p class="text-[11px] text-slate-500">
                          <template v-if="item.verbalApproval && item.approverName">
                            Approved verbally by {{ item.approverName }} on {{ item.approvedDate }} at {{ item.approvedTime }}
                          </template>
                          <template v-else>
                            Approved on {{ item.approvedDate }} at {{ item.approvedTime }}
                          </template>
                        </p>
                      </div>
                      <p class="text-xs font-semibold text-slate-900 flex-shrink-0">
                        {{ formatCurrency(item.amount) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
      </DialogContent>
    </Dialog>

    <!-- Send Customer View Dialog -->
    <Dialog v-model="showSendDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send {{ getTypeLabel(invoiceData?.ticket?.type || 'W') }} #{{ invoiceData?.ticket?.ticketNumber }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <!-- Message field -->
          <div>
            <label class="text-sm font-medium text-slate-700 mb-2 block">
              Message
            </label>
            <Textarea
              v-model="sendMessage"
              placeholder="Enter message to send..."
              rows="4"
              class="w-full"
            />
          </div>

          <!-- Customer View URL -->
          <div>
            <label class="text-sm font-medium text-slate-700 mb-2 block">
              Customer View URL
            </label>
            <div class="flex gap-2">
              <Input
                :value="sendUrl"
                readonly
                class="flex-1 font-mono text-xs"
              />
              <Button
                variant="outline"
                @click="openCustomerViewUrl"
                class="flex-shrink-0"
              >
                Open
              </Button>
            </div>
          </div>

          <!-- Communication Method Selection -->
          <div v-if="invoiceData?.ticket" class="space-y-3 pt-2">
            <label class="block text-sm font-medium text-slate-700 mb-2">
              Send via:
            </label>
            <div class="space-y-4">
              <!-- Email -->
              <div class="flex items-start gap-2">
                <Checkbox :checked="sendViaEmail" @update:checked="sendViaEmail = $event" :disabled="!emailOptions.length && !emailOverrideTrimmed" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <label class="text-sm font-medium text-slate-700">Email</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      class="h-8"
                      @click="isEditingEmail = !isEditingEmail"
                    >
                      {{ isEditingEmail ? 'Done' : 'Change' }}
                    </Button>
                  </div>

                  <div class="mt-1 space-y-2">
                    <div v-if="isEditingEmail" class="flex gap-2">
                      <Input
                        v-model="emailOverride"
                        type="email"
                        placeholder="Enter email address"
                        class="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="h-10"
                        @click="emailOverride = ''"
                      >
                        Clear
                      </Button>
                    </div>
                    <div v-else>
                      <div v-if="emailOverrideTrimmed" class="text-xs text-slate-600 break-all">
                        Sending to: <span class="font-medium text-slate-900">{{ emailOverrideTrimmed }}</span>
                      </div>
                      <select
                        v-else-if="emailOptions.length > 1"
                        v-model="selectedEmail"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option v-for="email in emailOptions" :key="email" :value="email">
                          {{ email }}
                        </option>
                      </select>
                      <div v-else-if="emailOptions.length === 1" class="text-xs text-slate-500 break-all">
                        {{ selectedEmail }}
                      </div>
                      <div v-else class="text-xs text-slate-500">
                        No email address on file.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SMS -->
              <div class="flex items-start gap-2">
                <Checkbox :checked="sendViaSMS" @update:checked="sendViaSMS = $event" :disabled="!phoneOptions.length && !phoneOverrideTrimmed" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <label class="text-sm font-medium text-slate-700">SMS</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      class="h-8"
                      @click="isEditingPhone = !isEditingPhone"
                    >
                      {{ isEditingPhone ? 'Done' : 'Change' }}
                    </Button>
                  </div>

                  <div class="mt-1 space-y-2">
                    <div v-if="isEditingPhone" class="flex gap-2">
                      <Input
                        v-model="phoneOverride"
                        inputmode="tel"
                        placeholder="Enter phone number"
                        class="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="h-10"
                        @click="phoneOverride = ''"
                      >
                        Clear
                      </Button>
                    </div>
                    <div v-else>
                      <div v-if="phoneOverrideTrimmed" class="text-xs text-slate-600 break-all">
                        Sending to: <span class="font-medium text-slate-900">{{ phoneOverrideTrimmed }}</span>
                      </div>
                      <select
                        v-else-if="phoneOptions.length > 1"
                        v-model="selectedPhone"
                        class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option v-for="phone in phoneOptions" :key="phone" :value="phone">
                          {{ phone }}
                        </option>
                      </select>
                      <div v-else-if="phoneOptions.length === 1" class="text-xs text-slate-500 break-all">
                        {{ selectedPhone }}
                      </div>
                      <div v-else class="text-xs text-slate-500">
                        No phone number on file.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="!emailOptions.length && !phoneOptions.length && !emailOverrideTrimmed && !phoneOverrideTrimmed" class="text-sm text-slate-600">
                No phone number or email address is available for this customer.
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            @click="showSendDialog = false"
          >
            Cancel
          </Button>
          <Button
            class="bg-[#68b045] hover:bg-[#5a9a3a] text-white"
            @click="handleSendMessage"
            :disabled="!canSendCustomerView"
          >
            <PhChatCircle v-if="sendViaSMS" :size="16" weight="regular" class="mr-2" />
            <PhEnvelope v-if="sendViaEmail" :size="16" weight="regular" class="mr-2" />
            Send customer view
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchInvoiceDetail, validateInvoiceToken, buildTicketFromInvoiceDetail, fetchShopHistoryByVehicleTag, sendHitsNotification, resolveInvoiceByInvToken } from '@/api/tickets'
import type { ShopHistoryEntry } from '@/api/tickets'
import { decodeInvoiceToken, encodeInvoiceToken, type InvoiceTokenParams } from '@/lib/invoice-token'
import { isShopSuppliesPartNum } from '@/lib/shop-supplies'
import type { Ticket, InvoiceDetailResponse, DetailRow } from '@/types/ticket'
import { mapVehicleStatusToApi } from '@/types/ticket'
import Dialog from '@/components/ui/Dialog.vue'
import DialogContent from '@/components/ui/DialogContent.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import SignaturePad from '@/components/SignaturePad.vue'
import ShopHistoryPanel from '@/components/ShopHistoryPanel.vue'
import TimelinePanel from '@/components/TimelinePanel.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { PhArrowClockwise, PhChatCircle, PhEnvelope, PhEye, PhPrinter } from '@phosphor-icons/vue'
import { cn } from '@/lib/utils'
import {
  getWorkApproval,
  getWorkApprovalItem,
  getApprovedTotal,
  upsertWorkApprovalItems,
  markNotificationSent,
  type WorkApprovalItemV1,
  type WorkApprovalRecordV1,
} from '@/lib/work-approvals'
import { getInvoiceViewStatus, getVehicleStatusChanges, isInvoiceActivelyViewed, markInvoiceViewAccessed, touchInvoiceViewActive, trackVehicleStatusChange } from '@/lib/invoice-view-tracker'

// Debug: Verify script is loading
console.log('CustomerInvoiceView.vue script loaded')

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const loadingDocumentType = ref<string | null>(null)
const error = ref('')
const refreshing = ref(false)
const invoiceData = ref<{
  ticket: Ticket
  invoiceDetail: InvoiceDetailResponse
} | null>(null)

const invoiceToken = ref<string>('')

// Advisor vs Customer view detection
// Check both query param and localStorage key
const isAdvisorView = computed(() => {
  if (typeof window === 'undefined') return false
  // Check query param first (when opened from TicketsPage)
  if (route.query.internal === 'true') return true
  // Check localStorage for advisor session
  return localStorage.getItem('advisor_logged_in') === 'true'
})

const isCustomerView = computed(() => !isAdvisorView.value)

const isPreviewMode = computed(() => route.query.preview === 'true')

// Use for layout: when preview, show customer view regardless of advisor session
const showAdvisorLayout = computed(() => isAdvisorView.value && !isPreviewMode.value)

const openPreviewCustomerView = () => {
  const token = route.query.inv ?? route.query.token ?? invoiceToken.value
  if (!token) return
  router.push({ path: '/cv', query: { inv: token, preview: 'true' } })
}

const goBackToAdvisorView = () => {
  const token = route.query.inv ?? route.query.token ?? invoiceToken.value
  if (!token) return
  router.push({ path: '/cv', query: { inv: token, internal: 'true' } })
}

const VEHICLE_STATUSES = [
  'Not Started',
  'Online Appointment',
  'Not Here Yet',
  'Check In',
  'On Lot',
  'In Shop',
  'Inspection Complete',
  'Awaiting Callback',
  'Awaiting Parts',
  'Out For Sublet',
  'Ready',
] as const

// Status popover state (internal view only)
const showStatusPopover = ref(false)
const statusBadgeRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const popoverPosition = ref({ top: 0, left: 0 })

const popoverStyle = computed(() => ({
  top: `${popoverPosition.value.top}px`,
  left: `${popoverPosition.value.left}px`,
}))

const updatePopoverPositionFromElement = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const popoverWidth = 224
  const popoverHeight = 320
  const padding = 8
  const spaceBelow = window.innerHeight - rect.bottom - padding
  const spaceAbove = rect.top - padding
  const showAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow
  let top = showAbove ? rect.top - popoverHeight - padding : rect.bottom + padding
  top = Math.max(padding, Math.min(top, window.innerHeight - popoverHeight - padding))
  let left = window.innerWidth < 640 ? (window.innerWidth - popoverWidth) / 2 : rect.left
  left = Math.max(padding, Math.min(left, window.innerWidth - popoverWidth - padding))
  popoverPosition.value = { top, left }
}

const toggleStatusPopover = (e?: MouseEvent) => {
  if (showStatusPopover.value) {
    showStatusPopover.value = false
    return
  }
  // Use clicked element for positioning (more reliable than ref which can be null)
  const anchorEl = (e?.currentTarget ?? statusBadgeRef.value) as HTMLElement | null
  if (anchorEl) {
    updatePopoverPositionFromElement(anchorEl)
  }
  showStatusPopover.value = true
}

// Close popover on scroll/resize when open
watch(showStatusPopover, (open) => {
  if (!open) return
  const handleScroll = () => {
    const el = statusBadgeRef.value
    if (el) updatePopoverPositionFromElement(el)
  }
  const handleResize = () => {
    const el = statusBadgeRef.value
    if (el) updatePopoverPositionFromElement(el)
  }
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', handleResize)
  return () => {
    window.removeEventListener('scroll', handleScroll, true)
    window.removeEventListener('resize', handleResize)
  }
})

// Close popover on Escape (click-outside is handled by transparent backdrop)
watch(showStatusPopover, (open) => {
  if (!open) return
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') showStatusPopover.value = false
  }
  document.addEventListener('keydown', handleEscape, true)
  return () => {
    document.removeEventListener('keydown', handleEscape, true)
  }
})

// Shop history state
const shopHistoryLoading = ref(false)
const shopHistoryError = ref('')
const shopHistoryEntries = ref<ShopHistoryEntry[]>([])
const shopHistoryLastTag = ref<string>('')
const selectedShopHistoryTicketNumber = ref<number | null>(null)
const isViewingHistoricalInvoice = computed(() => selectedShopHistoryTicketNumber.value !== null)

// Historical invoice detail loading state
const loadingHistoricalInvoiceDetail = ref(false)
const historicalInvoiceDetailError = ref<string>('')
const historicalInvoiceDetails = ref<Map<number, InvoiceDetailResponse>>(new Map())
let historicalInvoiceDetailAbortController: AbortController | null = null

// Panel visibility state
const showShopHistoryPanel = ref(true) // Default visible for advisor
const showTimelinePanel = ref(true) // Default visible for advisor
const showShopHistoryPanelMobile = ref(false)
const showTimelinePanelMobile = ref(false)

// Dialog state
const showApprovalsModal = ref(false)

// Hide timeline panel when entering preview mode (show only when user clicks Timeline button)
watch(isPreviewMode, (preview) => {
  if (preview) {
    showTimelinePanel.value = false
    showTimelinePanelMobile.value = false
  }
})

const selectedShopHistoryEntry = computed((): ShopHistoryEntry | null => {
  if (selectedShopHistoryTicketNumber.value === null) return null
  return (
    (shopHistoryEntries.value || []).find(
      (e) => e.ticket.ticketNumber === selectedShopHistoryTicketNumber.value
    ) ?? null
  )
})

const currentTicketForShopHistory = computed(() => {
  const t = invoiceData.value?.ticket
  if (!t) return null
  return {
    ticketNumber: t.ticketNumber,
    type: t.type,
    date: t.date,
    total: t.total,
  }
})

// Merged shop history entry with fetched detail data
const selectedShopHistoryEntryWithDetails = computed((): ShopHistoryEntry | null => {
  const entry = selectedShopHistoryEntry.value
  if (!entry || selectedShopHistoryTicketNumber.value === null) return null
  
  // Check if we have fetched detail data for this ticket
  const detailResponse = historicalInvoiceDetails.value.get(selectedShopHistoryTicketNumber.value)
  
  if (detailResponse && detailResponse.success) {
    // Merge the shop history entry with fetched detail data
    // Prioritize fetched detail data (invoiceRow and detailRows) over shop history entry data
    return {
      ...entry,
      invoiceRow: detailResponse.invoiceRow || entry.invoiceRow,
      detailRows: detailResponse.detailRows || entry.detailRows,
    }
  }
  
  // Return original entry if no detail data is available yet
  return entry
})

const handleSelectHistoricalInvoice = async (ticketNumber: number) => {
  const currentNum = invoiceData.value?.ticket?.ticketNumber
  if (currentNum != null && ticketNumber === currentNum) {
    selectedShopHistoryTicketNumber.value = null
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      showShopHistoryPanelMobile.value = false
    }
    return
  }
  // Force reactivity by setting to null first, then to the new value
  // This ensures Vue detects the change even if clicking the same invoice again
  if (selectedShopHistoryTicketNumber.value === ticketNumber) {
    selectedShopHistoryTicketNumber.value = null
    await nextTick()
  }
  selectedShopHistoryTicketNumber.value = ticketNumber
  // On mobile, close the panel after selection
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    showShopHistoryPanelMobile.value = false
  }

  // Cancel any previous detail fetch
  if (historicalInvoiceDetailAbortController) {
    historicalInvoiceDetailAbortController.abort()
  }
  
  // Check if we already have the detail data cached locally
  if (historicalInvoiceDetails.value.has(ticketNumber)) {
    historicalInvoiceDetailError.value = ''
    return
  }
  
  loadingHistoricalInvoiceDetail.value = true
  historicalInvoiceDetailError.value = ''
  
  historicalInvoiceDetailAbortController = new AbortController()
  
  try {
    const detailResponse = await fetchInvoiceDetail(
      {
        invoiceNum: ticketNumber,
        includeRawData: 'true',
        includeSchema: 'false',
      },
      historicalInvoiceDetailAbortController.signal
    )
    
    if (!detailResponse.success) {
      historicalInvoiceDetailError.value = detailResponse.error || 'Failed to load invoice details'
    } else {
      // Store the fetched detail data
      historicalInvoiceDetails.value.set(ticketNumber, detailResponse)
      historicalInvoiceDetailError.value = ''
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Request was cancelled, ignore
      return
    }
    console.error('Error fetching historical invoice detail:', error)
    historicalInvoiceDetailError.value = error?.message || 'Failed to load invoice details'
  } finally {
    loadingHistoricalInvoiceDetail.value = false
    historicalInvoiceDetailAbortController = null
  }
}

const backToCurrentInvoice = () => {
  selectedShopHistoryTicketNumber.value = null
  historicalInvoiceDetailError.value = ''
  // Cancel any pending detail fetch
  if (historicalInvoiceDetailAbortController) {
    historicalInvoiceDetailAbortController.abort()
    historicalInvoiceDetailAbortController = null
  }
}

// backToShopHistoryList removed - not needed with new panel design

// Work approvals (customer flow + advisor read-only)
const approvalRecord = ref<WorkApprovalRecordV1 | null>(null)
const showApproveSelectDialog = ref(false)
const showApproveConfirmDialog = ref(false)
const approvalSelection = ref<Record<string, boolean>>({})
const signatureDataUrl = ref('')
const verbalApproval = ref(false)
const verbalApproverName = ref('')
const approveUiError = ref('')
const approveUiWarning = ref('')
const approvingWork = ref(false)

const refreshApprovalRecord = () => {
  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  approvalRecord.value = ticketNum ? getWorkApproval(ticketNum) : null
  // Trigger timeline update by accessing a reactive value
  // The timelineData computed will recompute when this ref changes
  approvalUpdateTrigger.value = Date.now()
}

const refreshInvoice = async () => {
  if (refreshing.value) return
  const ticketNum = isViewingHistoricalInvoice.value
    ? selectedShopHistoryTicketNumber.value
    : invoiceData.value?.ticket?.ticketNumber
  if (!ticketNum) return

  refreshing.value = true
  try {
    const detailResponse = await fetchInvoiceDetail({
      invoiceNum: ticketNum,
      includeRawData: 'true',
      includeSchema: 'false',
    })
    if (!detailResponse.success) {
      if (isViewingHistoricalInvoice.value) {
        historicalInvoiceDetailError.value = detailResponse.error || 'Failed to load invoice details'
      } else {
        error.value = detailResponse.error || 'Failed to load invoice details'
      }
      return
    }
    if (isViewingHistoricalInvoice.value) {
      historicalInvoiceDetails.value.set(ticketNum, detailResponse)
      historicalInvoiceDetailError.value = ''
    } else {
      const ticket = invoiceData.value?.ticket
      if (ticket) {
        invoiceData.value = { ticket, invoiceDetail: detailResponse }
      }
      refreshApprovalRecord()
    }
  } catch (err) {
    console.error('Error refreshing invoice:', err)
    const msg = err instanceof Error ? err.message : 'Failed to refresh invoice'
    if (isViewingHistoricalInvoice.value) {
      historicalInvoiceDetailError.value = msg
    } else {
      error.value = msg
    }
  } finally {
    refreshing.value = false
  }
}

// Trigger for timeline reactivity when approvals change
const approvalUpdateTrigger = ref(Date.now())

const hasAnyApprovals = computed(() => (approvalRecord.value?.items?.length || 0) > 0)

// Shop information
const shopData = ref({
  name: 'Maverick Tire and Auto',
  address: {
    street: '3213 Lucas Ct',
    city: 'Waco',
    state: 'TX',
    zip: '76078',
  },
  phone: '(555) 123-4567',
  email: 'info@mavericktire.com',
  website: 'www.mavericktireonline.com',
  logoUrl: 'https://hitsdigital-portal.com/apps/dist/logo/92000-3.png?t=1769028386',
})

const shopName = computed(() => (shopData.value.name || '').trim())
const shopAddressLine1 = computed(() => (shopData.value.address?.street || '').trim())
const shopAddressLine2 = computed(() => {
  const city = (shopData.value.address?.city || '').trim()
  const state = (shopData.value.address?.state || '').trim()
  const zip = (shopData.value.address?.zip || '').trim()
  const cityState = city && state ? `${city}, ${state}` : (city || state)
  return zip ? `${cityState}${cityState ? ' ' : ''}${zip}` : cityState
})
const shopPhone = computed(() => (shopData.value.phone || '').trim())
const shopEmail = computed(() => (shopData.value.email || '').trim())
const shopWebsite = computed(() => (shopData.value.website || '').trim())

const shopLogoUrl = computed(() => (shopData.value.logoUrl || '').trim())
const hideShopLogo = ref(false)
watch(shopLogoUrl, () => { hideShopLogo.value = false })

// Reset panel visibility when entering preview mode (hide by default); restore when leaving
watch(
  isPreviewMode,
  (preview) => {
    if (preview) {
      showShopHistoryPanel.value = false
      showShopHistoryPanelMobile.value = false
    } else if (isAdvisorView.value) {
      showShopHistoryPanel.value = true
      showTimelinePanel.value = true
    }
  },
  { immediate: true }
)

watch(showApprovalsModal, (isOpen) => {
  if (isOpen) refreshApprovalRecord()
})

// When attrLink from notifications API is accessed (URL has section=approvals), open the approval dialog
watch(
  () => [loading.value, error.value, route.query.section],
  () => {
    if (!loading.value && !error.value && route.query.section === 'approvals') {
      nextTick(() => {
        showApprovalsModal.value = true
      })
    }
  },
  { immediate: true }
)

const showShopLogo = computed(() => !!shopLogoUrl.value && !hideShopLogo.value)

const hasAnyShopContactInfo = computed(() => !!shopPhone.value || !!shopEmail.value || !!shopWebsite.value)
const hasAnyShopTextInfo = computed(() => !!shopName.value || !!shopAddressLine1.value || !!shopAddressLine2.value || hasAnyShopContactInfo.value)
const hasAnyShopHeaderInfo = computed(() => hasAnyShopTextInfo.value || showShopLogo.value)
const hasFooterContactInfo = computed(() => !!shopPhone.value || !!shopEmail.value)


onMounted(async () => {
  // Support old route (/view/:token), cv?inv=... (external format), and cv?token=... (legacy)
  let token: string | null = null
  let tokenParams: InvoiceTokenParams | null = null

  // Check for cv query: inv (canonical) or token (legacy)
  const queryInv = route.query.inv as string | undefined
  const queryToken = route.query.token as string | undefined
  const queryTokenValue = queryInv ?? queryToken
  if (queryTokenValue) {
    token = queryTokenValue
    invoiceToken.value = queryTokenValue
    // Decode our format first (base64.hash with e,a,i)
    tokenParams = decodeInvoiceToken(queryTokenValue)
    if (!tokenParams) {
      // External/portal tokens (e.g. hitsdigital-portal.com): resolve via backend when configured
      const resolved = await resolveInvoiceByInvToken(queryTokenValue)
      if (resolved) {
        tokenParams = { e: '', a: '92000', i: String(resolved.invoiceNum) }
      } else {
        error.value = 'Invalid invoice token. The link may have expired or been created by another system.'
        loading.value = false
        return
      }
    }
  } else {
    // Check for old route format: /view/:token
    const paramToken = route.params.token as string
    if (paramToken) {
      token = paramToken
      invoiceToken.value = paramToken
      tokenParams = decodeInvoiceToken(paramToken)
      if (!tokenParams) {
        const resolved = await resolveInvoiceByInvToken(paramToken)
        if (resolved) {
          tokenParams = { e: '', a: '92000', i: String(resolved.invoiceNum) }
        }
        // If still no tokenParams, later logic falls back to localStorage
      }
    }
  }
  
  if (!token) {
    error.value = 'Invalid invoice link'
    loading.value = false
    return
  }

  try {
    let ticketNumber: number
    let ticket: Ticket | null = null
    
    // If we have decoded token parameters (new format)
    if (tokenParams) {
      ticketNumber = parseInt(tokenParams.i)
      const account = tokenParams.a

      // Validate token and fetch invoice detail (single API call, reused for display)
      const validation = await validateInvoiceToken(account, tokenParams.i)
      if (!validation.valid) {
        error.value = validation.error || 'Invalid invoice token'
        loading.value = false
        return
      }

      // Validate account number matches (client-side validation)
      if (tokenParams.a !== '92000') {
        error.value = 'Invalid account number'
        loading.value = false
        return
      }

      const invoiceDetailResponse = validation.invoiceDetail!
      ticket = buildTicketFromInvoiceDetail(invoiceDetailResponse)
      if (!ticket) {
        error.value = 'Invoice not found'
        loading.value = false
        return
      }
      loadingDocumentType.value = ticket.type

      invoiceData.value = {
        ticket,
        invoiceDetail: invoiceDetailResponse,
      }
    } else {
      // Legacy format: retrieve from localStorage
      const storedData = localStorage.getItem(`invoice_view_${token}`)
      if (!storedData) {
        error.value = 'Invoice not found or link has expired'
        loading.value = false
        return
      }

      const storedInvoiceData = JSON.parse(storedData)
      ticket = storedInvoiceData?.ticket
      ticketNumber = storedInvoiceData?.ticket?.ticketNumber
      if (ticket?.type) loadingDocumentType.value = ticket.type

      if (!ticketNumber || !ticket) {
        error.value = 'Invalid invoice data: ticket number not found'
        loading.value = false
        return
      }

      // Fetch fresh invoice detail from API
      const invoiceDetailResponse = await fetchInvoiceDetail({
        invoiceNum: ticketNumber,
        includeRawData: 'true',
        includeSchema: 'false',
      })

      if (!invoiceDetailResponse.success) {
        error.value = invoiceDetailResponse.error || 'Failed to load invoice details'
        loading.value = false
        return
      }

      invoiceData.value = {
        ticket: ticket!,
        invoiceDetail: invoiceDetailResponse,
      }
    }

    // Record "Ticket Viewed" for customer view – same path that drives the view-button pulse.
    // When in customer view, always update lastActive (or mark first view) and bump so the timeline "Ticket Viewed" event pulses.
    const internalFlag = route.query.internal === 'true'
    const previewFlag = route.query.preview === 'true'
    if (invoiceData.value.ticket.ticketNumber && token && !internalFlag && !previewFlag) {
      const ticketNum = invoiceData.value.ticket.ticketNumber
      const existing = getInvoiceViewStatus(ticketNum)
      const row = invoiceData.value.invoiceDetail?.invoiceRow
      const ticketTotal = row && (row.Total != null || row.Subtotal != null)
        ? (parseFloat(String(row.Total ?? row.Subtotal ?? 0)) || undefined)
        : undefined;
      if (!existing) {
        markInvoiceViewAccessed(ticketNum, token, { ticketTotal })
        const { buildTimelineEventForViewed } = await import('@/types/timeline')
        const { persistTimelineEvent } = await import('@/api/timeline')
        await persistTimelineEvent(buildTimelineEventForViewed(ticketNum, { ticketTotal }))
      } else {
        touchInvoiceViewActive(ticketNum)
      }
      viewStatusUpdateTrigger.value = Date.now()
    }

    // When the invoice view is first opened, if the ticket has a vehicle status and the timeline
    // has no vehicle status changes yet, seed the timeline with that status (from apptVehStatus).
    const ticketNumForTimeline = invoiceData.value.ticket.ticketNumber
    const initialStatus = invoiceData.value.ticket.vehicleStatus
    if (ticketNumForTimeline && initialStatus) {
      const existingChanges = getVehicleStatusChanges(ticketNumForTimeline)
      if (existingChanges.length === 0) {
        const row = invoiceData.value.invoiceDetail?.invoiceRow
        const ticketTotal = row && (row.Total != null || row.Subtotal != null)
          ? (parseFloat(String(row.Total ?? row.Subtotal ?? 0)) || undefined)
          : undefined;
        const userName = typeof window !== 'undefined' ? (localStorage.getItem('current_user') || localStorage.getItem('user_name') || undefined) : undefined
        trackVehicleStatusChange(ticketNumForTimeline, initialStatus, { user: userName, ticketTotal })
        const { buildTimelineEventForVehicleStatus } = await import('@/types/timeline')
        const { persistTimelineEvent } = await import('@/api/timeline')
        const { mapVehicleStatusToApi } = await import('@/types/ticket')
        const vehicleStatusNumeric = mapVehicleStatusToApi(initialStatus)
        await persistTimelineEvent(buildTimelineEventForVehicleStatus(ticketNumForTimeline, vehicleStatusNumeric, { user: userName, ticketTotal }))
        vehicleStatusUpdateTrigger.value = Date.now()
      }
    }

    loading.value = false
    refreshApprovalRecord()
    
    // Listen for work approval changes to update timeline
    const approvalChangeListener = () => {
      refreshApprovalRecord()
      approvalUpdateTrigger.value = Date.now()
    }
    window.addEventListener('work-approval-changed', approvalChangeListener)
    
      // Also listen for storage events (cross-tab changes)
    const storageEventListener = (e: StorageEvent) => {
      if (e.key === 'work_approvals_v1') {
        refreshApprovalRecord()
        approvalUpdateTrigger.value = Date.now()
      } else if (e.key && e.key.startsWith('vehicle_status_changes_')) {
        // Vehicle status change detected - refresh timeline
        const ticketNum = invoiceData.value?.ticket?.ticketNumber
        if (ticketNum && e.key === `vehicle_status_changes_${ticketNum}`) {
          vehicleStatusUpdateTrigger.value = Date.now()
          approvalUpdateTrigger.value = Date.now()
        }
      } else if (e.key && e.key.startsWith('invoice_view_status_')) {
        // Same as view-button pulse: storage fires when customer views in another tab
        const ticketNum = invoiceData.value?.ticket?.ticketNumber
        if (ticketNum && e.key === `invoice_view_status_${ticketNum}`) {
          viewStatusUpdateTrigger.value = Date.now()
        }
      }
    }
    window.addEventListener('storage', storageEventListener)
    
    // Same as view-button pulse: same-tab updates (e.g. customer view just called markInvoiceViewAccessed)
    const viewStatusChangeListener = (e: Event) => {
      const ticketNumber = (e as CustomEvent)?.detail?.ticketNumber
      if (typeof ticketNumber === 'number' && ticketNumber === invoiceData.value?.ticket?.ticketNumber) {
        viewStatusUpdateTrigger.value = Date.now()
      }
    }
    window.addEventListener('invoice-view-status-changed', viewStatusChangeListener)
    
    // Also listen for same-tab vehicle status changes (e.g. from TicketsPage)
    const vehicleStatusChangeListener = (e: Event) => {
      const detail = (e as CustomEvent<{ ticketNumber?: number; newStatus?: string }>)?.detail
      const ticketNumber = detail?.ticketNumber
      const newStatus = detail?.newStatus
      if (typeof ticketNumber !== 'number' || ticketNumber !== invoiceData.value?.ticket?.ticketNumber) return
      // Update displayed vehicle status so the badge reflects the change immediately
      if (newStatus != null && invoiceData.value) {
        invoiceData.value = {
          ...invoiceData.value,
          ticket: {
            ...invoiceData.value.ticket,
            vehicleStatus: newStatus as typeof invoiceData.value.ticket.vehicleStatus,
          },
        }
      }
      if (shopHistoryEntries.value.length > 0) {
        shopHistoryEntries.value = shopHistoryEntries.value.map((entry) =>
          entry.ticket.ticketNumber === ticketNumber
            ? { ...entry, ticket: { ...entry.ticket, vehicleStatus: newStatus ?? entry.ticket.vehicleStatus } }
            : entry
        )
      }
      vehicleStatusUpdateTrigger.value = Date.now()
      approvalUpdateTrigger.value = Date.now()
    }
    window.addEventListener('vehicle-status-changed', vehicleStatusChangeListener)

    // Load shop history automatically for customer view, or when advisor panel is visible
    if (isCustomerView.value || (isAdvisorView.value && showShopHistoryPanel.value)) {
      console.log('🔍 Auto-loading shop history - isCustomerView:', isCustomerView.value, 'isAdvisorView:', isAdvisorView.value, 'showShopHistoryPanel:', showShopHistoryPanel.value)
      void openShopHistoryDialog()
    }
  } catch (err) {
    console.error('Error loading invoice data:', err)
    error.value = err instanceof Error ? err.message : 'Error loading invoice data'
    loading.value = false
  }
})

onUnmounted(() => {
  if (ticketViewedPulseStopTimer) {
    clearTimeout(ticketViewedPulseStopTimer)
    ticketViewedPulseStopTimer = null
  }
  // Note: storage event listener cleanup is handled by the event listener itself
  // Custom event listeners should be cleaned up here if needed
})

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'W':
      return 'Workorder'
    case 'I':
      return 'Invoice'
    case 'B':
      return 'Invoice' // Batch shows as Invoice to customers
    case 'Q':
      return 'Quote'
    default:
      return 'Invoice'
  }
}

const getLoadingDocumentLabel = (type: string | null, details = false): string => {
  const suffix = details ? ' details' : ''
  if (!type) return `Loading${suffix}...`
  switch (type) {
    case 'W':
      return `Loading workorder${suffix}...`
    case 'Q':
      return `Loading quote${suffix}...`
    case 'I':
    case 'B':
    default:
      return `Loading invoice${suffix}...`
  }
}

const handleVehicleStatusChange = async (status: string) => {
  showStatusPopover.value = false
  const ticket = invoiceData.value?.ticket
  if (!ticket) return
  const currentStatus = (displayedVehicleStatus.value || 'Not Started').trim()
  if (status.trim() === currentStatus) return

  // Update local state immediately
  invoiceData.value = {
    ...invoiceData.value!,
    ticket: { ...ticket, vehicleStatus: status as Ticket['vehicleStatus'] },
  }
  if (shopHistoryEntries.value.length > 0) {
    shopHistoryEntries.value = shopHistoryEntries.value.map((entry) =>
      entry.ticket.ticketNumber === ticket.ticketNumber
        ? { ...entry, ticket: { ...entry.ticket, vehicleStatus: status as Ticket['vehicleStatus'] } }
        : entry
    )
  }

  if (typeof window !== 'undefined') {
    try {
      const userName = localStorage.getItem('current_user') || localStorage.getItem('user_name') || undefined
      const row = invoiceData.value?.invoiceDetail?.invoiceRow
      const ticketTotal = row && (row.Total != null || row.Subtotal != null)
        ? (parseFloat(String(row.Total ?? row.Subtotal ?? 0)) || undefined)
        : undefined
      trackVehicleStatusChange(ticket.ticketNumber, status, { user: userName, ticketTotal })
      const { buildTimelineEventForVehicleStatus } = await import('@/types/timeline')
      const { persistTimelineEvent } = await import('@/api/timeline')
      const vehicleStatusNumeric = mapVehicleStatusToApi(status as Ticket['vehicleStatus'])
      await persistTimelineEvent(buildTimelineEventForVehicleStatus(ticket.ticketNumber, vehicleStatusNumeric, { user: userName, ticketTotal }))
      window.dispatchEvent(new CustomEvent('vehicle-status-changed', {
        detail: { ticketNumber: ticket.ticketNumber, newStatus: status },
      }))
    } catch (err) {
      console.error('Error tracking vehicle status change:', err)
    }
  }

  try {
    const vehicleParts = ticket.vehicle ? ticket.vehicle.match(/^(.+?)\s+(\d{4})\s+\(([^)]+)\)$/) : null
    const vehMake = vehicleParts ? vehicleParts[1].split(' ')[0] : ''
    const vehModel = vehicleParts ? vehicleParts[1].split(' ').slice(1).join(' ') : ''
    const vehYear = vehicleParts ? vehicleParts[2] : ''
    const vehTag = vehicleParts ? vehicleParts[3] : ''
    const apptVehStatus = mapVehicleStatusToApi(status as Ticket['vehicleStatus'])
    const notificationPayload = {
      handlerId: 3,
      notificationType: status,
      ApptVehicleStatus: apptVehStatus,
      ticketNum: ticket.ticketNumber,
      storeNum: 3,
      custNum: 0,
      custFirstName: ticket.name.split(' ')[0] || '',
      custLastName: ticket.name.split(' ').slice(1).join(' ') || '',
      custEmail: '',
      custPhone: '',
      custMobile: '',
      custAddress: '',
      custCity: '',
      custState: '',
      custZip: '',
      apptDate: '',
      apptTime: 0,
      apptDescription: '',
      apptCode: '',
      apptVehStatus,
      apptCancel: '',
      comment: `Vehicle status updated to: ${status}`,
      vehTag,
      vehMake,
      vehModel,
      vehYear,
      vehVin: '',
      vehMileage: 0,
      attrType: '',
      attrMemo: '',
      attrLink: '',
    }
    const result = await sendHitsNotification(notificationPayload)
    if (!result.success) {
      console.error('Failed to send HITS notification:', result.error)
    }
  } catch (err) {
    console.error('Error sending vehicle status notification:', err)
  }

  vehicleStatusUpdateTrigger.value = Date.now()
  approvalUpdateTrigger.value = Date.now()
}

const getVehicleStatusColor = (status: string) => {
  switch (status) {
    case "Not Started":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "Online Appointment":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "Not Here Yet":
      return "bg-slate-200 text-slate-700 border-slate-300"
    case "Check In":
      return "bg-blue-300 text-blue-800 border-blue-400"
    case "On Lot":
      return "bg-blue-700 text-blue-100 border-blue-800"
    case "In Shop":
      return "bg-indigo-100 text-indigo-800 border-indigo-200"
    case "Inspection Complete":
      return "bg-teal-100 text-teal-800 border-teal-200"
    case "Awaiting Callback":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "Awaiting Parts":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Out For Sublet":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "Ready":
      return "bg-green-100 text-green-800 border-green-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

const formatMileage = (mileage: number): string => {
  return new Intl.NumberFormat('en-US').format(mileage)
}

// parseMmddyyyyToTime removed - not needed (ShopHistoryPanel handles sorting)

const getCurrentVehicleTag = (): string => {
  const fromInvoiceRow = invoiceData.value?.invoiceDetail?.invoiceRow?.AutoTag
  if (fromInvoiceRow && String(fromInvoiceRow).trim()) {
    const tag = String(fromInvoiceRow).trim()
    console.log('🔍 getCurrentVehicleTag: Using AutoTag from invoiceRow:', tag)
    return tag
  }
  const vehicle = invoiceData.value?.ticket?.vehicle
  const tag = vehicle ? (getVehicleLicensePlate(vehicle) || '').trim() : ''
  console.log('🔍 getCurrentVehicleTag: Using parsed license plate from vehicle:', vehicle, '-> tag:', tag)
  return tag
}

const getRegularLineItemsFromRows = (rows: DetailRow[]): DetailRow[] => {
  return (rows || []).filter((item) => {
    if (item.Props?.IsDeclined || item.Props?.IsComment) return false
    // Shop supplies belong with totals, not the line-item list (match CustomerInvoiceView behavior).
    return !isShopSuppliesPartNum(item.ProductNum)
  })
}

const getDeclinedLineItemsFromRows = (rows: DetailRow[]): DetailRow[] => {
  return (rows || []).filter((item) => {
    if (!item.Props?.IsDeclined) return false
    if (item.Props?.IsComment) return false
    // Keep shop supplies out of declined list as well.
    return !isShopSuppliesPartNum(item.ProductNum)
  })
}

const getCustomerPreviewLineItemsForHistory = (entry: ShopHistoryEntry): GroupedPackageItem[] => {
  const rows = entry.detailRows || []
  let grouped = groupItemsByPackage(getRegularLineItemsFromRows(rows))
  // Ensure stable ordering (same as CustomerInvoiceView)
  grouped = [...grouped].sort((a, b) => (Number(a.headerItem.LineNum) || 0) - (Number(b.headerItem.LineNum) || 0))
  return grouped
}

// getCustomerPreviewDeclinedItemsForHistory kept for potential future use in historical invoice view
const getCustomerPreviewDeclinedItemsForHistory = (entry: ShopHistoryEntry): GroupedPackageItem[] => {
  const rows = entry.detailRows || []
  return groupItemsByPackage(getDeclinedLineItemsFromRows(rows))
}

// sortedShopHistoryEntries removed - ShopHistoryPanel handles sorting internally

// Shop history now uses a dedicated details view (no inline expand/collapse).

// Guard against accidental re-entrancy (prevents reactive update loops)
let shopHistoryInFlight = false

const openShopHistoryDialog = async () => {
  const tag = getCurrentVehicleTag()
  console.log('🔍 openShopHistoryDialog: Called with tag:', tag, 'isAdvisorView:', isAdvisorView.value, 'isCustomerView:', isCustomerView.value)

  // If we already loaded this tag successfully, don't refetch on re-open.
  if (
    !shopHistoryLoading.value &&
    tag &&
    shopHistoryLastTag.value === tag &&
    shopHistoryEntries.value.length > 0 &&
    !shopHistoryError.value
  ) {
    console.log('🔍 openShopHistoryDialog: Skipping - already loaded for tag:', tag)
    return
  }

  if (shopHistoryInFlight) {
    console.log('🔍 openShopHistoryDialog: Skipping - already in flight')
    return
  }
  shopHistoryInFlight = true

  shopHistoryLoading.value = true
  shopHistoryError.value = ''
  shopHistoryEntries.value = []
  shopHistoryLastTag.value = tag
  selectedShopHistoryTicketNumber.value = null

  if (!tag) {
    console.warn('🔍 openShopHistoryDialog: No tag available')
    shopHistoryError.value = 'No license plate is available for this invoice.'
    shopHistoryLoading.value = false
    shopHistoryInFlight = false
    return
  }

  try {
    console.log('🔍 Shop History: Fetching with tag:', tag)
    const result = await fetchShopHistoryByVehicleTag(tag)
    console.log('🔍 Shop History: Result:', result.success ? `Success (${result.entries?.length || 0} entries)` : `Error: ${result.error}`)
    if (!result.success) {
      shopHistoryError.value = result.error || 'Failed to load shop history.'
      shopHistoryEntries.value = []
    } else {
      shopHistoryEntries.value = result.entries || []
    }
  } catch (err) {
    console.error('🔍 Shop History: Exception:', err)
    shopHistoryError.value = err instanceof Error ? err.message : 'Failed to load shop history.'
    shopHistoryEntries.value = []
  } finally {
    shopHistoryLoading.value = false
    shopHistoryInFlight = false
  }
}

const handlePrint = () => {
  window.print()
}

const handleShopHistoryButton = () => {
  if (isPreviewMode.value) {
    // Preview: toggle panel (mobile slide-out or desktop)
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      const wasVisible = showShopHistoryPanelMobile.value
      showShopHistoryPanelMobile.value = !showShopHistoryPanelMobile.value
      if (!wasVisible && showShopHistoryPanelMobile.value) {
        void openShopHistoryDialog()
      }
    } else {
      const wasVisible = showShopHistoryPanel.value
      showShopHistoryPanel.value = !showShopHistoryPanel.value
      if (!wasVisible && showShopHistoryPanel.value) {
        void openShopHistoryDialog()
      }
    }
  } else if (isAdvisorView.value) {
    // Advisor: toggle panel visibility
    const wasVisible = showShopHistoryPanel.value
    showShopHistoryPanel.value = !showShopHistoryPanel.value
    if (!wasVisible && showShopHistoryPanel.value) {
      void openShopHistoryDialog()
    }
  } else {
    // Customer (non-preview): on mobile, toggle slide-out panel
    if (window.innerWidth < 1024) {
      showShopHistoryPanelMobile.value = !showShopHistoryPanelMobile.value
    }
    // On desktop customer view, panel is always visible
  }
  // Load shop history if not already loaded
  if (shopHistoryEntries.value.length === 0 && !shopHistoryLoading.value) {
    void openShopHistoryDialog()
  }
}

const handleTimelineButton = () => {
  if (isPreviewMode.value) {
    // Preview: toggle panel (mobile slide-out or desktop), like advisor view
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      showTimelinePanelMobile.value = !showTimelinePanelMobile.value
    } else {
      showTimelinePanel.value = !showTimelinePanel.value
    }
  } else if (isAdvisorView.value) {
    // Advisor: toggle panel visibility
    showTimelinePanel.value = !showTimelinePanel.value
  } else {
    // Customer (non-preview): on mobile, toggle slide-out panel
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      showTimelinePanelMobile.value = !showTimelinePanelMobile.value
    }
  }
}

const parseVehicleString = (vehicle: string) => {
  if (!vehicle) return { make: '', model: '', year: '', licensePlate: '' }
  
  const match = vehicle.match(/^(.+?)\s+(\d{4})\s+\(([^)]+)\)$/)
  if (match) {
    const makeModel = match[1].trim()
    const parts = makeModel.split(' ')
    const make = parts[0] || ''
    const model = parts.slice(1).join(' ') || ''
    return {
      make,
      model,
      year: match[2],
      licensePlate: match[3],
    }
  }
  
  const tagMatch = vehicle.match(/\(([^)]+)\)/)
  const licensePlate = tagMatch ? tagMatch[1] : ''
  const withoutTag = vehicle.replace(/\s*\([^)]+\)\s*$/, '').trim()
  
  return {
    make: withoutTag,
    model: '',
    year: '',
    licensePlate,
  }
}

const getVehicleLicensePlate = (vehicle: string): string => {
  return parseVehicleString(vehicle).licensePlate
}

const formatLicensePlateDisplay = (plate: string | undefined, state?: string): string => {
  if (!plate && !state) return '—'
  const p = (plate ?? '').trim()
  const s = (state ?? '').trim()
  return s ? `${p} (${s})` : p || '—'
}

const getVehicleMakeModelYear = (vehicle: string): string => {
  const parsed = parseVehicleString(vehicle)
  const parts = [parsed.year, parsed.make, parsed.model].filter(Boolean)
  return parts.join(' ')
}

const getVehicleMileage = (): number | undefined => {
  if (invoiceData.value?.invoiceDetail?.invoiceRow?.Mileage !== undefined) {
    return invoiceData.value.invoiceDetail.invoiceRow.Mileage
  }
  const ticket = invoiceData.value?.ticket
  if (ticket && 'mileage' in ticket && ticket.mileage !== undefined) {
    return ticket.mileage
  }
  return undefined
}

const getVehicleVIN = (): string | undefined => {
  if (invoiceData.value?.invoiceDetail?.invoiceRow?.VIN) {
    return invoiceData.value.invoiceDetail.invoiceRow.VIN
  }
  return undefined
}

const getRegularLineItems = (): DetailRow[] => {
  if (!invoiceData.value?.invoiceDetail?.detailRows) return []
  return invoiceData.value.invoiceDetail.detailRows.filter((item) => {
    if (item.Props?.IsDeclined || item.Props?.IsComment) return false
    // Shop supplies should render in the totals area (subtotal/tax), not in the line-item list.
    return !isShopSuppliesPartNum(item.ProductNum)
  })
}

const getShopSuppliesLineItems = (): DetailRow[] => {
  if (!invoiceData.value?.invoiceDetail?.detailRows) return []
  return invoiceData.value.invoiceDetail.detailRows.filter((item) => {
    if (item.Props?.IsDeclined || item.Props?.IsComment) return false
    return isShopSuppliesPartNum(item.ProductNum)
  })
}

const getCustomerPreviewShopSuppliesTotal = computed((): number => {
  const items = getShopSuppliesLineItems()
  return items.reduce((sum, item) => sum + (parseFloat(item.Total || '0') || 0), 0)
})

const getDeclinedItems = (): DetailRow[] => {
  if (!invoiceData.value?.invoiceDetail?.detailRows) return []
  return invoiceData.value.invoiceDetail.detailRows.filter((item) => {
    if (!item.Props?.IsDeclined) return false
    // Keep shop supplies out of the declined list as well (they belong with totals).
    return !isShopSuppliesPartNum(item.ProductNum)
  })
}

// Combine duplicate OIL items with same PartNum
const combineDuplicateOILItems = (items: DetailRow[]): DetailRow[] => {
  // IMPORTANT: Do not mutate reactive `detailRows` objects.
  // This function is used inside computed/render paths; mutating source rows can cause
  // recursive update loops (and also corrupts totals by re-combining on each render).
  const itemsCopy: DetailRow[] = items.map((item) => ({
    ...item,
    Props: item.Props ? { ...item.Props } : undefined,
  }))
  const oilItemsMap = new Map<string, DetailRow[]>()
  const itemsToRemove = new Set<number>()
  
  // Find all OIL items (case-insensitive comparison)
  itemsCopy.forEach(item => {
    const rawsize = item.Rawsize?.trim().toUpperCase()
    if (rawsize === "OIL" && item.ProductNum) {
      if (!oilItemsMap.has(item.ProductNum)) {
        oilItemsMap.set(item.ProductNum, [])
      }
      oilItemsMap.get(item.ProductNum)!.push(item)
    }
  })
  
  // Combine quantities for duplicate OIL items with same PartNum
  oilItemsMap.forEach((oilItems) => {
    if (oilItems.length < 2) return // No duplicates
    
    // Sort by ItemNum (LineNum) to keep the one with smallest ItemNum
    oilItems.sort((a, b) => {
      return (Number(a.LineNum) || 0) - (Number(b.LineNum) || 0)
    })
    
    // Keep the one with smallest ItemNum
    const baseItem = oilItems[0]
    
    // Sum quantities from all duplicate OIL items
    let combinedQuantity = 0
    let combinedTotal = 0
    
    oilItems.forEach(item => {
      const qty = parseFloat(item.Quantity || '0') || 0
      const total = parseFloat(item.Total || '0') || 0
      combinedQuantity += qty
      combinedTotal += total
    })
    
    // Update the base item with combined values
    baseItem.Quantity = parseFloat(combinedQuantity.toFixed(2)).toString()
    baseItem.Total = parseFloat(combinedTotal.toFixed(2)).toString()
    
    // Mark all other duplicate OIL items for removal
    for (let i = 1; i < oilItems.length; i++) {
      itemsToRemove.add(oilItems[i].LineNum)
    }
  })
  
  return itemsCopy.filter(item => !itemsToRemove.has(item.LineNum))
}

// Group items by Package ID
interface GroupedPackageItem {
  packageId: number
  headerItem: DetailRow // Header item for the package (OIL item for oil change packages, first item for regular packages)
  items: DetailRow[] // All other items in the package (excluding header)
}

// Calculate total for all items in a group
const getGroupTotal = (group: GroupedPackageItem): number => {
  let total = parseFloat(group.headerItem.Total || '0') || 0
  if (group.items && group.items.length > 0) {
    group.items.forEach(item => {
      total += parseFloat(item.Total || '0') || 0
    })
  }
  return total
}

const groupItemsByPackage = (items: DetailRow[]): GroupedPackageItem[] => {
  // First, combine duplicate OIL items
  const combinedItems = combineDuplicateOILItems(items)
  
  // Step 1: Sort items by ItemNum (mapped to LineNum in DetailRow) smallest to largest
  // Note: ItemNum from API response is mapped to LineNum in the DetailRow interface
  // ItemNum is always a 4-digit integer (1000, 1002, 1004, etc.)
  const sortedItems = [...combinedItems].sort((a, b) => {
    // LineNum should already be a number, but ensure it's numeric for sorting
    const numA = Number(a.LineNum) || 0
    const numB = Number(b.LineNum) || 0
    const result = numA - numB
    // Debug: Uncomment to verify sorting
    // if (Math.abs(result) > 0) console.log(`Sorting: ${numA} vs ${numB} = ${result}`)
    return result
  })
  
  // Verify sort worked (for debugging - can be removed)
  // for (let i = 1; i < sortedItems.length; i++) {
  //   if (Number(sortedItems[i-1].LineNum) > Number(sortedItems[i].LineNum)) {
  //     console.warn('Sort failed!', sortedItems[i-1].LineNum, '>', sortedItems[i].LineNum)
  //   }
  // }
  
  // Track which items have been processed
  const processedLineNums = new Set<number>()
  const grouped: GroupedPackageItem[] = []
  
  // Step 2: Process OIL items as special group headers
  // Only process the OIL item with the smallest ItemNum if there are multiple OIL items
  // For the selected OIL item, make it a header and nest:
  // - The OIL FILTER (if it has RAWSIZE = "OIL FILTER" or ExtendedDescription contains "OIL FILTER")
  // - The item after it (next ItemNum)
  
  // First, find all OIL items and sort by ItemNum to get the smallest one
  const oilItems: DetailRow[] = []
  for (let i = 0; i < sortedItems.length; i++) {
    if (processedLineNums.has(sortedItems[i].LineNum)) continue
    
    const currentItem = sortedItems[i]
    const rawsize = currentItem.Rawsize?.trim().toUpperCase() || ""
    
    if (rawsize === "OIL") {
      oilItems.push(currentItem)
    }
  }
  
  // Sort OIL items by ItemNum and only process the first one (smallest ItemNum)
  oilItems.sort((a, b) => {
    return (Number(a.LineNum) || 0) - (Number(b.LineNum) || 0)
  })
  
  // Only process the first OIL item (smallest ItemNum)
  if (oilItems.length > 0) {
    const oilItem = oilItems[0]
    const oilItemIndex = sortedItems.findIndex(item => item.LineNum === oilItem.LineNum)
    
    if (oilItemIndex !== -1 && !processedLineNums.has(oilItem.LineNum)) {
      const nestedItems: DetailRow[] = []
      
      // Find OIL FILTER anywhere in the sorted items (regardless of ItemNum position)
      // OIL FILTER should always be nested under OIL
      for (let j = 0; j < sortedItems.length; j++) {
        if (sortedItems[j].LineNum === oilItem.LineNum) continue // Skip the OIL item itself
        if (processedLineNums.has(sortedItems[j].LineNum)) continue // Skip already processed items
        
        const checkItem = sortedItems[j]
        const checkRawsize = checkItem.Rawsize?.trim().toUpperCase() || ""
        const checkDescription = checkItem.Description?.trim().toUpperCase() || ""
        
        // Check if this is an OIL FILTER:
        // 1. Rawsize is exactly "OIL FILTER", OR
        // 2. ExtendedDescription (stored in Description field) contains "OIL FILTER" (case-insensitive)
        const hasRawsizeOilFilter = checkRawsize === "OIL FILTER"
        const hasDescriptionOilFilter = checkDescription.includes("OIL FILTER")
        const isOilFilter = hasRawsizeOilFilter || hasDescriptionOilFilter
        
        if (isOilFilter) {
          nestedItems.push(checkItem)
          processedLineNums.add(checkItem.LineNum)
          break // Only one OIL FILTER per OIL item
        }
      }
      
      // Find the immediate next ItemNum (LineNum) after OIL
      // Since ItemNum increments by 2 (1000, 1002, 1004, etc.), nest only the next ItemNum (OIL ItemNum + 2)
      const oilItemNum = Number(oilItem.LineNum) || 0
      const expectedNextItemNum = oilItemNum + 2
      
      // Find the item with ItemNum = OIL ItemNum + 2 (the immediate next ItemNum)
      // Exclude items that are already in nestedItems (like OIL FILTER)
      const nestedItemNums = new Set(nestedItems.map(item => Number(item.LineNum) || 0))
      
      for (let j = 0; j < sortedItems.length; j++) {
        if (sortedItems[j].LineNum === oilItem.LineNum) continue // Skip the OIL item itself
        if (processedLineNums.has(sortedItems[j].LineNum)) continue // Skip already processed items
        
        const checkItemNum = Number(sortedItems[j].LineNum) || 0
        // Only nest the immediate next ItemNum (OIL ItemNum + 2), and exclude items already nested
        if (checkItemNum === expectedNextItemNum && !nestedItemNums.has(checkItemNum)) {
          nestedItems.push(sortedItems[j])
          processedLineNums.add(sortedItems[j].LineNum)
          break // Only nest the immediate next ItemNum
        }
      }
      
      // Mark OIL item as processed and add to grouped
      // Sort nested items by LineNum to maintain order (ItemNum is always numeric)
      nestedItems.sort((a, b) => {
        return (Number(a.LineNum) || 0) - (Number(b.LineNum) || 0)
      })
      processedLineNums.add(oilItem.LineNum)
      grouped.push({
        packageId: oilItem.Package ?? 0,
        headerItem: oilItem,
        items: nestedItems,
      })
    }
  }
  
  // Step 3: Group remaining items by Package ID
  const packageMap = new Map<number, DetailRow[]>()
  
  sortedItems.forEach(item => {
    if (processedLineNums.has(item.LineNum)) return // Already processed as part of oil change package
    
    const packageId = item.Package ?? 0
    if (!packageMap.has(packageId)) {
      packageMap.set(packageId, [])
    }
    packageMap.get(packageId)!.push(item)
  })
  
  // Step 4: Process regular packages
  // Sort packages by the smallest ItemNum (LineNum) in each package to maintain order
  const sortedPackages = Array.from(packageMap.entries()).sort((a, b) => {
    const minA = Math.min(...a[1].map(item => Number(item.LineNum) || 0))
    const minB = Math.min(...b[1].map(item => Number(item.LineNum) || 0))
    return minA - minB
  })
  
  sortedPackages.forEach(([packageId, packageItems]) => {
    // Items with Package ID 0 are always standalone (not grouped together)
    if (packageId === 0) {
      // Each item with Package ID 0 is standalone
      // Sort by LineNum to ensure proper order (ItemNum is always numeric)
      const sortedStandaloneItems = [...packageItems].sort((a, b) => {
        return (Number(a.LineNum) || 0) - (Number(b.LineNum) || 0)
      })
      sortedStandaloneItems.forEach(item => {
        grouped.push({
          packageId: 0,
          headerItem: item,
          items: [],
        })
      })
      return
    }
    
    // For packages with non-zero package ID:
    // Sort items by ItemNum (LineNum) - first item becomes header, rest are nested
    const sortedPackageItems = [...packageItems].sort((a, b) => {
      return (Number(a.LineNum) || 0) - (Number(b.LineNum) || 0)
    })
    const headerItem = sortedPackageItems[0]
    const otherItems = sortedPackageItems.slice(1)
    // Ensure otherItems are also sorted (they should be already, but be explicit)
    otherItems.sort((a, b) => {
      return (Number(a.LineNum) || 0) - (Number(b.LineNum) || 0)
    })
    
    grouped.push({
      packageId,
      headerItem,
      items: otherItems,
    })
  })
  
  // Return groups sorted by the header item's ItemNum (LineNum)
  // ItemNum is always a 4-digit integer, so simple numeric comparison works
  const finalSorted = grouped.sort((a, b) => {
    const numA = Number(a.headerItem.LineNum) || 0
    const numB = Number(b.headerItem.LineNum) || 0
    const result = numA - numB
    // Debug: Uncomment to verify final sort
    // if (Math.abs(result) > 0) console.log(`Final sort: ${numA} vs ${numB} = ${result}`)
    return result
  })
  
  // Verify final sort worked (for debugging - can be removed)
  // for (let i = 1; i < finalSorted.length; i++) {
  //   if (Number(finalSorted[i-1].headerItem.LineNum) > Number(finalSorted[i].headerItem.LineNum)) {
  //     console.warn('Final sort failed!', finalSorted[i-1].headerItem.LineNum, '>', finalSorted[i].headerItem.LineNum)
  //   }
  // }
  
  return finalSorted
}

const getCustomerPreviewLineItems = computed((): GroupedPackageItem[] => {
  console.log('=== getCustomerPreviewLineItems called ===')
  console.log('invoiceData.value exists:', !!invoiceData.value)
  console.log('invoiceData.value?.invoiceDetail exists:', !!invoiceData.value?.invoiceDetail)
  console.log('invoiceData.value?.invoiceDetail?.detailRows exists:', !!invoiceData.value?.invoiceDetail?.detailRows)
  console.log('detailRows length:', invoiceData.value?.invoiceDetail?.detailRows?.length)
  
  if (!invoiceData.value?.invoiceDetail?.detailRows) {
    console.log('Early return - no detailRows')
    return []
  }
  
  // Get items
  const allItems = getRegularLineItems()
  console.log('allItems length:', allItems.length)
  
  // Debug: Log items before grouping
  console.log('Items before grouping:', allItems.map(i => ({
    LineNum: i.LineNum,
    LineNumType: typeof i.LineNum,
    Desc: i.Description?.substring(0, 30)
  })))
  
  // Group items (this function already sorts internally)
  let grouped = groupItemsByPackage(allItems)
  
  // Final sort to ensure groups are in ItemNum order (1000, 1002, 1004, etc.)
  // Create a new array to ensure Vue reactivity picks up the change
  grouped = [...grouped].sort((a, b) => {
    const numA = Number(a.headerItem.LineNum) || 0
    const numB = Number(b.headerItem.LineNum) || 0
    return numA - numB
  })
  
  // Debug: Log final sorted groups
  console.log('Final sorted groups:', grouped.map(g => ({
    LineNum: g.headerItem.LineNum,
    LineNumType: typeof g.headerItem.LineNum,
    Desc: g.headerItem.Description?.substring(0, 30)
  })))
  
  return grouped
})

const getCustomerPreviewDeclinedItems = computed((): GroupedPackageItem[] => {
  const items = getDeclinedItems()
  return groupItemsByPackage(items)
})

// --- Work approvals helpers (customer + advisor) ---
const formatDateMmddyyyy = (date: Date): string => {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

const formatTimeForMemo = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const approvalGroups = computed(() => {
  // Explicitly filter out any shop supplies that might have slipped through
  return getCustomerPreviewLineItems.value.filter((group) => {
    // Check header item
    if (isShopSuppliesPartNum(group.headerItem.ProductNum)) return false
    // Check nested items
    if (group.items && group.items.some((item) => isShopSuppliesPartNum(item.ProductNum))) {
      return false
    }
    return true
  })
})

const getServiceGroupKey = (group: GroupedPackageItem): string => {
  return `${group.packageId}:${group.headerItem.LineNum}`
}

const isServiceGroupApproved = (group: GroupedPackageItem): boolean => {
  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  if (!ticketNum) return false
  return !!getWorkApprovalItem(ticketNum, getServiceGroupKey(group))
}

const isServiceGroupSelected = (group: GroupedPackageItem): boolean => {
  return !!approvalSelection.value[getServiceGroupKey(group)]
}

const setServiceGroupSelected = (group: GroupedPackageItem, selected: boolean) => {
  approveUiError.value = ''
  approvalSelection.value = {
    ...approvalSelection.value,
    [getServiceGroupKey(group)]: selected,
  }
}

const eligibleApprovalGroups = computed(() => {
  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  if (!ticketNum) return [] as GroupedPackageItem[]
  return approvalGroups.value.filter((g) => !getWorkApprovalItem(ticketNum, getServiceGroupKey(g)))
})

const selectedApprovalGroups = computed(() => {
  return approvalGroups.value.filter((g) => isServiceGroupSelected(g))
})

const eligibleApprovalTotal = computed(() => {
  return eligibleApprovalGroups.value.reduce((sum, g) => sum + getGroupTotal(g), 0)
})

const selectedApprovalTotal = computed(() => {
  return selectedApprovalGroups.value.reduce((sum, g) => sum + getGroupTotal(g), 0)
})

// Alias names used by the UI when re-approving additional work
const newSelectedApprovalGroups = computed(() => selectedApprovalGroups.value)
const newSelectedApprovalTotal = computed(() => selectedApprovalTotal.value)

const existingApprovedTotal = computed(() => {
  const items = approvalRecord.value?.items ?? []
  return items.reduce((sum, i) => sum + (Number.isFinite(i.amount) ? i.amount : 0), 0)
})

const totalApprovedAfterSelection = computed(() => {
  return existingApprovedTotal.value + newSelectedApprovalTotal.value
})

const getApprovalForGroup = (group: GroupedPackageItem): WorkApprovalItemV1 | null => {
  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  if (!ticketNum) return null
  return getWorkApprovalItem(ticketNum, getServiceGroupKey(group))
}

const advisorApprovedTotal = computed(() => {
  const items = approvalRecord.value?.items ?? []
  return items.reduce((sum, i) => sum + (Number.isFinite(i.amount) ? i.amount : 0), 0)
})

const advisorLatestApproval = computed(() => {
  const items = approvalRecord.value?.items ?? []
  if (items.length === 0) return null
  return items.reduce((latest, item) => {
    if (!latest) return item
    return item.approvedAtIso > latest.approvedAtIso ? item : latest
  }, null as WorkApprovalItemV1 | null)
})

const advisorLatestApprovedDate = computed(() => advisorLatestApproval.value?.approvedDate ?? '')
const advisorLatestApprovedTime = computed(() => advisorLatestApproval.value?.approvedTime ?? '')
// advisorApproverIp removed - not needed without PIN panel
const advisorSignatureDataUrl = computed(() => advisorLatestApproval.value?.signatureDataUrl ?? '')

const advisorApprovedGroups = computed(() => {
  return approvalGroups.value.filter((g) => !!getApprovalForGroup(g))
})

/** All approval items from the record, sorted by line number. Use this for display so all approvals show regardless of approval method. */
const sortedApprovalItems = computed((): WorkApprovalItemV1[] => {
  const items = approvalRecord.value?.items ?? []
  return [...items].sort((a, b) => a.lineNum - b.lineNum)
})

/** First and latest approval timestamps for summary display when we have multiple approval batches */
const approvalDateRange = computed(() => {
  const items = approvalRecord.value?.items ?? []
  if (items.length === 0) return null
  const sorted = [...items].sort((a, b) => a.approvedAtIso.localeCompare(b.approvedAtIso))
  const first = sorted[0]
  const latest = sorted[sorted.length - 1]
  const firstStr = `${first.approvedDate} ${first.approvedTime}`
  const latestStr = `${latest.approvedDate} ${latest.approvedTime}`
  return firstStr === latestStr ? firstStr : { first: firstStr, latest: latestStr }
})

// advisorDeclinedGroups removed - not displayed in new timeline panel

const isAllEligibleSelected = computed(() => {
  if (eligibleApprovalGroups.value.length === 0) return false
  return eligibleApprovalGroups.value.every((g) => isServiceGroupSelected(g))
})

const setAllEligibleSelected = (checked: boolean) => {
  approveUiError.value = ''
  const next: Record<string, boolean> = { ...approvalSelection.value }
  for (const g of eligibleApprovalGroups.value) {
    next[getServiceGroupKey(g)] = checked
  }
  approvalSelection.value = next
}

const showApproveWorkButton = computed(() => {
  // Only show for customer view, not when viewing historical invoice
  if (isAdvisorView.value) return false
  if (isViewingHistoricalInvoice.value) return false
  if (!invoiceData.value?.ticket?.ticketNumber) return false
  // Show if there is anything left to approve OR if the customer is revisiting approvals.
  return eligibleApprovalGroups.value.length > 0 || hasAnyApprovals.value
})

const showAdvisorApproveWorkButton = computed(() => {
  if (!isAdvisorView.value) return false
  if (!invoiceData.value?.ticket?.ticketNumber) return false
  return eligibleApprovalGroups.value.length > 0 || hasAnyApprovals.value
})

const openApproveDialog = () => {
  approveUiError.value = ''
  approveUiWarning.value = ''
  signatureDataUrl.value = ''
  verbalApproval.value = false
  verbalApproverName.value = ''
  approvalSelection.value = {}
  refreshApprovalRecord()
  // Default to all eligible services selected
  const next: Record<string, boolean> = {}
  for (const g of eligibleApprovalGroups.value) {
    next[getServiceGroupKey(g)] = true
  }
  approvalSelection.value = next
  showApproveSelectDialog.value = true
}

const openConfirmDialog = () => {
  approveUiError.value = ''
  approveUiWarning.value = ''
  if (selectedApprovalGroups.value.length === 0) {
    approveUiError.value = 'Please select at least one service to approve.'
    return
  }
  showApproveConfirmDialog.value = true
}

const handleApproveContinue = () => {
  approveUiError.value = ''
  if (selectedApprovalGroups.value.length === 0) {
    approveUiError.value = 'Please select at least one service to approve.'
    return
  }
  if (isAdvisorView.value && verbalApproval.value) {
    if (!verbalApproverName.value.trim()) {
      approveUiError.value = 'Approver name is required for verbal approval.'
      return
    }
    submitVerbalApproval()
    return
  }
  openConfirmDialog()
}

const submitVerbalApproval = async () => {
  approveUiError.value = ''
  approveUiWarning.value = ''

  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  if (!ticketNum) {
    approveUiError.value = 'Ticket number is missing.'
    return
  }

  approvingWork.value = true
  const now = new Date()
  const approvedAtIso = now.toISOString()
  const approvedDate = formatDateMmddyyyy(now)
  const approvedTime = formatTimeForMemo(now)
  const approverName = verbalApproverName.value.trim()

  const itemsToUpsert: WorkApprovalItemV1[] = selectedApprovalGroups.value.map((group) => ({
    key: getServiceGroupKey(group),
    lineNum: group.headerItem.LineNum,
    description: group.headerItem.Description || '—',
    amount: getGroupTotal(group),
    approvedAtIso,
    approvedDate,
    approvedTime,
    approverIp: 'unknown',
    signatureDataUrl: '',
    verbalApproval: true,
    approverName,
  }))

  try {
    const existingApproval = getWorkApproval(ticketNum)
    const record = upsertWorkApprovalItems(ticketNum, itemsToUpsert, approvedAtIso)
    const prevItemCount = existingApproval?.items?.length ?? 0
    const isAdditionalWork = prevItemCount > 0 && record.items && record.items.length > prevItemCount
    const shouldSendNotification =
      !existingApproval ||
      existingApproval.items.length === 0 ||
      !existingApproval.notificationSent ||
      isAdditionalWork
    approvalRecord.value = record
    approvalUpdateTrigger.value = Date.now()

    const { buildTimelineEventForApproval } = await import('@/types/timeline')
    const { persistTimelineEvent } = await import('@/api/timeline')
    const approvalTotal = getApprovedTotal(ticketNum)
    const approvalDetails = JSON.stringify(record.items ?? [])
    const approvalSignature = record.items?.[0]?.signatureDataUrl ?? ''
    const attrLink = buildApprovalsLink(ticketNum)
    await persistTimelineEvent(
      buildTimelineEventForApproval(ticketNum, approvalTotal, approvalDetails, approvalSignature, {
        approvalName: approverName,
        datetime: approvedAtIso,
        approvalLink: attrLink || undefined,
      })
    )

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('work-approval-changed', {
        detail: { ticketNumber: ticketNum }
      }))
    }

    if (shouldSendNotification) {
      const attrMemo = isAdditionalWork
        ? `Additional work approved verbally by ${approverName} on ${approvedDate} at ${approvedTime}`
        : `Work approved verbally by ${approverName} on ${approvedDate} at ${approvedTime}`
      const comment = buildApprovalNotificationCommentFromItems(record.items || [])
      const link = attrLink || buildApprovalsLink(ticketNum)
      const notificationResult = await sendHitsNotification({
        handlerId: 4,
        notificationType: 'Work Approved',
        ticketNum,
        storeNum: 0,
        comment,
        attrType: 'Authorization',
        attrMemo,
        attrLink: link,
      })
      if (notificationResult.success) {
        markNotificationSent(ticketNum)
      } else {
        approveUiWarning.value = notificationResult.error || 'Approval saved, but notification failed to send.'
      }
    }

    showApproveSelectDialog.value = false
    await nextTick()
    if (typeof document !== 'undefined') {
      setTimeout(() => { document.body.style.overflow = '' }, 100)
    }
  } catch (err) {
    approveUiError.value = err instanceof Error ? err.message : 'Failed to save approval.'
  } finally {
    approvingWork.value = false
  }
}

const buildApprovalsLink = (ticketNum?: number): string => {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  const num = ticketNum ?? invoiceData.value?.ticket?.ticketNumber

  // Same URL token for both internal and external: always use cv?inv=<token>&internal=true&section=approvals
  const queryInv = route.query.inv as string | undefined
  const queryToken = route.query.token as string | undefined
  const paramToken = route.params.token as string | undefined
  let token = queryInv ?? queryToken ?? paramToken ?? invoiceToken.value
  if (!token && num) {
    token = encodeInvoiceToken({ e: 'a', a: '92000', i: String(num) })
  }
  if (token) {
    return `${origin}/cv?inv=${encodeURIComponent(token)}&internal=true&section=approvals`
  }
  if (num) {
    const fallbackToken = encodeInvoiceToken({ e: 'a', a: '92000', i: String(num) })
    return `${origin}/cv?inv=${encodeURIComponent(fallbackToken)}&internal=true&section=approvals`
  }
  return origin
}

const buildApprovalNotificationCommentFromItems = (items: WorkApprovalItemV1[]): string => {
  const parts = (items || [])
    .slice()
    .sort((a, b) => a.lineNum - b.lineNum)
    .map((i) => `${(i.description || '—').replace(/\\s+/g, ' ').trim()} ($${i.amount.toFixed(2)})`)

  const comment = `Approved services: ${parts.join('; ')}`

  // Keep the comment reasonably sized for downstream systems.
  const MAX_LEN = 900
  return comment.length > MAX_LEN ? `${comment.slice(0, MAX_LEN - 1)}…` : comment
}

const submitApproval = async () => {
  approveUiError.value = ''
  approveUiWarning.value = ''

  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  if (!ticketNum) {
    approveUiError.value = 'Ticket number is missing.'
    return
  }

  if (selectedApprovalGroups.value.length === 0) {
    approveUiError.value = 'Please select at least one service to approve.'
    return
  }

  if (!signatureDataUrl.value) {
    approveUiError.value = 'Signature is required.'
    return
  }

  approvingWork.value = true
  const now = new Date()
  const approvedAtIso = now.toISOString()
  const approvedDate = formatDateMmddyyyy(now)
  const approvedTime = formatTimeForMemo(now)

  const itemsToUpsert: WorkApprovalItemV1[] = selectedApprovalGroups.value.map((group) => ({
    key: getServiceGroupKey(group),
    lineNum: group.headerItem.LineNum,
    description: group.headerItem.Description || '—',
    amount: getGroupTotal(group),
    approvedAtIso,
    approvedDate,
    approvedTime,
    approverIp: 'unknown',
    signatureDataUrl: signatureDataUrl.value,
  }))

  try {
    const existingApproval = getWorkApproval(ticketNum)
    const record = upsertWorkApprovalItems(ticketNum, itemsToUpsert, approvedAtIso)
    const prevItemCount = existingApproval?.items?.length ?? 0
    const isAdditionalWork = prevItemCount > 0 && record.items && record.items.length > prevItemCount
    const shouldSendNotification =
      !existingApproval ||
      existingApproval.items.length === 0 ||
      !existingApproval.notificationSent ||
      isAdditionalWork
    approvalRecord.value = record
    
    // Update timeline trigger to refresh timeline display
    approvalUpdateTrigger.value = Date.now()

    const { buildTimelineEventForApproval } = await import('@/types/timeline')
    const { persistTimelineEvent } = await import('@/api/timeline')
    const approvalTotal = getApprovedTotal(ticketNum)
    const approvalDetails = JSON.stringify(record.items ?? [])
    const approvalSignature = record.items?.[0]?.signatureDataUrl ?? ''
    const attrLink = buildApprovalsLink(ticketNum)
    await persistTimelineEvent(
      buildTimelineEventForApproval(ticketNum, approvalTotal, approvalDetails, approvalSignature, {
        datetime: approvedAtIso,
        approvalLink: attrLink || undefined,
      })
    )
    
    // Dispatch custom event to notify other components (e.g., TicketsPage) of approval change
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('work-approval-changed', {
detail: { ticketNumber: ticketNum }
      }))
    }

    // Send notification for first approval or when additional work is approved
    if (shouldSendNotification) {
      const attrMemo = isAdditionalWork
        ? `Additional work approved on ${approvedDate} at ${approvedTime}`
        : `Work approved on ${approvedDate} at ${approvedTime}`
      const comment = buildApprovalNotificationCommentFromItems(record.items || [])
      const link = attrLink || buildApprovalsLink(ticketNum)
      const notificationResult = await sendHitsNotification({
        handlerId: 4,
        notificationType: 'Work Approved',
        ticketNum: ticketNum,
        storeNum: 0,
        comment,
        attrType: 'Authorization',
        attrMemo,
        attrLink: link,
      })

      if (notificationResult.success) {
        // Mark notification as sent to prevent duplicate notifications
        markNotificationSent(ticketNum)
      } else {
        approveUiWarning.value = notificationResult.error || 'Approval saved, but notification failed to send.'
      }
    }

    // Close dialogs in sequence to ensure proper scroll unlock
    showApproveConfirmDialog.value = false
    await nextTick()
    showApproveSelectDialog.value = false
    await nextTick()
    
    // Force scroll unlock as a safety measure (Dialog component uses a counter that might get out of sync)
    if (typeof document !== 'undefined') {
      // Use setTimeout to ensure this runs after all dialog watchers have processed
      setTimeout(() => {
        document.body.style.overflow = ''
      }, 100)
    }
  } catch (err) {
    approveUiError.value = err instanceof Error ? err.message : 'Failed to save approval.'
  } finally {
    approvingWork.value = false
  }
}

const getCustomerPreviewSubtotal = (): number | undefined => {
  if (!invoiceData.value?.invoiceDetail?.invoiceRow?.Subtotal) return undefined
  const apiSubtotal = parseFloat(invoiceData.value.invoiceDetail.invoiceRow.Subtotal) || 0
  // Subtract shop supplies from the API subtotal to show services-only subtotal
  return apiSubtotal - getCustomerPreviewShopSuppliesTotal.value
}

const getCustomerPreviewTotal = (): number | undefined => {
  const subtotal = getCustomerPreviewSubtotal()
  if (subtotal === undefined) return undefined
  
  const shopSupplies = getCustomerPreviewShopSuppliesTotal.value
  const salesTax = invoiceData.value?.invoiceDetail?.invoiceRow?.SalesTax 
    ? parseFloat(invoiceData.value.invoiceDetail.invoiceRow.SalesTax) || 0 
    : 0
  
  // Add back shop supplies that were subtracted from the subtotal
  return subtotal + shopSupplies + salesTax
}

// Reactive trigger for vehicle status changes
const vehicleStatusUpdateTrigger = ref(Date.now())
// Same reactive trigger as view-button pulse (TicketsPage): storage + invoice-view-status-changed
const viewStatusUpdateTrigger = ref(Date.now())

// Timeline data computation
const timelineData = computed(() => {
  // Access approvalUpdateTrigger to make this reactive to approval changes
  void approvalUpdateTrigger.value
  // Access vehicleStatusUpdateTrigger to make this reactive to vehicle status changes
  void vehicleStatusUpdateTrigger.value
  // Same trigger as view-button pulse – timeline "Ticket Viewed" stays in sync with view button
  void viewStatusUpdateTrigger.value
  
  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  if (!ticketNum) {
    return {
      ticketSentEvents: [],
      ticketViewed: null,
      workApprovals: [],
      currentVehicleStatus: null,
      vehicleStatusChanges: [],
    }
  }

  // Get all ticket sent events (array of sends)
  let ticketSentEvents: Array<{ timestamp: number; sentBy?: string }> = []
  if (typeof window !== 'undefined') {
    try {
      const { getAllTicketSentEvents } = require('@/lib/invoice-view-tracker')
      ticketSentEvents = getAllTicketSentEvents(ticketNum)
    } catch {
      // Fallback to direct localStorage access
      try {
        const stored = localStorage.getItem(`ticket_sent_${ticketNum}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            ticketSentEvents = parsed.filter((item): item is { timestamp: number; sentBy?: string } =>
              typeof item === 'object' && item !== null && typeof item.timestamp === 'number'
            )
          } else if (typeof parsed === 'object' && parsed.timestamp) {
            ticketSentEvents = [parsed]
          } else {
            const timestamp = parseInt(stored)
            if (!isNaN(timestamp)) {
              ticketSentEvents = [{ timestamp }]
            }
          }
        }
      } catch {
        const stored = localStorage.getItem(`ticket_sent_${ticketNum}`)
        if (stored) {
          const timestamp = parseInt(stored)
          if (!isNaN(timestamp)) {
            ticketSentEvents = [{ timestamp }]
          }
        }
      }
    }
  }

  // Same function that drives the view-button pulse: getInvoiceViewStatus (invoice-view-tracker)
  const viewStatus = typeof window !== 'undefined' ? getInvoiceViewStatus(ticketNum) : null
  const ticketViewed: number | null = viewStatus?.firstViewed ?? null

  // Get work approval events - combine verbal and signature approvals into a single timeline entry
  let workApprovals: Array<{
    timestamp: number
    approvedDate: string
    approvedTime: string
    verbalApproval?: boolean
    approverName?: string
    hasSignature?: boolean
  }> = []
  try {
    const approval = getWorkApproval(ticketNum)
    if (approval && approval.items && approval.items.length > 0) {
      // Group items by approvedAtIso (items approved together have the same timestamp)
      const approvalMap = new Map<string, {
        timestamp: number
        approvedDate: string
        approvedTime: string
        verbalApproval?: boolean
        approverName?: string
        hasSignature?: boolean
      }>()
      
      approval.items.forEach((item) => {
        const approvedAtIso = item.approvedAtIso
        if (!approvalMap.has(approvedAtIso)) {
          const timestamp = new Date(approvedAtIso).getTime()
          approvalMap.set(approvedAtIso, {
            timestamp,
            approvedDate: item.approvedDate,
            approvedTime: item.approvedTime,
            verbalApproval: item.verbalApproval,
            approverName: item.approverName,
            hasSignature: !!(item.signatureDataUrl && item.signatureDataUrl.length > 0),
          })
        }
      })
      
      const batches = Array.from(approvalMap.values()).sort((a, b) => a.timestamp - b.timestamp)
      // Combine all approval batches into one timeline entry
      if (batches.length > 0) {
        const latest = batches[batches.length - 1]
        const hasVerbal = batches.some((b) => b.verbalApproval)
        const verbalBatch = batches.find((b) => b.verbalApproval && b.approverName)
        workApprovals = [{
          timestamp: latest.timestamp,
          approvedDate: latest.approvedDate,
          approvedTime: latest.approvedTime,
          verbalApproval: hasVerbal,
          approverName: verbalBatch?.approverName,
          hasSignature: batches.some((b) => b.hasSignature),
        }]
      }
    }
  } catch (err) {
    console.error('Error getting work approvals for timeline:', err)
    workApprovals = []
  }

  // Get vehicle status changes
  let vehicleStatusChanges: Array<{ status: string; timestamp: number }> = []
  if (typeof window !== 'undefined') {
    try {
      const { getVehicleStatusChanges } = require('@/lib/invoice-view-tracker')
      vehicleStatusChanges = getVehicleStatusChanges(ticketNum)
    } catch {
      // Fallback to direct localStorage access
      const stored = localStorage.getItem(`vehicle_status_changes_${ticketNum}`)
      if (stored) {
        try {
          vehicleStatusChanges = JSON.parse(stored)
        } catch {
          vehicleStatusChanges = []
        }
      }
    }
  }

  // Get current vehicle status from invoice data
  const currentVehicleStatus = invoiceData.value?.ticket?.vehicleStatus || null

  return {
    ticketSentEvents,
    ticketViewed,
    workApprovals,
    currentVehicleStatus,
    vehicleStatusChanges,
  }
})

// Vehicle Status badge: use latest from timeline (localStorage) so it stays in sync when status
// is changed in another tab or via custom event. Timeline and badge share the same source of truth.
const displayedVehicleStatus = computed(() => {
  const t = timelineData.value
  const changes = t.vehicleStatusChanges ?? []
  if (changes.length > 0) {
    const latest = changes.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
    return latest.status
  }
  return t.currentVehicleStatus ?? ''
})

// True when timeline has any customer-visible content (used to show Timeline button in customer view)
const hasCustomerVisibleTimelineContent = computed(() => {
  const t = timelineData.value
  return (
    t.ticketViewed != null ||
    (t.workApprovals?.length ?? 0) > 0 ||
    (t.vehicleStatusChanges?.length ?? 0) > 0
  )
})

// Same as view-button pulse: true when customer is actively viewing (within 5 min). Used to pulse "Ticket Viewed" in timeline.
// Red pulsing border on "Ticket Viewed" only in internal advisor view (not on external customer view)
const isTicketViewedPulsing = computed(() => {
  if (!isAdvisorView.value) return false
  void viewStatusUpdateTrigger.value
  const ticketNum = invoiceData.value?.ticket?.ticketNumber
  return ticketNum != null && isInvoiceActivelyViewed(ticketNum)
})

// 5-minute timer to stop "Ticket Viewed" pulse when customer has been viewing for 5 min (no extra highlighting after)
// Must run when advisor has page open (isAdvisorView) – that's when the pulse is shown. Previously used isCustomerView,
// so the timer never ran in advisor view and the pulse never stopped until refresh.
let ticketViewedPulseStopTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () =>
    isAdvisorView.value &&
    invoiceData.value?.ticket?.ticketNumber != null &&
    timelineData.value.ticketViewed != null,
  (active) => {
    if (ticketViewedPulseStopTimer) {
      clearTimeout(ticketViewedPulseStopTimer)
      ticketViewedPulseStopTimer = null
    }
    if (!active) return
    // Use lastActive from view tracker to match isInvoiceActivelyViewed (pulse logic)
    const status = getInvoiceViewStatus(invoiceData.value!.ticket!.ticketNumber)
    const lastActive = status?.lastActive ?? timelineData.value.ticketViewed!
    const elapsed = Date.now() - lastActive
    const delay = Math.max(0, 5 * 60 * 1000 - elapsed)
    ticketViewedPulseStopTimer = setTimeout(() => {
      ticketViewedPulseStopTimer = null
      viewStatusUpdateTrigger.value = Date.now()
    }, delay)
  },
  { immediate: true }
)

// When user navigates from advisor URL to customer URL in same tab – same logic as view-button data source.
// When in customer view, always touch or mark so the timeline "Ticket Viewed" event pulses.
watch(
  () => [route.query.internal, route.query.preview, route.query.inv, route.query.token, route.params.token],
  async () => {
    if (route.query.internal === 'true') return
    if (route.query.preview === 'true') return
    const token = (route.query.inv ?? route.query.token ?? route.params.token) as string | undefined
    if (!token || !invoiceData.value?.ticket?.ticketNumber) return
    if (token !== invoiceToken.value) return
    const ticketNum = invoiceData.value.ticket.ticketNumber
    const existing = getInvoiceViewStatus(ticketNum)
    const row = invoiceData.value?.invoiceDetail?.invoiceRow
    const ticketTotal = row && (row.Total != null || row.Subtotal != null)
      ? (parseFloat(String(row.Total ?? row.Subtotal ?? 0)) || undefined)
      : undefined
    if (!existing) {
      markInvoiceViewAccessed(ticketNum, token, { ticketTotal })
      const { buildTimelineEventForViewed } = await import('@/types/timeline')
      const { persistTimelineEvent } = await import('@/api/timeline')
      await persistTimelineEvent(buildTimelineEventForViewed(ticketNum, { ticketTotal }))
    } else {
      touchInvoiceViewActive(ticketNum)
    }
    viewStatusUpdateTrigger.value = Date.now()
  },
  { immediate: false }
)

// Send dialog state
const showSendDialog = ref(false)
const sendViaEmail = ref(false)
const sendViaSMS = ref(false)
const sendMessage = ref('')
const sendUrl = ref<string>('')

// Contact info state
const selectedEmail = ref('')
const emailOverride = ref('')
const isEditingEmail = ref(false)
const emailOverrideTrimmed = computed(() => emailOverride.value.trim())
const effectiveEmail = computed(() => emailOverrideTrimmed.value || selectedEmail.value)

const selectedPhone = ref('')
const phoneOverride = ref('')
const isEditingPhone = ref(false)
const phoneOverrideTrimmed = computed(() => phoneOverride.value.trim())
const effectivePhone = computed(() => phoneOverrideTrimmed.value || selectedPhone.value)

function normalizeContactList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n;|]+/g)
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return [String(value).trim()].filter(Boolean)
}

const emailOptions = computed(() => {
  const ticket = invoiceData.value?.ticket
  if (!ticket) return []
  const t: any = ticket
  return normalizeContactList(t?.emails ?? ticket.email)
})

const phoneOptions = computed(() => {
  const ticket = invoiceData.value?.ticket
  if (!ticket) return []
  const t: any = ticket
  return normalizeContactList(t?.phones ?? ticket.phone)
})

const canSendCustomerView = computed(() => {
  if (!invoiceData.value?.ticket) return false
  if (!sendViaEmail.value && !sendViaSMS.value) return false
  if (sendViaEmail.value && !effectiveEmail.value) return false
  if (sendViaSMS.value && !effectivePhone.value) return false
  return true
})

const initSendRecipients = () => {
  selectedEmail.value = emailOptions.value[0] || ''
  emailOverride.value = ''
  isEditingEmail.value = false

  selectedPhone.value = phoneOptions.value[0] || ''
  phoneOverride.value = ''
  isEditingPhone.value = false
}

const createInvoiceViewUrl = async (): Promise<string> => {
  if (!invoiceData.value?.ticket) {
    throw new Error('Ticket is required')
  }

  const { generateCustomerViewUrl } = await import('@/lib/invoice-token')
  
  const url = generateCustomerViewUrl({
    e: 'p',
    a: '92000',
    i: invoiceData.value.ticket.ticketNumber.toString(),
  })
  
  return url
}

const openCustomerViewUrl = async () => {
  try {
    let url = sendUrl.value

    // If the URL isn't generated yet, generate it on-demand.
    if (!url) {
      url = await createInvoiceViewUrl()
      sendUrl.value = url
    }

    if (!url) {
      alert('Customer view URL is not available.')
      return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error) {
    console.error('Error opening customer view URL:', error)
    alert('Error opening customer view URL')
  }
}

// Send functionality (for advisor view)
const handleSend = async () => {
  if (!invoiceData.value?.ticket) return
  
  try {
    const viewUrl = await createInvoiceViewUrl()
    sendUrl.value = viewUrl

    // Default to all available channels; user can uncheck in the dialog.
    sendViaEmail.value = emailOptions.value.length > 0
    sendViaSMS.value = phoneOptions.value.length > 0
    initSendRecipients()

    const typeLabel = getTypeLabel(invoiceData.value.ticket.type).toLowerCase()
    sendMessage.value = `Please see the attached breakdown of your ${typeLabel}.`
    showSendDialog.value = true
  } catch (error) {
    console.error('Error creating invoice view URL:', error)
    alert('Error creating invoice view. Please try again.')
  }
}

const handleSendMessage = async () => {
  try {
    if (!invoiceData.value?.ticket) return
    
    // Track that ticket was sent
    if (typeof window !== 'undefined') {
      try {
        const { markTicketSent, resetInvoiceViewStatus } = await import('@/lib/invoice-view-tracker')
        const userName = localStorage.getItem('current_user') || localStorage.getItem('user_name') || 'Advisor'
        const row = invoiceData.value?.invoiceDetail?.invoiceRow
        const ticketTotal = row && (row.Total != null || row.Subtotal != null)
          ? (parseFloat(String(row.Total ?? row.Subtotal ?? 0)) || undefined)
          : undefined
        markTicketSent(invoiceData.value.ticket.ticketNumber, userName, { ticketTotal })
        const { buildTimelineEventForSent } = await import('@/types/timeline')
        const { persistTimelineEvent } = await import('@/api/timeline')
        await persistTimelineEvent(buildTimelineEventForSent(invoiceData.value.ticket.ticketNumber, { user: userName, ticketTotal }))
        // Automatically reset view status when sending again
        resetInvoiceViewStatus(invoiceData.value.ticket.ticketNumber)
      } catch (err) {
        console.error('Error tracking ticket sent:', err)
      }
    }
    
    // Check that at least one channel is selected
    if (!sendViaEmail.value && !sendViaSMS.value) {
      alert('Please select at least one communication method')
      return
    }

    // Validate selected channels have contact info
    if (sendViaSMS.value && !effectivePhone.value) {
      alert('Phone number is required for SMS but not available')
      return
    }
    if (sendViaEmail.value && !effectiveEmail.value) {
      alert('Email address is required for email but not available')
      return
    }
    
    // TODO: Implement actual SMS/Email sending functionality
    const channels: string[] = []
    if (sendViaEmail.value) channels.push('Email')
    if (sendViaSMS.value) channels.push('SMS')
    
    console.log(`Sending via ${channels.join(' and ')} to customer:`, {
      ticket: invoiceData.value.ticket,
      message: sendMessage.value,
      url: sendUrl.value,
      channels,
      recipients: {
        email: sendViaEmail.value ? effectiveEmail.value : undefined,
        phone: sendViaSMS.value ? effectivePhone.value : undefined,
      },
    })
    
    // For now, show confirmation
    const recipientLines = [
      sendViaEmail.value ? `Email: ${effectiveEmail.value}` : null,
      sendViaSMS.value ? `SMS: ${effectivePhone.value}` : null,
    ].filter(Boolean).join('\n')
    alert(`Message will be sent via ${channels.join(' and ')}:\n${recipientLines}\n\n${sendMessage.value}\n\n${sendUrl.value}`)
    
    showSendDialog.value = false
    sendViaEmail.value = false
    sendViaSMS.value = false
  } catch (error) {
    console.error('Error sending message:', error)
    alert('Error sending message. Please try again.')
  }
}
</script>

<style>
@media print {
  body * {
    visibility: hidden;
  }
  #invoice-print-area,
  #invoice-print-area * {
    visibility: visible;
  }
  #invoice-print-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
  .no-print {
    display: none !important;
  }
}
</style>
