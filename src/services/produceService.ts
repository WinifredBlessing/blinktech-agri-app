import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Produce, Farmer, ProduceCategory } from '../types';

export interface DatabaseProduceRow {
  id: string;
  farmer_id: string;
  name: string;
  category: string;
  description: string;
  location: string | null;
  state: string | null;
  lga: string | null;
  quantity: number;
  unit: string;
  price: number;
  harvest_date: string | null;
  image_url: string | null;
  status: 'Available' | 'Limited' | 'Low Stock' | 'Out of Stock';
  created_at: string;
  updated_at: string;
  profiles?: {
    id?: string;
    full_name?: string;
    farm_name?: string;
    phone?: string;
    state?: string;
    city?: string;
    lga?: string;
    location?: string;
    description?: string;
    farming_type?: string;
  } | null;
}

export interface ProduceInput {
  id?: string;
  name: string;
  category: ProduceCategory;
  description: string;
  location?: string;
  state?: string;
  lga?: string;
  availableQuantity: number;
  unit: string;
  price: number;
  status?: 'Available' | 'Limited' | 'Low Stock' | 'Out of Stock';
  image?: string;
  images?: string[];
  harvestDate?: string;
  farmerId?: string;
  farmerName?: string;
}

class ProduceService {
  /**
   * Translates a Supabase DB row into the application's Produce domain model.
   */
  public mapRowToProduce(row: DatabaseProduceRow): Produce {
    // Normalise 'Low Stock' status to 'Limited' for UI consistency
    let normalizedStatus: 'Available' | 'Limited' | 'Out of Stock' = 'Available';
    if (row.status === 'Out of Stock') {
      normalizedStatus = 'Out of Stock';
    } else if (row.status === 'Limited' || row.status === 'Low Stock' || Number(row.quantity) <= 20) {
      normalizedStatus = 'Limited';
    }

    const farmerProfile = row.profiles;
    const farmerName =
      farmerProfile?.farm_name ||
      farmerProfile?.full_name ||
      'Farmer';

    const location =
      row.location ||
      farmerProfile?.location ||
      (farmerProfile?.city && farmerProfile?.state
        ? `${farmerProfile.city}, ${farmerProfile.state}`
        : 'Nigeria');

    return {
      id: row.id,
      farmerId: row.farmer_id,
      farmerName,
      name: row.name,
      category: row.category as ProduceCategory,
      description: row.description || '',
      location,
      state: row.state || farmerProfile?.state || '',
      lga: row.lga || farmerProfile?.lga || '',
      availableQuantity: Number(row.quantity) || 0,
      unit: row.unit || 'kg',
      price: Number(row.price) || 0,
      status: normalizedStatus,
      image: row.image_url || undefined,
      images: row.image_url ? [row.image_url] : [],
      harvestDate: row.harvest_date || undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * Fetches all produce from Supabase, joined with farmer profile data.
   */
  public async fetchProduceList(): Promise<Produce[]> {
    if (!isSupabaseConfigured) {
      console.warn('ProduceService: Supabase is not configured.');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('produce')
        .select(`
          *,
          profiles:farmer_id (
            id,
            full_name,
            farm_name,
            phone,
            state,
            city,
            lga,
            location,
            description,
            farming_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('ProduceService.fetchProduceList error:', error.message);
        return [];
      }

      return (data || []).map((row: any) => this.mapRowToProduce(row));
    } catch (err) {
      console.error('ProduceService.fetchProduceList network error:', err);
      return [];
    }
  }

  /**
   * Fetches a single produce item and its associated farmer details by UUID.
   */
  public async fetchProduceById(id: string): Promise<{ produce: Produce; farmer?: Farmer; error?: string } | null> {
    if (!isSupabaseConfigured || !id) return null;

    try {
      const { data, error } = await supabase
        .from('produce')
        .select(`
          *,
          profiles:farmer_id (
            id,
            full_name,
            farm_name,
            phone,
            state,
            city,
            lga,
            location,
            description,
            farming_type
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.warn('ProduceService.fetchProduceById error:', error.message);
        return { produce: null as any, error: error.message };
      }

      if (!data) {
        return null;
      }

      const produce = this.mapRowToProduce(data);

      let farmer: Farmer | undefined = undefined;
      if (data.profiles) {
        const p = data.profiles;
        farmer = {
          id: p.id || produce.farmerId,
          name: p.full_name || produce.farmerName || 'Farmer',
          farmName: p.farm_name || produce.farmerName || 'Farm',
          photo: '',
          phone: p.phone || '',
          state: p.state || produce.state || '',
          city: p.city || '',
          lga: p.lga || produce.lga || '',
          description: p.description || '',
          experience: (typeof (p as any).experience === 'string' && (p as any).experience.trim()) ? (p as any).experience.trim() : '5+ years',
          categories: [produce.category],
          status: 'Active'
        };
      }

      return { produce, farmer };
    } catch (err: any) {
      console.error('ProduceService.fetchProduceById exception:', err);
      return { produce: null as any, error: err?.message || 'Network error' };
    }
  }

  /**
   * Inserts a new produce record into Supabase for the authenticated farmer.
   * Avoids returning the full Base64 image and joined profiles over the wire.
   * Uses client-provided or generated listing UUID for idempotency, duplicate prevention, and response-loss recovery.
   */
  public async createProduce(produceData: ProduceInput, authenticatedUserId: string): Promise<Produce> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const farmerId = authenticatedUserId;
    if (!farmerId) {
      throw new Error('Authentication required: Must be signed in as a farmer to list produce.');
    }

    // Determine status
    const qty = Number(produceData.availableQuantity) || 0;
    let status = produceData.status || 'Available';
    if (qty === 0) {
      status = 'Out of Stock';
    } else if (qty <= 20 && status === 'Available') {
      status = 'Limited';
    }

    // Stable client-generated UUID for idempotency and duplicate prevention
    const listingId = produceData.id || crypto.randomUUID();

    const payload: Record<string, any> = {
      id: listingId,
      farmer_id: farmerId,
      name: produceData.name.trim(),
      category: produceData.category,
      description: produceData.description.trim(),
      location: produceData.location || null,
      state: produceData.state || null,
      lga: produceData.lga || null,
      quantity: qty,
      unit: produceData.unit || 'kg',
      price: Number(produceData.price) || 0,
      harvest_date: produceData.harvestDate || null,
      image_url: produceData.image || (produceData.images && produceData.images[0]) || null,
      status
    };

    const t0 = performance.now();
    const isRemoteImage = Boolean(payload.image_url?.startsWith('http'));
    const imageSizeKB = payload.image_url && !isRemoteImage ? Math.round((payload.image_url.length * 0.75) / 1024) : 0;
    console.log(`[ProduceService] 1. Prepared produce payload. ID: ${listingId}, Farmer: ${farmerId}, Image: ${isRemoteImage ? 'Storage URL' : imageSizeKB + 'KB'}`);

    // Select ONLY lightweight metadata columns upon insert.
    // Avoid returning the multi-megabyte Base64 image_url and joined profile data over the wire!
    const selectColumns = 'id, farmer_id, name, category, description, location, state, lga, quantity, unit, price, status, harvest_date, created_at';

    let data: any = null;
    let insertError: any = null;

    // Helper to enforce strict maximum execution duration on async operations
    const withTimeout = <T>(promise: PromiseLike<T>, ms: number, errorMsg: string): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
        promise.then(
          (val) => {
            clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });
    };

    try {
      console.log(`[ProduceService] 2. Sending insert to Supabase for listingId: ${listingId}...`);
      const insertStart = performance.now();

      const result = await withTimeout(
        supabase
          .from('produce')
          .insert(payload)
          .select(selectColumns)
          .single(),
        15000,
        'Supabase produce insert request timed out after 15s'
      );

      const insertMs = (performance.now() - insertStart).toFixed(1);
      console.log(`[ProduceService] 3. Supabase insert completed in ${insertMs}ms. Error:`, result.error?.message || 'none');

      data = result.data;
      insertError = result.error;
    } catch (networkErr: any) {
      console.warn('[ProduceService] Insert threw exception / aborted:', networkErr?.message || networkErr);
      insertError = networkErr;
    }

    // Handle ambiguous network failures or duplicate key conflicts:
    // If the insert timed out or was already committed during a previous retry attempt (code 23505),
    // check whether the row was committed in Supabase.
    if (insertError || !data) {
      const isDuplicateKey =
        insertError?.code === '23505' ||
        (typeof insertError?.message === 'string' && insertError.message.includes('duplicate key'));

      console.log(`[ProduceService] 4. Recovery check running (isDuplicateKey: ${Boolean(isDuplicateKey)})...`);

      try {
        const { data: verifiedRow, error: verifyErr } = await withTimeout(
          supabase
            .from('produce')
            .select(selectColumns)
            .eq('id', listingId)
            .eq('farmer_id', farmerId)
            .maybeSingle(),
          8000,
          'Recovery check timed out after 8s'
        );

        if (verifiedRow && !verifyErr) {
          console.warn(`[ProduceService] 5. Listing confirmed committed in database! (id: ${verifiedRow.id})`);
          data = verifiedRow;
          insertError = null;
        } else {
          console.log('[ProduceService] 5. Recovery check: listing not found in DB or check failed:', verifyErr?.message || 'row is null');
        }
      } catch (verifyCheckErr: any) {
        console.warn('[ProduceService] Recovery check exception:', verifyCheckErr?.message || verifyCheckErr);
      }
    }

    if (insertError || !data) {
      console.error('[ProduceService] createProduce final failure:', {
        code: insertError?.code,
        message: insertError?.message,
        details: insertError?.details,
        hint: insertError?.hint
      });

      const errMessage = (insertError?.message || String(insertError || '')).toLowerCase();
      const isNetworkOrTimeout =
        insertError?.name === 'AbortError' ||
        errMessage.includes('abort') ||
        errMessage.includes('failed to fetch') ||
        errMessage.includes('networkerror') ||
        errMessage.includes('timeout') ||
        errMessage.includes('524') ||
        errMessage.includes('504');

      if (isNetworkOrTimeout) {
        throw new Error(
          'Publishing status could not be confirmed due to a network interruption. Your listing may already be saved. Please check your produce inventory before trying again to prevent duplicate listings.'
        );
      }

      throw new Error(insertError?.message || 'Failed to list produce in database.');
    }

    const duration = performance.now() - t0;
    console.log(`[ProduceService] Produce published & verified in ${duration.toFixed(1)}ms (id: ${data.id})`);

    // Build the confirmed Produce domain model using the confirmed DB record,
    // retaining the local in-memory image without echoing megabytes back from Supabase.
    const createdProduce: Produce = {
      id: data.id,
      farmerId: data.farmer_id || farmerId,
      farmerName: produceData.farmerName || 'Farmer',
      name: data.name,
      category: data.category as ProduceCategory,
      description: data.description || '',
      location: data.location || produceData.location || 'Nigeria',
      state: data.state || produceData.state || '',
      lga: data.lga || produceData.lga || '',
      availableQuantity: Number(data.quantity) || 0,
      unit: data.unit || 'kg',
      price: Number(data.price) || 0,
      status: (data.status as any) || status,
      image: payload.image_url || undefined,
      images: payload.image_url ? [payload.image_url] : [],
      harvestDate: data.harvest_date || undefined,
      createdAt: data.created_at || new Date().toISOString(),
    };

    return createdProduce;
  }

  /**
   * Updates an existing produce record in Supabase.
   */
  public async updateProduce(id: string, updates: Partial<ProduceInput>): Promise<Produce> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const payload: Record<string, any> = {};

    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.description !== undefined) payload.description = updates.description.trim();
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.state !== undefined) payload.state = updates.state;
    if (updates.lga !== undefined) payload.lga = updates.lga;
    if (updates.availableQuantity !== undefined) payload.quantity = Number(updates.availableQuantity);
    if (updates.unit !== undefined) payload.unit = updates.unit;
    if (updates.price !== undefined) payload.price = Number(updates.price);
    if (updates.harvestDate !== undefined) payload.harvest_date = updates.harvestDate;
    if (updates.image !== undefined) payload.image_url = updates.image;
    if (updates.images && updates.images.length > 0 && updates.image === undefined) {
      payload.image_url = updates.images[0];
    }
    if (updates.status !== undefined) payload.status = updates.status;

    // Recalculate automatic status if quantity was updated and status not explicitly set
    if (updates.availableQuantity !== undefined && updates.status === undefined) {
      const q = Number(updates.availableQuantity);
      if (q === 0) payload.status = 'Out of Stock';
      else if (q <= 20) payload.status = 'Limited';
      else payload.status = 'Available';
    }

    const t0 = performance.now();
    const { data, error } = await supabase
      .from('produce')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        profiles:farmer_id (
          id,
          full_name,
          farm_name,
          phone,
          state,
          city,
          lga,
          location,
          description,
          farming_type
        )
      `)
      .single();
    const duration = performance.now() - t0;

    if (error) {
      console.error('ProduceService.updateProduce error:', error);
      throw new Error(error.message || 'Failed to update produce record.');
    }

    if (import.meta.env.DEV) {
      console.log(`[DevTiming] Supabase produce update took ${duration.toFixed(2)}ms (id: ${id})`);
    }

    return this.mapRowToProduce(data);
  }

  /**
   * Deletes a produce record from Supabase.
   */
  public async deleteProduce(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase
      .from('produce')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('ProduceService.deleteProduce error:', error);
      throw new Error(error.message || 'Failed to delete produce record.');
    }
  }

  private activeChannel: any = null;

  /**
   * Establishes a Supabase Realtime subscription on public.produce.
   * Invokes the callback on INSERT, UPDATE, and DELETE events.
   * Returns a cleanup unsubscribe function.
   */
  public subscribeToProduce(
    onPayload: (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      produce?: Produce;
      id: string;
    }) => void
  ): () => void {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    // Clean up any previously active channel to prevent duplicate subscriptions
    if (this.activeChannel) {
      supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
    }

    const channelId = `produce_realtime_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'produce'
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
            const row = newRow as DatabaseProduceRow;
            if (!row || !row.id) return;

            // Map incoming row immediately so UI updates without extra roundtrip latency
            const initialProduce = this.mapRowToProduce(row);
            onPayload({
              eventType,
              produce: initialProduce,
              id: row.id
            });

            // Reconcile complete joined farmer profile in background if not already present
            if (!row.profiles) {
              this.fetchProduceById(row.id).then((fullItem) => {
                if (fullItem?.produce) {
                  onPayload({
                    eventType: 'UPDATE',
                    produce: fullItem.produce,
                    id: row.id
                  });
                }
              }).catch(() => {
                // Background profile resolution failures do not disrupt the listing
              });
            }
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

export const produceService = new ProduceService();
