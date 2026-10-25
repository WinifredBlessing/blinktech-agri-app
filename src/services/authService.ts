import { User, Role } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface AuthSession {
  user: User;
  token?: string;
}

export interface RegisterMetadata {
  role: Role;
  name: string;
  phone?: string;
  buyerType?: string;
  farmName?: string;
  organization?: string;
  state?: string;
  city?: string;
  lga?: string;
  location?: string;
  address?: string;
  farmingType?: string;
  description?: string;
  experience?: string;
  [key: string]: any;
}

const STORAGE_KEY_USER = 'agrilink_user';
const STORAGE_KEY_USERS = 'agrilink_users';

class AuthService {
  private currentUser: User | null = null;
  private isRegistering = false;

  constructor() {
    this.currentUser = this.getCachedUser();
  }

  /**
   * Indicates if a registration is actively in progress
   */
  public isRegistrationInProgress(): boolean {
    return this.isRegistering;
  }

  /**
   * Helper to retrieve cached user from localStorage for instant rendering
   */
  public getCachedUser(): User | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
    return null;
  }

  /**
   * Translates Supabase authentication error codes and messages into clear, actionable user feedback
   */
  private formatAuthError(error: any): string {
    if (!error) return 'An unexpected error occurred. Please try again.';
    const msg = (error.message || '').toLowerCase();

    if (msg.includes('invalid login credentials')) {
      return 'Invalid email or password. Please verify your credentials or register a new account.';
    }
    if (msg.includes('user already registered') || msg.includes('already registered')) {
      return 'An account with this email address already exists. Please sign in instead.';
    }
    if (msg.includes('password should be at least') || msg.includes('weak password')) {
      return 'Password must be at least 6 characters long.';
    }
    if (msg.includes('signup requires a valid password')) {
      return 'Please enter a valid password for your account.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Email not confirmed. Please check your inbox or confirmation link.';
    }
    if (
      msg.includes('rate limit') ||
      msg.includes('over_email_send_rate_limit') ||
      msg.includes('too many requests')
    ) {
      return 'Email rate limit exceeded on Supabase. Please wait a few minutes, or disable "Confirm email" in Supabase Dashboard (Auth -> Providers -> Email) to allow instant unlimited signups.';
    }
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network error') ||
      msg.includes('getaddrinfo')
    ) {
      return 'Network connection error. Unable to reach Supabase. Please check your internet connection.';
    }
    return error.message || 'Authentication failed. Please try again.';
  }

  /**
   * Queries the Supabase 'profiles' table for the user's authoritative profile record
   */
  public async fetchProfile(userId: string): Promise<any | null> {
    if (!isSupabaseConfigured || !userId) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not query profiles table:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('fetchProfile network exception:', err);
      return null;
    }
  }

  /**
   * Upserts a user's record into the 'profiles' table
   */
  public async upsertProfile(profileData: Record<string, any>): Promise<any | null> {
    if (!isSupabaseConfigured || !profileData.id) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Upsert to profiles warning:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('upsertProfile exception:', err);
      return null;
    }
  }

  /**
   * Maps a Supabase Profile database row and/or Auth User object into the frontend User model.
   * Authorization rule: The database (public.profiles.role) is the sole source of truth.
   */
  public mapProfileToUser(profile: any, sbUser?: any): User {
    const meta = sbUser?.user_metadata || {};
    const email = profile?.email || sbUser?.email || meta.email || '';

    // Database role from public.profiles:
    // authenticatedUser.id -> public.profiles.id -> public.profiles.role
    const rawRole = (profile?.role || '').toString().toLowerCase().trim();

    let role: Role;
    if (rawRole === 'admin') {
      role = 'Admin';
    } else if (rawRole === 'buyer') {
      role = 'Buyer';
    } else if (rawRole === 'farmer') {
      role = 'Farmer';
    } else {
      // Safe fallback only if profile record has not yet loaded
      const metaRole = (meta.role || '').toString().toLowerCase().trim();
      role = metaRole === 'buyer' ? 'Buyer' : 'Farmer';
    }

    const name =
      profile?.full_name ||
      meta.full_name ||
      meta.name ||
      (email ? email.split('@')[0] : 'User');

    const phone = profile?.phone || meta.phone || sbUser?.phone || '';
    const buyerType = profile?.buyer_type || meta.buyerType || (role === 'Buyer' ? 'Individual' : undefined);

    const farmName =
      profile?.farm_name ||
      meta.farmName ||
      (role === 'Farmer' ? `${name}'s Farm` : undefined);

    const organization =
      profile?.organization ||
      meta.organization ||
      (role === 'Buyer' ? name : undefined);

    const location =
      profile?.location ||
      meta.location ||
      (profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : 'Nigeria');

    const createdAt =
      profile?.created_at ||
      sbUser?.created_at ||
      new Date().toISOString();

    const dateJoined =
      profile?.created_at ? profile.created_at.split('T')[0] :
      meta.dateJoined || (sbUser?.created_at ? sbUser.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);

    return {
      id: profile?.id || sbUser?.id || '',
      name,
      email,
      phone,
      role,
      buyerType,
      farmName,
      organization,
      location,
      state: profile?.state || meta.state || '',
      city: profile?.city || meta.city || '',
      lga: profile?.lga || meta.lga || '',
      address: profile?.address || meta.address || '',
      description: profile?.description || meta.description || '',
      farmingType: profile?.farming_type || meta.farmingType || (role === 'Farmer' ? 'Mixed Farming' : undefined),
      experience: (profile?.experience !== undefined && profile?.experience !== null && String(profile.experience).trim())
        ? String(profile.experience).trim()
        : (meta.experience !== undefined && meta.experience !== null && String(meta.experience).trim()
          ? String(meta.experience).trim()
          : undefined),
      status: profile?.status || meta.status || 'Active',
      accountStatus: profile?.status || meta.accountStatus || 'Active',
      isVerified: Boolean(profile?.is_verified ?? meta?.is_verified ?? false),
      dateJoined,
      createdAt,
    };
  }

  /**
   * Backwards compatible mapping from pure Supabase User
   */
  public mapSupabaseUser(sbUser: any): User {
    return this.mapProfileToUser(null, sbUser);
  }

  /**
   * Syncs user record into the local users list for admin dashboard inspection
   */
  public syncToUsersList(user: User): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS);
      const users: User[] = stored ? JSON.parse(stored) : [];
      const index = users.findIndex(
        (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
      );
      if (index >= 0) {
        users[index] = { ...users[index], ...user };
      } else {
        users.unshift(user);
      }
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Error syncing user to list:', e);
    }
  }

  /**
   * Restores existing Supabase session on startup and across page refreshes
   */
  public async restoreSession(): Promise<User | null> {
    if (!isSupabaseConfigured) {
      this.currentUser = this.getCachedUser();
      return this.currentUser;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session?.user) {
        this.currentUser = null;
        localStorage.removeItem(STORAGE_KEY_USER);
        return null;
      }

      const sbUser = data.session.user;
      const profile = await this.fetchProfile(sbUser.id);
      const user = this.mapProfileToUser(profile, sbUser);

      this.currentUser = user;
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      this.syncToUsersList(user);
      return user;
    } catch (err) {
      console.error('Error checking Supabase session:', err);
      this.currentUser = this.getCachedUser();
      return this.currentUser;
    }
  }

  /**
   * Real Supabase Authentication: Sign in with email and password
   */
  public async login(email: string, password: string): Promise<User> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!cleanPassword) {
      throw new Error('Please enter your password.');
    }

    console.log('LOGIN: signIn called', { email: cleanEmail });
    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      data = res.data;
      error = res.error;
    } catch (thrown: any) {
      console.error('LOGIN: signInWithPassword exception thrown:', thrown);
      error = thrown;
    }

    console.log('LOGIN: signIn returned', {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      userId: data?.user?.id,
      error: error?.message || null,
    });
    console.log('LOGIN: session exists =', !!data?.session);

    if (error) {
      throw new Error(this.formatAuthError(error));
    }

    if (!data?.user) {
      throw new Error('Authentication succeeded but no user data was returned.');
    }

    // 3. After successful authentication, get authenticated user's ID from Supabase
    const userId = data.user.id;
    console.log('LOGIN: querying public.profiles for user ID =', userId);

    // 4. Query public.profiles using that authenticated user's ID
    let profile = await this.fetchProfile(userId);

    // Ensure we wait for the database profile record, with a brief retry if query is in-flight
    if (!profile) {
      console.log('LOGIN: retrying profile query for user ID =', userId);
      await new Promise((resolve) => setTimeout(resolve, 300));
      profile = await this.fetchProfile(userId);
    }
    console.log('LOGIN: profile query finished. Database role =', profile?.role || 'none');

    // 5. Read the role from public.profiles and map user
    const user = this.mapProfileToUser(profile, data.user);
    console.log('LOGIN: authoritative user role from database =', user.role);

    if (user.accountStatus === 'Suspended' || user.status === 'Suspended') {
      await this.logout();
      throw new Error('This account has been suspended. Please contact platform support.');
    }

    if (user.accountStatus === 'Banned' || user.status === 'Banned') {
      await this.logout();
      throw new Error('This account has been permanently disabled.');
    }

    this.currentUser = user;
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    this.syncToUsersList(user);
    return user;
  }

  /**
   * Real Supabase Authentication: Register a new user with role and profile metadata.
   * Supabase Auth creates the account; the database trigger creates the profile.
   * Does NOT sign the user in or keep an active session.
   */
  public async register(
    email: string,
    password: string,
    metadata: RegisterMetadata
  ): Promise<void> {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) throw new Error('Please enter a valid email address.');
    if (!cleanPassword || cleanPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (!metadata.name?.trim()) {
      throw new Error('Please enter your full name or business name.');
    }

    // Role constraint: only 'farmer' | 'buyer' allowed. Admin registration is strictly forbidden.
    const rawRole = (metadata.role || 'farmer').toString().toLowerCase();
    const dbRole = rawRole === 'buyer' ? 'buyer' : 'farmer';

    const farmName =
      metadata.farmName || (dbRole === 'farmer' ? `${metadata.name}'s Farm` : undefined);
    const organization =
      metadata.organization || (dbRole === 'buyer' ? metadata.name : undefined);

    console.log('REGISTER: signUp called', { email: cleanEmail, role: dbRole });
    this.isRegistering = true;
    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            role: dbRole,
            full_name: metadata.name.trim(),
            name: metadata.name.trim(),
            phone: metadata.phone?.trim() || '',
            buyerType: metadata.buyerType || '',
            farmName: farmName || '',
            organization: organization || '',
            status: 'Active',
            accountStatus: 'Active',
            dateJoined: new Date().toISOString().split('T')[0],
          },
        },
      });
      data = res.data;
      error = res.error;
    } catch (thrownErr: any) {
      console.error('REGISTER: signUp exception thrown:', thrownErr);
      error = thrownErr;
    }

    console.log('REGISTER: signUp returned', {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      userId: data?.user?.id,
      error: error?.message || null,
    });

    if (error) {
      this.isRegistering = false;
      throw new Error(this.formatAuthError(error));
    }

    if (!data?.user) {
      this.isRegistering = false;
      throw new Error('Registration failed. No user was returned by Supabase.');
    }

    console.log('REGISTER: user created in Supabase Auth, id =', data.user.id);

    // Database trigger public.handle_new_user() automatically creates the profile.
    // Do NOT manually create duplicate profiles from the frontend.
    // Explicitly sign out so the newly created account is NOT left with an active session.
    try {
      await supabase.auth.signOut();
    } catch (signOutErr) {
      console.warn('REGISTER: signOut cleanup notice:', signOutErr);
    } finally {
      this.currentUser = null;
      localStorage.removeItem(STORAGE_KEY_USER);
      this.isRegistering = false;
    }

    console.log('REGISTER: completed successfully with no active session remaining');
  }

  /**
   * Real Supabase Authentication: Sign out current session
   */
  public async logout(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEY_USER);

    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Error signing out of Supabase:', err);
      }
    }
  }

  public getCurrentUser(): User | null {
    if (!this.currentUser) {
      this.currentUser = this.getCachedUser();
    }
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  public hasRole(role: Role): boolean {
    const user = this.getCurrentUser();
    return user !== null && user.role.toLowerCase() === role.toLowerCase();
  }

  /**
   * Update user profile in Supabase profiles table and user_metadata.
   *
   * Fix: The profiles table update now throws on error (instead of silently
   * swallowing it with console.warn), so the UI only displays a success message
   * after the DB confirms the write. `role` is omitted from the update payload —
   * it is immutable (enforced by the prevent_profile_role_tampering trigger) and
   * sending it caused unnecessary trigger overhead. A read-after-write confirms
   * the actual persisted values before updating local state.
   */
  public async updateProfile(updates: Partial<User>): Promise<User> {
    const current = this.getCurrentUser();
    if (!current) throw new Error('No user is currently authenticated.');

    const updatedUser: User = {
      ...current,
      ...updates,
    };

    if (isSupabaseConfigured) {
      // 1. Update public.profiles — omit `role` so the role-tampering trigger
      //    is not involved. Any DB error is thrown so the caller surfaces it.
      const profileUpdates: Record<string, any> = {
        full_name: updatedUser.name,
        phone: updatedUser.phone || null,
        farm_name: updatedUser.farmName || null,
        organization: updatedUser.organization || null,
        buyer_type: updatedUser.buyerType || null,
        location: updatedUser.location || null,
        state: updatedUser.state || null,
        city: updatedUser.city || null,
        lga: updatedUser.lga || null,
        address: updatedUser.address || null,
        description: updatedUser.description || null,
        farming_type: updatedUser.farmingType || null,
        status: updatedUser.status || 'Active',
        updated_at: new Date().toISOString(),
      };

      if (updates.experience !== undefined) {
        profileUpdates.experience = updates.experience?.trim() || null;
      } else if (updatedUser.experience !== undefined) {
        profileUpdates.experience = updatedUser.experience?.trim() || null;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', current.id);

      if (profileError) {
        // Surface the actual DB error to the UI — do not swallow it silently.
        throw new Error(`Failed to save profile: ${profileError.message}`);
      }

      // 2. Read the profile row back immediately to confirm the DB saved the
      //    values. This is the authoritative source after a successful write.
      const confirmedProfile = await this.fetchProfile(current.id);

      // 3. Also sync user_metadata in Auth so it stays in sync with the DB.
      //    This is best-effort: if it fails we warn but do not roll back,
      //    because the DB write (step 1) already succeeded and is the truth.
      try {
        const metadataUpdates: Record<string, any> = {
          name: updatedUser.name,
          full_name: updatedUser.name,
          phone: updatedUser.phone,
          farmName: updatedUser.farmName,
          organization: updatedUser.organization,
          buyerType: updatedUser.buyerType,
          location: updatedUser.location,
          state: updatedUser.state,
          city: updatedUser.city,
          lga: updatedUser.lga,
          address: updatedUser.address,
          description: updatedUser.description,
          farmingType: updatedUser.farmingType,
          status: updatedUser.status,
        };
        if (updatedUser.experience !== undefined) {
          metadataUpdates.experience = updatedUser.experience;
        }

        await supabase.auth.updateUser({
          data: metadataUpdates,
        });
      } catch (metaErr: any) {
        console.warn('user_metadata sync warning (non-fatal, DB update succeeded):', metaErr);
      }

      // 4. Build the final user object from the confirmed DB row. The DB is the
      //    authoritative source. We overlay the fields we just wrote to ensure
      //    instant UI reflection even if the read-after-write had any slight delay.
      const dbUser = confirmedProfile
        ? this.mapProfileToUser(confirmedProfile, null)
        : updatedUser;

      const finalUser: User = {
        ...dbUser,
        // Preserve fields that live only in auth, not in profiles
        id: current.id,
        email: current.email,
        role: current.role, // role is immutable by trigger; keep current value
        // Overlay the values we just wrote so the UI reflects them immediately
        farmName: confirmedProfile?.farm_name ?? updatedUser.farmName,
        phone: confirmedProfile?.phone ?? updatedUser.phone,
        description: confirmedProfile?.description ?? updatedUser.description,
        name: confirmedProfile?.full_name ?? updatedUser.name,
        state: confirmedProfile?.state ?? updatedUser.state,
        city: confirmedProfile?.city ?? updatedUser.city,
        lga: confirmedProfile?.lga ?? updatedUser.lga,
        address: confirmedProfile?.address ?? updatedUser.address,
        farmingType: confirmedProfile?.farming_type ?? updatedUser.farmingType,
        location: confirmedProfile?.location ?? updatedUser.location,
        experience: (confirmedProfile?.experience && confirmedProfile.experience.trim()) ? confirmedProfile.experience.trim() : updatedUser.experience,
      };

      this.currentUser = finalUser;
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(finalUser));
      this.syncToUsersList(finalUser);
      return finalUser;
    }

    // Supabase not configured: persist to localStorage only
    this.currentUser = updatedUser;
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    this.syncToUsersList(updatedUser);
    return updatedUser;
  }

  /**
   * Queries Supabase 'profiles' table for all user profiles
   */
  public async fetchAllProfiles(): Promise<User[]> {
    if (!isSupabaseConfigured) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_USERS);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not query all profiles from Supabase:', error.message);
        try {
          const stored = localStorage.getItem(STORAGE_KEY_USERS);
          return stored ? JSON.parse(stored) : [];
        } catch {
          return [];
        }
      }

      const users = (data || []).map((p) => this.mapProfileToUser(p));
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch (e) {
        console.warn('Could not cache users in localStorage:', e);
      }
      return users;
    } catch (err) {
      console.warn('fetchAllProfiles network exception:', err);
      try {
        const stored = localStorage.getItem(STORAGE_KEY_USERS);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
  }

  /**
   * Subscribes to realtime updates on Supabase 'profiles' table
   */
  public subscribeToProfiles(callback: (profiles: User[]) => void): () => void {
    if (!isSupabaseConfigured) return () => {};

    try {
      const channel = supabase
        .channel('admin_profiles_realtime_' + Date.now())
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          async () => {
            console.log('REALTIME: profiles table changed, refetching...');
            const fresh = await this.fetchAllProfiles();
            callback(fresh);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Could not establish realtime channel for profiles:', err);
      return () => {};
    }
  }

  /**
   * Admin-only operation to update user status (Active / Suspended / Banned) and verification state.
   * Enforces server-side authorization:
   * 1. Attempts to execute the atomic RPC `admin_moderate_user_status`
   * 2. Falls back to direct table update with verified `.select()` check under the admin RLS policy
   * 3. Validates that the database actually modified the row (detects 0-row RLS silent blocks)
   * 4. Updates local cache ONLY after the database confirms the write
   */
  public async adminUpdateUserStatus(
    targetUserId: string,
    newStatus: 'Active' | 'Suspended' | 'Banned',
    isVerified?: boolean
  ): Promise<User> {
    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }

    if (isSupabaseConfigured) {
      // Step A: Attempt the secure least-privilege RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'admin_moderate_user_status',
        {
          target_user_id: targetUserId,
          new_status: newStatus,
          new_is_verified: isVerified !== undefined ? isVerified : null,
        }
      );

      if (!rpcError && rpcData) {
        const confirmedUser = this.mapProfileToUser(rpcData);
        this.syncToUsersList(confirmedUser);
        return confirmedUser;
      }

      // If the error is an explicit permission or business rule rejection from the RPC, throw immediately
      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw new Error(`Admin moderation rejected: ${rpcError.message}`);
      }

      // Step B: Fallback to direct table update under the Admin RLS UPDATE policy
      const updatePayload: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (isVerified !== undefined) {
        updatePayload.is_verified = isVerified;
      }

      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', targetUserId)
        .select();

      if (updateError) {
        throw new Error(`Database error updating status: ${updateError.message}`);
      }

      if (!updateData || updateData.length === 0) {
        throw new Error(
          'Database update affected 0 rows. RLS policy rejected the update or target user was not found. Please ensure the admin moderation migration is applied in Supabase.'
        );
      }

      const confirmedProfile = updateData[0];
      const confirmedUser = this.mapProfileToUser(confirmedProfile);
      this.syncToUsersList(confirmedUser);
      return confirmedUser;
    }

    // Offline / Supabase not configured fallback
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    const index = users.findIndex((u) => u.id === targetUserId);
    if (index === -1) {
      throw new Error('User not found in local records.');
    }
    const updated: User = {
      ...users[index],
      status: newStatus,
      accountStatus: newStatus,
      ...(isVerified !== undefined ? { isVerified } : {}),
    };
    users[index] = updated;
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    return updated;
  }

  /**
   * Admin-only operation to update user profile information (Name, Phone, Location, Farm/Org).
   * Verifies database persistence before updating local cache.
   */
  public async adminUpdateUserProfile(
    targetUserId: string,
    updates: {
      fullName: string;
      phone?: string;
      location?: string;
      farmName?: string;
      organization?: string;
    }
  ): Promise<User> {
    if (!targetUserId) {
      throw new Error('Target user ID is required.');
    }

    if (isSupabaseConfigured) {
      // Step A: Attempt the secure least-privilege RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'admin_update_user_profile',
        {
          target_user_id: targetUserId,
          p_full_name: updates.fullName,
          p_phone: updates.phone || null,
          p_location: updates.location || null,
          p_farm_name: updates.farmName || null,
          p_organization: updates.organization || null,
        }
      );

      if (!rpcError && rpcData) {
        const confirmedUser = this.mapProfileToUser(rpcData);
        this.syncToUsersList(confirmedUser);
        return confirmedUser;
      }

      if (rpcError && !rpcError.message.includes('function') && !rpcError.message.includes('does not exist')) {
        throw new Error(`Admin update profile rejected: ${rpcError.message}`);
      }

      // Step B: Fallback to direct table update under the Admin RLS UPDATE policy
      const updatePayload: Record<string, any> = {
        full_name: updates.fullName,
        phone: updates.phone || null,
        location: updates.location || null,
        farm_name: updates.farmName || null,
        organization: updates.organization || null,
        updated_at: new Date().toISOString(),
      };

      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', targetUserId)
        .select();

      if (updateError) {
        throw new Error(`Database error updating profile: ${updateError.message}`);
      }

      if (!updateData || updateData.length === 0) {
        throw new Error(
          'Database update affected 0 rows. RLS policy rejected the update or target user was not found. Please ensure the admin moderation migration is applied in Supabase.'
        );
      }

      const confirmedProfile = updateData[0];
      const confirmedUser = this.mapProfileToUser(confirmedProfile);
      this.syncToUsersList(confirmedUser);
      return confirmedUser;
    }

    // Offline / Supabase not configured fallback
    const stored = localStorage.getItem(STORAGE_KEY_USERS);
    const users: User[] = stored ? JSON.parse(stored) : [];
    const index = users.findIndex((u) => u.id === targetUserId);
    if (index === -1) {
      throw new Error('User not found in local records.');
    }
    const updated: User = {
      ...users[index],
      name: updates.fullName,
      phone: updates.phone || users[index].phone,
      location: updates.location || users[index].location,
      farmName: updates.farmName !== undefined ? updates.farmName : users[index].farmName,
      organization: updates.organization !== undefined ? updates.organization : users[index].organization,
    };
    users[index] = updated;
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    return updated;
  }
}

export const authService = new AuthService();
