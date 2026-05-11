export type PortalLanguage = "en" | "te";

type TranslationKey =
  | "admin.layout.badge"
  | "admin.layout.title"
  | "admin.layout.openManagerDashboard"
  | "admin.nav.overview"
  | "admin.nav.eventDates"
  | "admin.nav.events"
  | "admin.nav.managers"
  | "admin.nav.creators"
  | "admin.nav.appBanners"
  | "admin.nav.banners"
  | "admin.nav.appPosters"
  | "admin.nav.posters"
  | "admin.nav.competitions"
  | "admin.nav.contests"
  | "admin.nav.creatorBanners"
  | "admin.nav.creatorAds"
  | "admin.nav.announcements"
  | "admin.nav.updates"
  | "admin.nav.pushNotifications"
  | "admin.nav.push"
  | "admin.nav.dashboardAccess"
  | "admin.nav.access"
  | "admin.nav.landingAccess"
  | "admin.nav.landing"
  | "admin.nav.settings"
  | "manager.table.loginRequired"
  | "manager.table.unableLoad"
  | "manager.table.unableStatus"
  | "manager.table.unablePassword"
  | "manager.table.unableDevice"
  | "manager.table.title"
  | "manager.table.search"
  | "manager.table.allStatuses"
  | "manager.table.active"
  | "manager.table.inactive"
  | "manager.table.refresh"
  | "manager.table.loading"
  | "manager.table.empty"
  | "manager.table.open"
  | "manager.table.close"
  | "manager.table.deactivate"
  | "manager.table.activate"
  | "manager.table.resetPassword"
  | "manager.table.resetDevice"
  | "manager.table.loginEmail"
  | "manager.table.resetLink"
  | "manager.table.copied"
  | "manager.table.initialPassword"
  | "manager.table.loginUrl"
  | "manager.table.recoveryLink"
  | "manager.table.credentialsCopied"
  | "manager.table.manager"
  | "manager.table.contact"
  | "manager.table.status"
  | "manager.table.actions"
  | "manager.create.loginRequired"
  | "manager.create.creationFailed"
  | "manager.create.title"
  | "manager.create.help"
  | "manager.create.name"
  | "manager.create.email"
  | "manager.create.phone"
  | "manager.create.creating"
  | "manager.create.create"
  | "manager.create.ready"
  | "manager.create.managerId"
  | "manager.create.loginEmail"
  | "manager.create.loginLink"
  | "manager.create.setupLink"
  | "manager.create.setupHelp"
  | "manager.create.initialPassword"
  | "manager.create.loginSteps"
  | "manager.create.recoveryLink"
  | "manager.create.recoveryHelp"
  | "admin.overview.eyebrow"
  | "admin.overview.defaultName"
  | "admin.overview.description"
  | "admin.overview.totalCreators"
  | "admin.overview.totalManagers"
  | "admin.overview.totalPosters"
  | "admin.overview.todayUploads"
  | "admin.overview.totalEarnings"
  | "admin.overview.uploadTrend"
  | "admin.overview.last7DaysUploads"
  | "admin.overview.refresh"
  | "admin.overview.revenueSummary"
  | "admin.overview.earningsSplit"
  | "admin.overview.gross"
  | "admin.overview.creatorShare"
  | "admin.overview.platformShare"
  | "admin.overview.paidOut"
  | "admin.overview.categoryPerformance"
  | "admin.overview.topCategoryUploads"
  | "admin.overview.category"
  | "admin.overview.uploads"
  | "admin.overview.approved"
  | "admin.overview.pending"
  | "admin.overview.rejected"
  | "admin.overview.unableLoad"
  | "manager.overview.eyebrow"
  | "manager.overview.defaultName"
  | "manager.overview.description"
  | "manager.overview.assignedCreators"
  | "manager.overview.pendingReviews"
  | "manager.overview.todayUploads"
  | "manager.overview.approvalRate"
  | "manager.overview.uploadTrend"
  | "manager.overview.last7DaysUploads"
  | "manager.overview.refresh"
  | "manager.overview.performanceSummary"
  | "manager.overview.reviewOutcome"
  | "manager.overview.approved"
  | "manager.overview.rejected"
  | "manager.overview.totalUploads"
  | "manager.overview.categoryBreakdown"
  | "manager.overview.assignedCategories"
  | "manager.overview.category"
  | "manager.overview.uploads"
  | "manager.overview.pending"
  | "manager.overview.unableLoad"
  | "websitePosters.eyebrow"
  | "websitePosters.title"
  | "websitePosters.description"
  | "websitePosters.refresh"
  | "websitePosters.unableLoad"
  | "websitePosters.confirmDelete"
  | "websitePosters.unableDelete"
  | "websitePosters.deleted"
  | "websitePosters.preview"
  | "websitePosters.category"
  | "websitePosters.sortOrder"
  | "websitePosters.status"
  | "websitePosters.updated"
  | "websitePosters.action"
  | "websitePosters.loading"
  | "websitePosters.empty"
  | "websitePosters.active"
  | "websitePosters.inactive"
  | "websitePosters.delete"
  | "websitePosters.showingPage"
  | "websitePosters.totalPosters"
  | "websitePosters.previous"
  | "websitePosters.next"
  | "payouts.eyebrow"
  | "payouts.title"
  | "payouts.description"
  | "payouts.refresh"
  | "payouts.searchPlaceholder"
  | "payouts.allStatuses"
  | "payouts.paid"
  | "payouts.queued"
  | "payouts.onHold"
  | "payouts.approved"
  | "payouts.apply"
  | "payouts.loading"
  | "payouts.empty"
  | "payouts.creator"
  | "payouts.amount"
  | "payouts.status"
  | "payouts.note"
  | "payouts.date"
  | "payouts.showingPage"
  | "payouts.totalPayouts"
  | "payouts.previous"
  | "payouts.next"
  | "payouts.unableLoad"
  | "audit.eyebrow"
  | "audit.title"
  | "audit.description"
  | "audit.refresh"
  | "audit.searchPlaceholder"
  | "audit.actionPlaceholder"
  | "audit.apply"
  | "audit.loading"
  | "audit.empty"
  | "audit.action"
  | "audit.user"
  | "audit.role"
  | "audit.target"
  | "audit.message"
  | "audit.timestamp"
  | "audit.showingPage"
  | "audit.totalLogs"
  | "audit.previous"
  | "audit.next"
  | "audit.unableLoad"
  | "creator.upload.unableReadImageSize"
  | "creator.upload.unableOptimizeImage"
  | "creator.upload.uploadFailed"
  | "creator.upload.unableLoadWorkspace"
  | "creator.upload.loginRequired"
  | "creator.upload.selectPoster"
  | "creator.upload.selectAssignedCategory"
  | "creator.upload.preparingUpload"
  | "creator.upload.uploadedForReview"
  | "creator.upload.uploadStudio"
  | "creator.upload.uploadTitle"
  | "creator.upload.refresh"
  | "creator.upload.refreshing"
  | "creator.upload.uploadWindowClosed"
  | "creator.upload.imageCustomizationOnly"
  | "creator.upload.selectedCategory"
  | "creator.upload.selectCategory"
  | "creator.upload.noAssignedCategories"
  | "creator.upload.accepted"
  | "creator.upload.rejected"
  | "creator.upload.pending"
  | "creator.upload.reason"
  | "creator.upload.choosePoster"
  | "creator.upload.customization"
  | "creator.upload.uploading"
  | "creator.upload.upload"
  | "creator.upload.alreadyUploadedToday"
  | "creator.upload.customize"
  | "creator.upload.previewPlacement"
  | "creator.upload.close"
  | "creator.upload.photoShape"
  | "creator.upload.premiumShapes"
  | "creator.upload.transparentCutouts"
  | "creator.upload.photoMode"
  | "creator.upload.bgRemoved"
  | "creator.upload.originalPhoto"
  | "creator.upload.photoSize"
  | "creator.upload.dragHelp"
  | "creator.upload.showGradientStrip"
  | "creator.upload.apply"
  | "creator.upload.appliedMessage"
  | "creator.upload.shape.circle"
  | "creator.upload.shape.scallop_circle"
  | "creator.upload.shape.soft_burst"
  | "creator.upload.shape.badge"
  | "creator.upload.shape.rounded_square"
  | "creator.upload.shape.vertical_rectangle"
  | "creator.upload.shape.square"
  | "creator.upload.shape.transparent_bottom_fade"
  | "creator.upload.shape.transparent_clean"
  | "creator.upload.shape.transparent_soft_round"
  | "creator.upload.shape.transparent_sharp_round";

const translations: Record<PortalLanguage, Record<TranslationKey, string>> = {
  en: {
    "admin.layout.badge": "Admin Panel",
    "admin.layout.title": "Admin Dashboard",
    "admin.layout.openManagerDashboard": "Open Manager Dashboard",
    "admin.nav.overview": "Overview",
    "admin.nav.eventDates": "Event Dates",
    "admin.nav.events": "Events",
    "admin.nav.managers": "Managers",
    "admin.nav.creators": "Creators",
    "admin.nav.appBanners": "App Banners",
    "admin.nav.banners": "Banners",
    "admin.nav.appPosters": "App Posters",
    "admin.nav.posters": "Posters",
    "admin.nav.competitions": "Competitions",
    "admin.nav.contests": "Contests",
    "admin.nav.creatorBanners": "Creator Banners",
    "admin.nav.creatorAds": "Creator Ads",
    "admin.nav.announcements": "Announcements",
    "admin.nav.updates": "Updates",
    "admin.nav.pushNotifications": "Push Notifications",
    "admin.nav.push": "Push",
    "admin.nav.dashboardAccess": "Dashboard Access",
    "admin.nav.access": "Access",
    "admin.nav.landingAccess": "Landing Access",
    "admin.nav.landing": "Landing",
    "admin.nav.settings": "Settings",
    "manager.table.loginRequired": "Login required.",
    "manager.table.unableLoad": "Unable to load managers.",
    "manager.table.unableStatus": "Unable to change manager status.",
    "manager.table.unablePassword": "Unable to reset password.",
    "manager.table.unableDevice": "Unable to reset device.",
    "manager.table.title": "Managers",
    "manager.table.search": "Search manager",
    "manager.table.allStatuses": "All statuses",
    "manager.table.active": "Active",
    "manager.table.inactive": "Inactive",
    "manager.table.refresh": "Refresh",
    "manager.table.loading": "Loading managers...",
    "manager.table.empty": "No managers found.",
    "manager.table.open": "Open",
    "manager.table.close": "Close",
    "manager.table.deactivate": "Deactivate",
    "manager.table.activate": "Activate",
    "manager.table.resetPassword": "Reset password",
    "manager.table.resetDevice": "Reset device",
    "manager.table.loginEmail": "Login email",
    "manager.table.resetLink": "Reset link",
    "manager.table.copied": "Reset link copied",
    "manager.table.initialPassword": "System password",
    "manager.table.loginUrl": "Login URL",
    "manager.table.recoveryLink": "Email recovery link (optional)",
    "manager.table.credentialsCopied": "Login details copied to clipboard",
    "manager.table.manager": "Manager",
    "manager.table.contact": "Contact",
    "manager.table.status": "Status",
    "manager.table.actions": "Actions",
    "manager.create.loginRequired": "Login required.",
    "manager.create.creationFailed": "Manager creation failed.",
    "manager.create.title": "Create Manager Access",
    "manager.create.help":
      "Enter manager details. The system generates a unique manager@ password for login plus OTP.",
    "manager.create.name": "Manager name",
    "manager.create.email": "Manager email",
    "manager.create.phone": "Manager phone",
    "manager.create.creating": "Creating manager...",
    "manager.create.create": "Create Manager",
    "manager.create.ready": "Manager ready",
    "manager.create.managerId": "Manager ID",
    "manager.create.loginEmail": "Login email",
    "manager.create.loginLink": "Login link",
    "manager.create.setupLink": "Setup link",
    "manager.create.setupHelp": "Use only if Firebase email recovery is needed.",
    "manager.create.initialPassword": "Generated password",
    "manager.create.loginSteps":
      "Manager opens login URL, enters this email plus the generated password, then completes OTP.",
    "manager.create.recoveryLink": "Firebase password recovery email link",
    "manager.create.recoveryHelp":
      "Reserve this link for emergencies; normal login uses email plus generated password plus OTP.",
    "admin.overview.eyebrow": "Admin Overview",
    "admin.overview.defaultName": "Admin",
    "admin.overview.description": "Live creators, managers, poster activity, and earnings summary for daily decisions.",
    "admin.overview.totalCreators": "Total Creators",
    "admin.overview.totalManagers": "Total Managers",
    "admin.overview.totalPosters": "Total Posters",
    "admin.overview.todayUploads": "Today Uploads",
    "admin.overview.totalEarnings": "Total Earnings",
    "admin.overview.uploadTrend": "Upload Trend",
    "admin.overview.last7DaysUploads": "Last 7 days uploads",
    "admin.overview.refresh": "Refresh",
    "admin.overview.revenueSummary": "Revenue Summary",
    "admin.overview.earningsSplit": "Earnings split",
    "admin.overview.gross": "Gross",
    "admin.overview.creatorShare": "Creator Share",
    "admin.overview.platformShare": "Platform Share",
    "admin.overview.paidOut": "Paid Out",
    "admin.overview.categoryPerformance": "Category Performance",
    "admin.overview.topCategoryUploads": "Top category uploads",
    "admin.overview.category": "Category",
    "admin.overview.uploads": "Uploads",
    "admin.overview.approved": "Approved",
    "admin.overview.pending": "Pending",
    "admin.overview.rejected": "Rejected",
    "admin.overview.unableLoad": "Unable to load admin overview.",
    "manager.overview.eyebrow": "Manager Overview",
    "manager.overview.defaultName": "Manager",
    "manager.overview.description": "Live creator assignments, pending reviews, upload activity, and approval performance.",
    "manager.overview.assignedCreators": "Assigned Creators",
    "manager.overview.pendingReviews": "Pending Reviews",
    "manager.overview.todayUploads": "Today Uploads",
    "manager.overview.approvalRate": "Approval Rate",
    "manager.overview.uploadTrend": "Upload Trend",
    "manager.overview.last7DaysUploads": "Last 7 days uploads",
    "manager.overview.refresh": "Refresh",
    "manager.overview.performanceSummary": "Performance Summary",
    "manager.overview.reviewOutcome": "Review outcome snapshot",
    "manager.overview.approved": "Approved",
    "manager.overview.rejected": "Rejected",
    "manager.overview.totalUploads": "Total Uploads",
    "manager.overview.categoryBreakdown": "Category Breakdown",
    "manager.overview.assignedCategories": "Assigned creator upload categories",
    "manager.overview.category": "Category",
    "manager.overview.uploads": "Uploads",
    "manager.overview.pending": "Pending",
    "manager.overview.unableLoad": "Unable to load manager overview.",
    "websitePosters.eyebrow": "Website Posters",
    "websitePosters.title": "Website poster library",
    "websitePosters.description": "View and remove posters used in the Mana Poster Ai website landing experience.",
    "websitePosters.refresh": "Refresh",
    "websitePosters.unableLoad": "Unable to load website posters.",
    "websitePosters.confirmDelete": "Delete this website poster?",
    "websitePosters.unableDelete": "Unable to delete website poster.",
    "websitePosters.deleted": "Website poster deleted.",
    "websitePosters.preview": "Preview",
    "websitePosters.category": "Category",
    "websitePosters.sortOrder": "Sort Order",
    "websitePosters.status": "Status",
    "websitePosters.updated": "Updated",
    "websitePosters.action": "Action",
    "websitePosters.loading": "Loading website posters...",
    "websitePosters.empty": "No website posters found.",
    "websitePosters.active": "Active",
    "websitePosters.inactive": "Inactive",
    "websitePosters.delete": "Delete",
    "websitePosters.showingPage": "Showing page",
    "websitePosters.totalPosters": "Total posters",
    "websitePosters.previous": "Previous",
    "websitePosters.next": "Next",
    "payouts.eyebrow": "Creator Payouts",
    "payouts.title": "Payout ledger",
    "payouts.description": "Review creator payout records with real status, amount, and created date.",
    "payouts.refresh": "Refresh",
    "payouts.searchPlaceholder": "Search creator ID, status, note",
    "payouts.allStatuses": "All statuses",
    "payouts.paid": "Paid",
    "payouts.queued": "Queued",
    "payouts.onHold": "On hold",
    "payouts.approved": "Approved",
    "payouts.apply": "Apply",
    "payouts.loading": "Loading payouts...",
    "payouts.empty": "No payouts found.",
    "payouts.creator": "Creator",
    "payouts.amount": "Amount",
    "payouts.status": "Status",
    "payouts.note": "Note",
    "payouts.date": "Date",
    "payouts.showingPage": "Showing page",
    "payouts.totalPayouts": "Total payouts",
    "payouts.previous": "Previous",
    "payouts.next": "Next",
    "payouts.unableLoad": "Unable to load payouts.",
    "audit.eyebrow": "Audit Logs",
    "audit.title": "Admin activity timeline",
    "audit.description": "Review real admin actions with actor, target, and timestamp details.",
    "audit.refresh": "Refresh",
    "audit.searchPlaceholder": "Search action, user, target, message",
    "audit.actionPlaceholder": "Action filter or all",
    "audit.apply": "Apply",
    "audit.loading": "Loading audit logs...",
    "audit.empty": "No audit logs found.",
    "audit.action": "Action",
    "audit.user": "User",
    "audit.role": "Role",
    "audit.target": "Target",
    "audit.message": "Message",
    "audit.timestamp": "Timestamp",
    "audit.showingPage": "Showing page",
    "audit.totalLogs": "Total logs",
    "audit.previous": "Previous",
    "audit.next": "Next",
    "audit.unableLoad": "Unable to load audit logs.",
    "creator.upload.unableReadImageSize": "Unable to read image size.",
    "creator.upload.unableOptimizeImage": "Unable to optimize image on this device.",
    "creator.upload.uploadFailed": "Upload failed.",
    "creator.upload.unableLoadWorkspace": "Unable to load creator workspace.",
    "creator.upload.loginRequired": "Login required.",
    "creator.upload.selectPoster": "Select a poster image or video.",
    "creator.upload.selectAssignedCategory": "Select an assigned category.",
    "creator.upload.preparingUpload": "Preparing upload...",
    "creator.upload.uploadedForReview": "Poster uploaded and sent for manager review.",
    "creator.upload.uploadStudio": "Upload Studio",
    "creator.upload.uploadTitle": "Upload",
    "creator.upload.refresh": "Refresh",
    "creator.upload.refreshing": "Refreshing...",
    "creator.upload.uploadWindowClosed": "Upload window is closed today. Uploads reopen from",
    "creator.upload.imageCustomizationOnly": "Image customization is available only for poster images.",
    "creator.upload.selectedCategory": "Selected Category",
    "creator.upload.selectCategory": "Select category",
    "creator.upload.noAssignedCategories": "No assigned categories.",
    "creator.upload.accepted": "Accepted",
    "creator.upload.rejected": "Rejected",
    "creator.upload.pending": "Pending",
    "creator.upload.reason": "Reason",
    "creator.upload.choosePoster": "Choose Poster",
    "creator.upload.customization": "Customization",
    "creator.upload.uploading": "Uploading...",
    "creator.upload.upload": "Upload",
    "creator.upload.alreadyUploadedToday": "A poster has already been submitted for this category today. You can upload again tomorrow.",
    "creator.upload.customize": "Customize",
    "creator.upload.previewPlacement": "Preview Placement",
    "creator.upload.close": "Close",
    "creator.upload.photoShape": "Photo Shape",
    "creator.upload.premiumShapes": "Premium Shapes",
    "creator.upload.transparentCutouts": "Transparent Cutouts",
    "creator.upload.photoMode": "Photo Mode",
    "creator.upload.bgRemoved": "BG Removed",
    "creator.upload.originalPhoto": "Original Photo",
    "creator.upload.photoSize": "Photo Size",
    "creator.upload.dragHelp": "Drag the photo and name directly. Use the mouse wheel to adjust photo size.",
    "creator.upload.showGradientStrip": "Show gradient strip",
    "creator.upload.apply": "Apply",
    "creator.upload.appliedMessage": "Customization applied. This placement will be saved when you upload.",
    "creator.upload.shape.circle": "Circle",
    "creator.upload.shape.scallop_circle": "Scallop Circle",
    "creator.upload.shape.soft_burst": "Soft Burst",
    "creator.upload.shape.badge": "Badge",
    "creator.upload.shape.rounded_square": "Rounded Square",
    "creator.upload.shape.vertical_rectangle": "Vertical Rectangle",
    "creator.upload.shape.square": "Classic Square",
    "creator.upload.shape.transparent_bottom_fade": "Bottom Blend",
    "creator.upload.shape.transparent_clean": "Clean Cutout",
    "creator.upload.shape.transparent_soft_round": "Soft Round",
    "creator.upload.shape.transparent_sharp_round": "Sharp Round",
  },
  te: {
    "admin.layout.badge": "à°…à°¡à±à°®à°¿à°¨à± à°ªà±à°¯à°¾à°¨à±†à°²à±",
    "admin.layout.title": "à°…à°¡à±à°®à°¿à°¨à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±",
    "admin.layout.openManagerDashboard": "à°®à±‡à°¨à±‡à°œà°°à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à± à°¤à±†à°°à°µà°‚à°¡à°¿",
    "admin.nav.overview": "à°“à°µà°°à±à°µà±à°¯à±‚",
    "admin.nav.eventDates": "à°ˆà°µà±†à°‚à°Ÿà± à°¤à±‡à°¦à±€à°²à±",
    "admin.nav.events": "à°ˆà°µà±†à°‚à°Ÿà±à°¸à±",
    "admin.nav.managers": "à°®à±‡à°¨à±‡à°œà°°à±à°²à±",
    "admin.nav.creators": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à±à°²à±",
    "admin.nav.appBanners": "à°¯à°¾à°ªà± à°¬à±à°¯à°¾à°¨à°°à±à°²à±",
    "admin.nav.banners": "à°¬à±à°¯à°¾à°¨à°°à±à°²à±",
    "admin.nav.appPosters": "à°¯à°¾à°ªà± à°ªà±‹à°¸à±à°Ÿà°°à±à°²à±",
    "admin.nav.posters": "à°ªà±‹à°¸à±à°Ÿà°°à±à°²à±",
    "admin.nav.competitions": "à°•à°¾à°‚à°ªà°¿à°Ÿà°¿à°·à°¨à±à°¸à±",
    "admin.nav.contests": "à°•à°¾à°‚à°Ÿà±†à°¸à±à°Ÿà±à°¸à±",
    "admin.nav.creatorBanners": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°¬à±à°¯à°¾à°¨à°°à±à°²à±",
    "admin.nav.creatorAds": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°¯à°¾à°¡à±à°¸à±",
    "admin.nav.announcements": "à°ªà±à°°à°•à°Ÿà°¨à°²à±",
    "admin.nav.updates": "à°…à°ªà±â€Œà°¡à±‡à°Ÿà±à°¸à±",
    "admin.nav.pushNotifications": "à°ªà±à°·à± à°¨à±‹à°Ÿà°¿à°«à°¿à°•à±‡à°·à°¨à±à°¸à±",
    "admin.nav.push": "à°ªà±à°·à±",
    "admin.nav.dashboardAccess": "à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à± à°¯à°¾à°•à±à°¸à±†à°¸à±",
    "admin.nav.access": "à°¯à°¾à°•à±à°¸à±†à°¸à±",
    "admin.nav.landingAccess": "à°²à°¾à°‚à°¡à°¿à°‚à°—à± à°¯à°¾à°•à±à°¸à±†à°¸à±",
    "admin.nav.landing": "à°²à°¾à°‚à°¡à°¿à°‚à°—à±",
    "admin.nav.settings": "à°¸à±†à°Ÿà±à°Ÿà°¿à°‚à°—à±à°¸à±",
    "manager.table.loginRequired": "à°²à°¾à°—à°¿à°¨à± à°…à°µà°¸à°°à°‚.",
    "manager.table.unableLoad": "à°®à±‡à°¨à±‡à°œà°°à±à°²à°¨à± à°²à±‹à°¡à± à°šà±‡à°¯à°²à±‡à°•à°ªà±‹à°¯à°¾à°‚.",
    "manager.table.unableStatus": "à°®à±‡à°¨à±‡à°œà°°à± à°¸à±à°Ÿà±‡à°Ÿà°¸à± à°®à°¾à°°à±à°šà°²à±‡à°•à°ªà±‹à°¯à°¾à°‚.",
    "manager.table.unablePassword": "à°ªà°¾à°¸à±â€Œà°µà°°à±à°¡à± à°°à±€à°¸à±†à°Ÿà± à°šà±‡à°¯à°²à±‡à°•à°ªà±‹à°¯à°¾à°‚.",
    "manager.table.unableDevice": "à°¡à°¿à°µà±ˆà°¸à± à°°à±€à°¸à±†à°Ÿà± à°šà±‡à°¯à°²à±‡à°•à°ªà±‹à°¯à°¾à°‚.",
    "manager.table.title": "à°®à±‡à°¨à±‡à°œà°°à±à°²à±",
    "manager.table.search": "à°®à±‡à°¨à±‡à°œà°°à±â€Œà°¨à± à°µà±†à°¤à°•à°‚à°¡à°¿",
    "manager.table.allStatuses": "à°…à°¨à±à°¨à°¿ à°¸à±à°Ÿà±‡à°Ÿà°¸à±â€Œà°²à±",
    "manager.table.active": "à°¯à°¾à°•à±à°Ÿà°¿à°µà±",
    "manager.table.inactive": "à°‡à°¨à°¾à°•à±à°Ÿà°¿à°µà±",
    "manager.table.refresh": "à°°à°¿à°«à±à°°à±†à°·à±",
    "manager.table.loading": "à°®à±‡à°¨à±‡à°œà°°à±à°²à°¨à± à°²à±‹à°¡à± à°šà±‡à°¸à±à°¤à±à°¨à±à°¨à°¾à°‚...",
    "manager.table.empty": "à° à°®à±‡à°¨à±‡à°œà°°à±à°²à± à°•à°¨à°¬à°¡à°²à±‡à°¦à±.",
    "manager.table.open": "à°¤à±†à°°à±à°µà±",
    "manager.table.close": "à°®à±‚à°¸à°¿à°µà±‡à°¯à°¿",
    "manager.table.deactivate": "à°¡à°¿à°¯à°¾à°•à±à°Ÿà°¿à°µà±‡à°Ÿà±",
    "manager.table.activate": "à°¯à°¾à°•à±à°Ÿà°¿à°µà±‡à°Ÿà±",
    "manager.table.resetPassword": "à°ªà°¾à°¸à±â€Œà°µà°°à±à°¡à± à°°à±€à°¸à±†à°Ÿà±",
    "manager.table.resetDevice": "à°¡à°¿à°µà±ˆà°¸à± à°°à±€à°¸à±†à°Ÿà±",
    "manager.table.loginEmail": "à°²à°¾à°—à°¿à°¨à± à°‡à°®à±†à°¯à°¿à°²à±",
    "manager.table.resetLink": "à°°à±€à°¸à±†à°Ÿà± à°²à°¿à°‚à°•à±",
    "manager.table.copied": "à°°à±€à°¸à±†à°Ÿà± à°²à°¿à°‚à°•à± à°•à°¾à°ªà±€ à°…à°¯à°¿à°‚à°¦à°¿",
    "manager.table.initialPassword": "సిస్టమ్ పాస్వర్డ్",
    "manager.table.loginUrl": "లాగిన్ URL",
    "manager.table.recoveryLink": "ఇమెయిల్ రికవరీ లింక్ (ఐచ్ఛికం)",
    "manager.table.credentialsCopied": "లాగిన్ వివరాలు క్లిప్‌బోర్డ్‌కు కాపీ అయ్యాయి",
    "manager.table.manager": "à°®à±‡à°¨à±‡à°œà°°à±",
    "manager.table.contact": "à°¸à°‚à°ªà±à°°à°¦à°¿à°‚à°ªà±",
    "manager.table.status": "à°¸à±à°Ÿà±‡à°Ÿà°¸à±",
    "manager.table.actions": "à°šà°°à±à°¯à°²à±",
    "manager.create.loginRequired": "à°²à°¾à°—à°¿à°¨à± à°…à°µà°¸à°°à°‚.",
    "manager.create.creationFailed": "à°®à±‡à°¨à±‡à°œà°°à± à°•à±à°°à°¿à°¯à±‡à°·à°¨à± à°µà°¿à°«à°²à°®à±ˆà°‚à°¦à°¿.",
    "manager.create.title": "à°®à±‡à°¨à±‡à°œà°°à± à°¯à°¾à°•à±à°¸à±†à°¸à± à°•à±à°°à°¿à°¯à±‡à°Ÿà± à°šà±‡à°¯à°‚à°¡à°¿",
    "manager.create.help":
      "మేనేజర్ వివరాలు ఇవ్వండి. లాగిన్ OTPతో పాటు ప్రత్యేక manager@ పాస్వర్డ్‌ను సిస్టమ్ స్వయంచాలకంగా ఇస్తుంది.",
    "manager.create.name": "à°®à±‡à°¨à±‡à°œà°°à± à°ªà±‡à°°à±",
    "manager.create.email": "à°®à±‡à°¨à±‡à°œà°°à± à°‡à°®à±†à°¯à°¿à°²à±",
    "manager.create.phone": "à°®à±‡à°¨à±‡à°œà°°à± à°«à±‹à°¨à±",
    "manager.create.creating": "à°®à±‡à°¨à±‡à°œà°°à±â€Œà°¨à°¿ à°•à±à°°à°¿à°¯à±‡à°Ÿà± à°šà±‡à°¸à±à°¤à±à°¨à±à°¨à°¾à°‚...",
    "manager.create.create": "à°®à±‡à°¨à±‡à°œà°°à± à°•à±à°°à°¿à°¯à±‡à°Ÿà± à°šà±‡à°¯à°‚à°¡à°¿",
    "manager.create.ready": "à°®à±‡à°¨à±‡à°œà°°à± à°°à±†à°¡à±€",
    "manager.create.managerId": "à°®à±‡à°¨à±‡à°œà°°à± à°à°¡à°¿",
    "manager.create.loginEmail": "à°²à°¾à°—à°¿à°¨à± à°‡à°®à±†à°¯à°¿à°²à±",
    "manager.create.loginLink": "à°²à°¾à°—à°¿à°¨à± à°²à°¿à°‚à°•à±",
    "manager.create.setupLink": "à°¸à±†à°Ÿà°ªà± à°²à°¿à°‚à°•à±",
    "manager.create.setupHelp": "ఫైర్‌బేస్ ఇమెయిల్ రికవరీ అవసరమైనప్పుడే ఉపయోగించండి.",
    "manager.create.initialPassword": "జనరేట్ చేసిన పాస్వర్డ్",
    "manager.create.loginSteps":
      "మేనేజర్ లాగిన్ URL తెరుసుకొని ఈ ఇమెయిల్, జనరేట్ చేసిన పాస్వర్డ్ ఇచ్చిన తర్వాత OTP పూర్తి చేయాలి.",
    "manager.create.recoveryLink": "Firebase పాస్వర్డ్ రికవరీ ఇమెయిల్ లింక్",
    "manager.create.recoveryHelp":
      "అత్యవసరానికి ఉంచండి; సాధారణ లాగిన్ ఇమెయిల్ + జనరేట్ పాస్వర్డ్ + OTP.",
    "admin.overview.eyebrow": "à°…à°¡à±à°®à°¿à°¨à± à°“à°µà°°à±à°µà±à°¯à±‚",
    "admin.overview.defaultName": "à°…à°¡à±à°®à°¿à°¨à±",
    "admin.overview.description": "à°°à±‹à°œà±à°µà°¾à°°à±€ à°¨à°¿à°°à±à°£à°¯à°¾à°² à°•à±‹à°¸à°‚ à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à±à°²à±, à°®à±‡à°¨à±‡à°œà°°à±à°²à±, à°ªà±‹à°¸à±à°Ÿà°°à± à°¯à°¾à°•à±à°Ÿà°¿à°µà°¿à°Ÿà±€, à°†à°¦à°¾à°¯ à°¸à°®à°—à±à°° à°¦à±ƒà°¶à±à°¯à°‚.",
    "admin.overview.totalCreators": "à°®à±Šà°¤à±à°¤à°‚ à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à±à°²à±",
    "admin.overview.totalManagers": "à°®à±Šà°¤à±à°¤à°‚ à°®à±‡à°¨à±‡à°œà°°à±à°²à±",
    "admin.overview.totalPosters": "à°®à±Šà°¤à±à°¤à°‚ à°ªà±‹à°¸à±à°Ÿà°°à±à°²à±",
    "admin.overview.todayUploads": "à°ˆà°°à±‹à°œà± à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "admin.overview.totalEarnings": "à°®à±Šà°¤à±à°¤à°‚ à°†à°¦à°¾à°¯à°‚",
    "admin.overview.uploadTrend": "à°…à°ªà±â€Œà°²à±‹à°¡à± à°Ÿà±à°°à±†à°‚à°¡à±",
    "admin.overview.last7DaysUploads": "à°—à°¤ 7 à°°à±‹à°œà±à°² à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "admin.overview.refresh": "à°°à°¿à°«à±à°°à±†à°·à±",
    "admin.overview.revenueSummary": "à°†à°¦à°¾à°¯ à°¸à°¾à°°à°¾à°‚à°¶à°‚",
    "admin.overview.earningsSplit": "à°†à°¦à°¾à°¯ à°µà°¿à°­à°œà°¨",
    "admin.overview.gross": "à°®à±Šà°¤à±à°¤à°‚ à°†à°¦à°¾à°¯à°‚",
    "admin.overview.creatorShare": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°µà°¾à°Ÿà°¾",
    "admin.overview.platformShare": "à°ªà±à°²à°¾à°Ÿà±â€Œà°«à°¾à°®à± à°µà°¾à°Ÿà°¾",
    "admin.overview.paidOut": "à°šà±†à°²à±à°²à°¿à°‚à°šà°¿à°¨à°¦à°¿",
    "admin.overview.categoryPerformance": "à°•à±‡à°Ÿà°—à°¿à°°à±€ à°ªà°¨à°¿à°¤à±€à°°à±",
    "admin.overview.topCategoryUploads": "à°…à°—à±à°° à°•à±‡à°Ÿà°—à°¿à°°à±€ à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "admin.overview.category": "à°•à±‡à°Ÿà°—à°¿à°°à±€",
    "admin.overview.uploads": "à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "admin.overview.approved": "à°†à°®à±‹à°¦à°¿à°‚à°šà°¿à°¨à°µà°¿",
    "admin.overview.pending": "à°ªà±†à°‚à°¡à°¿à°‚à°—à±",
    "admin.overview.rejected": "à°¤à°¿à°°à°¸à±à°•à°°à°¿à°‚à°šà°¿à°¨à°µà°¿",
    "admin.overview.unableLoad": "à°…à°¡à±à°®à°¿à°¨à± à°“à°µà°°à±à°µà±à°¯à±‚ à°²à±‹à°¡à± à°•à°¾à°²à±‡à°¦à±.",
    "manager.overview.eyebrow": "à°®à±‡à°¨à±‡à°œà°°à± à°“à°µà°°à±à°µà±à°¯à±‚",
    "manager.overview.defaultName": "à°®à±‡à°¨à±‡à°œà°°à±",
    "manager.overview.description": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°…à°¸à±ˆà°¨à±â€Œà°®à±†à°‚à°Ÿà±à°²à±, à°ªà±†à°‚à°¡à°¿à°‚à°—à± à°°à°¿à°µà±à°¯à±‚à°²à±, à°…à°ªà±â€Œà°²à±‹à°¡à± à°¯à°¾à°•à±à°Ÿà°¿à°µà°¿à°Ÿà±€, à°…à°ªà±à°°à±‚à°µà°²à± à°ªà°¨à°¿à°¤à±€à°°à±.",
    "manager.overview.assignedCreators": "à°…à°¸à±ˆà°¨à± à°…à°¯à°¿à°¨ à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à±à°²à±",
    "manager.overview.pendingReviews": "à°ªà±†à°‚à°¡à°¿à°‚à°—à± à°°à°¿à°µà±à°¯à±‚à°²à±",
    "manager.overview.todayUploads": "à°ˆà°°à±‹à°œà± à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "manager.overview.approvalRate": "à°…à°ªà±à°°à±‚à°µà°²à± à°°à±‡à°Ÿà±",
    "manager.overview.uploadTrend": "à°…à°ªà±â€Œà°²à±‹à°¡à± à°Ÿà±à°°à±†à°‚à°¡à±",
    "manager.overview.last7DaysUploads": "à°—à°¤ 7 à°°à±‹à°œà±à°² à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "manager.overview.refresh": "à°°à°¿à°«à±à°°à±†à°·à±",
    "manager.overview.performanceSummary": "à°ªà°¨à°¿à°¤à±€à°°à± à°¸à°¾à°°à°¾à°‚à°¶à°‚",
    "manager.overview.reviewOutcome": "à°°à°¿à°µà±à°¯à±‚ à°«à°²à°¿à°¤à°¾à°² à°¸à±à°¨à°¾à°ªà±â€Œà°·à°¾à°Ÿà±",
    "manager.overview.approved": "à°†à°®à±‹à°¦à°¿à°‚à°šà°¿à°¨à°µà°¿",
    "manager.overview.rejected": "à°¤à°¿à°°à°¸à±à°•à°°à°¿à°‚à°šà°¿à°¨à°µà°¿",
    "manager.overview.totalUploads": "à°®à±Šà°¤à±à°¤à°‚ à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "manager.overview.categoryBreakdown": "à°•à±‡à°Ÿà°—à°¿à°°à±€ à°µà°¿à°­à°œà°¨",
    "manager.overview.assignedCategories": "à°…à°¸à±ˆà°¨à± à°…à°¯à°¿à°¨ à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°…à°ªà±â€Œà°²à±‹à°¡à± à°•à±‡à°Ÿà°—à°¿à°°à±€à°²à±",
    "manager.overview.category": "à°•à±‡à°Ÿà°—à°¿à°°à±€",
    "manager.overview.uploads": "à°…à°ªà±â€Œà°²à±‹à°¡à±à°²à±",
    "manager.overview.pending": "à°ªà±†à°‚à°¡à°¿à°‚à°—à±",
    "manager.overview.unableLoad": "à°®à±‡à°¨à±‡à°œà°°à± à°“à°µà°°à±à°µà±à°¯à±‚ à°²à±‹à°¡à± à°•à°¾à°²à±‡à°¦à±.",
    "websitePosters.eyebrow": "à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à±à°²à±",
    "websitePosters.title": "à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à± à°²à±ˆà°¬à±à°°à°°à±€",
    "websitePosters.description": "Mana Poster Ai à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°²à°¾à°‚à°¡à°¿à°‚à°—à± à°…à°¨à±à°­à°µà°‚à°²à±‹ à°‰à°ªà°¯à±‹à°—à°¿à°‚à°šà±‡ à°ªà±‹à°¸à±à°Ÿà°°à±à°²à°¨à± à°šà±‚à°¡à°‚à°¡à°¿, à°¤à±Šà°²à°—à°¿à°‚à°šà°‚à°¡à°¿.",
    "websitePosters.refresh": "à°°à°¿à°«à±à°°à±†à°·à±",
    "websitePosters.unableLoad": "à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à±à°²à± à°²à±‹à°¡à± à°•à°¾à°²à±‡à°¦à±.",
    "websitePosters.confirmDelete": "à°ˆ à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à±â€Œà°¨à± à°¤à±Šà°²à°—à°¿à°‚à°šà°¾à°²à°¾?",
    "websitePosters.unableDelete": "à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à± à°¤à±Šà°²à°—à°¿à°‚à°šà°²à±‡à°•à°ªà±‹à°¯à°¾à°‚.",
    "websitePosters.deleted": "à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à± à°¤à±Šà°²à°—à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿.",
    "websitePosters.preview": "à°ªà±à°°à°¿à°µà±à°¯à±‚",
    "websitePosters.category": "à°•à±‡à°Ÿà°—à°¿à°°à±€",
    "websitePosters.sortOrder": "à°•à±à°°à°® à°¸à°‚à°–à±à°¯",
    "websitePosters.status": "à°¸à±à°Ÿà±‡à°Ÿà°¸à±",
    "websitePosters.updated": "à°…à°ªà±â€Œà°¡à±‡à°Ÿà± à°¸à°®à°¯à°‚",
    "websitePosters.action": "à°šà°°à±à°¯",
    "websitePosters.loading": "à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à±à°²à± à°²à±‹à°¡à± à°…à°µà±à°¤à±à°¨à±à°¨à°¾à°¯à°¿...",
    "websitePosters.empty": "à° à°µà±†à°¬à±â€Œà°¸à±ˆà°Ÿà± à°ªà±‹à°¸à±à°Ÿà°°à±à°²à± à°²à°­à°¿à°‚à°šà°²à±‡à°¦à±.",
    "websitePosters.active": "à°¯à°¾à°•à±à°Ÿà°¿à°µà±",
    "websitePosters.inactive": "à°‡à°¨à°¾à°•à±à°Ÿà°¿à°µà±",
    "websitePosters.delete": "à°¤à±Šà°²à°—à°¿à°‚à°šà±",
    "websitePosters.showingPage": "à°ªà±‡à°œà±€ à°šà±‚à°ªà±à°¤à±‹à°‚à°¦à°¿",
    "websitePosters.totalPosters": "à°®à±Šà°¤à±à°¤à°‚ à°ªà±‹à°¸à±à°Ÿà°°à±à°²à±",
    "websitePosters.previous": "à°®à±à°¨à±à°ªà°Ÿà°¿",
    "websitePosters.next": "à°¤à°°à±à°µà°¾à°¤à°¿",
    "payouts.eyebrow": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°ªà±‡à°®à±†à°‚à°Ÿà±à°²à±",
    "payouts.title": "à°ªà±‡à°®à±†à°‚à°Ÿà± à°²à±†à°¡à±à°œà°°à±",
    "payouts.description": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°ªà±‡à°®à±†à°‚à°Ÿà± à°°à°¿à°•à°¾à°°à±à°¡à±à°²à°¨à± à°¸à±à°Ÿà±‡à°Ÿà°¸à±, à°®à±Šà°¤à±à°¤à°‚, à°¤à±‡à°¦à±€à°¤à±‹ à°šà±‚à°¡à°‚à°¡à°¿.",
    "payouts.refresh": "à°°à°¿à°«à±à°°à±†à°·à±",
    "payouts.searchPlaceholder": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°à°¡à°¿, à°¸à±à°Ÿà±‡à°Ÿà°¸à±, à°¨à±‹à°Ÿà± à°•à±‹à°¸à°‚ à°µà±†à°¤à°•à°‚à°¡à°¿",
    "payouts.allStatuses": "à°…à°¨à±à°¨à°¿ à°¸à±à°Ÿà±‡à°Ÿà°¸à±â€Œà°²à±",
    "payouts.paid": "à°šà±†à°²à±à°²à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿",
    "payouts.queued": "à°•à±à°¯à±‚ à°²à±‹ à°‰à°‚à°¦à°¿",
    "payouts.onHold": "à°¹à±‹à°²à±à°¡à±â€Œà°²à±‹ à°‰à°‚à°¦à°¿",
    "payouts.approved": "à°†à°®à±‹à°¦à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿",
    "payouts.apply": "à°…à°ªà±à°²à±ˆ",
    "payouts.loading": "à°ªà±‡à°®à±†à°‚à°Ÿà±à°²à± à°²à±‹à°¡à± à°…à°µà±à°¤à±à°¨à±à°¨à°¾à°¯à°¿...",
    "payouts.empty": "à° à°ªà±‡à°®à±†à°‚à°Ÿà±à°²à± à°²à°­à°¿à°‚à°šà°²à±‡à°¦à±.",
    "payouts.creator": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à±",
    "payouts.amount": "à°®à±Šà°¤à±à°¤à°‚",
    "payouts.status": "à°¸à±à°Ÿà±‡à°Ÿà°¸à±",
    "payouts.note": "à°¨à±‹à°Ÿà±",
    "payouts.date": "à°¤à±‡à°¦à±€",
    "payouts.showingPage": "à°ªà±‡à°œà±€ à°šà±‚à°ªà±à°¤à±‹à°‚à°¦à°¿",
    "payouts.totalPayouts": "à°®à±Šà°¤à±à°¤à°‚ à°ªà±‡à°®à±†à°‚à°Ÿà±à°²à±",
    "payouts.previous": "à°®à±à°¨à±à°ªà°Ÿà°¿",
    "payouts.next": "à°¤à°°à±à°µà°¾à°¤à°¿",
    "payouts.unableLoad": "à°ªà±‡à°®à±†à°‚à°Ÿà±à°²à± à°²à±‹à°¡à± à°•à°¾à°²à±‡à°¦à±.",
    "audit.eyebrow": "à°†à°¡à°¿à°Ÿà± à°²à°¾à°—à±à°¸à±",
    "audit.title": "à°…à°¡à±à°®à°¿à°¨à± à°¯à°¾à°•à±à°Ÿà°¿à°µà°¿à°Ÿà±€ à°Ÿà±ˆà°®à±â€Œà°²à±ˆà°¨à±",
    "audit.description": "à°…à°¸à°²à± à°…à°¡à±à°®à°¿à°¨à± à°šà°°à±à°¯à°²à°¨à± à°¯à±‚à°œà°°à±, à°Ÿà°¾à°°à±à°—à±†à°Ÿà±, à°¸à°®à°¯à°‚à°¤à±‹ à°šà±‚à°¡à°‚à°¡à°¿.",
    "audit.refresh": "à°°à°¿à°«à±à°°à±†à°·à±",
    "audit.searchPlaceholder": "à°šà°°à±à°¯, à°¯à±‚à°œà°°à±, à°Ÿà°¾à°°à±à°—à±†à°Ÿà±, à°®à±†à°¸à±‡à°œà± à°•à±‹à°¸à°‚ à°µà±†à°¤à°•à°‚à°¡à°¿",
    "audit.actionPlaceholder": "à°¯à°¾à°•à±à°·à°¨à± à°«à°¿à°²à±à°Ÿà°°à± à°²à±‡à°¦à°¾ all",
    "audit.apply": "à°…à°ªà±à°²à±ˆ",
    "audit.loading": "à°†à°¡à°¿à°Ÿà± à°²à°¾à°—à±à°¸à± à°²à±‹à°¡à± à°…à°µà±à°¤à±à°¨à±à°¨à°¾à°¯à°¿...",
    "audit.empty": "à° à°†à°¡à°¿à°Ÿà± à°²à°¾à°—à±à°¸à± à°²à°­à°¿à°‚à°šà°²à±‡à°¦à±.",
    "audit.action": "à°šà°°à±à°¯",
    "audit.user": "à°¯à±‚à°œà°°à±",
    "audit.role": "à°°à±‹à°²à±",
    "audit.target": "à°Ÿà°¾à°°à±à°—à±†à°Ÿà±",
    "audit.message": "à°®à±†à°¸à±‡à°œà±",
    "audit.timestamp": "à°¸à°®à°¯à°‚",
    "audit.showingPage": "à°ªà±‡à°œà±€ à°šà±‚à°ªà±à°¤à±‹à°‚à°¦à°¿",
    "audit.totalLogs": "à°®à±Šà°¤à±à°¤à°‚ à°²à°¾à°—à±à°¸à±",
    "audit.previous": "à°®à±à°¨à±à°ªà°Ÿà°¿",
    "audit.next": "à°¤à°°à±à°µà°¾à°¤à°¿",
    "audit.unableLoad": "à°†à°¡à°¿à°Ÿà± à°²à°¾à°—à±à°¸à± à°²à±‹à°¡à± à°•à°¾à°²à±‡à°¦à±.",
    "creator.upload.unableReadImageSize": "à°‡à°®à±‡à°œà± à°ªà°°à°¿à°®à°¾à°£à°‚ à°šà°¦à°µà°²à±‡à°•à°ªà±‹à°¯à°¾à°‚.",
    "creator.upload.unableOptimizeImage": "à°ˆ à°¡à°¿à°µà±ˆà°¸à±â€Œà°²à±‹ à°‡à°®à±‡à°œà±â€Œà°¨à± à°†à°ªà±à°Ÿà°¿à°®à±ˆà°œà± à°šà±‡à°¯à°²à±‡à°•à°ªà±‹à°¯à°¾à°‚.",
    "creator.upload.uploadFailed": "à°…à°ªà±â€Œà°²à±‹à°¡à± à°µà°¿à°«à°²à°®à±ˆà°‚à°¦à°¿.",
    "creator.upload.unableLoadWorkspace": "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°µà°°à±à°•à±â€Œà°¸à±à°ªà±‡à°¸à± à°²à±‹à°¡à± à°•à°¾à°²à±‡à°¦à±.",
    "creator.upload.loginRequired": "à°²à°¾à°—à°¿à°¨à± à°…à°µà°¸à°°à°‚.",
    "creator.upload.selectPoster": "à°’à°• à°ªà±‹à°¸à±à°Ÿà°°à± à°‡à°®à±‡à°œà± à°²à±‡à°¦à°¾ à°µà±€à°¡à°¿à°¯à±‹ à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿.",
    "creator.upload.selectAssignedCategory": "à°…à°¸à±ˆà°¨à± à°…à°¯à°¿à°¨ à°•à±‡à°Ÿà°—à°¿à°°à±€ à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿.",
    "creator.upload.preparingUpload": "à°…à°ªà±â€Œà°²à±‹à°¡à± à°¸à°¿à°¦à±à°§à°‚ à°šà±‡à°¸à±à°¤à±à°¨à±à°¨à°¾à°‚...",
    "creator.upload.uploadedForReview": "à°ªà±‹à°¸à±à°Ÿà°°à± à°…à°ªà±â€Œà°²à±‹à°¡à± à°…à°¯à°¿ à°®à±‡à°¨à±‡à°œà°°à± à°°à°¿à°µà±à°¯à±‚à°•à± à°ªà°‚à°ªà°¬à°¡à°¿à°‚à°¦à°¿.",
    "creator.upload.uploadStudio": "à°…à°ªà±â€Œà°²à±‹à°¡à± à°¸à±à°Ÿà±‚à°¡à°¿à°¯à±‹",
    "creator.upload.uploadTitle": "à°…à°ªà±â€Œà°²à±‹à°¡à±",
    "creator.upload.refresh": "à°°à°¿à°«à±à°°à±†à°·à±",
    "creator.upload.refreshing": "à°°à°¿à°«à±à°°à±†à°·à± à°…à°µà±à°¤à±‹à°‚à°¦à°¿...",
    "creator.upload.uploadWindowClosed": "à°ˆà°°à±‹à°œà± à°…à°ªà±â€Œà°²à±‹à°¡à± à°µà°¿à°‚à°¡à±‹ à°®à±à°—à°¿à°¸à°¿à°‚à°¦à°¿. à°®à°³à±à°²à±€ à°ªà±à°°à°¾à°°à°‚à°­à°®à°¯à±à°¯à±‡ à°¸à°®à°¯à°‚",
    "creator.upload.imageCustomizationOnly": "à°‡à°®à±‡à°œà± à°•à°¸à±à°Ÿà°®à±ˆà°œà±‡à°·à°¨à± à°ªà±‹à°¸à±à°Ÿà°°à± à°‡à°®à±‡à°œà±â€Œà°²à°•à± à°®à°¾à°¤à±à°°à°®à±‡ à°…à°‚à°¦à±à°¬à°¾à°Ÿà±à°²à±‹ à°‰à°‚à°Ÿà±à°‚à°¦à°¿.",
    "creator.upload.selectedCategory": "à°Žà°‚à°šà±à°•à±à°¨à±à°¨ à°•à±‡à°Ÿà°—à°¿à°°à±€",
    "creator.upload.selectCategory": "à°•à±‡à°Ÿà°—à°¿à°°à±€ à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿",
    "creator.upload.noAssignedCategories": "à°…à°¸à±ˆà°¨à± à°…à°¯à°¿à°¨ à°•à±‡à°Ÿà°—à°¿à°°à±€à°²à± à°²à±‡à°µà±.",
    "creator.upload.accepted": "à°†à°®à±‹à°¦à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿",
    "creator.upload.rejected": "à°¤à°¿à°°à°¸à±à°•à°°à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿",
    "creator.upload.pending": "à°ªà±†à°‚à°¡à°¿à°‚à°—à±",
    "creator.upload.reason": "à°•à°¾à°°à°£à°‚",
    "creator.upload.choosePoster": "à°ªà±‹à°¸à±à°Ÿà°°à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿",
    "creator.upload.customization": "à°•à°¸à±à°Ÿà°®à±ˆà°œà±‡à°·à°¨à±",
    "creator.upload.uploading": "à°…à°ªà±â€Œà°²à±‹à°¡à± à°…à°µà±à°¤à±‹à°‚à°¦à°¿...",
    "creator.upload.upload": "à°…à°ªà±â€Œà°²à±‹à°¡à±",
    "creator.upload.alreadyUploadedToday": "à°ˆ à°•à±‡à°Ÿà°—à°¿à°°à±€à°²à±‹ à°ˆà°°à±‹à°œà± à°’à°• à°ªà±‹à°¸à±à°Ÿà°°à± à°‡à°ªà±à°ªà°Ÿà°¿à°•à±‡ à°¸à°®à°°à±à°ªà°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿. à°°à±‡à°ªà± à°®à°³à±à°²à±€ à°…à°ªà±â€Œà°²à±‹à°¡à± à°šà±‡à°¯à°µà°šà±à°šà±.",
    "creator.upload.customize": "à°•à°¸à±à°Ÿà°®à±ˆà°œà±",
    "creator.upload.previewPlacement": "à°ªà±à°°à°¿à°µà±à°¯à±‚ à°ªà±à°²à±‡à°¸à±â€Œà°®à±†à°‚à°Ÿà±",
    "creator.upload.close": "à°®à±‚à°¸à°¿à°µà±‡à°¯à°¿",
    "creator.upload.photoShape": "à°«à±‹à°Ÿà±‹ à°·à±‡à°ªà±",
    "creator.upload.premiumShapes": "à°ªà±à°°à±€à°®à°¿à°¯à°‚ à°·à±‡à°ªà±â€Œà°²à±",
    "creator.upload.transparentCutouts": "à°Ÿà±à°°à°¾à°¨à±à°¸à±â€Œà°ªà°°à±†à°‚à°Ÿà± à°•à°Ÿà±â€Œà°”à°Ÿà±à°¸à±",
    "creator.upload.photoMode": "à°«à±‹à°Ÿà±‹ à°®à±‹à°¡à±",
    "creator.upload.bgRemoved": "à°¬à±à°¯à°¾à°•à±â€Œà°—à±à°°à±Œà°‚à°¡à± à°¤à±Šà°²à°—à°¿à°‚à°šà°¿à°¨à°¦à°¿",
    "creator.upload.originalPhoto": "à°’à°°à°¿à°œà°¿à°¨à°²à± à°«à±‹à°Ÿà±‹",
    "creator.upload.photoSize": "à°«à±‹à°Ÿà±‹ à°¸à±ˆà°œà±",
    "creator.upload.dragHelp": "à°«à±‹à°Ÿà±‹, à°ªà±‡à°°à± à°¨à± à°¨à±‡à°°à±à°—à°¾ à°¡à±à°°à°¾à°—à± à°šà±‡à°¯à°‚à°¡à°¿. à°«à±‹à°Ÿà±‹ à°¸à±ˆà°œà± à°®à°¾à°°à±à°šà°¡à°¾à°¨à°¿à°•à°¿ à°®à±Œà°¸à± à°µà±€à°²à± à°µà°¾à°¡à°‚à°¡à°¿.",
    "creator.upload.showGradientStrip": "à°—à±à°°à°¾à°¡à°¿à°¯à±†à°‚à°Ÿà± à°¸à±à°Ÿà±à°°à°¿à°ªà± à°šà±‚à°ªà°¿à°‚à°šà±",
    "creator.upload.apply": "à°…à°ªà±à°²à±ˆ",
    "creator.upload.appliedMessage": "à°•à°¸à±à°Ÿà°®à±ˆà°œà±‡à°·à°¨à± à°…à°ªà±à°²à±ˆ à°…à°¯à°¿à°‚à°¦à°¿. à°…à°ªà±â€Œà°²à±‹à°¡à± à°šà±‡à°¸à°¿à°¨à°ªà±à°ªà±à°¡à± à°‡à°¦à±‡ à°ªà±à°²à±‡à°¸à±â€Œà°®à±†à°‚à°Ÿà± à°¸à±‡à°µà± à°…à°µà±à°¤à±à°‚à°¦à°¿.",
    "creator.upload.shape.circle": "à°¸à°°à±à°•à°¿à°²à±",
    "creator.upload.shape.scallop_circle": "à°¸à±à°•à°¾à°²à±‹à°ªà± à°¸à°°à±à°•à°¿à°²à±",
    "creator.upload.shape.soft_burst": "à°¸à°¾à°«à±à°Ÿà± à°¬à°°à±à°¸à±à±à°Ÿà±",
    "creator.upload.shape.badge": "à°¬à±à°¯à°¾à°¡à±à°œà±",
    "creator.upload.shape.rounded_square": "à°°à±Œà°‚à°¡à±†à°¡à± à°¸à±à°•à±à°µà±‡à°°à±",
    "creator.upload.shape.vertical_rectangle": "à°µà±†à°°à±à°Ÿà°¿à°•à°²à± à°°à±†à°•à±à°Ÿà°¾à°‚à°—à°¿à°²à±",
    "creator.upload.shape.square": "à°•à±à°²à°¾à°¸à°¿à°•à± à°¸à±à°•à±à°µà±‡à°°à±",
    "creator.upload.shape.transparent_bottom_fade": "à°¬à°¾à°Ÿà°®à± à°¬à±à°²à±†à°‚à°¡à±",
    "creator.upload.shape.transparent_clean": "à°•à±à°²à±€à°¨à± à°•à°Ÿà±â€Œà°”à°Ÿà±",
    "creator.upload.shape.transparent_soft_round": "à°¸à°¾à°«à±à°Ÿà± à°°à±Œà°‚à°¡à±",
    "creator.upload.shape.transparent_sharp_round": "à°·à°¾à°°à±à°ªà± à°°à±Œà°‚à°¡à±",
  },
};

export function portalLanguage(value?: string | null): PortalLanguage {
  return value === "telugu" || value === "te" ? "te" : "en";
}

const WINDOWS_1252_BYTES: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function decodeMojibake(value: string): string {
  if (!/[àÃÂâ]/.test(value)) {
    return value;
  }
  const bytes: number[] = [];
  for (const char of value) {
    const mapped = WINDOWS_1252_BYTES[char];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    const code = char.charCodeAt(0);
    if (code <= 0xff) {
      bytes.push(code);
    } else {
      return value;
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

export function t(key: TranslationKey, lang: PortalLanguage): string {
  return decodeMojibake(translations[lang][key] ?? translations.en[key] ?? key);
}

