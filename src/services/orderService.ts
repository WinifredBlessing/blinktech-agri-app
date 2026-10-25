import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Order, OrderStatus } from '../types';

export interface DatabaseOrderRow {
  id: string; // UUID primary key
  order_number: string; // Stored computed 'ORD-xxxxxxxx'
  buyer_request_id: string;
  buyer_id: string;
  farmer_id: string;
  produce_id: string;
  quantity: number;
  unit: string;
  price: number;
  total_amount: number;
  pickup_location: string | null;
  delivery_location: string;
  preferred_delivery_date: string | null;
  status: OrderStatus;
  buyer_notes: string | null;
  farmer_notes: string | null;
  fulfillment_notes: string | null;
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
    location?: string;
  } | null;
}

const ORDER_SELECT_QUERY = `
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
    image_url,
    location
  )
`;

export class OrderService {
  /**
   * Translates a Supabase DB row into the application's Order domain model.
   */
  public mapRowToOrder(row: DatabaseOrderRow): Order {
    const buyerName =
      row.buyer_profile?.organization ||
      row.buyer_profile?.full_name ||
      'Commercial Buyer';

    const farmerName =
      row.farmer_profile?.farm_name ||
      row.farmer_profile?.full_name ||
      'Verified Farmer';

    const produceName = row.produce?.name || 'Agricultural Produce';
    const unit = row.unit || row.produce?.unit || 'kg';
    const quantity = Number(row.quantity) || 0;
    const price = Number(row.price) || 0;
    const totalAmount = Number(row.total_amount) || 0;

    return {
      id: row.id,
      orderNumber: row.order_number || `ORD-${row.id.slice(0, 8)}`,
      requestId: row.buyer_request_id,
      buyerId: row.buyer_id,
      buyerName,
      buyerPhone: row.buyer_profile?.phone || undefined,
      farmerId: row.farmer_id,
      farmerName,
      farmerPhone: row.farmer_profile?.phone || undefined,
      produceId: row.produce_id,
      produceName,
      produceImage: row.produce?.image_url || undefined,
      quantity,
      unit,
      price,
      totalAmount,
      pickupLocation: row.pickup_location || row.produce?.location || 'Farm Location',
      deliveryLocation: row.delivery_location || 'Nigeria',
      deliveryDate: row.preferred_delivery_date || row.created_at,
      status: row.status,
      buyerNotes: row.buyer_notes || undefined,
      farmerNotes: row.farmer_notes || undefined,
      fulfillmentNotes: row.fulfillment_notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Fetches orders visible to the current authenticated user governed by RLS.
   * Optionally filtered by user ID and role.
   */
  public async fetchOrders(userId?: string, role?: string): Promise<Order[]> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase is not configured. Returning empty orders array.');
      return [];
    }

    let query = supabase
      .from('orders')
      .select(ORDER_SELECT_QUERY)
      .order('created_at', { ascending: false });

    if (userId && role) {
      const normalizedRole = role.toLowerCase();
      if (normalizedRole === 'buyer') {
        query = query.eq('buyer_id', userId);
      } else if (normalizedRole === 'farmer') {
        query = query.eq('farmer_id', userId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('OrderService.fetchOrders error:', error);
      throw new Error(this.formatServiceError(error, 'Failed to fetch orders from database.'));
    }

    return (data || []).map((row) => this.mapRowToOrder(row as DatabaseOrderRow));
  }

  /**
   * Fetches orders for a specific buyer.
   */
  public async fetchBuyerOrders(buyerId: string): Promise<Order[]> {
    return this.fetchOrders(buyerId, 'buyer');
  }

  /**
   * Fetches orders for a specific farmer.
   */
  public async fetchFarmerOrders(farmerId: string): Promise<Order[]> {
    return this.fetchOrders(farmerId, 'farmer');
  }

  /**
   * Fetches all orders across the platform (for Platform Admins).
   */
  public async fetchAllOrders(): Promise<Order[]> {
    return this.fetchOrders();
  }

  /**
   * Fetches a single order by its UUID primary key.
   */
  public async fetchOrderById(orderId: string): Promise<Order | null> {
    if (!isSupabaseConfigured) return null;

    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT_QUERY)
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      console.error(`OrderService.fetchOrderById (${orderId}) error:`, error);
      throw new Error(this.formatServiceError(error, 'Failed to fetch order details.'));
    }

    if (!data) return null;
    return this.mapRowToOrder(data as DatabaseOrderRow);
  }

  /**
   * Calls the atomic PostgreSQL RPC: accept_buyer_request_and_create_order
   * This is the SOLE path for creating a commercial order in AgriLink.
   * The database function verifies the farmer, locks rows, decrements inventory,
   * updates the request to 'Accepted', and creates the order in a single transaction.
   */
  public async acceptBuyerRequestAndCreateOrder(
    requestId: string,
    farmerResponse?: string
  ): Promise<Order> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data: rawCreatedOrder, error } = await supabase.rpc(
      'accept_buyer_request_and_create_order',
      {
        p_request_id: requestId,
        p_farmer_response: farmerResponse || null
      }
    );

    if (error) {
      console.error('OrderService.acceptBuyerRequestAndCreateOrder error:', error);
      throw new Error(
        this.formatServiceError(error, 'Failed to accept purchase request and generate order.')
      );
    }

    if (!rawCreatedOrder) {
      throw new Error('Order creation RPC returned empty response.');
    }

    // Attempt to load the newly created order with joined relations (profiles, produce)
    const createdId = rawCreatedOrder.id;
    if (createdId) {
      try {
        const fullOrder = await this.fetchOrderById(createdId);
        if (fullOrder) return fullOrder;
      } catch (err) {
        console.warn('Could not re-fetch joined order after RPC, falling back to raw row:', err);
      }
    }

    return this.mapRowToOrder(rawCreatedOrder as DatabaseOrderRow);
  }

  /**
   * Updates order fulfillment status governed by RLS and trigger enforcement.
   */
  public async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    notes?: string
  ): Promise<Order> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const payload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (notes !== undefined) {
      payload.fulfillment_notes = notes;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId)
      .select(ORDER_SELECT_QUERY)
      .single();

    if (error) {
      console.error(`OrderService.updateOrderStatus (${orderId} -> ${status}) error:`, error);
      throw new Error(
        this.formatServiceError(error, `Failed to update order status to "${status}".`)
      );
    }

    return this.mapRowToOrder(data as DatabaseOrderRow);
  }

  /**
   * Allows the buyer to confirm receipt of shipment once marked 'Delivered'.
   * The database trigger explicitly authorizes buyers to transition Delivered -> Completed.
   */
  public async confirmOrderDelivered(orderId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, 'Completed');
  }

  /**
   * Administrative deletion of an order record.
   * Permitted strictly to Platform Admins by RLS.
   */
  public async deleteOrder(orderId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error(`OrderService.deleteOrder (${orderId}) error:`, error);
      throw new Error(this.formatServiceError(error, 'Failed to delete order.'));
    }
  }

  /**
   * Subscribes to Supabase Realtime changes on public.orders table.
   * Returns an unsubscribe function.
   */
  public subscribeToOrders(
    callback: (order: Order, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void
  ): () => void {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    const channelName = `public:orders:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        async (payload) => {
          const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';

          const oldRecord = payload.old as Record<string, any> | undefined;
          const newRecord = payload.new as Record<string, any> | undefined;

          if (eventType === 'DELETE') {
            if (oldRecord && oldRecord.id) {
              callback({ id: oldRecord.id } as Order, 'DELETE');
            }
            return;
          }

          const targetId = newRecord?.id;
          if (targetId) {
            try {
              const enriched = await this.fetchOrderById(targetId);
              if (enriched) {
                callback(enriched, eventType);
                return;
              }
            } catch (err) {
              console.warn('Realtime fetchOrderById failed, using raw payload:', err);
            }
          }

          if (newRecord) {
            callback(this.mapRowToOrder(newRecord as DatabaseOrderRow), eventType);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Formats error messages cleanly for end-user display.
   */
  private formatServiceError(error: any, fallback: string): string {
    if (!error) return fallback;

    const message = error.message || error.details || error.hint || '';

    // Handle user-friendly PostgreSQL trigger / RPC exceptions
    if (message.includes('Insufficient inventory')) {
      return message;
    }
    if (message.includes('Only registered farmers')) {
      return 'Only registered farmers can accept buyer requests.';
    }
    if (message.includes('You are not authorized')) {
      return 'You are not authorized to perform this operation.';
    }
    if (message.includes('already been converted to an order') || message.includes('already been accepted')) {
      return 'This buyer request has already been accepted and converted to an order.';
    }
    if (message.includes('can only transition to')) {
      return message;
    }
    if (message.includes('Completed orders cannot be modified')) {
      return 'Completed orders cannot be modified or reopened.';
    }
    if (message.includes('Cancelled orders cannot be modified')) {
      return 'Cancelled orders cannot be modified or reopened.';
    }
    if (message.includes('Buyers can only update order status from Delivered to Completed')) {
      return 'Buyers can only update order status from Delivered to Completed.';
    }
    if (message.includes('immutable after creation')) {
      return 'Commercial order terms cannot be modified after creation.';
    }

    return message || fallback;
  }
}

export const orderService = new OrderService();
