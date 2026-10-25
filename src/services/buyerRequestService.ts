import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Request } from '../types';
import { orderService } from './orderService';

export interface DatabaseBuyerRequestRow {
  id: string;
  buyer_id: string;
  farmer_id: string;
  produce_id: string;
  quantity: number;
  unit: string;
  price: number;
  total_amount: number;
  delivery_location: string | null;
  preferred_delivery_date: string | null;
  buyer_note: string | null;
  message: string | null;
  farmer_response: string | null;
  responded_at: string | null;
  status: 'Pending' | 'Accepted' | 'Declined' | 'Cancelled';
  created_at: string;
  updated_at: string;
  buyer_profile?: {
    id?: string;
    full_name?: string;
    organization?: string;
    phone?: string;
    email?: string;
  } | null;
  farmer_profile?: {
    id?: string;
    full_name?: string;
    farm_name?: string;
    phone?: string;
    state?: string;
    city?: string;
  } | null;
  produce?: {
    id?: string;
    name?: string;
    unit?: string;
    price?: number;
    status?: string;
    image_url?: string;
  } | null;
}

export interface BuyerRequestInput {
  farmerId: string;
  farmerName?: string;
  produceId: string;
  produceName: string;
  quantity: number;
  unit?: string;
  price: number;
  totalAmount: number;
  deliveryLocation: string;
  preferredDate: string;
  preferredDeliveryDate?: string;
  message?: string;
  buyerNote?: string;
}

class BuyerRequestService {
  /**
   * Translates a Supabase DB row into the application's Request domain model.
   */
  public mapRowToRequest(row: DatabaseBuyerRequestRow): Request {
    const buyerName =
      row.buyer_profile?.organization ||
      row.buyer_profile?.full_name ||
      'Buyer';

    const farmerName =
      row.farmer_profile?.farm_name ||
      row.farmer_profile?.full_name ||
      'Farmer';

    const produceName = row.produce?.name || 'Produce';
    const unit = row.unit || row.produce?.unit || 'kg';
    const quantity = Number(row.quantity) || 0;
    const price = Number(row.price) || Number(row.produce?.price) || 0;
    const totalAmount =
      Number(row.total_amount) ||
      (quantity * price);

    const note = row.buyer_note || row.message || '';
    const preferredDate = row.preferred_delivery_date || '';

    return {
      id: row.id,
      buyerId: row.buyer_id,
      buyerName,
      farmerId: row.farmer_id,
      farmerName,
      produceId: row.produce_id,
      produceName,
      price,
      quantity,
      unit,
      totalAmount,
      deliveryLocation: row.delivery_location || '',
      preferredDate,
      preferredDeliveryDate: preferredDate,
      message: note,
      buyerNote: note,
      farmerResponse: row.farmer_response || undefined,
      respondedAt: row.responded_at || undefined,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Fetches requests from Supabase with relational profiles and produce data.
   * Leverages Supabase RLS for secure filtering, plus role-based hints.
   */
  public async fetchRequests(userId?: string, role?: string): Promise<Request[]> {
    if (!isSupabaseConfigured) {
      console.warn('BuyerRequestService: Supabase is not configured.');
      return [];
    }

    try {
      let query = supabase
        .from('buyer_requests')
        .select(`
          *,
          buyer_profile:buyer_id (
            id,
            full_name,
            organization,
            phone,
            email
          ),
          farmer_profile:farmer_id (
            id,
            full_name,
            farm_name,
            phone,
            state,
            city
          ),
          produce:produce_id (
            id,
            name,
            unit,
            price,
            status,
            image_url
          )
        `)
        .order('created_at', { ascending: false });

      if (userId && role) {
        const normalizedRole = role.toLowerCase();
        if (normalizedRole === 'buyer') {
          query = query.eq('buyer_id', userId);
        } else if (normalizedRole === 'farmer') {
          query = query.eq('farmer_id', userId);
        }
        // Admins can see all rows; RLS ensures only authorized rows are returned
      }

      const { data, error } = await query;

      if (error) {
        console.error('BuyerRequestService.fetchRequests error:', error.message);
        return [];
      }

      return (data || []).map((row: any) => this.mapRowToRequest(row));
    } catch (err) {
      console.error('BuyerRequestService.fetchRequests network error:', err);
      return [];
    }
  }

  /**
   * Fetches requests submitted by the authenticated buyer.
   */
  public async fetchBuyerRequests(buyerId?: string): Promise<Request[]> {
    return this.fetchRequests(buyerId, 'buyer');
  }

  /**
   * Fetches incoming requests targeting the authenticated farmer's produce listings.
   */
  public async fetchFarmerRequests(farmerId?: string): Promise<Request[]> {
    return this.fetchRequests(farmerId, 'farmer');
  }

  /**
   * Fetches a single request by ID with joined relation fields.
   */
  public async fetchRequestById(id: string): Promise<Request | null> {
    if (!isSupabaseConfigured || !id) return null;

    try {
      const { data, error } = await supabase
        .from('buyer_requests')
        .select(`
          *,
          buyer_profile:buyer_id (
            id,
            full_name,
            organization,
            phone,
            email
          ),
          farmer_profile:farmer_id (
            id,
            full_name,
            farm_name,
            phone,
            state,
            city
          ),
          produce:produce_id (
            id,
            name,
            unit,
            price,
            status,
            image_url
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        if (error) console.warn('BuyerRequestService.fetchRequestById error:', error.message);
        return null;
      }

      return this.mapRowToRequest(data);
    } catch (err) {
      console.error('BuyerRequestService.fetchRequestById exception:', err);
      return null;
    }
  }

  /**
   * Helper to format errors into user-friendly messages for UI display.
   */
  public formatServiceError(error: any, defaultMsg: string): string {
    if (!error) return defaultMsg;
    const msg = error.message || (typeof error === 'string' ? error : '');

    if (msg.includes('Only registered buyers can create purchase requests')) {
      return 'Only registered buyers can submit purchase requests. Please sign in with a buyer account.';
    }
    if (msg.includes('Target farmer must be a registered farmer profile')) {
      return 'Target farmer is not registered as an active farmer.';
    }
    if (msg.includes('Cannot create a purchase request for Out of Stock produce') || msg.includes('out of stock')) {
      return 'Cannot submit request: this produce is currently out of stock.';
    }
    if (msg.includes('farmer_id must match the owner')) {
      return 'The selected produce does not belong to the targeted farmer.';
    }
    if (msg.includes('Only Pending requests can be cancelled')) {
      return 'Only pending requests can be cancelled.';
    }
    if (msg.includes('Buyers are not authorized to accept or decline requests')) {
      return 'You are not authorized to accept or decline requests.';
    }
    if (msg.includes('Farmers can only accept or decline pending requests')) {
      return 'Only pending requests can be accepted or declined.';
    }
    if (msg.includes('permission denied') || error.code === '42501') {
      return 'You do not have permission to perform this action.';
    }
    if (msg.includes('JWT') || msg.includes('token') || msg.includes('auth')) {
      return 'Your session has expired. Please sign in again.';
    }
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return 'Network connection error. Please check your connection and try again.';
    }
    return msg || defaultMsg;
  }

  /**
   * Submits a new buyer purchase request to Supabase.
   * Enforces buyer role, target produce availability, and ownership.
   */
  public async createRequest(input: BuyerRequestInput, buyerId?: string): Promise<Request> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const sessionUser = (await supabase.auth.getUser()).data.user;
    const effectiveBuyerId = buyerId || sessionUser?.id;

    if (!effectiveBuyerId) {
      throw new Error('Authentication required: You must be signed in as a buyer to submit a request.');
    }

    // Verify target produce exists and is not out of stock
    const { data: prodData, error: prodErr } = await supabase
      .from('produce')
      .select('id, farmer_id, status, quantity, price, unit')
      .eq('id', input.produceId)
      .maybeSingle();

    if (prodErr || !prodData) {
      throw new Error('Target produce listing does not exist.');
    }

    if (prodData.status === 'Out of Stock' || Number(prodData.quantity) <= 0) {
      throw new Error('Cannot submit request: this produce is currently out of stock.');
    }

    const targetFarmerId = prodData.farmer_id || input.farmerId;
    const reqQty = Number(input.quantity) || 1;
    const unitPrice = Number(input.price) || Number(prodData.price) || 0;
    const totalAmount = Number(input.totalAmount) || (reqQty * unitPrice);
    const prefDate = input.preferredDeliveryDate || input.preferredDate || null;
    const note = input.buyerNote || input.message || null;

    const payload = {
      buyer_id: effectiveBuyerId,
      farmer_id: targetFarmerId,
      produce_id: input.produceId,
      quantity: reqQty,
      unit: input.unit || prodData.unit || 'kg',
      price: unitPrice,
      total_amount: totalAmount,
      delivery_location: input.deliveryLocation || null,
      preferred_delivery_date: prefDate,
      buyer_note: note,
      message: note,
      status: 'Pending'
    };

    const { data, error } = await supabase
      .from('buyer_requests')
      .insert(payload)
      .select(`
        *,
        buyer_profile:buyer_id (
          id,
          full_name,
          organization,
          phone,
          email
        ),
        farmer_profile:farmer_id (
          id,
          full_name,
          farm_name,
          phone,
          state,
          city
        ),
        produce:produce_id (
          id,
          name,
          unit,
          price,
          status,
          image_url
        )
      `)
      .single();

    if (error) {
      console.error('BuyerRequestService.createRequest error:', error);
      throw new Error(this.formatServiceError(error, 'Failed to submit purchase request.'));
    }

    return this.mapRowToRequest(data);
  }

  /**
   * Accepts a pending request using the atomic PostgreSQL RPC: accept_buyer_request_and_create_order.
   * This delegates to orderService to atomically verify farmer authorization, lock rows,
   * decrement produce stock, transition request to 'Accepted', and create the commercial order.
   * Only authorized for the produce farmer. Preserved for backwards compatibility.
   */
  public async acceptRequest(requestId: string, farmerId?: string, responseMessage?: string): Promise<Request> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const sessionUser = (await supabase.auth.getUser()).data.user;
    const effectiveFarmerId = farmerId || sessionUser?.id;

    if (!effectiveFarmerId) {
      throw new Error('Authentication required to accept request.');
    }

    try {
      // Delegate to the atomic RPC via orderService
      await orderService.acceptBuyerRequestAndCreateOrder(requestId, responseMessage);

      // Re-fetch the updated request record with relations to preserve Promise<Request> compatibility
      const updated = await this.fetchRequestById(requestId);
      if (updated) {
        return updated;
      }
    } catch (error: any) {
      console.error('BuyerRequestService.acceptRequest error:', error);
      throw error;
    }

    throw new Error('Request accepted and order created, but could not retrieve updated request.');
  }

  /**
   * Declines a pending request. Only authorized for the produce farmer.
   */
  public async declineRequest(requestId: string, farmerId?: string, reason?: string): Promise<Request> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const sessionUser = (await supabase.auth.getUser()).data.user;
    const effectiveFarmerId = farmerId || sessionUser?.id;

    if (!effectiveFarmerId) {
      throw new Error('Authentication required to decline request.');
    }

    const payload = {
      status: 'Declined',
      farmer_response: reason || 'Declined by farmer',
      responded_at: new Date().toISOString()
    };

    let query = supabase
      .from('buyer_requests')
      .update(payload)
      .eq('id', requestId);

    if (effectiveFarmerId) {
      query = query.eq('farmer_id', effectiveFarmerId);
    }

    const { data, error } = await query
      .select(`
        *,
        buyer_profile:buyer_id (
          id,
          full_name,
          organization,
          phone,
          email
        ),
        farmer_profile:farmer_id (
          id,
          full_name,
          farm_name,
          phone,
          state,
          city
        ),
        produce:produce_id (
          id,
          name,
          unit,
          price,
          status,
          image_url
        )
      `)
      .single();

    if (error) {
      console.error('BuyerRequestService.declineRequest error:', error);
      throw new Error(this.formatServiceError(error, 'Failed to decline purchase request.'));
    }

    return this.mapRowToRequest(data);
  }

  /**
   * Cancels a pending request. Only authorized for the requesting buyer.
   */
  public async cancelRequest(requestId: string, buyerId?: string): Promise<Request> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const sessionUser = (await supabase.auth.getUser()).data.user;
    const effectiveBuyerId = buyerId || sessionUser?.id;

    if (!effectiveBuyerId) {
      throw new Error('Authentication required to cancel request.');
    }

    const payload = {
      status: 'Cancelled'
    };

    let query = supabase
      .from('buyer_requests')
      .update(payload)
      .eq('id', requestId);

    if (effectiveBuyerId) {
      query = query.eq('buyer_id', effectiveBuyerId);
    }

    const { data, error } = await query
      .select(`
        *,
        buyer_profile:buyer_id (
          id,
          full_name,
          organization,
          phone,
          email
        ),
        farmer_profile:farmer_id (
          id,
          full_name,
          farm_name,
          phone,
          state,
          city
        ),
        produce:produce_id (
          id,
          name,
          unit,
          price,
          status,
          image_url
        )
      `)
      .single();

    if (error) {
      console.error('BuyerRequestService.cancelRequest error:', error);
      throw new Error(this.formatServiceError(error, 'Failed to cancel purchase request.'));
    }

    return this.mapRowToRequest(data);
  }

  private activeChannel: any = null;

  /**
   * Subscribes to Realtime events on public.buyer_requests.
   * Notifies subscribers on INSERT, UPDATE, or DELETE with fresh joined records.
   */
  public subscribeToBuyerRequests(
    onPayload: (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      request?: Request;
      id: string;
    }) => void
  ): () => void {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    if (this.activeChannel) {
      supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
    }

    const channelId = `buyer_requests_realtime_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buyer_requests'
        },
        async (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === 'DELETE') {
            const deletedId = (oldRow as any)?.id;
            if (deletedId) {
              onPayload({ eventType: 'DELETE', id: deletedId });
            }
            return;
          }

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const row = newRow as DatabaseBuyerRequestRow;
            if (!row || !row.id) return;

            // Fetch the fully joined record for complete buyer, farmer, and produce details
            try {
              const fullReq = await this.fetchRequestById(row.id);
              if (fullReq) {
                onPayload({
                  eventType,
                  request: fullReq,
                  id: row.id
                });
                return;
              }
            } catch (e) {
              // Fallback to direct mapping
            }

            const fallbackRequest = this.mapRowToRequest(row);
            onPayload({
              eventType,
              request: fallbackRequest,
              id: row.id
            });
          }
        }
      )
      .subscribe();

    this.activeChannel = channel;

    return () => {
      if (this.activeChannel === channel) {
        supabase.removeChannel(channel);
        this.activeChannel = null;
      }
    };
  }
}

export const buyerRequestService = new BuyerRequestService();
