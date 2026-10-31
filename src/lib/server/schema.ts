import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  varchar,
  primaryKey,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

export const leadStatus = ['nuevo', 'contactado', 'propuesta', 'ganado', 'perdido'] as const;

export const leads = pgTable(
  'leads',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 12 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    source: varchar('source', { length: 16 }).notNull(),
    name: text('name').notNull(),
    company: text('company'),
    phone: varchar('phone', { length: 32 }).notNull(),
    email: text('email'),
    needs: text('needs').array().notNull().default([]),
    sector: varchar('sector', { length: 32 }),
    timeline: varchar('timeline', { length: 32 }),
    message: text('message'),
    /** Web actual del prospecto (diagnóstico). */
    siteUrl: text('site_url'),
    estimateMin: integer('estimate_min'),
    estimateMax: integer('estimate_max'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    landingPath: text('landing_path'),
    userAgent: text('user_agent'),
    status: varchar('status', { length: 16, enum: leadStatus }).notNull().default('nuevo'),
    notes: text('notes'),
  },
  (t) => [index('leads_created_at_idx').on(t.createdAt)],
);

export const quotes = pgTable('quotes', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ipHash: varchar('ip_hash', { length: 64 }).notNull(),
    messageCount: integer('message_count').notNull().default(0),
    leadId: integer('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  },
  (t) => [index('chat_sessions_ip_idx').on(t.ipHash, t.createdAt)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 12 }).notNull(),
    content: text('content').notNull(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('chat_messages_session_idx').on(t.sessionId, t.createdAt)],
);

export const rateLimits = pgTable('rate_limits', {
  key: varchar('key', { length: 128 }).primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull().default(0),
});

export const usageMonthly = pgTable(
  'usage_monthly',
  {
    month: varchar('month', { length: 7 }).notNull(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costEstimate: numeric('cost_estimate', { precision: 10, scale: 4 }).notNull().default('0'),
  },
  (t) => [primaryKey({ columns: [t.month] })],
);
