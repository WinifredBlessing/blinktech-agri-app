import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import {
  Produce,
  Farmer,
  Request,
  Order,
  Notification,
  LogisticsRequest,
  LogisticsStatus,
  OrderStatus
} from '../types';
import { produceService, ProduceInput } from '../services/produceService';
import { buyerRequestService, BuyerRequestInput } from '../services/buyerRequestService';
import { orderService } from '../services/orderService';
import { logisticsService } from '../services/logisticsService';
import { notificationService, deriveNotificationLink } from '../services/notificationService';
import { authService } from '../services/authService';
import { useAuth } from './AuthContext';

interface MarketplaceContextType {
  farmers: Farmer[];
  produceList: Produce[];
  loadingProduce: boolean;
  requests: Request[];
  loadingRequests: boolean;
  orders: Order[];
  loadingOrders: boolean;
  notifications: Notification[];
  loadingNotifications?: boolean;
  logisticsRequests: LogisticsRequest[];
  loadingLogistics: boolean;
  logisticsError: string | null;

  // Produce (Real Supabase-backed)
  addProduce: (produce: Omit<Produce, 'id' | 'farmerId' | 'farmerName' | 'createdAt'> & { id?: string }) => Promise<Produce | void>;
  updateProduce: (id: string, updates: Partial<Produce>) => Promise<Produce | void>;
  deleteProduce: (id: string) => Promise<void>;
  refreshProduce: () => Promise<void>;

  // Farmers
  updateFarmer: (id: string, updates: Partial<Farmer>) => void;
  getFarmerById: (id: string) => Farmer | undefined;

  // Requests (Real Supabase-backed)
  createRequest: (request: Omit<Request, 'id' | 'status' | 'createdAt'>) => Promise<Request>;
  acceptRequest: (requestId: string, responseMessage?: string) => Promise<void>;
  declineRequest: (requestId: string, reason?: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;

  // Orders (Real Supabase-backed)
  updateOrderStatus: (orderId: string, status: OrderStatus, notes?: string) => Promise<void>;
  confirmDelivery: (orderId: string) => Promise<void>;
  refreshOrders: () => Promise<void>;

  // Logistics
  createLogisticsRequest: (request: Omit<LogisticsRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<LogisticsRequest>;
  updateLogisticsStatus: (
    id: string,
    status: LogisticsStatus,
    provider?: string,
    driver?: string,
    driverPhone?: string
  ) => Promise<void>;
  refreshLogistics: () => Promise<void>;

  // Notifications (Real Supabase-backed)
  markNotificationRead: (id: string) => Promise<void> | void;
  markAllNotificationsRead: (userId: string) => Promise<void> | void;
  sendNotification: (
    userId: string,
    type: string,
    title: string,
    message: string,
    relatedId?: string,
    link?: string
  ) => Promise<void> | void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export const MarketplaceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  // 1. Produce State: Sole Source of Truth is Supabase (NO localStorage, NO demoProduce fallback)
  const [produceList, setProduceList] = useState<Produce[]>([]);
  const [loadingProduce, setLoadingProduce] = useState(true);

  // 2. Farmers State: Loaded from real Supabase profiles
  const [farmers, setFarmers] = useState<Farmer[]>(() => {
    try {
      const local = localStorage.getItem('agrilink_farmers');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });

  // 3. Requests State: Sole Source of Truth is Supabase (NO localStorage)
  const [requests, setRequests] = useState<Request[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // 4. Orders State: Sole Source of Truth is Supabase (NO localStorage)
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // 5. Notifications State: Sole Source of Truth is Supabase (NO localStorage)
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const [logisticsRequests, setLogisticsRequests] = useState<LogisticsRequest[]>([]);
  const [loadingLogistics, setLoadingLogistics] = useState(true);
  const [logisticsError, setLogisticsError] = useState<string | null>(null);

  // Storage Saver for the local farmer cache
  const saveFarmers = (list: Farmer[]) => {
    setFarmers(list);
    localStorage.setItem('agrilink_farmers', JSON.stringify(list));
  };

  // Clean up any obsolete localStorage produce/requests/orders/logistics/notifications keys on startup
  useEffect(() => {
    try {
      localStorage.removeItem('agrilink_produce');
      localStorage.removeItem('agrilink_requests');
      localStorage.removeItem('agrilink_orders');
      localStorage.removeItem('agrilink_logistics');
      localStorage.removeItem('agrilink_notifications');
    } catch {
      // ignore
    }
  }, []);

  // Sequence ref to prevent race conditions and ensure stale async responses do not overwrite newer state
  const logisticsFetchSeq = useRef(0);

  // Helper to reconcile logistics list: prevents overwriting newer local state with stale async responses
  const reconcileLogisticsList = useCallback((
    currentList: LogisticsRequest[],
    incomingList: LogisticsRequest[]
  ): LogisticsRequest[] => {
    if (!currentList || currentList.length === 0) return incomingList;

    const currentMap = new Map(currentList.map((item) => [item.id, item]));

    const merged = incomingList.map((incomingItem) => {
      const currentItem = currentMap.get(incomingItem.id);
      if (!currentItem) return incomingItem;

      const currentTime = currentItem.updatedAt ? new Date(currentItem.updatedAt).getTime() : 0;
      const incomingTime = incomingItem.updatedAt ? new Date(incomingItem.updatedAt).getTime() : 0;

      // Do not overwrite newer state with stale asynchronous response
      if (currentTime > incomingTime) {
        return currentItem;
      }

      return {
        ...incomingItem,
        buyerName: incomingItem.buyerName || currentItem.buyerName,
        farmerName: incomingItem.farmerName || currentItem.farmerName,
        produceName: incomingItem.produceName || currentItem.produceName,
      };
    });

    // Retain recently added local items that might not have appeared on server yet (within 15s)
    for (const currentItem of currentList) {
      if (!incomingList.some((incomingItem) => incomingItem.id === currentItem.id)) {
        const itemCreatedTime = currentItem.createdAt ? new Date(currentItem.createdAt).getTime() : 0;
        if (Date.now() - itemCreatedTime < 15000) {
          merged.unshift(currentItem);
        }
      }
    }

    return merged;
  }, []);

  // Helper to compare produce items and prevent unnecessary state updates when fields have not genuinely changed
  const isProduceItemEqual = (a: Produce, b: Produce): boolean => {
    return (
      a.id === b.id &&
      a.farmerId === b.farmerId &&
      a.name === b.name &&
      a.category === b.category &&
      a.description === b.description &&
      a.location === b.location &&
      a.state === b.state &&
      a.lga === b.lga &&
      Number(a.availableQuantity) === Number(b.availableQuantity) &&
      a.unit === b.unit &&
      Number(a.price) === Number(b.price) &&
      a.status === b.status &&
      a.image === b.image &&
      a.farmerName === b.farmerName &&
      a.harvestDate === b.harvestDate
    );
  };

  // Helper to reconcile produce lists: preserves previous array reference if items have not changed
  const reconcileProduceList = (current: Produce[], incoming: Produce[]): Produce[] => {
    if (!current || current.length === 0) return incoming;
    if (!incoming || incoming.length === 0) return incoming;
    if (current.length === incoming.length) {
      let hasDifference = false;
      for (let i = 0; i < current.length; i++) {
        if (!isProduceItemEqual(current[i], incoming[i])) {
          hasDifference = true;
          break;
        }
      }
      if (!hasDifference) return current;
    }
    return incoming;
  };

  // Dedicated helper to fetch logistics filtered by user role from Supabase
  const fetchLiveLogistics = useCallback(async (): Promise<LogisticsRequest[]> => {
    if (!user?.id) return [];
    const role = (user.role || '').toLowerCase();
    if (role === 'buyer') {
      return logisticsService.getByBuyer(user.id);
    } else if (role === 'farmer') {
      return logisticsService.getByFarmer(user.id);
    }
    return logisticsService.getAll();
  }, [user?.id, user?.role]);

  // Fetch logistics from Supabase
  const refreshLogistics = useCallback(async () => {
    if (!user?.id) {
      setLogisticsRequests([]);
      setLoadingLogistics(false);
      return;
    }
    const currentSeq = ++logisticsFetchSeq.current;
    try {
      const live = await fetchLiveLogistics();
      if (currentSeq >= logisticsFetchSeq.current) {
        setLogisticsRequests((prev) => reconcileLogisticsList(prev, live));
        setLogisticsError(null);
      }
    } catch (err: unknown) {
      console.error('refreshLogistics error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setLogisticsError(message);
    } finally {
      setLoadingLogistics(false);
    }
  }, [user?.id, fetchLiveLogistics, reconcileLogisticsList]);

  // Logistics records are loaded from Supabase with Realtime synchronization
  useEffect(() => {
    let mounted = true;

    setLogisticsRequests([]);
    setLogisticsError(null);

    if (!user?.id) {
      setLoadingLogistics(false);
      return () => {
        mounted = false;
      };
    }

    setLoadingLogistics(true);
    const initialSeq = ++logisticsFetchSeq.current;

    // 1. Initial load from Supabase
    fetchLiveLogistics()
      .then((live) => {
        if (mounted && initialSeq >= logisticsFetchSeq.current) {
          setLogisticsRequests(live);
          setLogisticsError(null);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : String(err);
        setLogisticsError(message);
        console.error('Initial fetchLogistics error:', err);
      })
      .finally(() => {
        if (mounted) setLoadingLogistics(false);
      });

    // 2. Realtime subscription to public.logistics_requests
    const unsubscribeLogistics = logisticsService.subscribeToLogistics((event) => {
      if (!mounted) return;

      const isRelevant = (log: LogisticsRequest) => {
        if (!user?.id) return false;
        const role = (user.role || '').toLowerCase();
        if (role === 'buyer') return log.buyerId === user.id;
        if (role === 'farmer') return log.farmerId === user.id;
        return true;
      };

      if (event.eventType === 'INSERT' && event.logistics) {
        const newLog = event.logistics;
        if (!isRelevant(newLog)) return;

        setLogisticsRequests((prev) => {
          const existing = prev.find((l) => l.id === newLog.id);
          if (existing) {
            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const newTime = newLog.updatedAt ? new Date(newLog.updatedAt).getTime() : 0;
            if (existingTime > newTime) return prev;
            return prev.map((l) => (l.id === newLog.id ? newLog : l));
          }
          return [newLog, ...prev];
        });
      } else if (event.eventType === 'UPDATE' && event.logistics) {
        const updated = event.logistics;
        setLogisticsRequests((prev) => {
          const existing = prev.find((l) => l.id === updated.id);
          if (existing) {
            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            const updatedTime = updated.updatedAt ? new Date(updated.updatedAt).getTime() : 0;
            if (existingTime > updatedTime) return prev;
            return prev.map((l) => (l.id === updated.id ? { ...existing, ...updated } : l));
          }
          if (isRelevant(updated)) {
            return [updated, ...prev];
          }
          return prev;
        });
      } else if (event.eventType === 'DELETE') {
        const deletedId = event.id;
        setLogisticsRequests((prev) => prev.filter((l) => l.id !== deletedId));
      }
    });

    // 3. Fallback poll every 5s for cross-client resilience (failures do not erase state)
    const interval = setInterval(() => {
      if (!user?.id) return;
      const pollSeq = ++logisticsFetchSeq.current;
      fetchLiveLogistics()
        .then((live) => {
          if (mounted && live && pollSeq >= logisticsFetchSeq.current) {
            setLogisticsRequests((prev) => reconcileLogisticsList(prev, live));
          }
        })
        .catch(() => {
          // Polling failures do not erase previously loaded valid data
        });
    }, 5000);

    // 4. Window focus listener
    const onFocus = () => {
      if (!user?.id) return;
      const focusSeq = ++logisticsFetchSeq.current;
      fetchLiveLogistics()
        .then((live) => {
          if (mounted && live && focusSeq >= logisticsFetchSeq.current) {
            setLogisticsRequests((prev) => reconcileLogisticsList(prev, live));
          }
        })
        .catch(() => {
          // Focus refresh failures do not erase previously loaded valid data
        });
    };
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribeLogistics();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, user?.role, fetchLiveLogistics, reconcileLogisticsList]);

  // Fetch produce and setup Realtime subscription
  const refreshProduce = async () => {
    const t0 = performance.now();
    try {
      const live = await produceService.fetchProduceList();
      setProduceList((prev) => reconcileProduceList(prev, live));
      if (import.meta.env.DEV) {
        console.log(`[DevTiming] refreshProduce completed in ${(performance.now() - t0).toFixed(2)}ms (${live.length} items)`);
      }
    } catch (err) {
      console.error('refreshProduce error:', err);
    } finally {
      setLoadingProduce(false);
    }
  };

  // Fetch requests from Supabase
  const refreshRequests = useCallback(async () => {
    try {
      const live = await buyerRequestService.fetchRequests(user?.id, user?.role);
      setRequests(live);
    } catch (err) {
      console.error('refreshRequests error:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [user?.id, user?.role]);

  // Fetch orders from Supabase
  const refreshOrders = useCallback(async () => {
    try {
      const live = await orderService.fetchOrders(user?.id, user?.role);
      setOrders(live);
    } catch (err) {
      console.error('refreshOrders error:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    let mounted = true;

    // Load registered farmers from Supabase profiles
    const loadRealFarmers = async () => {
      try {
        const profiles = await authService.fetchAllProfiles();
        if (mounted && profiles && profiles.length > 0) {
          const registeredFarmers: Farmer[] = profiles
            .filter((p: any) => (p.role || '').toLowerCase() === 'farmer')
            .map((p: any) => ({
              id: p.id,
              name: p.name || p.full_name || 'Farmer',
              farmName: p.farmName || p.farm_name || `${p.name || 'Farmer'}'s Farm`,
              photo: '',
              phone: p.phone || '',
              state: p.state || 'Kano',
              city: p.city || '',
              lga: p.lga || '',
              description: p.description || '',
              experience: (typeof p.experience === 'string' && p.experience.trim()) ? p.experience.trim() : '5+ years',
              categories: ['Grains', 'Vegetables'],
              status: p.status || 'Active'
            }));

          if (registeredFarmers.length > 0) {
            setFarmers(registeredFarmers);
            saveFarmers(registeredFarmers);
          }
        }
      } catch (err) {
        console.warn('loadRealFarmers error:', err);
      }
    };

    loadRealFarmers();

    // 1. Initial query for produce from Supabase
    setLoadingProduce(true);
    produceService.fetchProduceList().then((live) => {
      if (mounted) {
        setProduceList((prev) => reconcileProduceList(prev, live));
        setLoadingProduce(false);
      }
    });

    // 2. Realtime subscription to public.produce
    const unsubscribeProduce = produceService.subscribeToProduce((event) => {
      if (!mounted) return;

      if (event.eventType === 'INSERT' && event.produce) {
        const newProduce = event.produce;
        setProduceList((prev) => {
          const existingIdx = prev.findIndex((p) => p.id === newProduce.id);
          if (existingIdx !== -1) {
            if (isProduceItemEqual(prev[existingIdx], newProduce)) return prev;
            return prev.map((p) => (p.id === newProduce.id ? newProduce : p));
          }
          return [newProduce, ...prev];
        });
      } else if (event.eventType === 'UPDATE' && event.produce) {
        const updated = event.produce;
        setProduceList((prev) => {
          const existingIdx = prev.findIndex((p) => p.id === updated.id);
          if (existingIdx === -1) return [updated, ...prev];
          if (isProduceItemEqual(prev[existingIdx], updated)) return prev;
          return prev.map((p) => (p.id === updated.id ? updated : p));
        });
      } else if (event.eventType === 'DELETE') {
        const deletedId = event.id;
        setProduceList((prev) => {
          if (!prev.some((p) => p.id === deletedId)) return prev;
          return prev.filter((p) => p.id !== deletedId);
        });
      }
    });

    // 3. Fallback poll every 5s for cross-client resilience (only updates if data genuinely changed)
    const interval = setInterval(() => {
      produceService.fetchProduceList().then((live) => {
        if (mounted && live) {
          setProduceList((prev) => reconcileProduceList(prev, live));
        }
      });
    }, 5000);

    // 4. Window focus listener (only updates if data genuinely changed)
    const onFocus = () => {
      produceService.fetchProduceList().then((live) => {
        if (mounted && live) {
          setProduceList((prev) => reconcileProduceList(prev, live));
        }
      });
    };
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribeProduce();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Dedicated Effect: Fetch requests and establish Realtime subscription
  useEffect(() => {
    let mounted = true;
    setLoadingRequests(true);

    buyerRequestService.fetchRequests(user?.id, user?.role).then((live) => {
      if (mounted) {
        setRequests(live);
        setLoadingRequests(false);
      }
    });

    // Subscribe to Realtime updates on buyer_requests
    const unsubscribeRequests = buyerRequestService.subscribeToBuyerRequests((event) => {
      if (!mounted) return;

      if (event.eventType === 'INSERT' && event.request) {
        const newReq = event.request;
        setRequests((prev) => {
          if (prev.some((r) => r.id === newReq.id)) {
            return prev.map((r) => (r.id === newReq.id ? newReq : r));
          }
          return [newReq, ...prev];
        });
      } else if (event.eventType === 'UPDATE' && event.request) {
        const updated = event.request;
        setRequests((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      } else if (event.eventType === 'DELETE') {
        const deletedId = event.id;
        setRequests((prev) => prev.filter((r) => r.id !== deletedId));
      }
    });

    // Poll fallback every 5s for multi-device sync
    const interval = setInterval(() => {
      buyerRequestService.fetchRequests(user?.id, user?.role).then((live) => {
        if (mounted && live) {
          setRequests(live);
        }
      });
    }, 5000);

    const onFocus = () => {
      buyerRequestService.fetchRequests(user?.id, user?.role).then((live) => {
        if (mounted && live) {
          setRequests(live);
        }
      });
    };
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribeRequests();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, user?.role]);

  // Dedicated Effect: Fetch orders and establish Realtime subscription
  useEffect(() => {
    let mounted = true;
    setLoadingOrders(true);

    orderService.fetchOrders(user?.id, user?.role).then((live) => {
      if (mounted) {
        setOrders(live);
        setLoadingOrders(false);
      }
    }).catch((err) => {
      console.error('Initial fetchOrders error:', err);
      if (mounted) setLoadingOrders(false);
    });

    // Subscribe to Realtime updates on public.orders
    const unsubscribeOrders = orderService.subscribeToOrders((order, eventType) => {
      if (!mounted) return;

      if (eventType === 'INSERT') {
        setOrders((prev) => {
          if (prev.some((o) => o.id === order.id)) {
            return prev.map((o) => (o.id === order.id ? order : o));
          }
          return [order, ...prev];
        });
      } else if (eventType === 'UPDATE') {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? order : o))
        );
      } else if (eventType === 'DELETE') {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      }
    });

    // Poll fallback every 5s for multi-device sync
    const interval = setInterval(() => {
      orderService.fetchOrders(user?.id, user?.role).then((live) => {
        if (mounted && live) {
          setOrders(live);
        }
      }).catch(() => {});
    }, 5000);

    const onFocus = () => {
      orderService.fetchOrders(user?.id, user?.role).then((live) => {
        if (mounted && live) {
          setOrders(live);
        }
      }).catch(() => {});
    };
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribeOrders();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, user?.role]);

  // Dedicated Effect: Fetch notifications and establish Realtime subscription
  useEffect(() => {
    let mounted = true;

    if (!user?.id) {
      setNotifications([]);
      setLoadingNotifications(false);
      return;
    }

    setLoadingNotifications(true);

    // 1. Initial query for user's notifications from Supabase
    notificationService
      .fetchNotifications(user.id)
      .then((live) => {
        if (mounted) {
          setNotifications(live);
          setLoadingNotifications(false);
        }
      })
      .catch((err) => {
        console.error('Initial fetchNotifications error:', err);
        if (mounted) setLoadingNotifications(false);
      });

    // 2. Realtime subscription to public.notifications filtered to user.id
    const unsubscribeNotifications = notificationService.subscribeToNotifications(
      user.id,
      (event) => {
        if (!mounted) return;

        if (event.eventType === 'INSERT' && event.notification) {
          const newNotif = event.notification;
          setNotifications((prev) => {
            // Prevent duplicate notifications
            if (prev.some((n) => n.id === newNotif.id)) {
              return prev.map((n) => (n.id === newNotif.id ? newNotif : n));
            }
            return [newNotif, ...prev];
          });
        } else if (event.eventType === 'UPDATE' && event.notification) {
          const updated = event.notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        } else if (event.eventType === 'DELETE') {
          const deletedId = event.id;
          setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
        }
      }
    );

    // 3. Fallback poll every 5s for multi-device resilience and sync
    const interval = setInterval(() => {
      notificationService
        .fetchNotifications(user.id)
        .then((live) => {
          if (mounted && live) {
            setNotifications((prev) => {
              if (
                prev.length === live.length &&
                prev.every((p, idx) => p.id === live[idx]?.id && p.read === live[idx]?.read)
              ) {
                return prev;
              }
              return live;
            });
          }
        })
        .catch(() => {});
    }, 5000);

    // 4. Window focus listener
    const onFocus = () => {
      notificationService
        .fetchNotifications(user.id)
        .then((live) => {
          if (mounted && live) {
            setNotifications(live);
          }
        })
        .catch(() => {});
    };
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribeNotifications();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id]);

  // Notification Dispatcher: Routes through Supabase RPC create_notification
  const sendNotification = async (
    userId: string,
    type: string,
    title: string,
    message: string,
    relatedId?: string,
    link?: string
  ): Promise<void> => {
    try {
      const derivedLink = link || deriveNotificationLink(type);
      const created = await notificationService.createNotification({
        recipientId: userId,
        type,
        title,
        message,
        link: derivedLink,
        relatedId
      });

      // If this notification was for the current authenticated user,
      // optimistically add it to state immediately (preventing duplicate with Realtime)
      if (created && user?.id && userId === user.id) {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === created.id)) return prev;
          return [created, ...prev];
        });
      }
    } catch (err) {
      console.warn('sendNotification warning (non-blocking):', err);
    }
  };

  // Produce Operations — Real Supabase Execution
  const addProduce = async (produceData: Omit<Produce, 'id' | 'farmerId' | 'farmerName' | 'createdAt'> & { id?: string }) => {
    if (!user?.id) {
      throw new Error('Authentication required to add produce.');
    }

    const t0 = performance.now();

    const input: ProduceInput = {
      id: produceData.id,
      name: produceData.name,
      category: produceData.category,
      description: produceData.description,
      location: produceData.location || user.location || user.state || 'Nigeria',
      state: (produceData as any).state || user.state || '',
      lga: (produceData as any).lga || user.lga || '',
      availableQuantity: produceData.availableQuantity,
      unit: produceData.unit,
      price: produceData.price,
      status: produceData.status,
      image: produceData.image,
      images: produceData.images,
      harvestDate: produceData.harvestDate,
      farmerId: user.id,
      farmerName: user.farmName || user.name
    };

    console.log(`[MarketplaceContext.addProduce] Submitting produce "${input.name}" for farmer ${user.id}...`);

    // Await database confirmation: must not report success until DB confirms
    const created = await produceService.createProduce(input, user.id);
    console.log(`[MarketplaceContext.addProduce] createProduce confirmed (id: ${created.id}). Updating local produceList...`);

    const confirmedProduce: Produce = {
      ...created,
      farmerName: created.farmerName && created.farmerName !== 'Farmer'
        ? created.farmerName
        : (user.farmName || user.name || 'Farmer'),
      location: created.location || user.location || user.state || 'Nigeria',
      state: created.state || user.state || '',
      lga: created.lga || user.lga || '',
    };

    // Immediately update local state from confirmed saved record
    setProduceList((prev) => {
      const exists = prev.some((p) => p.id === confirmedProduce.id);
      if (exists) {
        return prev.map((p) => (p.id === confirmedProduce.id ? confirmedProduce : p));
      }
      return [confirmedProduce, ...prev];
    });

    console.log(
      `[MarketplaceContext.addProduce] produceList updated in ${(performance.now() - t0).toFixed(1)}ms (id: ${confirmedProduce.id})`
    );

    // Reconcile in background without delaying the success message or throwing on refresh failures
    refreshProduce().catch((refreshErr) => {
      console.warn('[Produce] Background produce refresh non-blocking error:', refreshErr);
    });

    return confirmedProduce;
  };

  const updateProduce = async (id: string, updates: Partial<Produce>) => {
    const t0 = performance.now();

    const inputUpdates: Partial<ProduceInput> = {
      name: updates.name,
      category: updates.category,
      description: updates.description,
      location: updates.location,
      state: updates.state,
      lga: updates.lga,
      availableQuantity: updates.availableQuantity,
      unit: updates.unit,
      price: updates.price,
      status: updates.status,
      image: updates.image,
      images: updates.images,
      harvestDate: updates.harvestDate
    };

    // Await database confirmation
    const updated = await produceService.updateProduce(id, inputUpdates);

    const confirmedProduce: Produce = {
      ...updated,
      farmerName: updated.farmerName && updated.farmerName !== 'Farmer'
        ? updated.farmerName
        : (user?.farmName || user?.name || 'Farmer'),
    };

    // Immediately update local state from confirmed record
    setProduceList((prev) =>
      prev.map((p) => (p.id === id ? confirmedProduce : p))
    );

    if (import.meta.env.DEV) {
      console.log(
        `[DevTiming] updateProduce confirmed and UI updated in ${(performance.now() - t0).toFixed(2)}ms (id: ${id})`
      );
    }

    // Reconcile in background without throwing on refresh failures
    refreshProduce().catch((refreshErr) => {
      console.warn('[Produce] Background produce refresh non-blocking error:', refreshErr);
    });

    return confirmedProduce;
  };

  const deleteProduce = async (id: string) => {
    await produceService.deleteProduce(id);
    setProduceList((prev) => prev.filter((p) => p.id !== id));
  };

  // Farmer Operations
  const updateFarmer = (id: string, updates: Partial<Farmer>) => {
    const exists = farmers.some((f) => f.id === id);
    let nextList: Farmer[];
    if (exists) {
      nextList = farmers.map((f) => (f.id === id ? { ...f, ...updates } : f));
    } else {
      const fallbackName = (user?.id === id ? user.name : '') || updates.name || 'Farmer';
      const newFarmer: Farmer = {
        id,
        name: updates.name || fallbackName,
        farmName: updates.farmName || (user?.id === id ? user.farmName : '') || `${fallbackName}'s Farm`,
        photo: updates.photo || '',
        phone: updates.phone || (user?.id === id ? user.phone : '') || '',
        state: updates.state || (user?.id === id ? (user.state || user.location) : '') || 'Kano',
        city: updates.city || (user?.id === id ? user.city : '') || '',
        lga: updates.lga || (user?.id === id ? user.lga : '') || '',
        description: updates.description || (user?.id === id ? user.description : '') || '',
        experience: updates.experience || '5+ years',
        categories: updates.categories || ['Grains', 'Vegetables'],
        status: updates.status || (user?.id === id && user.status === 'Suspended' ? 'Suspended' : 'Active'),
        ...updates
      };
      nextList = [...farmers, newFarmer];
    }
    saveFarmers(nextList);
  };

  const getFarmerById = (id: string): Farmer | undefined => {
    return farmers.find((f) => f.id === id);
  };

  // In-flight guard: prevents concurrent duplicate submissions of the same request.
  // useRef is used so the guard is shared across renders without causing re-renders.
  const createRequestInFlight = useRef(false);
  const acceptRequestInFlight = useRef<Set<string>>(new Set());

  // Requests Operations — Real Supabase Execution
  const createRequest = async (requestData: Omit<Request, 'id' | 'status' | 'createdAt'>): Promise<Request> => {
    if (!user?.id) {
      throw new Error('Authentication required: You must be signed in to create a purchase request.');
    }

    // Reject if a submission is already in-flight (double-tap / rapid re-submit guard)
    if (createRequestInFlight.current) {
      throw new Error('A request is already being submitted. Please wait for it to complete.');
    }

    createRequestInFlight.current = true;

    try {
      const input: BuyerRequestInput = {
        farmerId: requestData.farmerId,
        farmerName: requestData.farmerName,
        produceId: requestData.produceId,
        produceName: requestData.produceName,
        quantity: Number(requestData.quantity),
        unit: requestData.unit || 'kg',
        price: Number(requestData.price),
        totalAmount: Number(requestData.totalAmount),
        deliveryLocation: requestData.deliveryLocation,
        preferredDate: requestData.preferredDate,
        preferredDeliveryDate: requestData.preferredDeliveryDate || requestData.preferredDate,
        message: requestData.message,
        buyerNote: requestData.buyerNote || requestData.message
      };

      const created = await buyerRequestService.createRequest(input, user.id);

      setRequests((prev) => {
        if (prev.some((r) => r.id === created.id)) return prev;
        return [created, ...prev];
      });

      // Notify Farmer
      sendNotification(
        created.farmerId,
        'new_request',
        'New Produce Request',
        `${created.buyerName} requested ${created.quantity} ${created.unit || 'kg'} of ${created.produceName} for delivery to ${created.deliveryLocation}.`,
        created.id
      );

      // Notify Buyer confirmation
      sendNotification(
        created.buyerId,
        'request_submitted',
        'Request Submitted',
        `Your request #${created.id.slice(0, 8)} for ${created.quantity} ${created.unit || 'kg'} of ${created.produceName} has been submitted to the farmer.`,
        created.id
      );

      return created;
    } catch (err: any) {
      // Handle PostgreSQL unique constraint violation (code 23505):
      // Raised when a Pending request for the same buyer + produce already exists.
      const pgCode: string | undefined =
        err?.code || err?.details?.code || err?.error?.code;
      if (pgCode === '23505' || (err?.message as string | undefined)?.includes('uq_buyer_requests_pending_per_produce')) {
        throw new Error(
          'You already have a pending request for this produce. Please wait for the farmer to respond before submitting another.'
        );
      }
      // Re-throw all other errors unchanged — do not swallow them silently.
      throw err;
    } finally {
      // Always release the guard, regardless of success or failure.
      createRequestInFlight.current = false;
    }
  };

  const acceptRequest = async (requestId: string, responseMessage?: string): Promise<void> => {
    if (!user?.id) {
      throw new Error('Authentication required to accept request.');
    }

    if (acceptRequestInFlight.current.has(requestId)) {
      throw new Error('This request is currently being accepted. Please wait.');
    }

    acceptRequestInFlight.current.add(requestId);

    try {
      // Call the atomic Supabase RPC via orderService
      // The RPC atomically locks the request, verifies farmer, checks inventory,
      // decrements produce quantity, updates request to Accepted, and creates exactly one order!
      const createdOrder = await orderService.acceptBuyerRequestAndCreateOrder(
        requestId,
        responseMessage
      );

      // Reconcile in-memory states immediately for responsive UI
      setOrders((prev) => {
        if (prev.some((o) => o.id === createdOrder.id)) return prev;
        return [createdOrder, ...prev];
      });

      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'Accepted',
                farmerResponse: responseMessage || 'Accepted by farmer',
                respondedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            : r
        )
      );

      setProduceList((prev) =>
        prev.map((p) => {
          if (p.id !== createdOrder.produceId) return p;
          const remaining = Math.max(0, p.availableQuantity - createdOrder.quantity);
          return {
            ...p,
            availableQuantity: remaining,
            status: remaining === 0 ? 'Out of Stock' : p.status
          };
        })
      );

      // Refresh live requests, produce inventory, and orders from Supabase backend
      await Promise.all([
        refreshRequests(),
        refreshProduce(),
        refreshOrders()
      ]);

      // Send notifications (non-blocking)
      try {
        sendNotification(
          createdOrder.buyerId,
          'request_accepted',
          'Request Accepted — Order Created',
          `Farmer accepted your request for ${createdOrder.quantity} ${createdOrder.unit || 'kg'} of ${createdOrder.produceName}. Order #${createdOrder.orderNumber || createdOrder.id.slice(0, 8)} is confirmed.`,
          createdOrder.id
        );
      } catch (notifErr) {
        console.warn('Non-blocking notification error after acceptRequest:', notifErr);
      }
    } finally {
      acceptRequestInFlight.current.delete(requestId);
    }
  };

  const declineRequest = async (requestId: string, reason?: string): Promise<void> => {
    if (!user?.id) {
      throw new Error('Authentication required to decline request.');
    }

    const updated = await buyerRequestService.declineRequest(requestId, user.id, reason);

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updated : r))
    );

    sendNotification(
      updated.buyerId,
      'request_declined',
      'Request Declined',
      `Your request for ${updated.produceName} was declined.${reason ? ` Reason: ${reason}` : ''}`,
      updated.id
    );
  };

  const cancelRequest = async (requestId: string): Promise<void> => {
    if (!user?.id) {
      throw new Error('Authentication required to cancel request.');
    }

    const updated = await buyerRequestService.cancelRequest(requestId, user.id);

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? updated : r))
    );
  };

  // Order Operations — Real Supabase Execution
  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    notes?: string
  ): Promise<void> => {
    const updated = await orderService.updateOrderStatus(orderId, status, notes);

    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

    try {
      sendNotification(
        updated.buyerId,
        'order_status',
        'Order Status Updated',
        `Order #${updated.orderNumber || updated.id.slice(0, 8)} for ${updated.produceName} status changed to: ${status}.`,
        updated.id
      );

      sendNotification(
        updated.farmerId,
        'order_status',
        'Order Status Updated',
        `Order #${updated.orderNumber || updated.id.slice(0, 8)} status updated to: ${status}.`,
        updated.id
      );
    } catch (notifErr) {
      console.warn('Non-blocking notification error after updateOrderStatus:', notifErr);
    }
  };

  const confirmDelivery = async (orderId: string): Promise<void> => {
    const updated = await orderService.confirmOrderDelivered(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

    try {
      sendNotification(
        updated.farmerId,
        'order_status',
        'Delivery Confirmed by Buyer',
        `Buyer has confirmed delivery receipt for Order #${updated.orderNumber || updated.id.slice(0, 8)}. Order is now Completed.`,
        updated.id
      );
    } catch (notifErr) {
      console.warn('Non-blocking notification error after confirmDelivery:', notifErr);
    }
  };

  // Logistics Operations
  const createLogisticsRequest = async (
    requestData: Omit<LogisticsRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<LogisticsRequest> => {
    setLogisticsError(null);

    try {
      const created = await logisticsService.createLogisticsRequest({
        orderId: requestData.orderId,
        pickupLocation: requestData.pickupLocation,
        pickupAddress: requestData.pickupAddress,
        deliveryAddress: requestData.deliveryAddress,
        preferredDate: requestData.preferredDate,
        instructions: requestData.instructions
      });

      setLogisticsRequests((current) => [
        created,
        ...current.filter((request) => request.id !== created.id)
      ]);

      try {
        sendNotification(
          created.farmerId,
          'logistics_requested',
          'Delivery Requested by Buyer',
          `Buyer requested delivery for order #${created.orderId.slice(0, 8)} (${created.quantity} ${created.unit || 'kg'} ${created.produceName}).`,
          created.id
        );
      } catch (notifErr) {
        console.warn('Non-blocking notification error after createLogisticsRequest:', notifErr);
      }

      return created;
    } catch (err) {
      setLogisticsError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  const updateLogisticsStatus = async (
    id: string,
    status: LogisticsStatus,
    provider?: string,
    driver?: string,
    driverPhone?: string
  ): Promise<void> => {
    setLogisticsError(null);

    try {
      const updated = await logisticsService.updateLogisticsStatus(
        id,
        status,
        provider,
        driver,
        driverPhone
      );

      setLogisticsRequests((current) => current.map((request) =>
        request.id === updated.id ? updated : request
      ));

      // Synchronize associated order state when logistics status change may affect order
      // (The database RPC update_logistics_status conditionally advances orders to 'In Transit'
      // or 'Delivered' in the same transaction).
      if (status === 'In Transit' || status === 'Delivered') {
        try {
          const updatedOrder = await orderService.fetchOrderById(updated.orderId);
          if (updatedOrder) {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === updatedOrder.id);
              if (exists) {
                return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
              }
              return [updatedOrder, ...prev];
            });
          }
        } catch (orderSyncErr) {
          console.warn('Non-blocking order sync error after updateLogisticsStatus:', orderSyncErr);
        }
      }

      const statusMessages: Record<LogisticsStatus, string> = {
        Requested: 'Delivery requested',
        Assigned: `Provider assigned: ${updated.provider || 'AgriMove Logistics'}${updated.driver ? ` (Driver: ${updated.driver})` : ''}`,
        'Picked Up': `Produce picked up from farm in ${updated.pickupLocation}. In transit soon.`,
        'In Transit': `Shipment is currently in transit to ${updated.deliveryLocation}.`,
        Delivered: `Shipment delivered to ${updated.deliveryLocation}. Delivery receipt confirmation pending.`,
        Cancelled: `Delivery request for order #${updated.orderId.slice(0, 8)} was cancelled.`
      };

      try {
        sendNotification(
          updated.buyerId,
          'logistics_update',
          `Logistics Update: ${status}`,
          `Delivery #${updated.logisticsNumber || updated.id.slice(0, 8)} for ${updated.produceName}: ${statusMessages[status]}`,
          updated.id
        );
        sendNotification(
          updated.farmerId,
          'logistics_update',
          `Logistics Update: ${status}`,
          `Shipment #${updated.logisticsNumber || updated.id.slice(0, 8)} for order #${updated.orderId.slice(0, 8)}: ${statusMessages[status]}`,
          updated.id
        );
      } catch (notifErr) {
        console.warn('Non-blocking notification error after updateLogisticsStatus:', notifErr);
      }
    } catch (err) {
      setLogisticsError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  // Notification Readers: Persist to Supabase with optimistic UI updates
  const markNotificationRead = async (id: string): Promise<void> => {
    // 1. Optimistic update in state for instant UI responsiveness
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true, isRead: true } : n))
    );

    // 2. Persist to Supabase
    try {
      await notificationService.markNotificationRead(id, user?.id);
    } catch (err) {
      console.error('Failed to mark notification as read in Supabase:', err);
    }
  };

  const markAllNotificationsRead = async (userId: string): Promise<void> => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    // 1. Optimistic update in state for instant UI responsiveness
    setNotifications((prev) =>
      prev.map((n) =>
        n.userId === targetUserId ? { ...n, read: true, isRead: true } : n
      )
    );

    // 2. Persist to Supabase
    try {
      await notificationService.markAllNotificationsRead(targetUserId);
    } catch (err) {
      console.error('Failed to mark all notifications as read in Supabase:', err);
    }
  };

  return (
    <MarketplaceContext.Provider
      value={{
        farmers,
        produceList,
        loadingProduce,
        requests,
        loadingRequests,
        orders,
        loadingOrders,
        notifications,
        loadingNotifications,
        logisticsRequests,
        loadingLogistics,
        logisticsError,
        addProduce,
        updateProduce,
        deleteProduce,
        refreshProduce,
        updateFarmer,
        getFarmerById,
        createRequest,
        acceptRequest,
        declineRequest,
        cancelRequest,
        refreshRequests,
        updateOrderStatus,
        confirmDelivery,
        refreshOrders,
        createLogisticsRequest,
        updateLogisticsStatus,
        refreshLogistics,
        markNotificationRead,
        markAllNotificationsRead,
        sendNotification
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (context === undefined) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return context;
};
