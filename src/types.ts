export type ProduceCategory =
  | 'Grains'
  | 'Vegetables'
  | 'Fruits'
  | 'Tubers'
  | 'Legumes'
  | 'Poultry'
  | 'Livestock'
  | 'Other Produce'
  | 'Other'
  | string;

export interface Produce {
  id: string;
  farmerId: string;
  farmerName?: string;
  name: string;
  category: ProduceCategory;
  description: string;
  location: string;
  state?: string;
  lga?: string;
  availableQuantity: number;
  unit: string;
  price: number;
  status: 'Available' | 'Limited' | 'Low Stock' | 'Out of Stock';
  image?: string;
  images?: string[];
  harvestDate?: string;
  createdAt: string;
}

export interface Request {
  id: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmerName?: string;
  produceId: string;
  produceName: string;
  price: number;
  quantity: number;
  unit?: string;
  totalAmount: number;
  deliveryLocation: string;
  preferredDate: string;
  preferredDeliveryDate?: string;
  message?: string;
  buyerNote?: string;
  farmerResponse?: string;
  respondedAt?: string;
  status: 'Pending' | 'Accepted' | 'Declined' | 'Cancelled';
  createdAt: string;
  updatedAt?: string;
}

export type OrderStatus =
  | 'Confirmed'
  | 'Processing'
  | 'Ready for Delivery'
  | 'In Transit'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled';

// ORDER_STATUS_LIFECYCLE defines the valid forward transitions for each order status.
// Important: 'Ready for Delivery' → 'In Transit' is intentionally absent here.
// That transition is controlled exclusively by the logistics system (admin via
// update_logistics_status RPC), not directly by the farmer. Farmers may only
// cancel a 'Ready for Delivery' order; the logistics dispatch advances it to
// 'In Transit' when the driver picks up the produce.
export const ORDER_STATUS_LIFECYCLE: Record<OrderStatus, OrderStatus[]> = {
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Ready for Delivery', 'Cancelled'],
  'Ready for Delivery': ['Cancelled'],
  'In Transit': ['Delivered'],
  Delivered: ['Completed'],
  Completed: [],
  Cancelled: []
};

export const getAllowedFarmerNextStatuses = (currentStatus: OrderStatus): OrderStatus[] => {
  switch (currentStatus) {
    case 'Confirmed':
      return ['Processing', 'Cancelled'];
    case 'Processing':
      return ['Ready for Delivery', 'Cancelled'];
    case 'Ready for Delivery':
    case 'In Transit':
    case 'Delivered':
    case 'Completed':
    case 'Cancelled':
    default:
      return [];
  }
};

export interface Order {
  id: string;
  orderNumber?: string;
  requestId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone?: string;
  farmerId: string;
  farmerName?: string;
  farmerPhone?: string;
  produceId: string;
  produceName: string;
  produceImage?: string;
  quantity: number;
  unit?: string;
  price?: number;
  totalAmount: number;
  pickupLocation: string;
  deliveryLocation: string;
  deliveryDate: string;
  status: OrderStatus;
  buyerNotes?: string;
  farmerNotes?: string;
  fulfillmentNotes?: string;
  logisticsId?: string;
  logisticsStatus?: LogisticsStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  recipientId?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  relatedId?: string;
  read: boolean;
  isRead?: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface Farmer {
  id: string;
  name: string;
  farmName: string;
  photo: string;
  phone: string;
  state: string;
  city: string;
  lga: string;
  description: string;
  experience: string;
  categories: string[];
  status?: 'Active' | 'Suspended';
  dateJoined?: string;
}

export interface FarmerDashboardData {
  produceListed: number;
  availableStock: number;
  stockUnit: string;
  pendingRequests: number;
  activeOrders: number;
  completedOrders?: number;
}

export interface BuyerDashboardData {
  availableProduce: number;
  farmers: number;
  pendingRequests: number;
  activeOrders: number;
  completedOrders?: number;
}

export interface SmartMatchCriteria {
  produceQuery: string;
  quantity: number;
  deliveryLocation: string;
  preferredPrice?: number;
  deliveryRequired?: boolean;
}

export interface MatchReason {
  label: string;
  passed: boolean;
  score: number;
  maxScore: number;
}

export interface SmartMatchResult {
  produce: Produce;
  farmer?: Farmer;
  totalScore: number; // 0 - 100
  reasons: string[];
  reasonDetails: MatchReason[];
}

export type LogisticsStatus = 'Requested' | 'Assigned' | 'Picked Up' | 'In Transit' | 'Delivered' | 'Cancelled';

export const LOGISTICS_STATUS_LIFECYCLE: Record<LogisticsStatus, LogisticsStatus[]> = {
  Requested: ['Assigned', 'Cancelled'],
  Assigned: ['Picked Up', 'Cancelled'],
  'Picked Up': ['In Transit'],
  'In Transit': ['Delivered'],
  Delivered: [],
  Cancelled: []
};

export const getAllowedLogisticsNextStatuses = (currentStatus: LogisticsStatus): LogisticsStatus[] => {
  return LOGISTICS_STATUS_LIFECYCLE[currentStatus] || [];
};

export interface LogisticsRequest {
  id: string;
  logisticsNumber?: string;
  orderId: string;
  buyerId: string;
  buyerName: string;
  farmerId: string;
  farmerName?: string;
  produceName: string;
  quantity: number;
  unit?: string;
  pickupLocation: string;
  pickupAddress: string;
  deliveryLocation: string;
  deliveryAddress: string;
  preferredDate: string;
  instructions?: string;
  provider?: 'AgriMove Logistics' | 'FarmRoute Express' | string;
  driver?: string;
  driverPhone?: string;
  status: LogisticsStatus;
  createdAt: string;
  updatedAt: string;
}

export type Role = 'Farmer' | 'Buyer' | 'Admin' | 'farmer' | 'buyer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  buyerType?: string;
  farmName?: string;
  organization?: string;
  location?: string;
  state?: string;
  city?: string;
  lga?: string;
  address?: string;
  description?: string;
  farmingType?: string;
  experience?: string;
  status?: 'Active' | 'Suspended' | 'Banned';
  accountStatus?: 'Active' | 'Suspended' | 'Banned';
  isVerified?: boolean;
  dateJoined?: string;
  createdAt?: string;
}

export interface Activity {
  id: string;
  type: 'interest' | 'availability' | 'profile' | 'new_produce' | 'order_update' | 'new_farmer' | 'new_request' | 'new_order' | 'logistics_update';
  title: string;
  description: string;
  timeAgo: string;
  createdAt?: string;
}

export interface AdminStats {
  totalFarmers: number;
  totalBuyers: number;
  totalProduce: number;
  totalOrders: number;
  completedOrders: number;
  pendingRequests: number;
  activeLogistics: number;
  marketplaceValue: number;
}

export interface Dispute {
  id: string;
  orderId: string;
  buyerId: string;
  farmerId: string;
  issue: string;
  status: 'Open' | 'Resolved' | 'Rejected';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  createdAt: string;
}

export interface PlatformSettings {
  commissionRate: number; // e.g. 5 for 5%
}

// ---------------------------------------------------------------------------
// Payment & Settlement (Stage 1 — Bank Account Verification)
// ---------------------------------------------------------------------------

export type PayoutVerificationStatus = 'not_verified' | 'verifying' | 'verified' | 'failed';

/**
 * Represents a farmer's registered payout bank account.
 * The raw account number is NEVER stored or exposed — only the masked form.
 */
export interface FarmerPayoutAccount {
  id: string;
  farmerId: string;
  bankCode: string;
  bankName: string;
  /** Verified account holder name returned by Paystack */
  accountName: string;
  /** Masked display number, e.g. ****6789. Raw number is never stored. */
  maskedAccountNumber: string;
  verificationStatus: PayoutVerificationStatus;
  /** Reserved for future Paystack subaccount integration (Stage 2+). */
  paystackSubaccountCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
