import { supabase, isSupabaseConfigured } from './supabaseClient';
import { LogisticsRequest, LogisticsStatus } from '../types';

export const DEMO_LOGISTICS_PROVIDERS = [
  'AgriMove Logistics',
  'FarmRoute Express',
];

export const DEMO_DRIVERS = [
  { name: 'Chinedu Okafor', phone: '0803 234 5678', provider: 'AgriMove Logistics' },
  { name: 'Suleiman Danladi', phone: '0805 678 1234', provider: 'AgriMove Logistics' },
  { name: 'Babatunde Adeleke', phone: '0802 345 6789', provider: 'FarmRoute Express' },
  { name: 'Emeka Nwosu', phone: '0814 890 1234', provider: 'FarmRoute Express' },
];

const LOGISTICS_SELECT_QUERY = `
  *,
  order:orders!logistics_requests_order_id_fkey (
    id,
    order_number,
    buyer_id,
    farmer_id,
    produce_id,
    quantity,
    unit,
    pickup_location,
    delivery_location,
    preferred_delivery_date,
    buyer_profile:profiles!orders_buyer_id_fkey (
      id,
      full_name,
      organization
    ),
    farmer_profile:profiles!orders_farmer_id_fkey (
      id,
      full_name,
      farm_name
    ),
    produce:produce!orders_produce_id_fkey (
      id,
      name
    )
  )
`;

interface LogisticsProfileRelation {
  full_name?: string | null;
  farm_name?: string | null;
  organization?: string | null;
}

interface LogisticsOrderRelation {
  buyer_id: string;
  farmer_id: string;
  quantity: number;
  unit: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  buyer_profile?: LogisticsProfileRelation | null;
  farmer_profile?: LogisticsProfileRelation | null;
  produce?: { name?: string | null } | null;
}

interface DatabaseLogisticsRow {
  id: string;
  logistics_number: string;
  order_id: string;
  buyer_id: string;
  farmer_id: string;
  pickup_location: string;
  pickup_address: string | null;
  delivery_address: string | null;
  preferred_date: string | null;
  instructions: string | null;
  provider: string | null;
  driver: string | null;
  driver_phone: string | null;
  status: LogisticsStatus;
  created_at: string;
  updated_at: string;
  order?: LogisticsOrderRelation | null;
}

export type CreateLogisticsRequestInput = Pick<
  LogisticsRequest,
  'orderId' | 'pickupLocation' | 'pickupAddress' | 'deliveryAddress' | 'preferredDate' | 'instructions'
>;

export type LogisticsRealtimeEvent = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  logistics?: LogisticsRequest;
  id: string;
};

export class LogisticsService {
  private activeChannel: any = null;

  private ensureConfigured(): void {
    if (!isSupabaseConfigured) {
      throw new Error('Logistics service: Supabase is not configured.');
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    this.ensureConfigured();

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw this.formatError(error, 'Authentication check');
      if (!data.user) {
        throw new Error('Logistics service: Authentication required. Please sign in.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Logistics service:')) {
        throw error;
      }
      throw this.formatError(error, 'Authentication check');
    }
  }

  private formatError(error: unknown, operation: string): Error {
    const value = error as { message?: unknown; code?: unknown } | null;
    const detail = error instanceof Error
      ? error.message
      : typeof value?.message === 'string'
        ? value.message
        : typeof error === 'string'
          ? error
          : 'Unknown Supabase error.';
    const message = detail.toLowerCase();

    if (message.includes('authentication required') || message.includes('jwt')) {
      return new Error('Logistics service: Authentication required. Please sign in again.');
    }
    if (message.includes('only registered buyers')) {
      return new Error('Logistics service: Only registered buyers can request logistics.');
    }
    if (message.includes('only platform administrators')) {
      return new Error('Logistics service: Only platform administrators can update logistics.');
    }
    if (message.includes('order not found')) {
      return new Error('Logistics service: The selected order was not found.');
    }
    if (
      message.includes('cancelled order') ||
      message.includes('completed order') ||
      message.includes('not eligible')
    ) {
      return new Error(`Logistics service: This order is not eligible for logistics. ${detail}`);
    }
    if (
      message.includes('active logistics request already exists') ||
      message.includes('uq_logistics_active_order') ||
      value?.code === '23505'
    ) {
      return new Error('Logistics service: An active logistics request already exists for this order.');
    }
    if (
      message.includes('can only advance') ||
      message.includes('invalid logistics status') ||
      message.includes('logistics requests are terminal')
    ) {
      return new Error(`Logistics service: Status transition rejected. ${detail}`);
    }
    if (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('timeout')
    ) {
      return new Error(`Logistics service: Supabase network error during ${operation}. ${detail}`);
    }

    return new Error(`Logistics service: ${operation} failed. ${detail}`);
  }

  private mapRowToLogistics(row: DatabaseLogisticsRow): LogisticsRequest {
    const order = row.order;

    return {
      id: row.id,
      logisticsNumber: row.logistics_number,
      orderId: row.order_id,
      buyerId: row.buyer_id,
      buyerName: order?.buyer_profile?.organization || order?.buyer_profile?.full_name || 'Buyer',
      farmerId: row.farmer_id,
      farmerName: order?.farmer_profile?.farm_name || order?.farmer_profile?.full_name || 'Farmer',
      produceName: order?.produce?.name || 'Produce',
      quantity: Number(order?.quantity) || 0,
      unit: order?.unit || 'kg',
      pickupLocation: row.pickup_location,
      pickupAddress: row.pickup_address || '',
      deliveryLocation: order?.delivery_location || '',
      deliveryAddress: row.delivery_address || '',
      preferredDate: row.preferred_date || '',
      instructions: row.instructions || undefined,
      provider: row.provider || undefined,
      driver: row.driver || undefined,
      driverPhone: row.driver_phone || undefined,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async fetchLogisticsRequests(filters?: {
    buyerId?: string;
    farmerId?: string;
    orderId?: string;
  }): Promise<LogisticsRequest[]> {
    this.ensureConfigured();

    try {
      let query = supabase
        .from('logistics_requests')
        .select(LOGISTICS_SELECT_QUERY)
        .order('created_at', { ascending: false });

      if (filters?.buyerId) query = query.eq('buyer_id', filters.buyerId);
      if (filters?.farmerId) query = query.eq('farmer_id', filters.farmerId);
      if (filters?.orderId) query = query.eq('order_id', filters.orderId);

      const { data, error } = await query;
      if (error) throw this.formatError(error, 'Fetch logistics requests');

      return (data || []).map(row => this.mapRowToLogistics(row as unknown as DatabaseLogisticsRow));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Logistics service:')) throw error;
      throw this.formatError(error, 'Fetch logistics requests');
    }
  }

  public async getAll(): Promise<LogisticsRequest[]> {
    return this.fetchLogisticsRequests();
  }

  public async getByBuyer(buyerId: string): Promise<LogisticsRequest[]> {
    return this.fetchLogisticsRequests({ buyerId });
  }

  public async getByFarmer(farmerId: string): Promise<LogisticsRequest[]> {
    return this.fetchLogisticsRequests({ farmerId });
  }

  public async getByOrderId(orderId: string): Promise<LogisticsRequest | undefined> {
    const requests = await this.fetchLogisticsRequests({ orderId });
    return requests.find(request => request.status !== 'Cancelled') || requests[0];
  }

  public async fetchById(id: string): Promise<LogisticsRequest> {
    try {
      const { data, error } = await supabase
        .from('logistics_requests')
        .select(LOGISTICS_SELECT_QUERY)
        .eq('id', id)
        .maybeSingle();

      if (error) throw this.formatError(error, 'Fetch logistics request');
      if (!data) throw new Error(`Logistics service: Logistics request ${id} was not found after the operation.`);

      return this.mapRowToLogistics(data as unknown as DatabaseLogisticsRow);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Logistics service:')) throw error;
      throw this.formatError(error, 'Fetch logistics request');
    }
  }

  public async createLogisticsRequest(data: CreateLogisticsRequestInput): Promise<LogisticsRequest> {
    await this.ensureAuthenticated();

    try {
      const { data: created, error } = await supabase.rpc('create_logistics_request', {
        p_order_id: data.orderId,
        p_pickup_location: data.pickupLocation,
        p_pickup_address: data.pickupAddress || null,
        p_delivery_address: data.deliveryAddress || null,
        p_preferred_date: data.preferredDate || null,
        p_instructions: data.instructions || null
      });

      if (error) throw this.formatError(error, 'Create logistics request');

      const createdRow = (Array.isArray(created) ? created[0] : created) as DatabaseLogisticsRow | null;
      if (!createdRow?.id) {
        throw new Error('Logistics service: Create RPC returned no logistics request ID.');
      }

      try {
        return await this.fetchById(createdRow.id);
      } catch (fetchErr) {
        console.warn(`Follow-up fetchById failed after create RPC, falling back to mapped row:`, fetchErr);
        return this.mapRowToLogistics(createdRow);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Logistics service:')) throw error;
      throw this.formatError(error, 'Create logistics request');
    }
  }

  public async createRequest(
    data: Omit<LogisticsRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<LogisticsRequest> {
    return this.createLogisticsRequest(data);
  }

  public async updateLogisticsStatus(
    id: string,
    status: LogisticsStatus,
    provider?: string,
    driver?: string,
    driverPhone?: string
  ): Promise<LogisticsRequest> {
    await this.ensureAuthenticated();

    try {
      const { data: updated, error } = await supabase.rpc('update_logistics_status', {
        p_logistics_id: id,
        p_status: status,
        p_provider: provider || null,
        p_driver: driver || null,
        p_driver_phone: driverPhone || null
      });

      if (error) throw this.formatError(error, 'Update logistics status');

      const updatedRow = (Array.isArray(updated) ? updated[0] : updated) as DatabaseLogisticsRow | null;
      if (!updatedRow?.id) {
        throw new Error('Logistics service: Update RPC returned no logistics request ID.');
      }

      try {
        return await this.fetchById(updatedRow.id);
      } catch (fetchErr) {
        console.warn(`Follow-up fetchById failed after update RPC, falling back to mapped row:`, fetchErr);
        return this.mapRowToLogistics(updatedRow);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Logistics service:')) throw error;
      throw this.formatError(error, 'Update logistics status');
    }
  }

  public async updateStatus(
    id: string,
    status: LogisticsStatus,
    provider?: string,
    driver?: string,
    driverPhone?: string
  ): Promise<LogisticsRequest> {
    return this.updateLogisticsStatus(id, status, provider, driver, driverPhone);
  }

  /**
   * Subscribes to Supabase Realtime changes on public.logistics_requests table.
   * Emits typed events on INSERT, UPDATE, and DELETE.
   * Prevents duplicate active channels on the service instance.
   * Returns a cleanup unsubscribe function.
   */
  public subscribeToLogistics(
    callback: (event: LogisticsRealtimeEvent) => void
  ): () => void {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    // Clean up any previously active channel to prevent duplicate subscriptions
    if (this.activeChannel) {
      supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
    }

    const channelName = `public:logistics_requests:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logistics_requests'
        },
        async (payload) => {
          try {
            const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
            const oldRecord = payload.old as Record<string, any> | undefined;
            const newRecord = payload.new as Record<string, any> | undefined;

            if (eventType === 'DELETE') {
              const deletedId = oldRecord?.id;
              if (deletedId) {
                callback({ eventType: 'DELETE', id: deletedId });
              }
              return;
            }

            const targetId = newRecord?.id;
            if (targetId) {
              try {
                const enriched = await this.fetchById(targetId);
                if (enriched) {
                  callback({ eventType, logistics: enriched, id: targetId });
                  return;
                }
              } catch (err) {
                console.warn('Realtime fetchById for logistics warning, falling back to mapped row:', err);
              }

              if (newRecord) {
                callback({
                  eventType,
                  logistics: this.mapRowToLogistics(newRecord as unknown as DatabaseLogisticsRow),
                  id: targetId
                });
              }
            }
          } catch (eventErr) {
            console.error('Error processing logistics Realtime event:', eventErr);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
          console.warn(`Logistics Realtime subscription status: ${status}`, err?.message || err);
        }
      });

    this.activeChannel = channel;

    return () => {
      if (this.activeChannel === channel) {
        this.activeChannel = null;
      }
      supabase.removeChannel(channel);
    };
  }
}

export const logisticsService = new LogisticsService();
