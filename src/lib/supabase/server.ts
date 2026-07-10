import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let _client: ReturnType<typeof createClient<Database>> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _anyClient: any = null

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl)      throw new Error('NEXT_PUBLIC_SUPABASE_URL missing')
  if (!serviceRoleKey)   throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return { supabaseUrl, serviceRoleKey }
}

const clientOpts = {
  auth: { autoRefreshToken: false, persistSession: false },
}

// Simple in-memory mock store to prevent crashes and provide interactive features
const mockStore: Record<string, any[]> = {
  leads: [
    { id: 'l1', name: 'Priya Sharma', phone: '+91 98765 43210', email: 'priya@example.com', stage: 'qualified', ai_score: 94, budget: 450000, intent: 'bridal_purchase', urgency: 'high', confidence: 0.93, last_contact: new Date(Date.now() - 2 * 60 * 1000).toISOString(), tags: ['wedding', 'premium'], notes: 'December wedding. Looking for premium lehenga.', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'l2', name: 'Rahul Mehta', phone: '+91 87654 32109', email: 'rahul@example.com', stage: 'contacted', ai_score: 78, budget: 200000, intent: 'saree_purchase', urgency: 'medium', confidence: 0.81, last_contact: new Date(Date.now() - 18 * 60 * 1000).toISOString(), tags: ['saree', 'viewing'], notes: 'Wants weekend viewing.', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'l3', name: 'Ananya Patel', phone: '+91 76543 21098', email: 'ananya@example.com', stage: 'scheduled', ai_score: 88, budget: 350000, intent: 'bridal_purchase', urgency: 'high', confidence: 0.89, last_contact: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), tags: ['appointment'], notes: 'Appointment scheduled for next week.', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'l4', name: 'Kavya Reddy', phone: '+91 65432 10987', email: 'kavya@example.com', stage: 'new', ai_score: 52, budget: 150000, intent: 'casual_browse', urgency: 'low', confidence: 0.55, last_contact: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), tags: ['budget-sensitive'], notes: 'Price concerns. Needs value offering.', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'l5', name: 'Divya Krishnan', phone: '+91 54321 09876', email: 'divya@example.com', stage: 'converted', ai_score: 96, budget: 800000, intent: 'bridal_purchase', urgency: 'high', confidence: 0.97, last_contact: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), tags: ['premium', 'converted'], notes: 'Premium package confirmed. ₹8L deal closed.', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ],
  tasks: [
    { id: 't1', title: 'Send premium catalogue to Priya Sharma', lead_id: 'l1', due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), priority: 'urgent', status: 'pending', ai_generated: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't2', title: 'Schedule weekend viewing for Rahul Mehta', lead_id: 'l2', due_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), priority: 'high', status: 'pending', ai_generated: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't3', title: 'Follow up with Kavya — offer budget collection', lead_id: 'l4', due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), priority: 'medium', status: 'pending', ai_generated: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 't4', title: 'Confirm appointment details with Ananya', lead_id: 'l3', due_date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), priority: 'high', status: 'in_progress', ai_generated: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ],
  conversations: [
    { id: 'c1', customer_name: 'Priya Sharma', customer_phone: '+91 98765 43210', last_message: 'I am interested in the premium wedding package. What is the cost?', last_message_time: new Date().toISOString(), status: 'open', priority: 'urgent', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ],
  messages: []
}

class MockQueryChain {
  tableName: string;
  _data: any[] | null = null;
  error: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  initData() {
    if (this._data === null) {
      if (!mockStore[this.tableName]) {
        mockStore[this.tableName] = [];
      }
      this._data = JSON.parse(JSON.stringify(mockStore[this.tableName]));
    }
  }

  select(fields?: string, options?: any) {
    this.initData();
    // Simulate relations (e.g. conversations with contacts)
    if (this.tableName === 'conversations' && fields && fields.includes('contact')) {
      this._data = this._data!.map(conv => {
        if (!conv.contact) {
          conv.contact = {
            id: conv.contact_id || 'c_default',
            name: conv.customer_name || 'Customer Name',
            phone: conv.customer_phone || '+91 98765 43210',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
            tags: ['priority']
          };
        }
        return conv;
      });
    }
    return this;
  }

  order(field: string, options?: any) {
    this.initData();
    const ascending = options?.ascending !== false;
    this._data!.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;
      if (valA < valB) return ascending ? -1 : 1;
      if (valA > valB) return ascending ? 1 : -1;
      return 0;
    });
    return this;
  }

  limit(val: number) {
    this.initData();
    this._data = this._data!.slice(0, val);
    return this;
  }

  range(from: number, to: number) {
    this.initData();
    this._data = this._data!.slice(from, to + 1);
    return this;
  }

  eq(field: string, val: any) {
    this.initData();
    this._data = this._data!.filter((item: any) => item[field] === val);
    return this;
  }

  neq(field: string, val: any) {
    this.initData();
    this._data = this._data!.filter((item: any) => item[field] !== val);
    return this;
  }

  gte(field: string, val: any) {
    this.initData();
    this._data = this._data!.filter((item: any) => {
      const itemVal = item[field];
      if (itemVal === undefined || itemVal === null) return false;
      return itemVal >= val;
    });
    return this;
  }

  lte(field: string, val: any) {
    this.initData();
    this._data = this._data!.filter((item: any) => {
      const itemVal = item[field];
      if (itemVal === undefined || itemVal === null) return false;
      return itemVal <= val;
    });
    return this;
  }

  in(field: string, vals: any[]) {
    this.initData();
    this._data = this._data!.filter((item: any) => vals.includes(item[field]));
    return this;
  }

  ilike(field: string, pattern: string) {
    this.initData();
    const cleanPattern = pattern.replace(/%/g, '').toLowerCase();
    this._data = this._data!.filter((item: any) => {
      const val = item[field];
      return String(val || '').toLowerCase().includes(cleanPattern);
    });
    return this;
  }

  not(field: string, op: string, val: any) {
    this.initData();
    if (op === 'is' && val === null) {
      this._data = this._data!.filter((item: any) => item[field] !== null && item[field] !== undefined);
    } else {
      this._data = this._data!.filter((item: any) => item[field] !== val);
    }
    return this;
  }

  insert(body: any) {
    this.initData();
    const items = Array.isArray(body) ? body : [body];
    const newItems = items.map(item => ({
      id: item.id || Math.random().toString(36).substring(7),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...item
    }));
    if (!mockStore[this.tableName]) mockStore[this.tableName] = [];
    mockStore[this.tableName].push(...newItems);
    this._data = Array.isArray(body) ? newItems : newItems[0];
    return this;
  }

  update(updates: any) {
    this.initData();
    this._data!.forEach((item: any) => {
      Object.assign(item, updates, { updated_at: new Date().toISOString() });
      const storeItem = mockStore[this.tableName]?.find(x => x.id === item.id);
      if (storeItem) {
        Object.assign(storeItem, updates, { updated_at: new Date().toISOString() });
      }
    });
    return this;
  }

  delete() {
    this.initData();
    this._data!.forEach((item: any) => {
      if (mockStore[this.tableName]) {
        mockStore[this.tableName] = mockStore[this.tableName].filter(x => x.id !== item.id);
      }
    });
    this._data = [];
    return this;
  }

  single() {
    this.initData();
    this._data = Array.isArray(this._data) ? this._data[0] || null : this._data;
    return this;
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    this.initData();
    const res = {
      data: this._data,
      error: this.error,
      count: Array.isArray(this._data) ? this._data.length : (this._data ? 1 : 0)
    };
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }

  catch(onrejected?: (reason: any) => any) {
    this.initData();
    const res = {
      data: this._data,
      error: this.error,
      count: Array.isArray(this._data) ? this._data.length : (this._data ? 1 : 0)
    };
    return Promise.resolve(res).catch(onrejected);
  }
}

// Highly robust and flexible dynamic mock proxy builder
function createMockClient(): any {
  const handler = (tableName: string): any => {
    const chainInstance = new MockQueryChain(tableName);
    const chainProxy = new Proxy(chainInstance, {
      get: (target: any, prop: string | symbol) => {
        if (prop in target) {
          const val = target[prop];
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        }
        if (prop === 'then' || prop === 'catch') {
          return target[prop].bind(target);
        }
        if (typeof prop === 'string') {
          return () => chainProxy;
        }
        return undefined;
      }
    });
    return chainProxy;
  };

  return new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'from') {
        return (name: string) => handler(name);
      }
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
          signOut: () => Promise.resolve({ error: null }),
        };
      }
      return () => {
        return {
          from: (name: string) => handler(name)
        };
      };
    }
  });
}

/** Fully typed client — use for simple selects / inserts on single tables */
export function createSupabaseServiceClient(): any {
  if (_client) return _client
  try {
    const { supabaseUrl, serviceRoleKey } = getEnv()
    _client = createClient<Database>(supabaseUrl, serviceRoleKey, clientOpts)
  } catch (err) {
    console.warn('[AI Studio] Supabase Server Credentials missing — using mock client')
    _client = createMockClient()
  }
  return _client
}

/**
 * Untyped client — use when you need PostgREST join syntax like
 * `.select('*, contact:contacts(*)')` that TypeScript can't resolve
 * without `supabase gen types`. All query results are `any`.
 */
export function createSupabaseServiceClientUntyped(): any {
  if (_anyClient) return _anyClient
  try {
    const { supabaseUrl, serviceRoleKey } = getEnv()
    _anyClient = createClient(supabaseUrl, serviceRoleKey, clientOpts)
  } catch (err) {
    console.warn('[AI Studio] Supabase Server Credentials missing — using mock client (untyped)')
    _anyClient = createMockClient()
  }
  return _anyClient
}