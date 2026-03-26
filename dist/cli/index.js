#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/plugins/manifest.ts
function validatePluginManifest(data) {
  const result = pluginManifestSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.flatten().fieldErrors;
    const msg = Object.entries(first).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ");
    return { success: false, error: msg || "Invalid manifest" };
  }
  const manifest = result.data;
  if (manifest.provides?.templates?.length) {
    for (const id of manifest.provides.templates) {
      if (!manifest.templates?.[id]) {
        return {
          success: false,
          error: `provides.templates references missing template: ${id}`
        };
      }
    }
  }
  if (manifest.provides?.channels?.length) {
    for (const id of manifest.provides.channels) {
      if (!manifest.channels?.[id]) {
        return {
          success: false,
          error: `provides.channels references missing channel: ${id}`
        };
      }
    }
  }
  return { success: true, manifest };
}
var import_zod, configFieldSchema, templateEntrySchema, channelEntrySchema, pluginManifestSchema;
var init_manifest = __esm({
  "src/lib/plugins/manifest.ts"() {
    "use strict";
    import_zod = require("zod");
    configFieldSchema = import_zod.z.object({
      type: import_zod.z.enum(["string", "number", "boolean"]),
      required: import_zod.z.boolean().optional(),
      label: import_zod.z.string().optional(),
      description: import_zod.z.string().optional()
    });
    templateEntrySchema = import_zod.z.object({
      file: import_zod.z.string().min(1),
      name: import_zod.z.string().min(1),
      description: import_zod.z.string().optional()
    });
    channelEntrySchema = import_zod.z.object({
      file: import_zod.z.string().min(1),
      name: import_zod.z.string().min(1),
      configSchema: import_zod.z.record(import_zod.z.string(), configFieldSchema).optional()
    });
    pluginManifestSchema = import_zod.z.object({
      name: import_zod.z.string().min(1),
      version: import_zod.z.string().min(1),
      description: import_zod.z.string().optional(),
      author: import_zod.z.string().optional(),
      provides: import_zod.z.object({
        templates: import_zod.z.array(import_zod.z.string()).optional(),
        channels: import_zod.z.array(import_zod.z.string()).optional()
      }).optional(),
      templates: import_zod.z.record(import_zod.z.string(), templateEntrySchema).optional(),
      channels: import_zod.z.record(import_zod.z.string(), channelEntrySchema).optional()
    });
  }
});

// src/lib/plugins/loader.ts
function getPluginsDir() {
  return import_path3.default.join(process.cwd(), "plugins");
}
function getRegistryPath() {
  return import_path3.default.join(getPluginsDir(), REGISTRY_FILENAME);
}
function readRegistry() {
  const registryPath = getRegistryPath();
  try {
    const raw = import_fs.default.readFileSync(registryPath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (e) => typeof e === "object" && e !== null && "slug" in e && "path" in e && typeof e.slug === "string" && typeof e.path === "string"
    );
  } catch {
    return [];
  }
}
function loadManifest(pluginDir) {
  const manifestPath = import_path3.default.join(pluginDir, MANIFEST_FILENAME);
  try {
    const raw = import_fs.default.readFileSync(manifestPath, "utf-8");
    const data = JSON.parse(raw);
    const result = validatePluginManifest(data);
    return result.success ? result.manifest : null;
  } catch {
    return null;
  }
}
function loadPlugins() {
  const pluginsDir = getPluginsDir();
  if (!import_fs.default.existsSync(pluginsDir)) return [];
  const registry = readRegistry();
  const loaded = [];
  for (const entry of registry) {
    const pluginDir = import_path3.default.isAbsolute(entry.path) ? entry.path : import_path3.default.join(process.cwd(), entry.path);
    if (!import_fs.default.existsSync(pluginDir)) {
      loaded.push({
        slug: entry.slug,
        dir: pluginDir,
        manifest: { name: entry.slug, version: "0.0.0" },
        error: "Plugin directory not found"
      });
      continue;
    }
    const manifest = loadManifest(pluginDir);
    if (!manifest) {
      loaded.push({
        slug: entry.slug,
        dir: pluginDir,
        manifest: { name: entry.slug, version: "0.0.0" },
        error: "Invalid or missing manifest"
      });
      continue;
    }
    loaded.push({ slug: entry.slug, dir: pluginDir, manifest });
  }
  return loaded;
}
function getPluginChannels() {
  const plugins = loadPlugins();
  const out = [];
  for (const plugin of plugins) {
    if (plugin.error || !plugin.manifest.channels) continue;
    const channelIds = plugin.manifest.provides?.channels ?? Object.keys(plugin.manifest.channels);
    for (const id of channelIds) {
      const entry = plugin.manifest.channels[id];
      if (!entry) continue;
      const resolvedFile = import_path3.default.resolve(plugin.dir, entry.file);
      out.push({
        pluginSlug: plugin.slug,
        id,
        name: entry.name,
        configSchema: entry.configSchema,
        entry,
        resolvedFile
      });
    }
  }
  return out;
}
function getRegistryPathForCLI() {
  return getRegistryPath();
}
function getPluginsDirForCLI() {
  return getPluginsDir();
}
var import_fs, import_path3, REGISTRY_FILENAME, MANIFEST_FILENAME;
var init_loader = __esm({
  "src/lib/plugins/loader.ts"() {
    "use strict";
    import_fs = __toESM(require("fs"));
    import_path3 = __toESM(require("path"));
    init_manifest();
    REGISTRY_FILENAME = "registry.json";
    MANIFEST_FILENAME = "substrack-plugin.json";
  }
});

// src/lib/config/schema.ts
var import_zod2, sub5tr4ckerConfigSchema;
var init_schema = __esm({
  "src/lib/config/schema.ts"() {
    "use strict";
    import_zod2 = require("zod");
    sub5tr4ckerConfigSchema = import_zod2.z.object({
      /** schema version for migration support */
      configVersion: import_zod2.z.string().default("1.0.0"),
      /** operating mode */
      mode: import_zod2.z.enum(["local", "advanced"]).default("local"),
      /** app version at time of creation */
      appVersion: import_zod2.z.string().default("unknown"),
      /** port for the web UI */
      port: import_zod2.z.number().int().min(1024).max(65535).default(3054),
      /** auto-generated auth token for local single-user mode */
      authToken: import_zod2.z.string().optional(),
      /** email address of the local admin (used in local mode UI) */
      adminEmail: import_zod2.z.string().email().optional(),
      /** admin display name */
      adminName: import_zod2.z.string().optional(),
      notifications: import_zod2.z.object({
        channels: import_zod2.z.object({
          email: import_zod2.z.object({
            provider: import_zod2.z.literal("resend"),
            apiKey: import_zod2.z.string(),
            fromAddress: import_zod2.z.string(),
            replyToAddress: import_zod2.z.string().optional()
          }).optional(),
          telegram: import_zod2.z.object({
            botToken: import_zod2.z.string(),
            pollingEnabled: import_zod2.z.boolean().default(true),
            /** last processed update_id from Telegram polling */
            lastUpdateId: import_zod2.z.number().int().optional()
          }).optional()
        }),
        defaultChannel: import_zod2.z.enum(["email", "telegram"]).default("email")
      }).default({
        channels: {},
        defaultChannel: "email"
      }),
      /** cron/scheduling state */
      cron: import_zod2.z.object({
        installed: import_zod2.z.boolean().default(false),
        method: import_zod2.z.enum(["crontab", "launchd", "task-scheduler", "manual"]).optional(),
        interval: import_zod2.z.string().default("*/30 * * * *")
      }).default({
        installed: false,
        interval: "*/30 * * * *"
      }),
      /** only used in advanced mode */
      mongodb: import_zod2.z.object({
        uri: import_zod2.z.string()
      }).optional()
    });
  }
});

// src/lib/config/manager.ts
function getDataDir() {
  if (process.env.SUB5TR4CKER_DATA_PATH) {
    return import_path6.default.dirname(process.env.SUB5TR4CKER_DATA_PATH);
  }
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  return import_path6.default.join(home, ".sub5tr4cker");
}
function getConfigPath() {
  return import_path6.default.join(getDataDir(), "config.json");
}
function getDbPath() {
  if (process.env.SUB5TR4CKER_DATA_PATH) {
    return process.env.SUB5TR4CKER_DATA_PATH;
  }
  return import_path6.default.join(getDataDir(), "data.db");
}
function readConfig() {
  if (_cachedConfig) return _cachedConfig;
  const configPath = getConfigPath();
  if (!import_fs4.default.existsSync(configPath)) return null;
  try {
    const raw = JSON.parse(import_fs4.default.readFileSync(configPath, "utf-8"));
    const parsed = sub5tr4ckerConfigSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[config] invalid config.json:", parsed.error.flatten());
      return null;
    }
    _cachedConfig = parsed.data;
    return _cachedConfig;
  } catch (e) {
    console.error("[config] failed to read config.json:", e);
    return null;
  }
}
function writeConfig(config) {
  const dir = getDataDir();
  if (!import_fs4.default.existsSync(dir)) {
    import_fs4.default.mkdirSync(dir, { recursive: true });
    try {
      import_fs4.default.chmodSync(dir, 448);
    } catch {
    }
  }
  const configPath = getConfigPath();
  import_fs4.default.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 384
  });
  _cachedConfig = config;
}
function updateConfig(updates) {
  const current = readConfig();
  if (!current) throw new Error("Config not initialized. Run 's54r init' first.");
  const merged = { ...current, ...updates };
  const parsed = sub5tr4ckerConfigSchema.parse(merged);
  writeConfig(parsed);
  return parsed;
}
function getAppMode() {
  if (process.env.SUB5TR4CKER_MODE === "local") return "local";
  if (process.env.SUB5TR4CKER_MODE === "advanced") return "advanced";
  const config = readConfig();
  if (config) return config.mode;
  return "advanced";
}
function isLocalMode() {
  return getAppMode() === "local";
}
function getLocalSetting(key) {
  const config = readConfig();
  if (!config) return null;
  switch (key) {
    case "email.apiKey":
      return config.notifications.channels.email?.apiKey ?? null;
    case "email.fromAddress":
      return config.notifications.channels.email?.fromAddress ?? null;
    case "email.replyToAddress":
      return config.notifications.channels.email?.replyToAddress ?? null;
    case "telegram.botToken":
      return config.notifications.channels.telegram?.botToken ?? null;
    case "telegram.webhookSecret":
      return null;
    case "general.appUrl":
      return `http://localhost:${config.port}`;
    case "general.appName":
      return "sub5tr4cker";
    case "security.nextAuthSecret":
    case "security.authSecret":
      return config.authToken ?? null;
    default:
      return null;
  }
}
var import_fs4, import_path6, _cachedConfig;
var init_manager = __esm({
  "src/lib/config/manager.ts"() {
    "use strict";
    import_fs4 = __toESM(require("fs"));
    import_path6 = __toESM(require("path"));
    init_schema();
    _cachedConfig = null;
  }
});

// src/lib/db/mongoose.ts
function getCache() {
  if (!global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }
  return global.mongooseCache;
}
async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }
  const cached = getCache();
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = import_mongoose.default.connect(uri, { bufferCommands: false }).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
var import_mongoose;
var init_mongoose = __esm({
  "src/lib/db/mongoose.ts"() {
    "use strict";
    import_mongoose = __toESM(require("mongoose"));
  }
});

// src/models/user.ts
var import_mongoose2, userSchema, User;
var init_user = __esm({
  "src/models/user.ts"() {
    "use strict";
    import_mongoose2 = __toESM(require("mongoose"));
    userSchema = new import_mongoose2.Schema(
      {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        role: { type: String, enum: ["admin", "user"], default: "user" },
        emailVerified: { type: Date, default: null },
        image: { type: String, default: null },
        hashedPassword: { type: String, default: null },
        telegram: {
          type: new import_mongoose2.Schema(
            {
              chatId: { type: Number, required: true },
              username: { type: String, default: null },
              linkedAt: { type: Date, default: null }
            },
            { _id: false }
          ),
          default: void 0
        },
        telegramLinkCode: {
          type: new import_mongoose2.Schema(
            {
              code: { type: String, required: true },
              expiresAt: { type: Date, required: true }
            },
            { _id: false }
          ),
          default: void 0
        },
        notificationPreferences: {
          email: { type: Boolean, default: true },
          telegram: { type: Boolean, default: false },
          reminderFrequency: {
            type: String,
            enum: ["once", "daily", "every_3_days"],
            default: "every_3_days"
          }
        },
        welcomeEmailSentAt: { type: Date, default: null }
      },
      { timestamps: true }
    );
    userSchema.index({ "telegram.chatId": 1 }, { sparse: true, unique: true });
    userSchema.index(
      { "telegramLinkCode.code": 1 },
      { sparse: true, unique: true }
    );
    User = import_mongoose2.default.models.User || import_mongoose2.default.model("User", userSchema);
  }
});

// src/models/group.ts
var import_mongoose3, groupMemberSchema, groupSchema, Group;
var init_group = __esm({
  "src/models/group.ts"() {
    "use strict";
    import_mongoose3 = __toESM(require("mongoose"));
    groupMemberSchema = new import_mongoose3.Schema({
      user: { type: import_mongoose3.Schema.Types.ObjectId, ref: "User", default: null },
      email: { type: String, required: true },
      nickname: { type: String, required: true },
      role: { type: String, enum: ["member", "admin"], default: "member" },
      joinedAt: { type: Date, default: Date.now },
      leftAt: { type: Date, default: null },
      isActive: { type: Boolean, default: true },
      customAmount: { type: Number, default: null },
      acceptedAt: { type: Date, default: null },
      unsubscribedFromEmail: { type: Boolean, default: false },
      billingStartsAt: { type: Date, default: null }
    });
    groupSchema = new import_mongoose3.Schema(
      {
        name: { type: String, required: true },
        description: { type: String, default: null },
        admin: { type: import_mongoose3.Schema.Types.ObjectId, ref: "User", required: true },
        service: {
          name: { type: String, required: true },
          icon: { type: String, default: null },
          url: { type: String, default: null },
          accentColor: { type: String, default: null },
          emailTheme: {
            type: String,
            enum: ["clean", "minimal", "bold", "rounded", "corporate"],
            default: "clean"
          }
        },
        billing: {
          mode: {
            type: String,
            enum: ["equal_split", "fixed_amount", "variable"],
            default: "equal_split"
          },
          currentPrice: { type: Number, required: true },
          currency: { type: String, default: "EUR" },
          cycleDay: { type: Number, default: 1, min: 1, max: 28 },
          cycleType: {
            type: String,
            enum: ["monthly", "yearly"],
            default: "monthly"
          },
          adminIncludedInSplit: { type: Boolean, default: true },
          fixedMemberAmount: { type: Number, default: null },
          gracePeriodDays: { type: Number, default: 3 },
          paymentInAdvanceDays: { type: Number, default: 0, min: 0, max: 365 }
        },
        payment: {
          platform: {
            type: String,
            enum: ["revolut", "paypal", "bank_transfer", "stripe", "custom"],
            default: "revolut"
          },
          link: { type: String, default: null },
          instructions: { type: String, default: null },
          stripeAccountId: { type: String, default: null }
        },
        notifications: {
          remindersEnabled: { type: Boolean, default: true },
          followUpsEnabled: { type: Boolean, default: true },
          priceChangeEnabled: { type: Boolean, default: true },
          saveEmailParams: { type: Boolean, default: false }
        },
        members: [groupMemberSchema],
        announcements: {
          notifyOnPriceChange: { type: Boolean, default: true },
          extraText: { type: String, default: null }
        },
        telegramGroup: {
          chatId: { type: Number, default: null },
          linkedAt: { type: Date, default: null }
        },
        isActive: { type: Boolean, default: true },
        inviteCode: { type: String, default: null },
        inviteLinkEnabled: { type: Boolean, default: false },
        initializedAt: { type: Date, default: null }
      },
      { timestamps: true }
    );
    groupSchema.index({ admin: 1 });
    groupSchema.index({ "members.user": 1 });
    groupSchema.index({ "members.email": 1 });
    groupSchema.index({ inviteCode: 1 }, { sparse: true, unique: true });
    Group = import_mongoose3.default.models.Group || import_mongoose3.default.model("Group", groupSchema);
  }
});

// src/models/billing-period.ts
var import_mongoose4, memberPaymentSchema, reminderEntrySchema, billingPeriodSchema, BillingPeriod;
var init_billing_period = __esm({
  "src/models/billing-period.ts"() {
    "use strict";
    import_mongoose4 = __toESM(require("mongoose"));
    memberPaymentSchema = new import_mongoose4.Schema({
      memberId: { type: import_mongoose4.Schema.Types.ObjectId, required: true },
      memberEmail: { type: String, required: true },
      memberNickname: { type: String, required: true },
      amount: { type: Number, required: true },
      adjustedAmount: { type: Number, default: null },
      adjustmentReason: { type: String, default: null },
      status: {
        type: String,
        enum: ["pending", "member_confirmed", "confirmed", "overdue", "waived"],
        default: "pending"
      },
      memberConfirmedAt: { type: Date, default: null },
      adminConfirmedAt: { type: Date, default: null },
      confirmationToken: { type: String, default: null },
      notes: { type: String, default: null }
    });
    reminderEntrySchema = new import_mongoose4.Schema({
      sentAt: { type: Date, default: Date.now },
      channel: { type: String, enum: ["email", "telegram"], required: true },
      recipientCount: { type: Number, required: true },
      type: { type: String, enum: ["initial", "follow_up"], default: "initial" }
    });
    billingPeriodSchema = new import_mongoose4.Schema(
      {
        group: { type: import_mongoose4.Schema.Types.ObjectId, ref: "Group", required: true },
        periodStart: { type: Date, required: true },
        collectionOpensAt: { type: Date, required: false },
        periodEnd: { type: Date, required: true },
        periodLabel: { type: String, required: true },
        totalPrice: { type: Number, required: true },
        currency: { type: String, default: "EUR" },
        priceNote: { type: String, default: null },
        payments: [memberPaymentSchema],
        reminders: [reminderEntrySchema],
        isFullyPaid: { type: Boolean, default: false }
      },
      { timestamps: true }
    );
    billingPeriodSchema.index({ group: 1, periodStart: 1 }, { unique: true });
    billingPeriodSchema.index({ "payments.status": 1 });
    billingPeriodSchema.index(
      { "payments.confirmationToken": 1 },
      { sparse: true }
    );
    BillingPeriod = import_mongoose4.default.models.BillingPeriod || import_mongoose4.default.model("BillingPeriod", billingPeriodSchema);
  }
});

// src/models/price-history.ts
var import_mongoose5, priceHistorySchema, PriceHistory;
var init_price_history = __esm({
  "src/models/price-history.ts"() {
    "use strict";
    import_mongoose5 = __toESM(require("mongoose"));
    priceHistorySchema = new import_mongoose5.Schema(
      {
        group: { type: import_mongoose5.Schema.Types.ObjectId, ref: "Group", required: true },
        price: { type: Number, required: true },
        previousPrice: { type: Number, default: null },
        currency: { type: String, default: "EUR" },
        effectiveFrom: { type: Date, required: true },
        note: { type: String, default: null },
        membersNotified: { type: Boolean, default: false },
        createdBy: { type: import_mongoose5.Schema.Types.ObjectId, ref: "User", required: true }
      },
      { timestamps: true }
    );
    priceHistorySchema.index({ group: 1, effectiveFrom: 1 });
    PriceHistory = import_mongoose5.default.models.PriceHistory || import_mongoose5.default.model("PriceHistory", priceHistorySchema);
  }
});

// src/models/notification.ts
var import_mongoose6, notificationSchema, Notification;
var init_notification = __esm({
  "src/models/notification.ts"() {
    "use strict";
    import_mongoose6 = __toESM(require("mongoose"));
    notificationSchema = new import_mongoose6.Schema(
      {
        recipient: {
          type: import_mongoose6.Schema.Types.ObjectId,
          ref: "User",
          default: null
        },
        recipientEmail: { type: String, required: true },
        group: { type: import_mongoose6.Schema.Types.ObjectId, ref: "Group", default: null },
        billingPeriod: {
          type: import_mongoose6.Schema.Types.ObjectId,
          ref: "BillingPeriod",
          default: null
        },
        type: {
          type: String,
          enum: [
            "payment_reminder",
            "payment_confirmed",
            "admin_confirmation_request",
            "price_change",
            "price_adjustment",
            "announcement",
            "invite",
            "follow_up",
            "member_message"
          ],
          required: true
        },
        channel: {
          type: String,
          enum: ["email", "telegram"],
          required: true
        },
        status: {
          type: String,
          enum: ["sent", "failed", "pending"],
          default: "pending"
        },
        subject: { type: String, default: null },
        preview: { type: String, required: true },
        emailParams: { type: import_mongoose6.Schema.Types.Mixed, default: null },
        externalId: { type: String, default: null },
        error: { type: String, default: null },
        deliveredAt: { type: Date, default: null }
      },
      { timestamps: true }
    );
    notificationSchema.index({ recipient: 1 });
    notificationSchema.index({ group: 1 });
    notificationSchema.index({ type: 1 });
    notificationSchema.index({ createdAt: 1 });
    Notification = import_mongoose6.default.models.Notification || import_mongoose6.default.model("Notification", notificationSchema);
  }
});

// src/models/audit-event.ts
var import_mongoose7, auditEventSchema, AuditEvent;
var init_audit_event = __esm({
  "src/models/audit-event.ts"() {
    "use strict";
    import_mongoose7 = __toESM(require("mongoose"));
    auditEventSchema = new import_mongoose7.Schema(
      {
        actor: { type: import_mongoose7.Schema.Types.ObjectId, ref: "User", required: true },
        actorName: { type: String, required: true },
        action: {
          type: String,
          enum: [
            "payment_confirmed",
            "payment_self_confirmed",
            "payment_rejected",
            "payment_waived",
            "group_created",
            "group_edited",
            "member_added",
            "member_removed",
            "member_updated",
            "billing_period_created"
          ],
          required: true
        },
        group: { type: import_mongoose7.Schema.Types.ObjectId, ref: "Group", default: null },
        billingPeriod: {
          type: import_mongoose7.Schema.Types.ObjectId,
          ref: "BillingPeriod",
          default: null
        },
        targetMember: {
          type: import_mongoose7.Schema.Types.ObjectId,
          ref: "Group.members",
          default: null
        },
        metadata: { type: import_mongoose7.Schema.Types.Mixed, default: {} }
      },
      { timestamps: true }
    );
    auditEventSchema.index({ actor: 1 });
    auditEventSchema.index({ group: 1 });
    auditEventSchema.index({ action: 1 });
    auditEventSchema.index({ createdAt: -1 });
    AuditEvent = import_mongoose7.default.models.AuditEvent || import_mongoose7.default.model("AuditEvent", auditEventSchema);
  }
});

// src/models/settings.ts
var import_mongoose8, settingsSchema, Settings;
var init_settings = __esm({
  "src/models/settings.ts"() {
    "use strict";
    import_mongoose8 = __toESM(require("mongoose"));
    settingsSchema = new import_mongoose8.Schema(
      {
        key: { type: String, required: true, unique: true },
        value: { type: String, default: null },
        category: {
          type: String,
          enum: ["general", "email", "telegram", "notifications", "security", "cron", "plugin"],
          required: true
        },
        isSecret: { type: Boolean, default: false },
        label: { type: String, required: true },
        description: { type: String, required: true }
      },
      { timestamps: true }
    );
    settingsSchema.index({ category: 1 });
    Settings = import_mongoose8.default.models.Settings || import_mongoose8.default.model("Settings", settingsSchema);
  }
});

// src/models/scheduled-task.ts
var import_mongoose9, scheduledTaskSchema, ScheduledTask;
var init_scheduled_task = __esm({
  "src/models/scheduled-task.ts"() {
    "use strict";
    import_mongoose9 = __toESM(require("mongoose"));
    scheduledTaskSchema = new import_mongoose9.Schema(
      {
        type: {
          type: String,
          enum: [
            "payment_reminder",
            "aggregated_payment_reminder",
            "admin_confirmation_request"
          ],
          required: true
        },
        status: {
          type: String,
          enum: ["pending", "locked", "completed", "failed", "cancelled"],
          default: "pending"
        },
        runAt: { type: Date, required: true },
        lockedAt: { type: Date, default: null },
        lockedBy: { type: String, default: null },
        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        lastError: { type: String, default: null },
        completedAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
        idempotencyKey: { type: String, required: true },
        payload: {
          type: import_mongoose9.Schema.Types.Mixed,
          required: true
        }
      },
      { timestamps: true }
    );
    scheduledTaskSchema.index({ status: 1, runAt: 1 });
    scheduledTaskSchema.index({ lockedAt: 1 }, { sparse: true });
    scheduledTaskSchema.index({ idempotencyKey: 1 }, { unique: true });
    scheduledTaskSchema.index({ type: 1, "payload.groupId": 1 });
    scheduledTaskSchema.index({ createdAt: 1 });
    ScheduledTask = import_mongoose9.default.models.ScheduledTask || import_mongoose9.default.model("ScheduledTask", scheduledTaskSchema);
  }
});

// src/models/index.ts
var init_models = __esm({
  "src/models/index.ts"() {
    "use strict";
    init_user();
    init_group();
    init_billing_period();
    init_price_history();
    init_notification();
    init_audit_event();
    init_settings();
    init_scheduled_task();
  }
});

// src/lib/settings/definitions.ts
function getSettingsDefinition(key) {
  return settingsDefinitionMap.get(key) ?? null;
}
var settingsDefinitions, settingsDefinitionMap;
var init_definitions = __esm({
  "src/lib/settings/definitions.ts"() {
    "use strict";
    settingsDefinitions = [
      {
        key: "general.appUrl",
        category: "general",
        label: "App URL",
        description: "Base URL used for links in emails, redirects, and callbacks.",
        isSecret: false,
        envVar: "APP_URL",
        defaultValue: "http://localhost:3054"
      },
      {
        key: "email.apiKey",
        category: "email",
        label: "Resend API key",
        description: "API key used to send transactional emails through Resend.",
        isSecret: true,
        envVar: "RESEND_API_KEY"
      },
      {
        key: "email.fromAddress",
        category: "email",
        label: "From address",
        description: "Sender address shown on outgoing emails (e.g. SubsTrack <noreply@yourdomain.com>).",
        isSecret: false,
        envVar: "EMAIL_FROM",
        defaultValue: "sub5tr4cker <noreply@example.com>"
      },
      {
        key: "email.replyToAddress",
        category: "email",
        label: "Reply-to address",
        description: "Optional reply-to address so recipients can reply to a specific inbox.",
        isSecret: false,
        envVar: "EMAIL_REPLY_TO"
      },
      {
        key: "telegram.botToken",
        category: "telegram",
        label: "Telegram bot token",
        description: "BotFather token used to receive webhook updates and send messages.",
        isSecret: true,
        envVar: "TELEGRAM_BOT_TOKEN"
      },
      {
        key: "telegram.webhookSecret",
        category: "telegram",
        label: "Telegram webhook secret",
        description: "Secret token used to validate webhook calls from Telegram.",
        isSecret: true,
        envVar: "TELEGRAM_WEBHOOK_SECRET"
      },
      {
        key: "notifications.aggregateReminders",
        category: "notifications",
        label: "Aggregate automated reminders by user",
        description: "When enabled, cron reminders group members by email (one notification per user). Dashboard 'Notify all unpaid' always sends one combined reminder per member email.",
        isSecret: false,
        envVar: "AGGREGATE_REMINDERS",
        defaultValue: "false"
      },
      {
        key: "security.confirmationSecret",
        category: "security",
        label: "Confirmation token secret",
        description: "Secret used to sign member payment confirmation links.",
        isSecret: true,
        envVar: "CONFIRMATION_SECRET"
      },
      {
        key: "security.telegramLinkSecret",
        category: "security",
        label: "Telegram link secret",
        description: "Secret used to sign Telegram account-link tokens.",
        isSecret: true,
        envVar: "TELEGRAM_LINK_SECRET"
      },
      {
        key: "security.cronSecret",
        category: "cron",
        label: "Cron secret",
        description: "Shared secret required by protected cron endpoints.",
        isSecret: true,
        envVar: "CRON_SECRET"
      }
    ];
    settingsDefinitionMap = new Map(
      settingsDefinitions.map((definition) => [definition.key, definition])
    );
  }
});

// src/lib/billing/collection-window.ts
function collectionWindowOpenFilter(now2) {
  return {
    $expr: {
      $lte: [{ $ifNull: ["$collectionOpensAt", "$periodStart"] }, now2]
    }
  };
}
function getFirstReminderEligibleAt(collectionOpensAt, gracePeriodDays) {
  const d = new Date(collectionOpensAt);
  d.setDate(d.getDate() + gracePeriodDays);
  return d;
}
function resolveCollectionOpensAt(period) {
  return period.collectionOpensAt ?? period.periodStart;
}
var init_collection_window = __esm({
  "src/lib/billing/collection-window.ts"() {
    "use strict";
  }
});

// src/lib/storage/mongoose-adapter.ts
var mongoose_adapter_exports = {};
__export(mongoose_adapter_exports, {
  MongooseAdapter: () => MongooseAdapter
});
function toId(v) {
  if (v instanceof import_mongoose10.Types.ObjectId) return v.toString();
  if (typeof v === "string") return v;
  return String(v);
}
function toIdOrNull(v) {
  if (!v) return null;
  return toId(v);
}
function userToStorage(u) {
  return {
    id: toId(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerified: u.emailVerified,
    image: u.image,
    hashedPassword: u.hashedPassword,
    telegram: u.telegram ? {
      chatId: u.telegram.chatId,
      username: u.telegram.username,
      linkedAt: u.telegram.linkedAt
    } : null,
    telegramLinkCode: u.telegramLinkCode ? { code: u.telegramLinkCode.code, expiresAt: u.telegramLinkCode.expiresAt } : null,
    notificationPreferences: {
      email: u.notificationPreferences?.email ?? true,
      telegram: u.notificationPreferences?.telegram ?? false,
      reminderFrequency: u.notificationPreferences?.reminderFrequency ?? "every_3_days"
    },
    welcomeEmailSentAt: u.welcomeEmailSentAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
}
function memberToStorage(m) {
  return {
    id: toId(m._id),
    userId: toIdOrNull(m.user),
    email: m.email,
    nickname: m.nickname,
    role: m.role,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
    isActive: m.isActive,
    customAmount: m.customAmount,
    acceptedAt: m.acceptedAt,
    unsubscribedFromEmail: m.unsubscribedFromEmail,
    billingStartsAt: m.billingStartsAt
  };
}
function groupToStorage(g) {
  return {
    id: toId(g._id),
    name: g.name,
    description: g.description,
    adminId: toId(g.admin),
    service: {
      name: g.service.name,
      icon: g.service.icon,
      url: g.service.url,
      accentColor: g.service.accentColor,
      emailTheme: g.service.emailTheme
    },
    billing: {
      mode: g.billing.mode,
      currentPrice: g.billing.currentPrice,
      currency: g.billing.currency,
      cycleDay: g.billing.cycleDay,
      cycleType: g.billing.cycleType,
      adminIncludedInSplit: g.billing.adminIncludedInSplit,
      fixedMemberAmount: g.billing.fixedMemberAmount,
      gracePeriodDays: g.billing.gracePeriodDays,
      paymentInAdvanceDays: g.billing.paymentInAdvanceDays
    },
    payment: {
      platform: g.payment.platform,
      link: g.payment.link,
      instructions: g.payment.instructions,
      stripeAccountId: g.payment.stripeAccountId
    },
    notifications: {
      remindersEnabled: g.notifications.remindersEnabled,
      followUpsEnabled: g.notifications.followUpsEnabled,
      priceChangeEnabled: g.notifications.priceChangeEnabled,
      saveEmailParams: g.notifications.saveEmailParams
    },
    members: g.members.map(memberToStorage),
    announcements: {
      notifyOnPriceChange: g.announcements?.notifyOnPriceChange ?? true,
      extraText: g.announcements?.extraText ?? null
    },
    telegramGroup: {
      chatId: g.telegramGroup?.chatId ?? null,
      linkedAt: g.telegramGroup?.linkedAt ?? null
    },
    isActive: g.isActive,
    inviteCode: g.inviteCode,
    inviteLinkEnabled: g.inviteLinkEnabled,
    initializedAt: g.initializedAt,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt
  };
}
function paymentToStorage(p7) {
  return {
    id: toId(p7._id),
    memberId: toId(p7.memberId),
    memberEmail: p7.memberEmail,
    memberNickname: p7.memberNickname,
    amount: p7.amount,
    adjustedAmount: p7.adjustedAmount,
    adjustmentReason: p7.adjustmentReason,
    status: p7.status,
    memberConfirmedAt: p7.memberConfirmedAt,
    adminConfirmedAt: p7.adminConfirmedAt,
    confirmationToken: p7.confirmationToken,
    notes: p7.notes
  };
}
function periodToStorage(p7) {
  return {
    id: toId(p7._id),
    groupId: toId(p7.group),
    periodStart: p7.periodStart,
    collectionOpensAt: p7.collectionOpensAt ?? null,
    periodEnd: p7.periodEnd,
    periodLabel: p7.periodLabel,
    totalPrice: p7.totalPrice,
    currency: p7.currency,
    priceNote: p7.priceNote,
    payments: p7.payments.map(paymentToStorage),
    reminders: p7.reminders.map((r) => ({
      sentAt: r.sentAt,
      channel: r.channel,
      recipientCount: r.recipientCount,
      type: r.type
    })),
    isFullyPaid: p7.isFullyPaid,
    createdAt: p7.createdAt,
    updatedAt: p7.updatedAt
  };
}
function notificationToStorage(n) {
  return {
    id: toId(n._id),
    recipientId: toIdOrNull(n.recipient),
    recipientEmail: n.recipientEmail,
    groupId: toIdOrNull(n.group),
    billingPeriodId: toIdOrNull(n.billingPeriod),
    type: n.type,
    channel: n.channel,
    status: n.status,
    subject: n.subject,
    preview: n.preview,
    emailParams: n.emailParams ?? null,
    externalId: n.externalId,
    error: n.error,
    deliveredAt: n.deliveredAt,
    createdAt: n.createdAt
  };
}
function auditEventToStorage(event) {
  return {
    id: toId(event._id),
    actorId: toId(event.actor),
    actorName: event.actorName,
    action: event.action,
    groupId: toIdOrNull(event.group),
    billingPeriodId: toIdOrNull(event.billingPeriod),
    targetMemberId: toIdOrNull(event.targetMember),
    metadata: event.metadata ?? {},
    createdAt: event.createdAt
  };
}
function taskToStorage(t) {
  return {
    id: toId(t._id),
    type: t.type,
    status: t.status,
    runAt: t.runAt,
    lockedAt: t.lockedAt,
    lockedBy: t.lockedBy,
    attempts: t.attempts,
    maxAttempts: t.maxAttempts,
    lastError: t.lastError,
    completedAt: t.completedAt,
    cancelledAt: t.cancelledAt ?? null,
    idempotencyKey: t.idempotencyKey,
    payload: t.payload,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  };
}
function priceHistoryToStorage(p7) {
  return {
    id: toId(p7._id),
    groupId: toId(p7.group),
    price: p7.price,
    previousPrice: p7.previousPrice,
    currency: p7.currency,
    effectiveFrom: p7.effectiveFrom,
    note: p7.note,
    membersNotified: p7.membersNotified,
    createdBy: toId(p7.createdBy),
    createdAt: p7.createdAt
  };
}
var import_mongoose10, DEFAULT_LOCK_TTL_MS, DEFAULT_BATCH_SIZE, MongooseAdapter;
var init_mongoose_adapter = __esm({
  "src/lib/storage/mongoose-adapter.ts"() {
    "use strict";
    import_mongoose10 = require("mongoose");
    init_mongoose();
    init_models();
    init_definitions();
    init_collection_window();
    DEFAULT_LOCK_TTL_MS = 5 * 60 * 1e3;
    DEFAULT_BATCH_SIZE = 50;
    MongooseAdapter = class {
      async initialize() {
        await dbConnect();
      }
      async close() {
      }
      // ── users ──────────────────────────────────────────────────────────────────
      async getUser(id) {
        await dbConnect();
        const u = await User.findById(id).lean();
        return u ? userToStorage(u) : null;
      }
      async getUserByEmail(email) {
        await dbConnect();
        const u = await User.findOne({ email: email.toLowerCase().trim() }).lean();
        return u ? userToStorage(u) : null;
      }
      async getUserByTelegramChatId(chatId) {
        await dbConnect();
        const u = await User.findOne({ "telegram.chatId": chatId }).lean();
        return u ? userToStorage(u) : null;
      }
      async updateUser(id, data) {
        await dbConnect();
        const updated = await User.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
        if (!updated) throw new Error(`user not found: ${id}`);
        return userToStorage(updated);
      }
      async createUser(data) {
        await dbConnect();
        const u = await User.create({
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          role: data.role,
          hashedPassword: data.hashedPassword,
          notificationPreferences: data.notificationPreferences
        });
        const lean = await User.findById(u._id).lean();
        if (!lean) throw new Error("user create failed");
        return userToStorage(lean);
      }
      async countUsers() {
        await dbConnect();
        return User.countDocuments();
      }
      async getAdminUserCount() {
        await dbConnect();
        return User.countDocuments({ role: "admin" });
      }
      async promoteOldestUserToAdmin() {
        await dbConnect();
        const oldest = await User.findOne().sort({ createdAt: 1 }).select("_id").lean();
        if (!oldest?._id) return;
        await User.updateOne({ _id: oldest._id }, { $set: { role: "admin" } });
      }
      async linkTelegramAccountWithLinkCode(params) {
        await dbConnect();
        const { code, chatId, username, now: now2 } = params;
        const user = await User.findOneAndUpdate(
          {
            "telegramLinkCode.code": code,
            "telegramLinkCode.expiresAt": { $gt: now2 }
          },
          {
            $set: {
              telegram: { chatId, username, linkedAt: now2 },
              "notificationPreferences.telegram": true
            },
            $unset: { telegramLinkCode: "" }
          },
          { new: true }
        ).lean();
        return user ? userToStorage(user) : null;
      }
      async tryClaimWelcomeEmailSentAt(userId, at) {
        await dbConnect();
        const prev = await User.findOneAndUpdate(
          { _id: userId, welcomeEmailSentAt: null },
          { $set: { welcomeEmailSentAt: at } },
          { new: false }
        ).lean();
        return prev != null;
      }
      // ── groups ─────────────────────────────────────────────────────────────────
      async createGroup(data) {
        await dbConnect();
        const members = data.members.map((m) => ({
          user: m.userId ? new import_mongoose10.Types.ObjectId(m.userId) : null,
          email: m.email,
          nickname: m.nickname,
          role: m.role,
          joinedAt: m.joinedAt,
          leftAt: m.leftAt,
          isActive: m.isActive,
          customAmount: m.customAmount,
          acceptedAt: m.acceptedAt,
          unsubscribedFromEmail: m.unsubscribedFromEmail,
          billingStartsAt: m.billingStartsAt
        }));
        const g = await Group.create({
          name: data.name,
          description: data.description,
          admin: new import_mongoose10.Types.ObjectId(data.adminId),
          service: data.service,
          billing: data.billing,
          payment: data.payment,
          notifications: data.notifications,
          members,
          announcements: data.announcements,
          telegramGroup: data.telegramGroup,
          isActive: data.isActive,
          inviteCode: data.inviteCode,
          inviteLinkEnabled: data.inviteLinkEnabled,
          initializedAt: data.initializedAt
        });
        return groupToStorage(g);
      }
      async getGroup(id) {
        await dbConnect();
        const g = await Group.findById(id).lean();
        return g ? groupToStorage(g) : null;
      }
      async getGroupWithMemberUsers(id) {
        await dbConnect();
        const g = await Group.findById(id).populate({
          path: "members.user",
          model: "User",
          select: "telegram notificationPreferences"
        }).lean();
        if (!g) return null;
        const base = groupToStorage(g);
        const memberUsers = /* @__PURE__ */ new Map();
        for (const m of g.members) {
          const memberId = toId(m._id);
          if (m.user && typeof m.user === "object" && "notificationPreferences" in m.user) {
            const u = m.user;
            memberUsers.set(memberId, {
              telegram: u.telegram ? { chatId: u.telegram.chatId, username: u.telegram.username, linkedAt: u.telegram.linkedAt } : null,
              notificationPreferences: {
                email: u.notificationPreferences?.email ?? true,
                telegram: u.notificationPreferences?.telegram ?? false,
                reminderFrequency: u.notificationPreferences?.reminderFrequency ?? "every_3_days"
              }
            });
          } else {
            memberUsers.set(memberId, null);
          }
        }
        return { ...base, memberUsers };
      }
      async listGroupsForUser(userId, email) {
        await dbConnect();
        const groups = await Group.find({
          isActive: true,
          $or: [
            { admin: userId },
            { "members.user": userId },
            { "members.email": email, "members.isActive": true }
          ]
        }).lean();
        return groups.map(groupToStorage);
      }
      async listAllActiveGroups() {
        await dbConnect();
        const groups = await Group.find({ isActive: true }).lean();
        return groups.map(groupToStorage);
      }
      async updateGroup(id, data) {
        await dbConnect();
        const setFields = {};
        if (data.name !== void 0) setFields.name = data.name;
        if (data.description !== void 0) setFields.description = data.description;
        if (data.service !== void 0) setFields.service = data.service;
        if (data.billing !== void 0) setFields.billing = data.billing;
        if (data.payment !== void 0) setFields.payment = data.payment;
        if (data.notifications !== void 0) setFields.notifications = data.notifications;
        if (data.announcements !== void 0) setFields.announcements = data.announcements;
        if (data.telegramGroup !== void 0) setFields.telegramGroup = data.telegramGroup;
        if (data.isActive !== void 0) setFields.isActive = data.isActive;
        if (data.inviteCode !== void 0) setFields.inviteCode = data.inviteCode;
        if (data.inviteLinkEnabled !== void 0) setFields.inviteLinkEnabled = data.inviteLinkEnabled;
        if (data.initializedAt !== void 0) setFields.initializedAt = data.initializedAt;
        if (data.members !== void 0) {
          setFields.members = data.members.map((m) => ({
            _id: m.id ? new import_mongoose10.Types.ObjectId(m.id) : void 0,
            user: m.userId ? new import_mongoose10.Types.ObjectId(m.userId) : null,
            email: m.email,
            nickname: m.nickname,
            role: m.role,
            joinedAt: m.joinedAt,
            leftAt: m.leftAt,
            isActive: m.isActive,
            customAmount: m.customAmount,
            acceptedAt: m.acceptedAt,
            unsubscribedFromEmail: m.unsubscribedFromEmail,
            billingStartsAt: m.billingStartsAt
          }));
        }
        const updated = await Group.findByIdAndUpdate(id, { $set: setFields }, { new: true }).lean();
        if (!updated) throw new Error(`group not found: ${id}`);
        return groupToStorage(updated);
      }
      async softDeleteGroup(id) {
        await dbConnect();
        await Group.findByIdAndUpdate(id, { $set: { isActive: false } });
      }
      async findGroupByInviteCode(code) {
        await dbConnect();
        const g = await Group.findOne({ inviteCode: code }).lean();
        return g ? groupToStorage(g) : null;
      }
      async findActiveGroupForMemberInvitation(params) {
        await dbConnect();
        const { groupId, memberId } = params;
        if (groupId) {
          const g = await Group.findOne({ _id: groupId, isActive: true }).lean();
          if (!g) return null;
          const storage = groupToStorage(g);
          const m = storage.members.find(
            (mm) => mm.id === memberId && mm.isActive && !mm.leftAt
          );
          return m ? storage : null;
        }
        if (import_mongoose10.Types.ObjectId.isValid(memberId)) {
          const g = await Group.findOne({
            isActive: true,
            "members._id": new import_mongoose10.Types.ObjectId(memberId)
          }).lean();
          return g ? groupToStorage(g) : null;
        }
        return null;
      }
      // ── billing periods ────────────────────────────────────────────────────────
      async createBillingPeriod(data) {
        await dbConnect();
        const payments = data.payments.map((p7) => ({
          memberId: new import_mongoose10.Types.ObjectId(p7.memberId),
          memberEmail: p7.memberEmail,
          memberNickname: p7.memberNickname,
          amount: p7.amount,
          adjustedAmount: p7.adjustedAmount,
          adjustmentReason: p7.adjustmentReason,
          status: p7.status,
          memberConfirmedAt: p7.memberConfirmedAt,
          adminConfirmedAt: p7.adminConfirmedAt,
          confirmationToken: p7.confirmationToken,
          notes: p7.notes
        }));
        const period = await BillingPeriod.create({
          group: new import_mongoose10.Types.ObjectId(data.groupId),
          periodStart: data.periodStart,
          collectionOpensAt: data.collectionOpensAt,
          periodEnd: data.periodEnd,
          periodLabel: data.periodLabel,
          totalPrice: data.totalPrice,
          currency: data.currency,
          priceNote: data.priceNote,
          payments,
          reminders: data.reminders,
          isFullyPaid: data.isFullyPaid
        });
        return periodToStorage(period);
      }
      async getBillingPeriod(id, groupId) {
        await dbConnect();
        const p7 = await BillingPeriod.findOne({ _id: id, group: groupId }).lean();
        return p7 ? periodToStorage(p7) : null;
      }
      async getBillingPeriodByStart(groupId, periodStart) {
        await dbConnect();
        const p7 = await BillingPeriod.findOne({ group: groupId, periodStart }).lean();
        return p7 ? periodToStorage(p7) : null;
      }
      async getBillingPeriodById(id) {
        await dbConnect();
        const p7 = await BillingPeriod.findById(id).lean();
        return p7 ? periodToStorage(p7) : null;
      }
      async getOpenBillingPeriods(filter) {
        await dbConnect();
        const query = {
          ...collectionWindowOpenFilter(filter.asOf)
        };
        if (filter.unpaidOnly) query.isFullyPaid = false;
        if (filter.groupIds && filter.groupIds.length > 0) {
          query.group = { $in: filter.groupIds.map((id) => new import_mongoose10.Types.ObjectId(id)) };
        }
        const periods = await BillingPeriod.find(query).lean();
        return periods.map(periodToStorage);
      }
      async getPeriodsForGroup(groupId) {
        await dbConnect();
        const periods = await BillingPeriod.find({ group: groupId }).sort({ periodStart: -1 }).lean();
        return periods.map(periodToStorage);
      }
      async listUnpaidPeriodsWithStartBefore(asOf) {
        await dbConnect();
        const periods = await BillingPeriod.find({
          isFullyPaid: false,
          periodStart: { $lt: asOf }
        }).lean();
        return periods.map(periodToStorage);
      }
      async getFuturePeriods(groupId, afterDate) {
        await dbConnect();
        const periods = await BillingPeriod.find({
          group: groupId,
          periodStart: { $gt: afterDate }
        }).sort({ periodStart: 1 }).lean();
        return periods.map(periodToStorage);
      }
      async updateBillingPeriod(id, data) {
        await dbConnect();
        const setFields = {};
        if (data.periodStart !== void 0) setFields.periodStart = data.periodStart;
        if (data.collectionOpensAt !== void 0) setFields.collectionOpensAt = data.collectionOpensAt;
        if (data.periodEnd !== void 0) setFields.periodEnd = data.periodEnd;
        if (data.periodLabel !== void 0) setFields.periodLabel = data.periodLabel;
        if (data.totalPrice !== void 0) setFields.totalPrice = data.totalPrice;
        if (data.currency !== void 0) setFields.currency = data.currency;
        if (data.priceNote !== void 0) setFields.priceNote = data.priceNote;
        if (data.isFullyPaid !== void 0) setFields.isFullyPaid = data.isFullyPaid;
        if (data.reminders !== void 0) setFields.reminders = data.reminders;
        if (data.payments !== void 0) {
          setFields.payments = data.payments.map((p7) => ({
            _id: p7.id ? new import_mongoose10.Types.ObjectId(p7.id) : void 0,
            memberId: new import_mongoose10.Types.ObjectId(p7.memberId),
            memberEmail: p7.memberEmail,
            memberNickname: p7.memberNickname,
            amount: p7.amount,
            adjustedAmount: p7.adjustedAmount,
            adjustmentReason: p7.adjustmentReason,
            status: p7.status,
            memberConfirmedAt: p7.memberConfirmedAt,
            adminConfirmedAt: p7.adminConfirmedAt,
            confirmationToken: p7.confirmationToken,
            notes: p7.notes
          }));
        }
        const updated = await BillingPeriod.findByIdAndUpdate(id, { $set: setFields }, { new: true }).lean();
        if (!updated) throw new Error(`billing period not found: ${id}`);
        return periodToStorage(updated);
      }
      async deleteBillingPeriod(id, groupId) {
        await dbConnect();
        await BillingPeriod.findOneAndDelete({ _id: id, group: groupId });
      }
      async updatePaymentStatus(periodId, memberId, update) {
        await dbConnect();
        const period = await BillingPeriod.findById(periodId);
        if (!period) throw new Error(`billing period not found: ${periodId}`);
        const payment = period.payments.find(
          (p7) => p7.memberId.toString() === memberId
        );
        if (!payment) throw new Error(`payment not found for member ${memberId} in period ${periodId}`);
        if (update.status !== void 0) payment.status = update.status;
        if (update.memberConfirmedAt !== void 0) payment.memberConfirmedAt = update.memberConfirmedAt;
        if (update.adminConfirmedAt !== void 0) payment.adminConfirmedAt = update.adminConfirmedAt;
        if (update.confirmationToken !== void 0) payment.confirmationToken = update.confirmationToken;
        if (update.notes !== void 0) payment.notes = update.notes;
        if (update.adjustedAmount !== void 0) payment.adjustedAmount = update.adjustedAmount;
        if (update.adjustmentReason !== void 0) payment.adjustmentReason = update.adjustmentReason;
        period.isFullyPaid = period.payments.every(
          (p7) => p7.status === "confirmed" || p7.status === "waived"
        );
        await period.save();
        return periodToStorage(period);
      }
      async getBillingPeriodByConfirmationToken(token) {
        await dbConnect();
        const period = await BillingPeriod.findOne({
          "payments.confirmationToken": token
        });
        if (!period) return null;
        const paymentIndex = period.payments.findIndex(
          (p7) => p7.confirmationToken === token
        );
        if (paymentIndex === -1) return null;
        return { period: periodToStorage(period), paymentIndex };
      }
      // ── notifications ──────────────────────────────────────────────────────────
      async logNotification(data) {
        await dbConnect();
        const n = await Notification.create({
          recipient: data.recipientId ? new import_mongoose10.Types.ObjectId(data.recipientId) : null,
          recipientEmail: data.recipientEmail,
          group: data.groupId ? new import_mongoose10.Types.ObjectId(data.groupId) : null,
          billingPeriod: data.billingPeriodId ? new import_mongoose10.Types.ObjectId(data.billingPeriodId) : null,
          type: data.type,
          channel: data.channel,
          status: data.status,
          subject: data.subject ?? null,
          preview: data.preview,
          emailParams: data.emailParams ?? null,
          externalId: data.externalId ?? null,
          error: data.error ?? null,
          deliveredAt: data.deliveredAt ?? null
        });
        return notificationToStorage(n);
      }
      async getNotificationsForGroup(groupId, limit = 50) {
        await dbConnect();
        const ns = await Notification.find({ group: groupId }).sort({ createdAt: -1 }).limit(limit).lean();
        return ns.map(notificationToStorage);
      }
      async getNotificationById(id) {
        await dbConnect();
        const n = await Notification.findById(id).lean();
        return n ? notificationToStorage(n) : null;
      }
      async listNotifications(options) {
        await dbConnect();
        const { groupIds, type, channel, limit, offset } = options;
        if (!groupIds.length) {
          return { notifications: [], total: 0 };
        }
        const filter = {
          group: { $in: groupIds.map((gid) => new import_mongoose10.Types.ObjectId(gid)) }
        };
        if (type) filter.type = type;
        if (channel) filter.channel = channel;
        let query = Notification.find(filter).sort({ createdAt: -1 });
        if (offset !== void 0) query = query.skip(offset);
        if (limit !== void 0) query = query.limit(limit);
        const [total, rows] = await Promise.all([
          Notification.countDocuments(filter),
          query.lean()
        ]);
        return { total, notifications: rows.map(notificationToStorage) };
      }
      async logAudit(data) {
        await dbConnect();
        const event = await AuditEvent.create({
          actor: new import_mongoose10.Types.ObjectId(data.actorId),
          actorName: data.actorName,
          action: data.action,
          group: data.groupId ? new import_mongoose10.Types.ObjectId(data.groupId) : void 0,
          billingPeriod: data.billingPeriodId ? new import_mongoose10.Types.ObjectId(data.billingPeriodId) : void 0,
          targetMember: data.targetMemberId ? data.targetMemberId : void 0,
          metadata: data.metadata ?? {}
        });
        return auditEventToStorage(event.toObject());
      }
      async listAuditEvents(options = {}) {
        await dbConnect();
        const filter = {};
        if (options.groupIds?.length) {
          filter.group = { $in: options.groupIds.map((id) => new import_mongoose10.Types.ObjectId(id)) };
        }
        const unbounded = options.unbounded === true;
        const limit = unbounded ? void 0 : options.limit ?? 50;
        const offset = unbounded ? void 0 : options.offset ?? 0;
        let findQuery = AuditEvent.find(filter).sort({ createdAt: -1 });
        if (offset !== void 0) findQuery = findQuery.skip(offset);
        if (limit !== void 0) findQuery = findQuery.limit(limit);
        const [total, rows] = await Promise.all([
          AuditEvent.countDocuments(filter),
          findQuery.lean()
        ]);
        return {
          total,
          events: rows.map(
            (row) => auditEventToStorage(row)
          )
        };
      }
      // ── scheduled tasks ────────────────────────────────────────────────────────
      async enqueueTask(data) {
        await dbConnect();
        const existing = await ScheduledTask.findOne({ idempotencyKey: data.idempotencyKey });
        if (existing) return null;
        const t = await ScheduledTask.create({
          type: data.type,
          status: "pending",
          runAt: data.runAt,
          payload: data.payload,
          idempotencyKey: data.idempotencyKey,
          maxAttempts: data.maxAttempts ?? 5
        });
        return taskToStorage(t);
      }
      async claimTasks(workerId, options = {}) {
        await dbConnect();
        const limit = options.limit ?? DEFAULT_BATCH_SIZE;
        const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
        const now2 = /* @__PURE__ */ new Date();
        const staleThreshold = new Date(now2.getTime() - lockTtlMs);
        if (options.recoverStaleLocks) {
          await ScheduledTask.updateMany(
            { status: "locked", lockedAt: { $lt: staleThreshold } },
            { $set: { status: "pending", lockedAt: null, lockedBy: null } }
          );
        }
        const tasks = [];
        const cursor = ScheduledTask.find({ status: "pending", runAt: { $lte: now2 } }).sort({ runAt: 1 }).limit(limit).cursor();
        for await (const task of cursor) {
          const updated = await ScheduledTask.findOneAndUpdate(
            { _id: task._id, status: "pending" },
            { $set: { status: "locked", lockedAt: now2, lockedBy: workerId } },
            { returnDocument: "after" }
          );
          if (updated) tasks.push(taskToStorage(updated));
        }
        return tasks;
      }
      async completeTask(taskId) {
        await dbConnect();
        await ScheduledTask.findByIdAndUpdate(taskId, {
          $set: { status: "completed", completedAt: /* @__PURE__ */ new Date(), lockedAt: null, lockedBy: null }
        });
      }
      async failTask(taskId, error, attempts, maxAttempts) {
        await dbConnect();
        if (attempts >= maxAttempts) {
          await ScheduledTask.findByIdAndUpdate(taskId, {
            $set: { status: "failed", lastError: error, attempts, lockedAt: null, lockedBy: null }
          });
          return;
        }
        const backoffMs = Math.min(2 ** attempts * 60 * 1e3, 24 * 60 * 60 * 1e3);
        await ScheduledTask.findByIdAndUpdate(taskId, {
          $set: {
            status: "pending",
            runAt: new Date(Date.now() + backoffMs),
            lastError: error,
            attempts,
            lockedAt: null,
            lockedBy: null
          }
        });
      }
      async releaseTask(taskId) {
        await dbConnect();
        await ScheduledTask.findByIdAndUpdate(taskId, {
          $set: { status: "pending", lockedAt: null, lockedBy: null }
        });
      }
      async cancelTask(taskId) {
        await dbConnect();
        await ScheduledTask.findByIdAndUpdate(taskId, {
          $set: {
            status: "cancelled",
            cancelledAt: /* @__PURE__ */ new Date(),
            lockedAt: null,
            lockedBy: null
          }
        });
      }
      async getTaskById(taskId) {
        await dbConnect();
        const t = await ScheduledTask.findById(taskId).lean();
        return t ? taskToStorage(t) : null;
      }
      async retryFailedTask(taskId) {
        await dbConnect();
        await ScheduledTask.findByIdAndUpdate(taskId, {
          $set: {
            status: "pending",
            runAt: /* @__PURE__ */ new Date(),
            attempts: 0,
            lastError: null,
            lockedAt: null,
            lockedBy: null,
            completedAt: null
          }
        });
      }
      async bulkCancelPendingTasksForAdmin(filter) {
        await dbConnect();
        if (filter.adminGroupIds.length === 0) return 0;
        const visibility = {
          $or: [
            { "payload.groupId": { $in: filter.adminGroupIds } },
            { "payload.payments.groupId": { $in: filter.adminGroupIds } }
          ]
        };
        const and = [visibility];
        if (filter.groupId) {
          and.push({
            $or: [
              { "payload.groupId": filter.groupId },
              { "payload.payments.groupId": filter.groupId }
            ]
          });
        }
        if (filter.memberEmail) {
          const trimmed = filter.memberEmail.trim();
          const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          and.push({
            "payload.memberEmail": { $regex: new RegExp(`^${escaped}$`, "i") }
          });
        }
        if (filter.type) {
          and.push({ type: filter.type });
        }
        const q = {
          status: { $in: ["pending", "locked"] },
          $and: and
        };
        const result = await ScheduledTask.updateMany(q, {
          $set: {
            status: "cancelled",
            cancelledAt: /* @__PURE__ */ new Date(),
            lockedAt: null,
            lockedBy: null
          }
        });
        return result.modifiedCount;
      }
      async getTaskCounts() {
        await dbConnect();
        const [pending, locked, completed, failed, cancelled] = await Promise.all([
          ScheduledTask.countDocuments({ status: "pending" }),
          ScheduledTask.countDocuments({ status: "locked" }),
          ScheduledTask.countDocuments({ status: "completed" }),
          ScheduledTask.countDocuments({ status: "failed" }),
          ScheduledTask.countDocuments({ status: "cancelled" })
        ]);
        return { pending, locked, completed, failed, cancelled };
      }
      async listTasks(options = {}) {
        await dbConnect();
        const query = {};
        if (options.status) query.status = options.status;
        if (options.type) query.type = options.type;
        if (options.groupId) query["payload.groupId"] = options.groupId;
        if (options.anyGroupIdIn?.length) {
          query.$or = [
            { "payload.groupId": { $in: options.anyGroupIdIn } },
            { "payload.payments.groupId": { $in: options.anyGroupIdIn } }
          ];
        }
        const limit = options.limit ?? 50;
        const offset = options.offset ?? 0;
        const [tasks, total] = await Promise.all([
          ScheduledTask.find(query).sort({ runAt: -1 }).skip(offset).limit(limit).lean(),
          ScheduledTask.countDocuments(query)
        ]);
        return { tasks: tasks.map(taskToStorage), total };
      }
      // ── price history ──────────────────────────────────────────────────────────
      async createPriceHistory(data) {
        await dbConnect();
        const p7 = await PriceHistory.create({
          group: new import_mongoose10.Types.ObjectId(data.groupId),
          price: data.price,
          previousPrice: data.previousPrice,
          currency: data.currency,
          effectiveFrom: data.effectiveFrom,
          note: data.note ?? null,
          membersNotified: data.membersNotified ?? false,
          createdBy: new import_mongoose10.Types.ObjectId(data.createdBy)
        });
        return priceHistoryToStorage(p7);
      }
      async getPriceHistoryForGroup(groupId) {
        await dbConnect();
        const records = await PriceHistory.find({ group: groupId }).sort({ effectiveFrom: -1 }).lean();
        return records.map(priceHistoryToStorage);
      }
      // ── app settings (MongoDB only) ─────────────────────────────────────────────
      appSettingToStorage(row) {
        return {
          key: row.key,
          value: row.value,
          category: row.category,
          isSecret: row.isSecret,
          label: row.label,
          description: row.description
        };
      }
      async ensureAppSettingsSeeded() {
        await dbConnect();
        for (const definition of settingsDefinitions) {
          const existing = await Settings.findOne({ key: definition.key }).lean();
          if (existing) continue;
          const envValue = process.env[definition.envVar];
          const value = envValue ?? definition.defaultValue ?? null;
          await Settings.create({
            key: definition.key,
            value,
            category: definition.category,
            isSecret: definition.isSecret,
            label: definition.label,
            description: definition.description
          });
        }
      }
      async getAppSettingRow(key) {
        await dbConnect();
        const record = await Settings.findOne({ key }).lean();
        return record ? this.appSettingToStorage(record) : null;
      }
      async listAppSettingRows(category) {
        await dbConnect();
        const query = category ? { category } : {};
        const records = await Settings.find(query).sort({ category: 1, key: 1 }).lean();
        return records.map((r) => this.appSettingToStorage(r));
      }
      async upsertAppSettingRow(input) {
        await dbConnect();
        await Settings.findOneAndUpdate(
          { key: input.key },
          {
            key: input.key,
            value: input.value,
            category: input.category,
            isSecret: input.isSecret,
            label: input.label,
            description: input.description
          },
          { upsert: true, new: true }
        );
      }
      // ── data portability ───────────────────────────────────────────────────────
      async exportAll() {
        await dbConnect();
        const [groups, billingPeriods, notifications, priceHistory] = await Promise.all([
          Group.find({}).lean(),
          BillingPeriod.find({}).lean(),
          Notification.find({}).lean(),
          PriceHistory.find({}).lean()
        ]);
        return {
          version: "1.0.0",
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: { mode: "advanced", appVersion: process.env.npm_package_version ?? "unknown" },
          data: {
            groups: groups.map(groupToStorage),
            billingPeriods: billingPeriods.map(periodToStorage),
            notifications: notifications.map(notificationToStorage),
            priceHistory: priceHistory.map(priceHistoryToStorage)
          }
        };
      }
      async importAll(bundle) {
        await dbConnect();
        const errors = [];
        let groups = 0;
        let billingPeriods = 0;
        let notifications = 0;
        let priceHistory = 0;
        for (const g of bundle.data.groups) {
          try {
            await Group.findByIdAndUpdate(
              g.id,
              {
                $setOnInsert: {
                  _id: g.id,
                  name: g.name,
                  description: g.description,
                  admin: new import_mongoose10.Types.ObjectId(g.adminId),
                  service: g.service,
                  billing: g.billing,
                  payment: g.payment,
                  notifications: g.notifications,
                  members: g.members.map((m) => ({
                    _id: m.id,
                    user: m.userId ? new import_mongoose10.Types.ObjectId(m.userId) : null,
                    email: m.email,
                    nickname: m.nickname,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    leftAt: m.leftAt,
                    isActive: m.isActive,
                    customAmount: m.customAmount,
                    acceptedAt: m.acceptedAt,
                    unsubscribedFromEmail: m.unsubscribedFromEmail,
                    billingStartsAt: m.billingStartsAt
                  })),
                  announcements: g.announcements,
                  telegramGroup: g.telegramGroup,
                  isActive: g.isActive,
                  inviteCode: g.inviteCode,
                  inviteLinkEnabled: g.inviteLinkEnabled,
                  initializedAt: g.initializedAt,
                  createdAt: g.createdAt
                }
              },
              { upsert: true }
            );
            groups++;
          } catch (e) {
            errors.push(`group ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        for (const p7 of bundle.data.billingPeriods) {
          try {
            await BillingPeriod.findByIdAndUpdate(
              p7.id,
              {
                $setOnInsert: {
                  _id: p7.id,
                  group: new import_mongoose10.Types.ObjectId(p7.groupId),
                  periodStart: p7.periodStart,
                  collectionOpensAt: p7.collectionOpensAt,
                  periodEnd: p7.periodEnd,
                  periodLabel: p7.periodLabel,
                  totalPrice: p7.totalPrice,
                  currency: p7.currency,
                  priceNote: p7.priceNote,
                  payments: p7.payments.map((pay) => ({
                    _id: pay.id,
                    memberId: new import_mongoose10.Types.ObjectId(pay.memberId),
                    memberEmail: pay.memberEmail,
                    memberNickname: pay.memberNickname,
                    amount: pay.amount,
                    adjustedAmount: pay.adjustedAmount,
                    adjustmentReason: pay.adjustmentReason,
                    status: pay.status,
                    memberConfirmedAt: pay.memberConfirmedAt,
                    adminConfirmedAt: pay.adminConfirmedAt,
                    confirmationToken: pay.confirmationToken,
                    notes: pay.notes
                  })),
                  reminders: p7.reminders,
                  isFullyPaid: p7.isFullyPaid,
                  createdAt: p7.createdAt
                }
              },
              { upsert: true }
            );
            billingPeriods++;
          } catch (e) {
            errors.push(`period ${p7.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        for (const n of bundle.data.notifications) {
          try {
            await Notification.findByIdAndUpdate(
              n.id,
              {
                $setOnInsert: {
                  _id: n.id,
                  recipient: n.recipientId ? new import_mongoose10.Types.ObjectId(n.recipientId) : null,
                  recipientEmail: n.recipientEmail,
                  group: n.groupId ? new import_mongoose10.Types.ObjectId(n.groupId) : null,
                  billingPeriod: n.billingPeriodId ? new import_mongoose10.Types.ObjectId(n.billingPeriodId) : null,
                  type: n.type,
                  channel: n.channel,
                  status: n.status,
                  subject: n.subject,
                  preview: n.preview,
                  emailParams: n.emailParams,
                  externalId: n.externalId,
                  error: n.error,
                  deliveredAt: n.deliveredAt,
                  createdAt: n.createdAt
                }
              },
              { upsert: true }
            );
            notifications++;
          } catch (e) {
            errors.push(`notification ${n.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        for (const ph of bundle.data.priceHistory) {
          try {
            await PriceHistory.findByIdAndUpdate(
              ph.id,
              {
                $setOnInsert: {
                  _id: ph.id,
                  group: new import_mongoose10.Types.ObjectId(ph.groupId),
                  price: ph.price,
                  previousPrice: ph.previousPrice,
                  currency: ph.currency,
                  effectiveFrom: ph.effectiveFrom,
                  note: ph.note,
                  membersNotified: ph.membersNotified,
                  createdBy: new import_mongoose10.Types.ObjectId(ph.createdBy),
                  createdAt: ph.createdAt
                }
              },
              { upsert: true }
            );
            priceHistory++;
          } catch (e) {
            errors.push(`priceHistory ${ph.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        return { groups, billingPeriods, notifications, priceHistory, errors };
      }
    };
  }
});

// src/lib/storage/api.ts
function isStorageId(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function toApiShape(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toApiShape(item));
  }
  if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof Map)) {
    const record = value;
    const entries = Object.entries(record).map(([key, entryValue]) => [
      key === "id" ? "_id" : key,
      toApiShape(entryValue)
    ]);
    return Object.fromEntries(entries);
  }
  return value;
}
var init_api = __esm({
  "src/lib/storage/api.ts"() {
    "use strict";
  }
});

// src/lib/storage/types.ts
var init_types = __esm({
  "src/lib/storage/types.ts"() {
    "use strict";
  }
});

// src/lib/auth/local.ts
var LOCAL_ADMIN_USER_ID;
var init_local = __esm({
  "src/lib/auth/local.ts"() {
    "use strict";
    init_manager();
    LOCAL_ADMIN_USER_ID = "local-admin";
  }
});

// src/lib/storage/sqlite-adapter.ts
var sqlite_adapter_exports = {};
__export(sqlite_adapter_exports, {
  SqliteAdapter: () => SqliteAdapter
});
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function taskVisibleToAdminGroups(task, adminGroupIds) {
  const payload = task.payload;
  if (payload.groupId && adminGroupIds.has(payload.groupId)) return true;
  if (payload.payments?.length) {
    return payload.payments.some((p7) => p7.groupId && adminGroupIds.has(p7.groupId));
  }
  return false;
}
function parseRow(row) {
  return JSON.parse(row.data);
}
function parseDates(obj, dateKeys) {
  const out = { ...obj };
  for (const key of dateKeys) {
    if (typeof out[key] === "string") {
      out[key] = new Date(out[key]);
    } else if (out[key] === null || out[key] === void 0) {
      out[key] = null;
    }
  }
  return out;
}
function hydrateGroup(data) {
  const g = parseDates(data, ["initializedAt", "createdAt", "updatedAt"]);
  if (Array.isArray(g.members)) {
    g.members = g.members.map(
      (m) => parseDates(m, ["joinedAt", "leftAt", "acceptedAt", "billingStartsAt"])
    );
  }
  if (g.telegramGroup) {
    g.telegramGroup = parseDates(g.telegramGroup, ["linkedAt"]);
  }
  return g;
}
function hydratePeriod(data) {
  const p7 = parseDates(data, ["periodStart", "collectionOpensAt", "periodEnd", "createdAt", "updatedAt"]);
  if (Array.isArray(p7.payments)) {
    p7.payments = p7.payments.map(
      (pay) => parseDates(pay, ["memberConfirmedAt", "adminConfirmedAt"])
    );
  }
  if (Array.isArray(p7.reminders)) {
    p7.reminders = p7.reminders.map(
      (r) => parseDates(r, ["sentAt"])
    );
  }
  return p7;
}
function hydrateTask(data) {
  return parseDates(data, ["runAt", "lockedAt", "completedAt", "cancelledAt", "createdAt", "updatedAt"]);
}
function hydrateNotification(data) {
  return parseDates(data, ["deliveredAt", "createdAt"]);
}
function hydrateAuditEvent(data) {
  return parseDates(data, ["createdAt"]);
}
function hydratePriceHistory(data) {
  return parseDates(data, ["effectiveFrom", "createdAt"]);
}
function hydrateUser(data) {
  const u = parseDates(data, ["emailVerified", "welcomeEmailSentAt", "createdAt", "updatedAt"]);
  if (u.telegram) {
    u.telegram = parseDates(u.telegram, ["linkedAt"]);
  }
  if (u.telegramLinkCode) {
    u.telegramLinkCode = parseDates(u.telegramLinkCode, ["expiresAt"]);
  }
  return u;
}
var import_better_sqlite3, import_nanoid, SCHEMA_SQL, DEFAULT_LOCK_TTL_MS2, SqliteAdapter;
var init_sqlite_adapter = __esm({
  "src/lib/storage/sqlite-adapter.ts"() {
    "use strict";
    import_better_sqlite3 = __toESM(require("better-sqlite3"));
    import_nanoid = require("nanoid");
    init_manager();
    init_local();
    SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    invite_code TEXT UNIQUE,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_groups_admin ON groups(admin_id);
  CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active);

  CREATE TABLE IF NOT EXISTS billing_periods (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    period_start TEXT NOT NULL,
    collection_opens_at TEXT,
    is_fully_paid INTEGER NOT NULL DEFAULT 0,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_bp_group_start ON billing_periods(group_id, period_start);
  CREATE INDEX IF NOT EXISTS idx_bp_group ON billing_periods(group_id);
  CREATE INDEX IF NOT EXISTS idx_bp_unpaid ON billing_periods(is_fully_paid);

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notif_group ON notifications(group_id);
  CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at);

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    data JSON NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_group ON audit_events(group_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);

  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    run_at TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    locked_at TEXT,
    locked_by TEXT,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status_run ON scheduled_tasks(status, run_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_locked ON scheduled_tasks(locked_at);

  CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id),
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ph_group ON price_history(group_id);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    telegram_chat_id INTEGER UNIQUE,
    data JSON NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;
    DEFAULT_LOCK_TTL_MS2 = 5 * 60 * 1e3;
    SqliteAdapter = class {
      constructor(dbPath) {
        this.dbPath = dbPath;
      }
      async initialize() {
        if (this.db) return;
        const fs9 = await import("fs");
        const path11 = await import("path");
        const dir = path11.dirname(this.dbPath);
        if (!fs9.existsSync(dir)) {
          fs9.mkdirSync(dir, { recursive: true });
        }
        this.db = new import_better_sqlite3.default(this.dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.db.exec(SCHEMA_SQL);
        this.seedLocalAdmin();
      }
      // ensure the local admin user row exists (reads email/name from config)
      seedLocalAdmin() {
        try {
          const config = readConfig();
          if (!config) return;
          const existing = this.db.prepare("SELECT id FROM users WHERE id = ?").get(LOCAL_ADMIN_USER_ID);
          const ts = /* @__PURE__ */ new Date();
          const user = {
            id: LOCAL_ADMIN_USER_ID,
            name: config.adminName ?? "Admin",
            email: config.adminEmail ?? "admin@localhost",
            role: "admin",
            emailVerified: null,
            image: null,
            hashedPassword: null,
            telegram: null,
            telegramLinkCode: null,
            notificationPreferences: {
              email: !!config.notifications?.channels?.email,
              telegram: !!config.notifications?.channels?.telegram,
              reminderFrequency: "once"
            },
            welcomeEmailSentAt: null,
            createdAt: existing ? ts : ts,
            updatedAt: ts
          };
          this.upsertUser(user);
        } catch {
        }
      }
      async close() {
        this.db?.close();
        this.db = void 0;
      }
      ensureOpen() {
        if (!this.db) throw new Error("SqliteAdapter not initialized \u2014 call initialize() first");
      }
      // ── users ──────────────────────────────────────────────────────────────────
      async getUser(id) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM users WHERE id = ?").get(id);
        if (!row) return null;
        return hydrateUser(parseRow(row));
      }
      async getUserByEmail(email) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM users WHERE email = ?").get(email.toLowerCase().trim());
        if (!row) return null;
        return hydrateUser(parseRow(row));
      }
      async getUserByTelegramChatId(chatId) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM users WHERE telegram_chat_id = ?").get(chatId);
        if (!row) return null;
        return hydrateUser(parseRow(row));
      }
      async updateUser(id, data) {
        this.ensureOpen();
        const existing = await this.getUser(id);
        if (!existing) throw new Error(`user not found: ${id}`);
        const merged = { ...existing, ...data, updatedAt: /* @__PURE__ */ new Date() };
        this.db.prepare(
          "UPDATE users SET email = ?, telegram_chat_id = ?, data = ?, updated_at = ? WHERE id = ?"
        ).run(
          merged.email.toLowerCase(),
          merged.telegram?.chatId ?? null,
          JSON.stringify(merged),
          now(),
          id
        );
        return merged;
      }
      async createUser(data) {
        this.ensureOpen();
        const id = (0, import_nanoid.nanoid)();
        const ts = now();
        const user = {
          id,
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          role: data.role,
          emailVerified: null,
          image: null,
          hashedPassword: data.hashedPassword,
          telegram: null,
          telegramLinkCode: null,
          notificationPreferences: data.notificationPreferences,
          welcomeEmailSentAt: null,
          createdAt: new Date(ts),
          updatedAt: new Date(ts)
        };
        this.db.prepare(`
      INSERT INTO users (id, email, telegram_chat_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, user.email, null, JSON.stringify(user), ts, ts);
        return user;
      }
      async countUsers() {
        this.ensureOpen();
        const row = this.db.prepare("SELECT COUNT(*) AS c FROM users").get();
        return row.c;
      }
      async getAdminUserCount() {
        this.ensureOpen();
        const rows = this.db.prepare("SELECT data FROM users").all();
        return rows.filter((r) => hydrateUser(parseRow(r)).role === "admin").length;
      }
      async promoteOldestUserToAdmin() {
        this.ensureOpen();
        const row = this.db.prepare(
          "SELECT id, data FROM users ORDER BY created_at ASC LIMIT 1"
        ).get();
        if (!row) return;
        const u = hydrateUser(parseRow(row));
        if (u.role === "admin") return;
        await this.updateUser(u.id, { role: "admin" });
      }
      async linkTelegramAccountWithLinkCode(params) {
        this.ensureOpen();
        const { code, chatId, username, now: now2 } = params;
        const row = this.db.prepare(
          "SELECT id, data FROM users WHERE json_extract(data, '$.telegramLinkCode.code') = ?"
        ).get(code);
        if (!row) return null;
        const u = hydrateUser(parseRow(row));
        if (!u.telegramLinkCode || u.telegramLinkCode.code !== code || u.telegramLinkCode.expiresAt <= now2) {
          return null;
        }
        return await this.updateUser(u.id, {
          telegram: { chatId, username, linkedAt: now2 },
          telegramLinkCode: null,
          notificationPreferences: { ...u.notificationPreferences, telegram: true }
        });
      }
      async tryClaimWelcomeEmailSentAt(userId, at) {
        this.ensureOpen();
        const u = await this.getUser(userId);
        if (!u || u.welcomeEmailSentAt) return false;
        await this.updateUser(userId, { welcomeEmailSentAt: at });
        return true;
      }
      // local mode: upsert the single admin user
      upsertUser(user) {
        this.ensureOpen();
        this.db.prepare(`
      INSERT INTO users (id, email, telegram_chat_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        telegram_chat_id = excluded.telegram_chat_id,
        data = excluded.data,
        updated_at = excluded.updated_at
    `).run(
          user.id,
          user.email.toLowerCase(),
          user.telegram?.chatId ?? null,
          JSON.stringify(user),
          user.createdAt.toISOString(),
          now()
        );
      }
      // ── groups ─────────────────────────────────────────────────────────────────
      async createGroup(data) {
        this.ensureOpen();
        const id = (0, import_nanoid.nanoid)();
        const ts = now();
        const group = {
          id,
          ...data,
          createdAt: new Date(ts),
          updatedAt: new Date(ts)
        };
        this.db.prepare(`
      INSERT INTO groups (id, admin_id, is_active, invite_code, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.adminId, data.isActive ? 1 : 0, data.inviteCode ?? null, JSON.stringify(group), ts, ts);
        return group;
      }
      async getGroup(id) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM groups WHERE id = ?").get(id);
        if (!row) return null;
        return hydrateGroup(parseRow(row));
      }
      async getGroupWithMemberUsers(id) {
        this.ensureOpen();
        const group = await this.getGroup(id);
        if (!group) return null;
        const memberUsers = /* @__PURE__ */ new Map();
        for (const member of group.members) {
          if (member.userId) {
            const user = await this.getUser(member.userId);
            if (user) {
              memberUsers.set(member.id, {
                telegram: user.telegram,
                notificationPreferences: user.notificationPreferences
              });
              continue;
            }
          }
          memberUsers.set(member.id, null);
        }
        return { ...group, memberUsers };
      }
      async listGroupsForUser(userId, email) {
        this.ensureOpen();
        const rows = this.db.prepare("SELECT data FROM groups WHERE is_active = 1").all();
        const groups = rows.map((r) => hydrateGroup(parseRow(r)));
        return groups.filter((g) => {
          if (g.adminId === userId) return true;
          return g.members.some(
            (m) => m.isActive && (m.userId === userId || m.email.toLowerCase() === email.toLowerCase())
          );
        });
      }
      async listAllActiveGroups() {
        this.ensureOpen();
        const rows = this.db.prepare("SELECT data FROM groups WHERE is_active = 1").all();
        return rows.map((r) => hydrateGroup(parseRow(r)));
      }
      async updateGroup(id, data) {
        this.ensureOpen();
        const existing = await this.getGroup(id);
        if (!existing) throw new Error(`group not found: ${id}`);
        const merged = { ...existing, ...data, updatedAt: /* @__PURE__ */ new Date() };
        const ts = now();
        this.db.prepare(`
      UPDATE groups SET admin_id = ?, is_active = ?, invite_code = ?, data = ?, updated_at = ?
      WHERE id = ?
    `).run(merged.adminId, merged.isActive ? 1 : 0, merged.inviteCode ?? null, JSON.stringify(merged), ts, id);
        return merged;
      }
      async softDeleteGroup(id) {
        this.ensureOpen();
        const existing = await this.getGroup(id);
        if (!existing) return;
        await this.updateGroup(id, { isActive: false });
      }
      async findGroupByInviteCode(code) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM groups WHERE invite_code = ?").get(code);
        if (!row) return null;
        return hydrateGroup(parseRow(row));
      }
      async findActiveGroupForMemberInvitation(params) {
        this.ensureOpen();
        const { groupId, memberId } = params;
        if (groupId) {
          const g = await this.getGroup(groupId);
          if (!g?.isActive) return null;
          const m = g.members.find(
            (mm) => mm.id === memberId && mm.isActive && !mm.leftAt
          );
          return m ? g : null;
        }
        const rows = this.db.prepare("SELECT data FROM groups WHERE is_active = 1").all();
        for (const row of rows) {
          const g = hydrateGroup(parseRow(row));
          const m = g.members.find(
            (mm) => mm.id === memberId && mm.isActive && !mm.leftAt
          );
          if (m) return g;
        }
        return null;
      }
      // ── billing periods ────────────────────────────────────────────────────────
      async createBillingPeriod(data) {
        this.ensureOpen();
        const id = (0, import_nanoid.nanoid)();
        const ts = now();
        const period = {
          id,
          ...data,
          createdAt: new Date(ts),
          updatedAt: new Date(ts)
        };
        this.db.prepare(`
      INSERT INTO billing_periods (id, group_id, period_start, collection_opens_at, is_fully_paid, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
          id,
          data.groupId,
          data.periodStart.toISOString(),
          data.collectionOpensAt?.toISOString() ?? null,
          data.isFullyPaid ? 1 : 0,
          JSON.stringify(period),
          ts,
          ts
        );
        return period;
      }
      async getBillingPeriod(id, groupId) {
        this.ensureOpen();
        const row = this.db.prepare(
          "SELECT data FROM billing_periods WHERE id = ? AND group_id = ?"
        ).get(id, groupId);
        if (!row) return null;
        return hydratePeriod(parseRow(row));
      }
      async getBillingPeriodByStart(groupId, periodStart) {
        this.ensureOpen();
        const row = this.db.prepare(
          "SELECT data FROM billing_periods WHERE group_id = ? AND period_start = ?"
        ).get(groupId, periodStart.toISOString());
        if (!row) return null;
        return hydratePeriod(parseRow(row));
      }
      async getBillingPeriodById(id) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM billing_periods WHERE id = ?").get(id);
        if (!row) return null;
        return hydratePeriod(parseRow(row));
      }
      async getOpenBillingPeriods(filter) {
        this.ensureOpen();
        const asOf = filter.asOf.toISOString();
        let sql = `
      SELECT data FROM billing_periods
      WHERE COALESCE(collection_opens_at, period_start) <= ?
    `;
        const params = [asOf];
        if (filter.unpaidOnly) {
          sql += " AND is_fully_paid = 0";
        }
        if (filter.groupIds && filter.groupIds.length > 0) {
          sql += ` AND group_id IN (${filter.groupIds.map(() => "?").join(",")})`;
          params.push(...filter.groupIds);
        }
        const rows = this.db.prepare(sql).all(...params);
        return rows.map((r) => hydratePeriod(parseRow(r)));
      }
      async getPeriodsForGroup(groupId) {
        this.ensureOpen();
        const rows = this.db.prepare(
          "SELECT data FROM billing_periods WHERE group_id = ? ORDER BY period_start DESC"
        ).all(groupId);
        return rows.map((r) => hydratePeriod(parseRow(r)));
      }
      async listUnpaidPeriodsWithStartBefore(asOf) {
        this.ensureOpen();
        const rows = this.db.prepare(`
      SELECT data FROM billing_periods
      WHERE is_fully_paid = 0 AND period_start < ?
    `).all(asOf.toISOString());
        return rows.map((r) => hydratePeriod(parseRow(r)));
      }
      async getFuturePeriods(groupId, afterDate) {
        this.ensureOpen();
        const rows = this.db.prepare(
          "SELECT data FROM billing_periods WHERE group_id = ? AND period_start > ? ORDER BY period_start ASC"
        ).all(groupId, afterDate.toISOString());
        return rows.map((r) => hydratePeriod(parseRow(r)));
      }
      async updateBillingPeriod(id, data) {
        this.ensureOpen();
        const existing = await this.db.prepare(
          "SELECT data, group_id FROM billing_periods WHERE id = ?"
        ).get(id);
        if (!existing) throw new Error(`billing period not found: ${id}`);
        const current = hydratePeriod(parseRow(existing));
        const merged = { ...current, ...data, updatedAt: /* @__PURE__ */ new Date() };
        const ts = now();
        this.db.prepare(`
      UPDATE billing_periods
      SET collection_opens_at = ?, is_fully_paid = ?, data = ?, updated_at = ?
      WHERE id = ?
    `).run(
          merged.collectionOpensAt?.toISOString() ?? null,
          merged.isFullyPaid ? 1 : 0,
          JSON.stringify(merged),
          ts,
          id
        );
        return merged;
      }
      async deleteBillingPeriod(id, groupId) {
        this.ensureOpen();
        this.db.prepare("DELETE FROM billing_periods WHERE id = ? AND group_id = ?").run(id, groupId);
      }
      async updatePaymentStatus(periodId, memberId, update) {
        this.ensureOpen();
        const row = this.db.prepare(
          "SELECT data, group_id FROM billing_periods WHERE id = ?"
        ).get(periodId);
        if (!row) throw new Error(`billing period not found: ${periodId}`);
        const period = hydratePeriod(parseRow(row));
        const payment = period.payments.find((p7) => p7.memberId === memberId);
        if (!payment) throw new Error(`payment not found for member ${memberId} in period ${periodId}`);
        if (update.status !== void 0) payment.status = update.status;
        if (update.memberConfirmedAt !== void 0) payment.memberConfirmedAt = update.memberConfirmedAt;
        if (update.adminConfirmedAt !== void 0) payment.adminConfirmedAt = update.adminConfirmedAt;
        if (update.confirmationToken !== void 0) payment.confirmationToken = update.confirmationToken;
        if (update.notes !== void 0) payment.notes = update.notes;
        if (update.adjustedAmount !== void 0) payment.adjustedAmount = update.adjustedAmount;
        if (update.adjustmentReason !== void 0) payment.adjustmentReason = update.adjustmentReason;
        period.isFullyPaid = period.payments.every(
          (p7) => p7.status === "confirmed" || p7.status === "waived"
        );
        period.updatedAt = /* @__PURE__ */ new Date();
        const ts = now();
        this.db.prepare(`
      UPDATE billing_periods SET is_fully_paid = ?, data = ?, updated_at = ? WHERE id = ?
    `).run(period.isFullyPaid ? 1 : 0, JSON.stringify(period), ts, periodId);
        return period;
      }
      async getBillingPeriodByConfirmationToken(token) {
        this.ensureOpen();
        const rows = this.db.prepare("SELECT data FROM billing_periods").all();
        for (const r of rows) {
          const period = hydratePeriod(parseRow(r));
          const idx = period.payments.findIndex((p7) => p7.confirmationToken === token);
          if (idx !== -1) return { period, paymentIndex: idx };
        }
        return null;
      }
      // ── notifications ──────────────────────────────────────────────────────────
      async logNotification(data) {
        this.ensureOpen();
        const id = (0, import_nanoid.nanoid)();
        const ts = now();
        const notif = {
          id,
          recipientId: data.recipientId ?? null,
          recipientEmail: data.recipientEmail,
          groupId: data.groupId ?? null,
          billingPeriodId: data.billingPeriodId ?? null,
          type: data.type,
          channel: data.channel,
          status: data.status,
          subject: data.subject ?? null,
          preview: data.preview,
          emailParams: data.emailParams ?? null,
          externalId: data.externalId ?? null,
          error: data.error ?? null,
          deliveredAt: data.deliveredAt ?? null,
          createdAt: new Date(ts)
        };
        this.db.prepare(`
      INSERT INTO notifications (id, group_id, data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, data.groupId ?? null, JSON.stringify(notif), ts);
        return notif;
      }
      async getNotificationsForGroup(groupId, limit = 50) {
        this.ensureOpen();
        const rows = this.db.prepare(
          "SELECT data FROM notifications WHERE group_id = ? ORDER BY created_at DESC LIMIT ?"
        ).all(groupId, limit);
        return rows.map((r) => hydrateNotification(parseRow(r)));
      }
      async getNotificationById(id) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM notifications WHERE id = ?").get(id);
        if (!row) return null;
        return hydrateNotification(parseRow(row));
      }
      async listNotifications(options) {
        this.ensureOpen();
        const { groupIds, type, channel, limit, offset } = options;
        if (!groupIds.length) {
          return { notifications: [], total: 0 };
        }
        const inList = groupIds.map(() => "?").join(", ");
        let sqlWhere = `WHERE group_id IN (${inList})`;
        const params = [...groupIds];
        if (type) {
          sqlWhere += ` AND json_extract(data, '$.type') = ?`;
          params.push(type);
        }
        if (channel) {
          sqlWhere += ` AND json_extract(data, '$.channel') = ?`;
          params.push(channel);
        }
        const totalRow = this.db.prepare(`SELECT COUNT(*) as total FROM notifications ${sqlWhere}`).get(...params);
        let sql = `SELECT data FROM notifications ${sqlWhere} ORDER BY created_at DESC`;
        const listParams = [...params];
        if (limit !== void 0) {
          sql += " LIMIT ?";
          listParams.push(limit);
          if (offset !== void 0) {
            sql += " OFFSET ?";
            listParams.push(offset);
          }
        } else if (offset !== void 0) {
          sql += " LIMIT -1 OFFSET ?";
          listParams.push(offset);
        }
        const rows = this.db.prepare(sql).all(...listParams);
        return {
          total: totalRow.total,
          notifications: rows.map((r) => hydrateNotification(parseRow(r)))
        };
      }
      async logAudit(data) {
        this.ensureOpen();
        const id = (0, import_nanoid.nanoid)();
        const ts = now();
        const event = {
          id,
          actorId: data.actorId,
          actorName: data.actorName,
          action: data.action,
          groupId: data.groupId ?? null,
          billingPeriodId: data.billingPeriodId ?? null,
          targetMemberId: data.targetMemberId ?? null,
          metadata: data.metadata ?? {},
          createdAt: new Date(ts)
        };
        this.db.prepare(`
      INSERT INTO audit_events (id, group_id, created_at, data)
      VALUES (?, ?, ?, ?)
    `).run(id, event.groupId, ts, JSON.stringify(event));
        return event;
      }
      async listAuditEvents(options = {}) {
        this.ensureOpen();
        const unbounded = options.unbounded === true;
        const limit = unbounded ? void 0 : options.limit ?? 50;
        const offset = unbounded ? void 0 : options.offset ?? 0;
        const groupIds = options.groupIds ?? [];
        const where = groupIds.length ? `WHERE group_id IN (${groupIds.map(() => "?").join(", ")})` : "";
        const totalRow = this.db.prepare(`SELECT COUNT(*) as total FROM audit_events ${where}`).get(...groupIds);
        let listSql = `SELECT data FROM audit_events ${where} ORDER BY created_at DESC`;
        const listParams = [...groupIds];
        if (limit !== void 0) {
          listSql += " LIMIT ?";
          listParams.push(limit);
          if (offset !== void 0) {
            listSql += " OFFSET ?";
            listParams.push(offset);
          }
        } else if (offset !== void 0) {
          listSql += " LIMIT -1 OFFSET ?";
          listParams.push(offset);
        }
        const rows = this.db.prepare(listSql).all(...listParams);
        return {
          total: totalRow.total,
          events: rows.map((row) => hydrateAuditEvent(parseRow(row)))
        };
      }
      // ── scheduled tasks ────────────────────────────────────────────────────────
      async enqueueTask(data) {
        this.ensureOpen();
        const existing = this.db.prepare(
          "SELECT id FROM scheduled_tasks WHERE idempotency_key = ?"
        ).get(data.idempotencyKey);
        if (existing) return null;
        const id = (0, import_nanoid.nanoid)();
        const ts = now();
        const task = {
          id,
          type: data.type,
          status: "pending",
          runAt: data.runAt,
          lockedAt: null,
          lockedBy: null,
          attempts: 0,
          maxAttempts: data.maxAttempts ?? 5,
          lastError: null,
          completedAt: null,
          cancelledAt: null,
          idempotencyKey: data.idempotencyKey,
          payload: data.payload,
          createdAt: new Date(ts),
          updatedAt: new Date(ts)
        };
        this.db.prepare(`
      INSERT INTO scheduled_tasks (id, type, status, run_at, idempotency_key, locked_at, locked_by, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.type, "pending", data.runAt.toISOString(), data.idempotencyKey, null, null, JSON.stringify(task), ts, ts);
        return task;
      }
      async claimTasks(workerId, options = {}) {
        this.ensureOpen();
        const limit = options.limit ?? 50;
        const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS2;
        const nowTs = now();
        const staleThreshold = new Date(Date.now() - lockTtlMs).toISOString();
        if (options.recoverStaleLocks) {
          const stale = this.db.prepare(
            "SELECT id, data FROM scheduled_tasks WHERE status = 'locked' AND locked_at < ?"
          ).all(staleThreshold);
          const releaseStmt = this.db.prepare(
            "UPDATE scheduled_tasks SET status = 'pending', locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?"
          );
          for (const s of stale) {
            const t = hydrateTask(parseRow(s));
            t.status = "pending";
            t.lockedAt = null;
            t.lockedBy = null;
            t.updatedAt = /* @__PURE__ */ new Date();
            releaseStmt.run(JSON.stringify(t), nowTs, s.id);
          }
        }
        const candidates = this.db.prepare(`
      SELECT id, data FROM scheduled_tasks
      WHERE status = 'pending' AND run_at <= ?
      ORDER BY run_at ASC
      LIMIT ?
    `).all(nowTs, limit);
        const claimed = [];
        const claimStmt = this.db.prepare(`
      UPDATE scheduled_tasks
      SET status = 'locked', locked_at = ?, locked_by = ?, data = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `);
        for (const c of candidates) {
          const t = hydrateTask(parseRow(c));
          t.status = "locked";
          t.lockedAt = new Date(nowTs);
          t.lockedBy = workerId;
          t.updatedAt = /* @__PURE__ */ new Date();
          const result = claimStmt.run(nowTs, workerId, JSON.stringify(t), nowTs, c.id);
          if (result.changes > 0) claimed.push(t);
        }
        return claimed;
      }
      async completeTask(taskId) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId);
        if (!row) return;
        const t = hydrateTask(parseRow(row));
        t.status = "completed";
        t.completedAt = /* @__PURE__ */ new Date();
        t.lockedAt = null;
        t.lockedBy = null;
        t.updatedAt = /* @__PURE__ */ new Date();
        const ts = now();
        this.db.prepare("UPDATE scheduled_tasks SET status = 'completed', locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(t), ts, taskId);
      }
      async failTask(taskId, error, attempts, maxAttempts) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId);
        if (!row) return;
        const t = hydrateTask(parseRow(row));
        t.attempts = attempts;
        t.lastError = error;
        t.lockedAt = null;
        t.lockedBy = null;
        t.updatedAt = /* @__PURE__ */ new Date();
        const ts = now();
        if (attempts >= maxAttempts) {
          t.status = "failed";
        } else {
          const backoffMs = Math.min(2 ** attempts * 60 * 1e3, 24 * 60 * 60 * 1e3);
          t.status = "pending";
          t.runAt = new Date(Date.now() + backoffMs);
        }
        this.db.prepare(
          "UPDATE scheduled_tasks SET status = ?, run_at = ?, locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?"
        ).run(t.status, t.runAt.toISOString(), JSON.stringify(t), ts, taskId);
      }
      async releaseTask(taskId) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId);
        if (!row) return;
        const t = hydrateTask(parseRow(row));
        t.status = "pending";
        t.lockedAt = null;
        t.lockedBy = null;
        t.updatedAt = /* @__PURE__ */ new Date();
        const ts = now();
        this.db.prepare("UPDATE scheduled_tasks SET status = 'pending', locked_at = NULL, locked_by = NULL, data = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(t), ts, taskId);
      }
      async cancelTask(taskId) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId);
        if (!row) return;
        const t = hydrateTask(parseRow(row));
        t.status = "cancelled";
        t.cancelledAt = /* @__PURE__ */ new Date();
        t.lockedAt = null;
        t.lockedBy = null;
        t.updatedAt = /* @__PURE__ */ new Date();
        const ts = now();
        this.db.prepare("UPDATE scheduled_tasks SET status = 'cancelled', data = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(t), ts, taskId);
      }
      async getTaskById(taskId) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId);
        if (!row) return null;
        return hydrateTask(parseRow(row));
      }
      async retryFailedTask(taskId) {
        this.ensureOpen();
        const row = this.db.prepare("SELECT data FROM scheduled_tasks WHERE id = ?").get(taskId);
        if (!row) return;
        const t = hydrateTask(parseRow(row));
        t.status = "pending";
        t.runAt = /* @__PURE__ */ new Date();
        t.attempts = 0;
        t.lastError = null;
        t.lockedAt = null;
        t.lockedBy = null;
        t.completedAt = null;
        t.updatedAt = /* @__PURE__ */ new Date();
        const ts = now();
        this.db.prepare(
          "UPDATE scheduled_tasks SET status = 'pending', run_at = ?, data = ?, updated_at = ? WHERE id = ?"
        ).run(t.runAt.toISOString(), JSON.stringify(t), ts, taskId);
      }
      async bulkCancelPendingTasksForAdmin(filter) {
        this.ensureOpen();
        if (filter.adminGroupIds.length === 0) return 0;
        const adminSet = new Set(filter.adminGroupIds);
        const rows = this.db.prepare(
          `SELECT data FROM scheduled_tasks WHERE status IN ('pending', 'locked')`
        ).all();
        let n = 0;
        const ts = now();
        for (const row of rows) {
          const t = hydrateTask(parseRow(row));
          if (!taskVisibleToAdminGroups(t, adminSet)) continue;
          if (filter.groupId) {
            const touches = t.payload.groupId === filter.groupId || t.payload.payments?.some((p7) => p7.groupId === filter.groupId);
            if (!touches) continue;
          }
          if (filter.memberEmail) {
            const want = filter.memberEmail.trim().toLowerCase();
            const email = String(t.payload.memberEmail ?? "").toLowerCase();
            if (email !== want) continue;
          }
          if (filter.type && t.type !== filter.type) continue;
          t.status = "cancelled";
          t.cancelledAt = /* @__PURE__ */ new Date();
          t.lockedAt = null;
          t.lockedBy = null;
          t.updatedAt = /* @__PURE__ */ new Date();
          this.db.prepare("UPDATE scheduled_tasks SET status = 'cancelled', data = ?, updated_at = ? WHERE id = ?").run(
            JSON.stringify(t),
            ts,
            t.id
          );
          n++;
        }
        return n;
      }
      async getTaskCounts() {
        this.ensureOpen();
        const rows = this.db.prepare(
          "SELECT status, COUNT(*) as count FROM scheduled_tasks GROUP BY status"
        ).all();
        const counts = { pending: 0, locked: 0, completed: 0, failed: 0, cancelled: 0 };
        for (const row of rows) {
          if (row.status in counts) counts[row.status] = row.count;
        }
        return counts;
      }
      async listTasks(options = {}) {
        this.ensureOpen();
        const conditions = [];
        const params = [];
        if (options.status) {
          conditions.push("status = ?");
          params.push(options.status);
        }
        if (options.type) {
          conditions.push("type = ?");
          params.push(options.type);
        }
        if (options.groupId) {
          conditions.push("json_extract(data, '$.payload.groupId') = ?");
          params.push(options.groupId);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const rows = this.db.prepare(
          `SELECT data FROM scheduled_tasks ${where} ORDER BY run_at DESC`
        ).all(...params);
        let tasks = rows.map((r) => hydrateTask(parseRow(r)));
        if (options.anyGroupIdIn?.length) {
          const adminSet = new Set(options.anyGroupIdIn);
          tasks = tasks.filter((t) => taskVisibleToAdminGroups(t, adminSet));
        }
        const total = tasks.length;
        const limit = options.limit ?? 50;
        const offset = options.offset ?? 0;
        tasks = tasks.slice(offset, offset + limit);
        return { tasks, total };
      }
      // ── price history ──────────────────────────────────────────────────────────
      async createPriceHistory(data) {
        this.ensureOpen();
        const id = (0, import_nanoid.nanoid)();
        const ts = now();
        const ph = {
          id,
          groupId: data.groupId,
          price: data.price,
          previousPrice: data.previousPrice,
          currency: data.currency,
          effectiveFrom: data.effectiveFrom,
          note: data.note ?? null,
          membersNotified: data.membersNotified ?? false,
          createdBy: data.createdBy,
          createdAt: new Date(ts)
        };
        this.db.prepare(`
      INSERT INTO price_history (id, group_id, data, created_at) VALUES (?, ?, ?, ?)
    `).run(id, data.groupId, JSON.stringify(ph), ts);
        return ph;
      }
      async getPriceHistoryForGroup(groupId) {
        this.ensureOpen();
        const rows = this.db.prepare(
          "SELECT data FROM price_history WHERE group_id = ? ORDER BY created_at DESC"
        ).all(groupId);
        return rows.map((r) => hydratePriceHistory(parseRow(r)));
      }
      // ── app settings (not persisted in SQLite; local mode uses config.json) ─────
      async ensureAppSettingsSeeded() {
        this.ensureOpen();
      }
      async getAppSettingRow(_key) {
        this.ensureOpen();
        return null;
      }
      async listAppSettingRows(_category) {
        this.ensureOpen();
        return [];
      }
      async upsertAppSettingRow(_input) {
        this.ensureOpen();
      }
      // ── data portability ───────────────────────────────────────────────────────
      async exportAll() {
        this.ensureOpen();
        const groupRows = this.db.prepare("SELECT data FROM groups").all();
        const periodRows = this.db.prepare("SELECT data FROM billing_periods").all();
        const notifRows = this.db.prepare("SELECT data FROM notifications").all();
        const phRows = this.db.prepare("SELECT data FROM price_history").all();
        return {
          version: "1.0.0",
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: { mode: "local", appVersion: process.env.npm_package_version ?? "unknown" },
          data: {
            groups: groupRows.map((r) => hydrateGroup(parseRow(r))),
            billingPeriods: periodRows.map((r) => hydratePeriod(parseRow(r))),
            notifications: notifRows.map((r) => hydrateNotification(parseRow(r))),
            priceHistory: phRows.map((r) => hydratePriceHistory(parseRow(r)))
          }
        };
      }
      async importAll(bundle) {
        this.ensureOpen();
        const errors = [];
        let groups = 0;
        let billingPeriods = 0;
        let notifications = 0;
        let priceHistory = 0;
        const importGroup = this.db.prepare(`
      INSERT OR IGNORE INTO groups (id, admin_id, is_active, invite_code, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const importPeriod = this.db.prepare(`
      INSERT OR IGNORE INTO billing_periods (id, group_id, period_start, collection_opens_at, is_fully_paid, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const importNotif = this.db.prepare(`
      INSERT OR IGNORE INTO notifications (id, group_id, data, created_at) VALUES (?, ?, ?, ?)
    `);
        const importPh = this.db.prepare(`
      INSERT OR IGNORE INTO price_history (id, group_id, data, created_at) VALUES (?, ?, ?, ?)
    `);
        const runImport = this.db.transaction(() => {
          for (const g of bundle.data.groups) {
            try {
              importGroup.run(
                g.id,
                g.adminId,
                g.isActive ? 1 : 0,
                g.inviteCode ?? null,
                JSON.stringify(g),
                new Date(g.createdAt).toISOString(),
                new Date(g.updatedAt).toISOString()
              );
              groups++;
            } catch (e) {
              errors.push(`group ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          for (const p7 of bundle.data.billingPeriods) {
            try {
              importPeriod.run(
                p7.id,
                p7.groupId,
                new Date(p7.periodStart).toISOString(),
                p7.collectionOpensAt ? new Date(p7.collectionOpensAt).toISOString() : null,
                p7.isFullyPaid ? 1 : 0,
                JSON.stringify(p7),
                new Date(p7.createdAt).toISOString(),
                new Date(p7.updatedAt).toISOString()
              );
              billingPeriods++;
            } catch (e) {
              errors.push(`period ${p7.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          for (const n of bundle.data.notifications) {
            try {
              importNotif.run(n.id, n.groupId ?? null, JSON.stringify(n), new Date(n.createdAt).toISOString());
              notifications++;
            } catch (e) {
              errors.push(`notification ${n.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          for (const ph of bundle.data.priceHistory) {
            try {
              importPh.run(ph.id, ph.groupId, JSON.stringify(ph), new Date(ph.createdAt).toISOString());
              priceHistory++;
            } catch (e) {
              errors.push(`priceHistory ${ph.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        });
        runImport();
        return { groups, billingPeriods, notifications, priceHistory, errors };
      }
    };
  }
});

// src/lib/storage/index.ts
var storage_exports = {};
__export(storage_exports, {
  db: () => db,
  getAdapter: () => getAdapter,
  isStorageId: () => isStorageId,
  resetAdapter: () => resetAdapter,
  setAdapter: () => setAdapter,
  toApiShape: () => toApiShape
});
function getAdapter() {
  if (_adapter) return _adapter;
  const mode = process.env.SUB5TR4CKER_MODE;
  if (mode === "local") {
    const { SqliteAdapter: SqliteAdapter2 } = (init_sqlite_adapter(), __toCommonJS(sqlite_adapter_exports));
    const dataPath = process.env.SUB5TR4CKER_DATA_PATH ?? `${process.env.HOME}/.sub5tr4cker/data.db`;
    _adapter = new SqliteAdapter2(dataPath);
  } else {
    _adapter = new MongooseAdapter();
  }
  return _adapter;
}
function setAdapter(adapter) {
  _adapter = adapter;
}
function resetAdapter() {
  _adapter = null;
  _initPromise = null;
}
async function db() {
  if (_initPromise) return _initPromise;
  const adapter = getAdapter();
  _initPromise = adapter.initialize().then(() => adapter).catch((error) => {
    _initPromise = null;
    throw error;
  });
  return _initPromise;
}
var _adapter, _initPromise;
var init_storage = __esm({
  "src/lib/storage/index.ts"() {
    "use strict";
    init_mongoose_adapter();
    init_api();
    init_types();
    _adapter = null;
    _initPromise = null;
  }
});

// src/lib/settings/migrate.ts
async function ensureSettingsMigrated() {
  if (!migrationPromise) {
    migrationPromise = runSettingsMigration().finally(() => {
      migrationPromise = null;
    });
  }
  await migrationPromise;
}
async function runSettingsMigration() {
  const store = await db();
  await store.ensureAppSettingsSeeded();
}
var migrationPromise;
var init_migrate = __esm({
  "src/lib/settings/migrate.ts"() {
    "use strict";
    init_storage();
    migrationPromise = null;
  }
});

// src/lib/settings/service.ts
function getEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-secret-change-in-production";
  return import_crypto3.default.createHash("sha256").update(secret).digest();
}
function decryptValue(value) {
  if (!value) {
    return null;
  }
  if (!value.startsWith("enc:")) {
    return value;
  }
  const [, iv, tag, encrypted] = value.split(":");
  if (!iv || !tag || !encrypted) {
    return value;
  }
  try {
    const decipher = import_crypto3.default.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final()
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("failed to decrypt setting value:", error);
    return null;
  }
}
function resolveFallbackValue(key) {
  const definition = getSettingsDefinition(key);
  if (!definition) {
    return null;
  }
  return process.env[definition.envVar] ?? definition.defaultValue ?? null;
}
async function getSetting(key) {
  if (isLocalMode()) {
    return getLocalSetting(key);
  }
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  await ensureSettingsMigrated();
  const store = await db();
  const definition = getSettingsDefinition(key);
  const record = await store.getAppSettingRow(key);
  const rawValue = record?.value ?? resolveFallbackValue(key);
  const value = definition?.isSecret && rawValue?.startsWith("enc:") ? decryptValue(rawValue) : rawValue;
  settingsCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
  return value;
}
var import_crypto3, CACHE_TTL_MS, settingsCache;
var init_service = __esm({
  "src/lib/settings/service.ts"() {
    "use strict";
    import_crypto3 = __toESM(require("crypto"));
    init_storage();
    init_definitions();
    init_migrate();
    init_manager();
    CACHE_TTL_MS = 6e4;
    settingsCache = /* @__PURE__ */ new Map();
  }
});

// src/lib/tokens.ts
async function getConfirmationSecret() {
  const fromSettings = await getSetting("security.confirmationSecret");
  if (fromSettings) return fromSettings;
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-secret-change-me";
}
async function getTelegramLinkSecret() {
  return await getSetting("security.telegramLinkSecret") || await getSetting("security.confirmationSecret") || "dev-secret-change-me";
}
async function verifyInviteLinkToken(token) {
  if (token.includes(".")) {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data2, signature2] = parts;
    const secret2 = await getTelegramLinkSecret();
    const expectedSignature2 = import_crypto4.default.createHmac("sha256", secret2).update(data2).digest("base64url");
    if (signature2 !== expectedSignature2) return null;
    try {
      const payload = JSON.parse(
        Buffer.from(data2, "base64url").toString()
      );
      if (Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }
  if (token.length < 43) return null;
  const memberId = token.slice(0, 24);
  const exp = token.slice(24, 31);
  const signature = token.slice(31);
  if (!/^[a-f0-9]{24}$/i.test(memberId)) return null;
  if (!/^[0-9a-z]{7}$/.test(exp)) return null;
  if (!/^[a-f0-9]{12}$/i.test(signature)) return null;
  const data = `${memberId}${exp}`;
  const secret = await getTelegramLinkSecret();
  const expectedSignature = import_crypto4.default.createHmac("sha256", secret).update(data).digest("hex").slice(0, 12);
  if (signature !== expectedSignature) return null;
  const expSec = parseInt(exp, 36);
  if (!Number.isFinite(expSec)) return null;
  if (Math.floor(Date.now() / 1e3) > expSec) return null;
  return {
    memberId,
    exp: expSec * 1e3
  };
}
async function createMagicLoginToken(userId, expiresInMinutes = 30) {
  const payload = {
    userId,
    exp: Date.now() + expiresInMinutes * 60 * 1e3
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getConfirmationSecret();
  const signature = import_crypto4.default.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}
async function createUnsubscribeToken(memberId, groupId, expiresInDays = 365) {
  const payload = {
    memberId,
    groupId,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1e3
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getConfirmationSecret();
  const signature = import_crypto4.default.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}
async function getUnsubscribeUrl(token) {
  const baseUrl = await getSetting("general.appUrl") || "http://localhost:3054";
  return `${baseUrl}/api/unsubscribe/${token}`;
}
async function createMemberPortalToken(memberId, groupId, expiresInDays = 90) {
  const payload = {
    memberId,
    groupId,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1e3
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await getConfirmationSecret();
  const signature = import_crypto4.default.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}
async function getMemberPortalUrl(token) {
  const baseUrl = await getSetting("general.appUrl") || "http://localhost:3054";
  return `${baseUrl}/member/${token}`;
}
var import_crypto4;
var init_tokens = __esm({
  "src/lib/tokens.ts"() {
    "use strict";
    import_crypto4 = __toESM(require("crypto"));
    init_service();
  }
});

// src/lib/tasks/idempotency.ts
function buildIdempotencyKey(type, payload, runAt) {
  const day = runAt.toISOString().slice(0, 10);
  switch (type) {
    case "payment_reminder":
      return `payment_reminder:${payload.billingPeriodId}:${payload.paymentId}:${day}`;
    case "aggregated_payment_reminder":
      return `aggregated_payment_reminder:${payload.memberEmail ?? ""}:${day}`;
    case "admin_confirmation_request":
      return `admin_confirmation_request:${payload.groupId}:${payload.billingPeriodId}:${day}`;
    default: {
      const _exhaustive = type;
      return _exhaustive;
    }
  }
}
var init_idempotency = __esm({
  "src/lib/tasks/idempotency.ts"() {
    "use strict";
  }
});

// src/lib/tasks/queue.ts
var queue_exports = {};
__export(queue_exports, {
  claimTasks: () => claimTasks,
  completeTask: () => completeTask,
  enqueueTask: () => enqueueTask,
  failTask: () => failTask,
  getTaskCounts: () => getTaskCounts,
  releaseTask: () => releaseTask
});
async function enqueueTask(input) {
  const store = await db();
  const idempotencyKey = buildIdempotencyKey(
    input.type,
    input.payload,
    input.runAt
  );
  return store.enqueueTask({
    type: input.type,
    runAt: input.runAt,
    payload: input.payload,
    idempotencyKey,
    maxAttempts: input.maxAttempts ?? 5
  });
}
async function claimTasks(workerId, options = {}) {
  const store = await db();
  return store.claimTasks(workerId, {
    limit: options.limit ?? DEFAULT_BATCH_SIZE2,
    lockTtlMs: options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS3,
    recoverStaleLocks: options.recoverStaleLocks
  });
}
async function completeTask(task) {
  const store = await db();
  await store.completeTask(task.id);
}
async function failTask(task, error) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const attempts = (task.attempts ?? 0) + 1;
  const maxAttempts = task.maxAttempts ?? 5;
  const store = await db();
  await store.failTask(task.id, errMessage, attempts, maxAttempts);
}
async function releaseTask(task) {
  const store = await db();
  await store.releaseTask(task.id);
}
async function getTaskCounts() {
  const store = await db();
  return store.getTaskCounts();
}
var DEFAULT_LOCK_TTL_MS3, DEFAULT_BATCH_SIZE2;
var init_queue = __esm({
  "src/lib/tasks/queue.ts"() {
    "use strict";
    init_storage();
    init_idempotency();
    DEFAULT_LOCK_TTL_MS3 = 5 * 60 * 1e3;
    DEFAULT_BATCH_SIZE2 = 50;
  }
});

// src/lib/email/branding.ts
function getAccentColor(accent) {
  return accent && HEX_REGEX.test(accent) ? accent : DEFAULT_ACCENT_COLOR;
}
function buildAutomatedMessageBadgeHtml() {
  return `
    <div style="padding: 10px 24px; background: #f1f5f9; color: #64748b; font-size: 12px; text-align: center; border-bottom: 1px solid #e2e8f0;">
      This is an automated message from your subscription group.
    </div>`;
}
var DEFAULT_ACCENT_COLOR, HEX_REGEX;
var init_branding = __esm({
  "src/lib/email/branding.ts"() {
    "use strict";
    DEFAULT_ACCENT_COLOR = "#3b82f6";
    HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
  }
});

// src/lib/site.ts
var REPO_URL, APP_NAME;
var init_site = __esm({
  "src/lib/site.ts"() {
    "use strict";
    REPO_URL = "https://github.com/n45os/sub5tr4cker";
    APP_NAME = "sub5tr4cker";
  }
});

// src/lib/email/footer.ts
function buildEmailFooterHtml(params = {}) {
  const appName = params.appName ?? APP_NAME;
  const repoUrl = params.repoUrl ?? REPO_URL;
  const unsubscribeUrl = params.unsubscribeUrl ?? null;
  const repoHost = repoUrl.replace(/^https:\/\//, "");
  const repoLink = `<a href="${repoUrl}" style="color: #64748b; text-decoration: underline;">source on GitHub</a>`;
  const lines = [`Sent by ${appName}`, `\xB7`, repoLink];
  if (unsubscribeUrl) {
    lines.push("\xB7", `<a href="${unsubscribeUrl}" style="color: #64748b;">Unsubscribe</a> from these emails`);
  }
  const metaLine = lines.join(" ");
  const urlLine = `<a href="${repoUrl}" style="color: #64748b; word-break: break-all;">${repoHost}</a>`;
  return `
    <p style="margin: 0 0 8px 0;">${metaLine}</p>
    <p style="margin: 0; font-size: 11px; line-height: 1.4;">${urlLine}</p>
  `;
}
var init_footer = __esm({
  "src/lib/email/footer.ts"() {
    "use strict";
    init_site();
    init_site();
  }
});

// src/lib/email/themes.ts
function isEmailTheme(value) {
  if (!value) return false;
  return EMAIL_THEME_IDS.includes(value);
}
function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return {
    r: Number.parseInt(n.slice(0, 2), 16),
    g: Number.parseInt(n.slice(2, 4), 16),
    b: Number.parseInt(n.slice(4, 6), 16)
  };
}
function alpha(hex, opacity) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}
function getThemeCss(theme, accent) {
  const accentSoft = alpha(accent, 0.12);
  const accentStrong = alpha(accent, 0.2);
  const accentBorder = alpha(accent, 0.35);
  if (theme === "minimal") {
    return `
      .container { border-radius: 6px; border: 1px solid #e2e8f0; box-shadow: none; }
      .header { background: #ffffff; color: #0f172a; border-top: 4px solid ${accent}; border-bottom: 1px solid #e2e8f0; }
      .header h1 { letter-spacing: -0.01em; }
      .body { padding: 28px; }
      .btn { border-radius: 6px; background: #0f172a; }
      .btn-secondary { background: #475569; }
      .section-card, .amount-card, .summary-card { border-radius: 6px; }
    `;
  }
  if (theme === "bold") {
    return `
      .container { border-radius: 14px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16); }
      .header { background: linear-gradient(135deg, ${accent}, #0f172a); color: #ffffff; padding: 32px 24px; }
      .header h1 { font-size: 24px; letter-spacing: -0.02em; }
      .body { padding: 28px; }
      .btn { border-radius: 10px; padding: 13px 30px; box-shadow: 0 8px 20px ${accentStrong}; }
      .amount-card { border: 1px solid ${accentBorder}; background: ${accentSoft}; }
      .section-card { border-left: 4px solid ${accent}; }
    `;
  }
  if (theme === "rounded") {
    return `
      .container { border-radius: 20px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12); }
      .header { background: ${accent}; color: #ffffff; border-bottom-left-radius: 18px; border-bottom-right-radius: 18px; }
      .body { padding: 28px; }
      .btn { border-radius: 9999px; padding: 12px 28px; }
      .btn-secondary { border-radius: 9999px; }
      .section-card, .amount-card, .summary-card { border-radius: 14px; }
    `;
  }
  if (theme === "corporate") {
    return `
      .container { border-radius: 4px; border: 1px solid #dbe3ee; box-shadow: 0 6px 16px rgba(15, 23, 42, 0.09); }
      .header { background: #0f172a; color: #ffffff; border-bottom: 4px solid ${accent}; }
      .header h1 { font-size: 20px; letter-spacing: 0; text-transform: uppercase; }
      .body { padding: 24px; }
      .btn { border-radius: 4px; padding: 11px 24px; }
      .section-card, .amount-card, .summary-card { border-radius: 4px; border-color: #cbd5e1; }
      .kicker { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
    `;
  }
  return `
    .container { border-radius: 10px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1); }
    .header { background: ${accent}; color: #ffffff; }
    .header h1 { letter-spacing: -0.01em; }
    .btn { border-radius: 8px; }
    .amount-card { border: 1px solid ${accentBorder}; background: ${accentSoft}; }
  `;
}
function resolveEmailTheme(theme, accentColor) {
  const id = isEmailTheme(theme) ? theme : "clean";
  const accent = getAccentColor(accentColor);
  return {
    id,
    accent,
    css: getThemeCss(id, accent)
  };
}
var EMAIL_THEME_IDS;
var init_themes = __esm({
  "src/lib/email/themes.ts"() {
    "use strict";
    init_branding();
    EMAIL_THEME_IDS = [
      "clean",
      "minimal",
      "bold",
      "rounded",
      "corporate"
    ];
  }
});

// src/lib/email/layout.ts
function buildEmailShell(params) {
  const resolved = resolveEmailTheme(params.theme, params.accentColor);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #f1f5f9;
          padding: 20px;
          color: #0f172a;
        }
        p { margin: 0 0 14px; line-height: 1.55; }
        a { color: ${resolved.accent}; }
        .container {
          max-width: 640px;
          margin: 0 auto;
          background: #ffffff;
          overflow: hidden;
        }
        .header {
          padding: 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1.25;
        }
        .body {
          padding: 24px;
        }
        .kicker {
          margin: 0 0 8px;
          color: #64748b;
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .amount-card,
        .summary-card,
        .section-card {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 10px;
          padding: 14px 16px;
          margin: 14px 0;
        }
        .amount-card .amount {
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 2px 0;
          color: #0f172a;
        }
        .muted {
          color: #64748b;
          font-size: 13px;
        }
        .note-box {
          background: #fffbeb;
          border-left: 4px solid #f59e0b;
          padding: 12px 14px;
          border-radius: 6px;
          margin: 14px 0;
          font-size: 13px;
          color: #78350f;
        }
        .cta { text-align: center; margin: 18px 0; }
        .btn {
          display: inline-block;
          background: ${resolved.accent};
          color: #ffffff !important;
          text-decoration: none;
          font-weight: 600;
          padding: 12px 26px;
        }
        .btn-secondary {
          background: #475569;
        }
        .btn-confirm {
          background: #16a34a;
        }
        .rows { margin-top: 10px; }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px dashed #dbe1ea;
          font-size: 14px;
        }
        .row:last-child { border-bottom: 0; }
        .row .label { color: #64748b; }
        .row .value { color: #0f172a; font-weight: 500; text-align: right; }
        .footer {
          padding: 16px 24px;
          background: #f8fafc;
          color: #94a3b8;
          font-size: 12px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        ${resolved.css}
      </style>
    </head>
    <body>
      <div class="container">
        ${buildAutomatedMessageBadgeHtml()}
        <div class="header">
          <h1>${params.title}</h1>
        </div>
        <div class="body">
          ${params.bodyHtml}
        </div>
        <div class="footer">
          ${buildEmailFooterHtml({ unsubscribeUrl: params.unsubscribeUrl ?? null })}
        </div>
      </div>
    </body>
    </html>
  `;
}
var init_layout = __esm({
  "src/lib/email/layout.ts"() {
    "use strict";
    init_branding();
    init_footer();
    init_themes();
  }
});

// src/lib/email/templates/price-adjustment.ts
var init_price_adjustment = __esm({
  "src/lib/email/templates/price-adjustment.ts"() {
    "use strict";
    init_layout();
  }
});

// src/lib/email/templates/price-change.ts
var init_price_change = __esm({
  "src/lib/email/templates/price-change.ts"() {
    "use strict";
    init_layout();
  }
});

// src/lib/email/client.ts
async function getResend() {
  const apiKey = await getSetting("email.apiKey");
  if (!apiKey) {
    throw new Error("email.apiKey setting is not configured");
  }
  if (!resend || resendKey !== apiKey) {
    resend = new import_resend.Resend(apiKey);
    resendKey = apiKey;
  }
  return resend;
}
async function sendEmail(params) {
  const client = await getResend();
  const defaultFrom = await getSetting("email.fromAddress") || "sub5tr4cker <noreply@example.com>";
  const from = params.from || defaultFrom;
  const replyTo = params.replyTo ?? await getSetting("email.replyToAddress") ?? void 0;
  try {
    const result = await client.emails.send({
      from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      ...replyTo ? { replyTo } : {}
    });
    if (result.error) {
      console.error("email send error:", result.error);
      return null;
    }
    return { id: result.data?.id ?? "unknown" };
  } catch (error) {
    console.error("email send exception:", error);
    return null;
  }
}
var import_resend, resend, resendKey;
var init_client = __esm({
  "src/lib/email/client.ts"() {
    "use strict";
    import_resend = require("resend");
    init_service();
    resend = null;
    resendKey = null;
  }
});

// src/lib/telegram/send.ts
async function sendTelegramMessage(params) {
  if (!await isTelegramEnabled()) return null;
  try {
    const bot2 = await getBot();
    const result = await bot2.api.sendMessage(params.chatId, params.text, {
      parse_mode: params.parseMode ?? "HTML",
      reply_markup: params.keyboard
    });
    return result.message_id;
  } catch (error) {
    console.error("telegram send error:", error);
    return null;
  }
}
var init_send = __esm({
  "src/lib/telegram/send.ts"() {
    "use strict";
    init_bot();
  }
});

// src/lib/plugins/channels.ts
function createEmailChannel() {
  return {
    id: "email",
    name: "Email",
    isBuiltIn: true,
    async send(target, message) {
      if (!target.email || target.preferences?.email === false) {
        return { sent: false, skipped: true };
      }
      const result = await sendEmail({
        to: target.email,
        subject: message.subject,
        html: message.emailHtml
      });
      return { sent: !!result, externalId: result?.id ?? null };
    }
  };
}
function createTelegramChannel() {
  return {
    id: "telegram",
    name: "Telegram",
    isBuiltIn: true,
    async send(target, message) {
      const enabled = await isTelegramEnabled();
      if (!enabled || !target.telegramChatId || target.preferences?.telegram === false) {
        return { sent: false, skipped: true };
      }
      const messageId = await sendTelegramMessage({
        chatId: target.telegramChatId,
        text: message.telegramText,
        keyboard: message.telegramKeyboard
      });
      return { sent: !!messageId, externalId: messageId?.toString() ?? null };
    }
  };
}
function createPluginChannels() {
  const registrations = getPluginChannels();
  const channels = [];
  for (const reg of registrations) {
    channels.push({
      id: `plugin:${reg.pluginSlug}:${reg.id}`,
      name: reg.name,
      isBuiltIn: false,
      async send(target, message, context) {
        try {
          const config = {};
          if (reg.entry.configSchema) {
            for (const key of Object.keys(reg.entry.configSchema)) {
              const value = await getSetting(
                `plugin.${reg.pluginSlug}.${key}`
              );
              if (value != null) config[key] = value;
            }
          }
          const mod = require(reg.resolvedFile);
          const sendFn = mod.send ?? mod.default?.send;
          if (typeof sendFn !== "function") return { sent: false };
          const result = await sendFn(config, {
            subject: message.subject,
            html: message.emailHtml,
            text: message.telegramText
          });
          return {
            sent: !!result?.sent,
            externalId: result?.externalId ?? null
          };
        } catch {
          return { sent: false };
        }
      }
    });
  }
  return channels;
}
function getChannels() {
  if (cachedChannels) return cachedChannels;
  cachedChannels = [
    createEmailChannel(),
    createTelegramChannel(),
    ...createPluginChannels()
  ];
  return cachedChannels;
}
function getBuiltInChannelIds() {
  return /* @__PURE__ */ new Set(["email", "telegram"]);
}
var cachedChannels;
var init_channels = __esm({
  "src/lib/plugins/channels.ts"() {
    "use strict";
    init_client();
    init_send();
    init_bot();
    init_loader();
    init_service();
    cachedChannels = null;
  }
});

// src/lib/notifications/service.ts
async function sendNotification(target, content) {
  const result = {
    email: { sent: false },
    telegram: { sent: false }
  };
  const builtInIds = getBuiltInChannelIds();
  const channels = getChannels().filter((ch) => builtInIds.has(ch.id));
  const message = {
    subject: content.subject,
    emailHtml: content.emailHtml,
    telegramText: content.telegramText,
    telegramKeyboard: content.telegramKeyboard
  };
  const targetPayload = {
    email: target.email,
    telegramChatId: target.telegramChatId ?? null,
    userId: target.userId ?? null,
    preferences: target.preferences
  };
  const context = {
    groupId: content.groupId,
    billingPeriodId: content.billingPeriodId
  };
  for (const channel of channels) {
    const sendResult = await channel.send(targetPayload, message, context);
    const channelKey = channel.id;
    const attempted = !sendResult.skipped;
    if (channelKey === "email") {
      result.email.sent = sendResult.sent;
      result.email.id = sendResult.externalId ?? void 0;
      if (attempted) {
        await logNotification({
          recipientEmail: target.email,
          recipientId: target.userId,
          channel: "email",
          type: content.type,
          subject: content.subject,
          preview: content.subject,
          status: sendResult.sent ? "sent" : "failed",
          externalId: sendResult.externalId ?? null,
          groupId: content.groupId,
          billingPeriodId: content.billingPeriodId,
          emailParams: content.emailParams
        });
      }
    } else if (channelKey === "telegram") {
      result.telegram.sent = sendResult.sent;
      result.telegram.messageId = sendResult.externalId ? Number(sendResult.externalId) : void 0;
      if (attempted) {
        await logNotification({
          recipientEmail: target.email,
          recipientId: target.userId,
          channel: "telegram",
          type: content.type,
          subject: null,
          preview: content.telegramText.substring(0, 100),
          status: sendResult.sent ? "sent" : "failed",
          externalId: sendResult.externalId ?? null,
          groupId: content.groupId,
          billingPeriodId: content.billingPeriodId
        });
      }
    }
  }
  return result;
}
async function logNotification(params) {
  try {
    const store = await db();
    const input = {
      recipientId: params.recipientId ?? null,
      recipientEmail: params.recipientEmail,
      groupId: params.groupId ?? null,
      billingPeriodId: params.billingPeriodId ?? null,
      type: params.type,
      channel: params.channel,
      status: params.status,
      subject: params.subject,
      preview: params.preview,
      emailParams: params.emailParams ?? null,
      externalId: params.externalId ?? null,
      deliveredAt: params.status === "sent" ? /* @__PURE__ */ new Date() : null
    };
    await store.logNotification(input);
  } catch (error) {
    console.error("failed to log notification:", error);
  }
}
var init_service2 = __esm({
  "src/lib/notifications/service.ts"() {
    "use strict";
    init_price_adjustment();
    init_price_change();
    init_storage();
    init_tokens();
    init_channels();
  }
});

// src/lib/notifications/reminder-targeting.ts
function asId(value) {
  return value == null ? "" : value.toString();
}
function getSkipReasons(member, user, sendEmail2, sendTelegram) {
  const reasons = [];
  if (member?.unsubscribedFromEmail) reasons.push("unsubscribed_from_email");
  if (user) {
    if (user.notificationPreferences?.email === false) reasons.push("email_pref_off");
    if (!user.telegram?.chatId) reasons.push("no_telegram_link");
    else if (user.notificationPreferences?.telegram === false) reasons.push("telegram_pref_off");
  }
  if (!sendEmail2 && !sendTelegram) reasons.push("no_reachable_channel");
  return reasons;
}
async function getReminderEligibility(params) {
  const { group, period, payment } = params;
  const member = group.members.find(
    (m) => asId(m.id ?? m._id) === asId(payment.memberId)
  );
  let user = params.user;
  const memberUserId = member?.userId ?? asId(member?.user);
  if (!user && memberUserId) {
    const store = await db();
    const u = await store.getUser(memberUserId);
    user = u ? { telegram: u.telegram, notificationPreferences: u.notificationPreferences } : null;
  }
  const sendEmail2 = !member?.unsubscribedFromEmail && (user?.notificationPreferences?.email ?? true);
  const sendTelegram = !!(user?.telegram?.chatId && (user.notificationPreferences?.telegram ?? false));
  const skipReasons = getSkipReasons(member ?? void 0, user, sendEmail2, sendTelegram);
  return {
    paymentId: payment.id ?? asId(payment._id),
    memberId: asId(payment.memberId),
    memberEmail: payment.memberEmail,
    memberNickname: payment.memberNickname,
    groupId: group.id ?? asId(group._id),
    groupName: group.name,
    periodId: period.id ?? asId(period._id),
    periodLabel: period.periodLabel,
    amount: payment.amount,
    currency: period.currency || "EUR",
    status: payment.status,
    sendEmail: sendEmail2,
    sendTelegram,
    skipReasons
  };
}
var init_reminder_targeting = __esm({
  "src/lib/notifications/reminder-targeting.ts"() {
    "use strict";
    init_storage();
  }
});

// src/lib/telegram/keyboards.ts
function paymentConfirmationKeyboard(periodId, memberId, options) {
  const kb = new import_grammy.InlineKeyboard().text("I've Paid", `confirm:${periodId}:${memberId}`).text("Remind Later", `snooze:${periodId}:${memberId}`);
  if (options?.includePayDetails !== false) {
    kb.row().text("Show paying details", `paydetails:${periodId}:${memberId}`);
  }
  return kb;
}
var import_grammy;
var init_keyboards = __esm({
  "src/lib/telegram/keyboards.ts"() {
    "use strict";
    import_grammy = require("grammy");
  }
});

// src/lib/email/templates/payment-reminder.ts
function buildPaymentReminderEmailHtml(params) {
  const bodyHtml = `
    <p class="kicker">${params.periodLabel}</p>
    <p>Hi ${params.memberName},</p>
    <p>You have an unpaid share for <strong>${params.groupName}</strong>.</p>
    <div class="amount-card">
      <p class="muted">Amount due</p>
      <p class="amount">${params.currency} ${params.amount.toFixed(2)}</p>
      <p class="muted">Managed by ${params.ownerName}</p>
    </div>
    ${params.adjustmentReason || params.priceNote ? `
      <div class="note-box">
        <strong>Note:</strong> ${params.adjustmentReason || params.priceNote}
      </div>
    ` : ""}
    <div class="section-card">
      <p class="kicker">Payment details</p>
      <div class="rows">
        <div class="row">
          <span class="label">Method</span>
          <span class="value" style="text-transform: capitalize;">${params.paymentPlatform.replaceAll("_", " ")}</span>
        </div>
        ${params.paymentLink ? `
          <div class="row">
            <span class="label">Link</span>
            <span class="value"><a href="${params.paymentLink}">Open payment link</a></span>
          </div>
        ` : ""}
        ${params.paymentInstructions ? `
          <div class="row">
            <span class="label">Instructions</span>
            <span class="value">${params.paymentInstructions}</span>
          </div>
        ` : ""}
      </div>
    </div>
    ${params.paymentLink ? `
      <div class="cta">
        <a href="${params.paymentLink}" class="btn">Pay now</a>
      </div>
    ` : ""}
    ${params.confirmUrl ? `
      <div class="cta">
        <a href="${params.confirmUrl}" class="btn btn-confirm">Verify payment</a>
      </div>
    ` : ""}
    ${params.extraText ? `<p class="muted">${params.extraText}</p>` : ""}
    <p>After you pay, click <strong>Verify payment</strong> so your admin can confirm it.</p>
  `;
  return buildEmailShell({
    title: "Payment Reminder",
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null
  });
}
function buildPaymentReminderTelegramText(params) {
  const noteLine = params.adjustmentReason || params.priceNote ? `
\u26A0\uFE0F <i>${params.adjustmentReason || params.priceNote}</i>
` : "";
  return `\u{1F4B3} <b>Payment Reminder</b>

${params.memberName}, you owe <b>${params.amount.toFixed(2)}${params.currency}</b>
for <b>${params.groupName}</b> \u2014 ${params.periodLabel}
` + noteLine + `
` + (params.paymentLink ? `Pay: ${params.paymentLink}

` : "") + `Tap below to verify payment once paid.`;
}
var init_payment_reminder = __esm({
  "src/lib/email/templates/payment-reminder.ts"() {
    "use strict";
    init_layout();
  }
});

// src/lib/notifications/reminder-send.ts
function asId2(value) {
  return value.toString();
}
async function sendReminderForPayment(group, period, payment, options) {
  const eligibility = await getReminderEligibility({ group, period, payment });
  let sendEmail2 = eligibility.sendEmail;
  let sendTelegram = eligibility.sendTelegram;
  if (options?.channelOverride === "email") sendTelegram = false;
  if (options?.channelOverride === "telegram") sendEmail2 = false;
  if (!sendEmail2 && !sendTelegram) {
    return { emailSent: false, telegramSent: false };
  }
  const member = group.members.find(
    (m) => m.id === asId2(payment.memberId)
  );
  const store = await db();
  const user = member?.userId ? await store.getUser(member.userId) : null;
  const periodId = period.id;
  const groupId = group.id;
  const memberId = asId2(payment.memberId);
  const portalToken = await createMemberPortalToken(memberId, groupId);
  const portalUrl = await getMemberPortalUrl(portalToken);
  const confirmUrl = `${portalUrl}?pay=${periodId}&open=confirm`;
  const paymentLink = group.payment?.link ?? null;
  const currency = period.currency || "\u20AC";
  const effectiveAmount = payment.adjustedAmount ?? payment.amount;
  const adjustmentReason = payment.adjustmentReason ?? null;
  const priceNote = period.priceNote ?? null;
  const unsubscribeUrl = sendEmail2 && member ? await getUnsubscribeUrl(
    await createUnsubscribeToken(
      asId2(payment.memberId),
      group.id
    )
  ) : null;
  const reminderTemplateParams = {
    memberName: payment.memberNickname,
    groupName: group.name,
    periodLabel: period.periodLabel,
    amount: effectiveAmount,
    currency,
    paymentPlatform: group.payment?.platform ?? "custom",
    paymentLink,
    paymentInstructions: group.payment?.instructions ?? null,
    confirmUrl,
    ownerName: "the admin",
    extraText: group.announcements?.extraText ?? null,
    adjustmentReason,
    priceNote,
    unsubscribeUrl,
    accentColor: group.service?.accentColor ?? null,
    theme: group.service?.emailTheme ?? "clean"
  };
  const emailHtml = buildPaymentReminderEmailHtml(reminderTemplateParams);
  const emailParams = group.notifications?.saveEmailParams === true ? {
    template: "payment_reminder",
    ...reminderTemplateParams
  } : void 0;
  const keyboard = paymentConfirmationKeyboard(
    period.id,
    asId2(payment.memberId)
  );
  const result = await sendNotification(
    {
      email: payment.memberEmail,
      telegramChatId: user?.telegram?.chatId,
      userId: user?.id,
      preferences: {
        email: sendEmail2,
        telegram: sendTelegram
      }
    },
    {
      type: "payment_reminder",
      subject: `Pay your ${group.service?.name ?? "subscription"} share \u2014 ${period.periodLabel}`,
      emailHtml,
      telegramText: buildPaymentReminderTelegramText({
        memberName: payment.memberNickname,
        groupName: group.name,
        periodLabel: period.periodLabel,
        amount: effectiveAmount,
        currency,
        paymentLink,
        adjustmentReason,
        priceNote
      }),
      telegramKeyboard: keyboard,
      groupId: group.id,
      billingPeriodId: periodId,
      emailParams
    }
  );
  return {
    emailSent: result.email.sent,
    telegramSent: result.telegram.sent
  };
}
var init_reminder_send = __esm({
  "src/lib/notifications/reminder-send.ts"() {
    "use strict";
    init_storage();
    init_service2();
    init_reminder_targeting();
    init_keyboards();
    init_tokens();
    init_payment_reminder();
  }
});

// src/lib/email/templates/aggregated-payment-reminder.ts
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function buildAggregatedIntroText(distinctPeriodCount, distinctGroupCount) {
  if (distinctGroupCount <= 1) {
    return `You have unpaid amounts for ${distinctPeriodCount} billing period(s):`;
  }
  return `You have unpaid amounts for ${distinctPeriodCount} billing period(s) across ${distinctGroupCount} subscription groups:`;
}
function buildAggregatedPaymentReminderEmailHtml(params) {
  const totalAmount = params.entries.reduce((sum, e) => sum + e.amount, 0);
  const currency = params.entries[0]?.currency ?? "\u20AC";
  const sectionsHtml = params.entries.map((entry) => {
    const note7 = entry.adjustmentReason || entry.priceNote ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 12px 0; font-size: 13px; color: #78350f;">
              <strong>Note:</strong> ${escapeHtml(entry.adjustmentReason || entry.priceNote || "")}
            </div>` : "";
    const payBtn = entry.paymentLink ? `<div style="text-align: center; margin: 16px 0;">
             <a href="${escapeHtml(entry.paymentLink)}" class="btn">Pay now</a>
           </div>` : "";
    const confirmBtn = entry.confirmUrl ? `<div style="text-align: center; margin: 16px 0;">
             <a href="${escapeHtml(entry.confirmUrl)}" class="btn btn-confirm">Verify payment</a>
           </div>` : "";
    return `
        <div class="section-card" style="border-left: 4px solid ${entry.accentColor || "#3b82f6"};">
          <p class="kicker">${escapeHtml(entry.serviceName)}</p>
          <p style="margin: 0 0 4px; font-weight: 600;">${escapeHtml(entry.groupName)} \u2014 ${escapeHtml(entry.periodLabel)}</p>
          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${entry.currency} ${entry.amount.toFixed(2)}</p>
          <div class="rows">
            <div class="row">
              <span class="label">Method</span>
              <span class="value" style="text-transform: capitalize;">${escapeHtml(entry.paymentPlatform.replaceAll("_", " "))}</span>
            </div>
            ${entry.paymentInstructions ? `
              <div class="row">
                <span class="label">Instructions</span>
                <span class="value">${escapeHtml(entry.paymentInstructions)}</span>
              </div>
            ` : ""}
          </div>
          ${note7}
          ${payBtn}
          ${confirmBtn}
        </div>`;
  }).join("");
  const bodyHtml = `
    <p>Hi ${escapeHtml(params.memberName)},</p>
    <p>${escapeHtml(buildAggregatedIntroText(params.distinctPeriodCount, params.distinctGroupCount))}</p>
    <div class="summary-card">
      <p class="kicker">Total due</p>
      <p class="amount">${currency} ${totalAmount.toFixed(2)}</p>
      <p class="muted">${params.distinctPeriodCount} period(s) \xB7 ${params.distinctGroupCount} group(s)</p>
    </div>
    ${sectionsHtml}
    <p class="muted">Use the verify button after each transfer so the admin can approve it.</p>
  `;
  return buildEmailShell({
    title: "Payment Reminders",
    bodyHtml,
    accentColor: params.accentColor ?? params.entries[0]?.accentColor ?? null,
    theme: params.theme ?? params.entries[0]?.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null
  });
}
function buildAggregatedPaymentReminderTelegramText(params) {
  const totalAmount = params.entries.reduce((sum, e) => sum + e.amount, 0);
  const currency = params.entries[0]?.currency ?? "\u20AC";
  const intro8 = buildAggregatedIntroText(
    params.distinctPeriodCount,
    params.distinctGroupCount
  );
  const lines = [
    "\u{1F4B3} <b>Payment Reminders</b>",
    "",
    `${params.memberName}, ${intro8.replace(/^You have /, "you have ")}`,
    `<b>Total: ${totalAmount.toFixed(2)}${currency}</b>`,
    ""
  ];
  for (const entry of params.entries) {
    const note7 = entry.adjustmentReason || entry.priceNote ? `
\u26A0\uFE0F <i>${entry.adjustmentReason || entry.priceNote}</i>` : "";
    lines.push(
      `\u2022 <b>${entry.groupName}</b> \u2014 ${entry.periodLabel}: ${entry.amount.toFixed(2)}${entry.currency}${note7}`
    );
    if (entry.paymentLink) {
      lines.push(`  Pay: ${entry.paymentLink}`);
    }
  }
  lines.push("", "Tap below to verify payment once paid (per group).");
  return lines.join("\n");
}
var init_aggregated_payment_reminder = __esm({
  "src/lib/email/templates/aggregated-payment-reminder.ts"() {
    "use strict";
    init_layout();
  }
});

// src/lib/notifications/aggregated-reminder-send.ts
function asId3(value) {
  return value == null ? "" : value.toString();
}
async function sendAggregatedReminder(memberEmail, memberName, payments, options) {
  if (payments.length === 0) {
    return { emailSent: false, telegramSent: false };
  }
  const store = await db();
  const user = await store.getUserByEmail(memberEmail);
  const sendEmail2 = user?.notificationPreferences?.email ?? true;
  const sendTelegram = !!(user?.telegram?.chatId && (user.notificationPreferences?.telegram ?? false));
  let wantEmail = sendEmail2;
  let wantTelegram = sendTelegram;
  if (options?.channelOverride === "email") wantTelegram = false;
  if (options?.channelOverride === "telegram") wantEmail = false;
  if (!wantEmail && !wantTelegram) {
    return { emailSent: false, telegramSent: false };
  }
  const entries = [];
  for (const { group, period, payment } of payments) {
    const periodId = period.id ?? asId3(period._id);
    const groupId = group.id ?? asId3(group._id);
    const memberId = asId3(payment.memberId);
    const portalToken = await createMemberPortalToken(memberId, groupId);
    const portalUrl = await getMemberPortalUrl(portalToken);
    const confirmUrl = `${portalUrl}?pay=${periodId}&open=confirm`;
    const effectiveAmount = payment.adjustedAmount ?? payment.amount;
    entries.push({
      groupName: group.name,
      serviceName: group.service?.name ?? "subscription",
      periodLabel: period.periodLabel,
      amount: effectiveAmount,
      currency: period.currency || "\u20AC",
      paymentPlatform: group.payment?.platform ?? "custom",
      paymentLink: group.payment?.link ?? null,
      paymentInstructions: group.payment?.instructions ?? null,
      confirmUrl,
      adjustmentReason: payment.adjustmentReason ?? null,
      priceNote: period.priceNote ?? null,
      accentColor: group.service?.accentColor ?? null,
      theme: group.service?.emailTheme ?? "clean"
    });
  }
  const distinctGroupCount = new Set(
    payments.map((i) => i.group.id ?? asId3(i.group._id))
  ).size;
  const distinctPeriodCount = new Set(
    payments.map((i) => i.period.id ?? asId3(i.period._id))
  ).size;
  const first = payments[0];
  const firstMemberId = asId3(first.payment.memberId);
  const firstGroupId = first.group.id ?? asId3(first.group._id);
  const unsubscribeUrl = wantEmail ? await getUnsubscribeUrl(
    await createUnsubscribeToken(firstMemberId, firstGroupId)
  ) : null;
  const accentColor = entries[0]?.accentColor ?? null;
  const aggregatedTemplateParams = {
    memberName,
    entries,
    distinctGroupCount,
    distinctPeriodCount,
    unsubscribeUrl,
    accentColor,
    theme: entries[0]?.theme ?? "clean"
  };
  const emailHtml = buildAggregatedPaymentReminderEmailHtml(aggregatedTemplateParams);
  const saveEmailParams = payments.some(
    (p7) => p7.group.notifications?.saveEmailParams === true
  );
  const emailParams = saveEmailParams ? {
    template: "aggregated_payment_reminder",
    ...aggregatedTemplateParams
  } : void 0;
  const telegramText = buildAggregatedPaymentReminderTelegramText({
    memberName,
    entries,
    distinctGroupCount,
    distinctPeriodCount
  });
  const firstPeriodId = first.period.id ?? asId3(first.period._id);
  const keyboard = paymentConfirmationKeyboard(firstPeriodId, firstMemberId, {
    includePayDetails: distinctGroupCount === 1
  });
  const result = await sendNotification(
    {
      email: memberEmail,
      telegramChatId: user?.telegram?.chatId ?? null,
      userId: user?.id ?? null,
      preferences: {
        email: wantEmail,
        telegram: wantTelegram
      }
    },
    {
      type: "payment_reminder",
      subject: distinctGroupCount > 1 ? `Payment reminders \u2014 ${distinctPeriodCount} period(s), ${distinctGroupCount} groups` : `Payment reminders \u2014 ${distinctPeriodCount} period(s)`,
      emailHtml,
      telegramText,
      telegramKeyboard: keyboard,
      groupId: firstGroupId,
      billingPeriodId: firstPeriodId,
      emailParams
    }
  );
  return {
    emailSent: result.email.sent,
    telegramSent: result.telegram.sent
  };
}
var init_aggregated_reminder_send = __esm({
  "src/lib/notifications/aggregated-reminder-send.ts"() {
    "use strict";
    init_storage();
    init_service2();
    init_keyboards();
    init_tokens();
    init_aggregated_payment_reminder();
  }
});

// src/lib/email/templates/admin-follow-up.ts
function buildAdminFollowUpEmailHtml(params) {
  const totalAmount = params.unverifiedMembers.reduce(
    (sum, member) => sum + member.amount,
    0
  );
  const rows = params.unverifiedMembers.map(
    (member) => `
        <div class="row">
          <span class="label">${member.memberNickname}</span>
          <span class="value">${params.currency} ${member.amount.toFixed(2)}</span>
        </div>
      `
  ).join("");
  const bodyHtml = `
    <p>The following members marked payment as completed for <strong>${params.groupName}</strong> \u2014 ${params.periodLabel}.</p>
    <div class="summary-card">
      <p class="kicker">Awaiting admin verification</p>
      <p class="amount">${params.currency} ${totalAmount.toFixed(2)}</p>
      <p class="muted">${params.unverifiedMembers.length} member(s) pending</p>
      <div class="rows">${rows}</div>
    </div>
    <p>Please verify these payments in the dashboard.</p>
    ${params.dashboardUrl ? `
      <div class="cta">
        <a href="${params.dashboardUrl}" class="btn">Verify in dashboard</a>
      </div>
    ` : ""}
  `;
  return buildEmailShell({
    title: "Payments Awaiting Verification",
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null
  });
}
function buildAdminFollowUpTelegramText(params) {
  return `\u{1F4CB} <b>Payments awaiting your verification</b>

<b>${params.groupName}</b> \u2014 ${params.periodLabel}

` + params.unverifiedMembers.map(
    (member) => `\u2022 ${member.memberNickname} \u2014 ${member.amount.toFixed(2)}${params.currency}`
  ).join("\n");
}
var init_admin_follow_up = __esm({
  "src/lib/email/templates/admin-follow-up.ts"() {
    "use strict";
    init_layout();
  }
});

// src/lib/notifications/admin-nudge.ts
async function sendAdminConfirmationNudge(group, period) {
  const unverified = period.payments.filter(
    (p7) => p7.status === "member_confirmed"
  );
  if (unverified.length === 0) return;
  const store = await db();
  const admin = await store.getUser(group.adminId);
  if (!admin) return;
  const appUrl = (await getSetting("general.appUrl") || "").replace(/\/$/, "");
  const dashboardUrl = appUrl ? `${appUrl}/dashboard/groups/${group.id}/billing` : null;
  const templateParams = {
    groupName: group.name,
    periodLabel: period.periodLabel,
    currency: period.currency,
    unverifiedMembers: unverified.map(
      (payment) => ({
        memberNickname: payment.memberNickname,
        amount: payment.amount
      })
    ),
    dashboardUrl,
    accentColor: group.service?.accentColor ?? null,
    theme: group.service?.emailTheme ?? "clean"
  };
  const emailHtml = buildAdminFollowUpEmailHtml(templateParams);
  const telegramText = buildAdminFollowUpTelegramText(templateParams);
  const emailParams = group.notifications?.saveEmailParams === true ? { template: "admin_follow_up", ...templateParams } : void 0;
  const telegramPref = admin.notificationPreferences?.telegram ?? false;
  const emailPref = admin.notificationPreferences?.email ?? true;
  const botOn = await isTelegramEnabled();
  const canDeliverTelegram = telegramPref && !!admin.telegram?.chatId && botOn;
  await sendNotification(
    {
      email: admin.email,
      telegramChatId: admin.telegram?.chatId,
      userId: admin.id,
      preferences: {
        telegram: telegramPref,
        email: !canDeliverTelegram && emailPref
      }
    },
    {
      type: "admin_confirmation_request",
      subject: `Verify payments for ${group.name} \u2014 ${period.periodLabel}`,
      emailHtml,
      telegramText,
      groupId: group.id,
      billingPeriodId: period.id,
      emailParams
    }
  );
}
var init_admin_nudge = __esm({
  "src/lib/notifications/admin-nudge.ts"() {
    "use strict";
    init_storage();
    init_service2();
    init_admin_follow_up();
    init_bot();
    init_service();
  }
});

// src/lib/tasks/worker.ts
function isPaymentStillUnpaid(payment) {
  return payment.status === "pending" || payment.status === "overdue";
}
async function executeTask(task) {
  const payload = task.payload;
  try {
    const store = await db();
    switch (task.type) {
      case "payment_reminder": {
        if (!payload.billingPeriodId || !payload.paymentId) {
          throw new Error("payment_reminder task missing billingPeriodId or paymentId");
        }
        const group = payload.groupId ? await store.getGroup(payload.groupId) : null;
        const period = payload.groupId ? await store.getBillingPeriod(payload.billingPeriodId, payload.groupId) : null;
        if (!group || !period) {
          throw new Error("group or period not found");
        }
        const payment = period.payments.find(
          (p7) => p7.id === payload.paymentId
        );
        if (!payment) {
          throw new Error("payment not found");
        }
        if (!isPaymentStillUnpaid(payment)) {
          await completeTask(task);
          return;
        }
        await sendReminderForPayment(group, period, payment);
        break;
      }
      case "aggregated_payment_reminder": {
        if (!payload.memberEmail || !payload.payments?.length) {
          throw new Error(
            "aggregated_payment_reminder task missing memberEmail or payments"
          );
        }
        const inputs = [];
        for (const ref of payload.payments) {
          const group = await store.getGroup(ref.groupId);
          const period = await store.getBillingPeriod(ref.billingPeriodId, ref.groupId);
          if (!group || !period) continue;
          const payment = period.payments.find(
            (p7) => p7.id === ref.paymentId
          );
          if (!payment) continue;
          if (!isPaymentStillUnpaid(payment)) continue;
          inputs.push({
            group,
            period,
            payment
          });
        }
        if (inputs.length === 0) {
          await completeTask(task);
          return;
        }
        const memberName = inputs[0].payment.memberNickname;
        await sendAggregatedReminder(
          payload.memberEmail,
          memberName,
          inputs
        );
        break;
      }
      case "admin_confirmation_request": {
        if (!payload.billingPeriodId) {
          throw new Error("admin_confirmation_request task missing billingPeriodId");
        }
        const group = payload.groupId ? await store.getGroup(payload.groupId) : null;
        const period = payload.groupId ? await store.getBillingPeriod(payload.billingPeriodId, payload.groupId) : null;
        if (!group || !period) {
          throw new Error("group or period not found");
        }
        await sendAdminConfirmationNudge(group, period);
        break;
      }
      default:
        throw new Error(`unsupported task type: ${task.type}`);
    }
    await completeTask(task);
  } catch (error) {
    await failTask(task, error);
    throw error;
  }
}
async function runWorkerBatch(workerId, options = {}) {
  const { claimTasks: claimTasks2 } = await Promise.resolve().then(() => (init_queue(), queue_exports));
  const tasks = await claimTasks2(workerId, {
    ...options,
    recoverStaleLocks: options.recoverStaleLocks ?? true
  });
  let completed = 0;
  let failed = 0;
  for (const task of tasks) {
    try {
      await executeTask(task);
      completed++;
    } catch {
      failed++;
    }
  }
  return { claimed: tasks.length, completed, failed };
}
var init_worker = __esm({
  "src/lib/tasks/worker.ts"() {
    "use strict";
    init_storage();
    init_reminder_send();
    init_aggregated_reminder_send();
    init_admin_nudge();
    init_queue();
  }
});

// src/jobs/run-notification-tasks.ts
var run_notification_tasks_exports = {};
__export(run_notification_tasks_exports, {
  runNotificationTasks: () => runNotificationTasks
});
async function runNotificationTasks(options) {
  const workerId = typeof process !== "undefined" && process.env.HOSTNAME ? `${process.env.HOSTNAME}:${process.pid}` : `worker:${process.pid}`;
  return runWorkerBatch(workerId, {
    limit: options?.limit ?? DEFAULT_BATCH_SIZE3,
    lockTtlMs: LOCK_TTL_MS,
    recoverStaleLocks: true
  });
}
var DEFAULT_BATCH_SIZE3, LOCK_TTL_MS;
var init_run_notification_tasks = __esm({
  "src/jobs/run-notification-tasks.ts"() {
    "use strict";
    init_worker();
    DEFAULT_BATCH_SIZE3 = 50;
    LOCK_TTL_MS = 5 * 60 * 1e3;
  }
});

// src/lib/email/templates/group-invite.ts
function buildInvitePaymentSection(params) {
  if (params.paymentLink) {
    return `
      <div class="section-card">
        <p class="kicker">Payment details</p>
        <div class="rows">
          <div class="row">
            <span class="label">Method</span>
            <span class="value" style="text-transform: capitalize;">${params.paymentPlatform.replaceAll("_", " ")}</span>
          </div>
          <div class="row">
            <span class="label">Payment link</span>
            <span class="value"><a href="${params.paymentLink}">Open payment link</a></span>
          </div>
          ${params.paymentInstructions ? `
            <div class="row">
              <span class="label">Instructions</span>
              <span class="value">${params.paymentInstructions}</span>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }
  if (params.paymentInstructions) {
    return `
      <div class="section-card">
        <p class="kicker">Payment instructions</p>
        <p>${params.paymentInstructions}</p>
      </div>
    `;
  }
  return "";
}
function buildTelegramWelcomeEmailHtml(params) {
  const settingsUrl = params.isPublic && params.appUrl ? `${params.appUrl.replace(/\/$/, "")}/dashboard/settings` : null;
  const telegramSection = params.telegramBotUsername ? params.telegramInviteLink ? `
        <div class="section-card">
          <p class="kicker">Telegram linked</p>
          <p>Your Telegram account is now linked for payment reminders and confirmations.</p>
          <div class="cta">
            <a href="${params.telegramInviteLink}" class="btn btn-secondary">Open Telegram chat</a>
          </div>
        </div>` : `
        <div class="section-card">
          <p class="kicker">Telegram linked</p>
          <p>Your Telegram account is now linked with <strong>@${params.telegramBotUsername}</strong>.</p>
        </div>` : "";
  const bodyHtml = `
    <p>Hi ${params.memberName},</p>
    <p>Your Telegram account is now linked for <strong>${params.groupName}</strong>.</p>
    <div class="cta">
      <a href="${params.magicLoginUrl}" class="btn">Sign in to sub5tr4cker</a>
    </div>
    <div class="section-card">
      <p class="kicker">Billing setup</p>
      <p>${params.billingSummary}</p>
    </div>
    ${buildInvitePaymentSection(params)}
    ${telegramSection}
    ${settingsUrl ? `<p class="muted">Manage channels: <a href="${settingsUrl}">${settingsUrl}</a></p>` : ""}
  `;
  return buildEmailShell({
    title: `Welcome to ${params.groupName}`,
    bodyHtml,
    accentColor: params.accentColor ?? null,
    theme: params.theme ?? null,
    unsubscribeUrl: params.unsubscribeUrl ?? null
  });
}
var init_group_invite = __esm({
  "src/lib/email/templates/group-invite.ts"() {
    "use strict";
    init_layout();
  }
});

// src/lib/telegram/payment-details-text.ts
function formatGroupPaymentDetailsPlainText(group) {
  const platform = PLATFORM_LABEL[group.payment.platform] ?? group.payment.platform;
  const lines = [
    `\u{1F4B3} How to pay \u2014 ${group.name}`,
    "",
    `Platform: ${platform}`
  ];
  const link = group.payment.link?.trim();
  if (link) {
    lines.push("", `Pay link: ${link}`);
  }
  const instructions = group.payment.instructions?.trim();
  if (instructions) {
    lines.push("", instructions);
  }
  const extra = group.announcements?.extraText?.trim();
  if (extra) {
    lines.push("", `Note from admin: ${extra}`);
  }
  if (!link && !instructions) {
    lines.push(
      "",
      "No payment link or instructions are set for this group yet. Ask your admin in the app if you need help."
    );
  }
  return lines.join("\n");
}
var PLATFORM_LABEL;
var init_payment_details_text = __esm({
  "src/lib/telegram/payment-details-text.ts"() {
    "use strict";
    PLATFORM_LABEL = {
      revolut: "Revolut",
      paypal: "PayPal",
      bank_transfer: "Bank transfer",
      stripe: "Stripe",
      custom: "Custom"
    };
  }
});

// src/lib/telegram/handlers.ts
function buildBillingSummary(group) {
  const { billing } = group;
  const cycle = billing.cycleType === "yearly" ? "year" : "month";
  const price = `${billing.currentPrice} ${billing.currency}`;
  if (billing.mode === "equal_split") {
    return `${price} per ${cycle}, equal split`;
  }
  if (billing.mode === "fixed_amount" && billing.fixedMemberAmount != null) {
    return `${billing.fixedMemberAmount} ${billing.currency} per member per ${cycle}`;
  }
  return `${price} per ${cycle} (variable)`;
}
function isPublicAppUrl(appUrl) {
  if (!appUrl || !appUrl.trim()) return false;
  const value = appUrl.trim().toLowerCase();
  return !value.startsWith("http://localhost") && !value.startsWith("https://localhost");
}
function registerHandlers(bot2) {
  bot2.command("start", async (ctx) => {
    const raw = typeof ctx.match === "string" ? ctx.match : "";
    const payload = raw.trim();
    try {
      if (payload.startsWith("link_")) {
        const code = payload.replace("link_", "").trim();
        await handleAccountLink(ctx, code);
        return;
      }
      if (payload.startsWith("invite_")) {
        const token = payload.replace("invite_", "").trim();
        await handleInviteLink(ctx, token);
        return;
      }
      await ctx.reply(
        "Welcome to sub5tr4cker!\n\nI help you manage shared subscription payments.\n\nLink your account from the sub5tr4cker web app to get started."
      );
    } catch (err) {
      console.error("telegram /start handler error:", err);
      await ctx.reply("Something went wrong. Please try again or generate a new link from the app.").catch(() => {
      });
    }
  });
  bot2.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const parts = data.split(":");
    if (parts.length < 3) {
      await ctx.answerCallbackQuery({ text: "Invalid action" });
      return;
    }
    const [action, periodId, memberId] = parts;
    switch (action) {
      case "confirm":
        await handleMemberConfirm(ctx, periodId, memberId);
        break;
      case "paydetails":
        await handlePayDetails(ctx, periodId);
        break;
      case "snooze":
        await handleSnooze(ctx);
        break;
      case "admin_confirm":
        await handleAdminConfirm(ctx, periodId, memberId);
        break;
      case "admin_reject":
        await handleAdminReject(ctx, periodId, memberId);
        break;
      default:
        await ctx.answerCallbackQuery({ text: "Unknown action" });
    }
  });
}
async function handleMemberConfirm(ctx, periodId, memberId) {
  const store = await db();
  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }
  const payment = period.payments.find((p7) => p7.memberId === memberId);
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }
  if (payment.status !== "pending" && payment.status !== "overdue") {
    await ctx.answerCallbackQuery({ text: "Already confirmed!" });
    return;
  }
  await store.updatePaymentStatus(periodId, memberId, {
    status: "member_confirmed",
    memberConfirmedAt: /* @__PURE__ */ new Date()
  });
  await ctx.answerCallbackQuery?.({ text: "Marked as paid!" });
  await ctx.editMessageText?.(
    "You've confirmed payment for this period. Waiting for admin verification."
  );
  const group = await store.getGroup(period.groupId);
  if (group) {
    await enqueueTask({
      type: "admin_confirmation_request",
      runAt: /* @__PURE__ */ new Date(),
      payload: {
        groupId: group.id,
        billingPeriodId: periodId
      }
    });
    await runNotificationTasks({ limit: 5 });
  }
}
async function handlePayDetails(ctx, periodId) {
  const store = await db();
  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }
  const group = await store.getGroup(period.groupId);
  if (!group) {
    await ctx.answerCallbackQuery({ text: "Group not found" });
    return;
  }
  const detailText = formatGroupPaymentDetailsPlainText(group);
  await ctx.answerCallbackQuery({
    text: "Sending how-to-pay details in a follow-up message."
  }).catch(() => {
  });
  await ctx.reply(detailText).catch((err) => {
    console.error("telegram paydetails reply error:", err);
  });
}
async function handleSnooze(ctx) {
  await ctx.answerCallbackQuery?.({
    text: "OK, I'll remind you again later."
  });
  await ctx.editMessageText?.(
    "Snoozed. You'll get another reminder soon. Don't forget to pay!"
  );
}
async function handleAdminConfirm(ctx, periodId, memberId) {
  const store = await db();
  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }
  const payment = period.payments.find((p7) => p7.memberId === memberId);
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }
  const updated = await store.updatePaymentStatus(periodId, memberId, {
    status: "confirmed",
    adminConfirmedAt: /* @__PURE__ */ new Date()
  });
  const payAfter = updated.payments.find((p7) => p7.memberId === memberId);
  await ctx.answerCallbackQuery?.({ text: "Payment confirmed!" });
  await ctx.editMessageText?.(
    `Confirmed payment from ${payAfter?.memberNickname ?? payment.memberNickname} (${payment.amount.toFixed(2)}${updated.currency}).`
  );
}
async function handleAdminReject(ctx, periodId, memberId) {
  const store = await db();
  const period = await store.getBillingPeriodById(periodId);
  if (!period) {
    await ctx.answerCallbackQuery({ text: "Period not found" });
    return;
  }
  const payment = period.payments.find((p7) => p7.memberId === memberId);
  if (!payment) {
    await ctx.answerCallbackQuery({ text: "Payment not found" });
    return;
  }
  await store.updatePaymentStatus(periodId, memberId, {
    status: "pending",
    memberConfirmedAt: null
  });
  await ctx.answerCallbackQuery?.({ text: "Payment rejected" });
  await ctx.editMessageText?.(
    `Rejected payment claim from ${payment.memberNickname}. They'll be reminded again.`
  );
}
async function handleAccountLink(ctx, code) {
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username ?? null;
  if (!chatId) {
    await ctx.reply("Could not get chat id.");
    return;
  }
  if (!code || code.length < 8) {
    await ctx.reply(
      "Invalid link. Generate a new one from the app Profile page."
    );
    return;
  }
  const store = await db();
  const now2 = /* @__PURE__ */ new Date();
  const user = await store.linkTelegramAccountWithLinkCode({
    code,
    chatId,
    username,
    now: now2
  });
  if (!user) {
    await ctx.reply(
      "This link has expired or is invalid. Generate a new one from the app Profile page."
    );
    return;
  }
  await ctx.reply(
    "\u2705 Account linked! You\u2019ll receive payment reminders here when enabled for your groups."
  );
}
async function handleInviteLink(ctx, token) {
  const payload = await verifyInviteLinkToken(token);
  if (!payload) {
    await ctx.reply(
      "This invite link has expired or is invalid. Ask your group admin to send you a new invite."
    );
    return;
  }
  const store = await db();
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username ?? null;
  if (!chatId) {
    await ctx.reply("Could not get chat id.");
    return;
  }
  const group = await store.findActiveGroupForMemberInvitation({
    groupId: payload.groupId ?? null,
    memberId: payload.memberId
  });
  if (!group) {
    await ctx.reply("This invite link is no longer valid.");
    return;
  }
  const member = group.members.find(
    (m) => m.id === payload.memberId && m.isActive && !m.leftAt
  );
  if (!member) {
    await ctx.reply("This invite link is no longer valid.");
    return;
  }
  const wasAccepted = !!member.acceptedAt;
  const now2 = /* @__PURE__ */ new Date();
  const normalizedEmail = member.email.toLowerCase().trim();
  let user = member.userId ? await store.getUser(member.userId) : null;
  if (!user) {
    user = await store.getUserByEmail(normalizedEmail);
  }
  if (!user) {
    user = await store.createUser({
      name: member.nickname.trim() || normalizedEmail,
      email: normalizedEmail,
      role: "user",
      hashedPassword: null,
      notificationPreferences: {
        email: true,
        telegram: true,
        reminderFrequency: "every_3_days"
      }
    });
  } else {
    await store.updateUser(user.id, {
      telegram: {
        chatId,
        username,
        linkedAt: now2
      },
      notificationPreferences: {
        ...user.notificationPreferences,
        telegram: true
      }
    });
    user = await store.getUser(user.id);
  }
  const nextMembers = group.members.map(
    (m) => m.id === member.id ? {
      ...m,
      userId: user.id,
      acceptedAt: m.acceptedAt ?? now2
    } : m
  );
  await store.updateGroup(group.id, { members: nextMembers });
  const shouldSendWelcomeEmail = !wasAccepted && await store.tryClaimWelcomeEmailSentAt(user.id, now2);
  if (shouldSendWelcomeEmail) {
    const appUrlSetting = await getSetting("general.appUrl");
    const baseUrl = (appUrlSetting?.trim() || "http://localhost:3054").replace(
      /\/$/,
      ""
    );
    const magicToken = await createMagicLoginToken(user.id);
    const magicLoginUrl = `${baseUrl}/invite-callback?token=${encodeURIComponent(magicToken)}&groupId=${encodeURIComponent(group.id)}`;
    const sendEmail2 = !member.unsubscribedFromEmail;
    const unsubscribeUrl = sendEmail2 ? await getUnsubscribeUrl(
      await createUnsubscribeToken(member.id, group.id)
    ) : null;
    const adminUser = await store.getUser(group.adminId);
    const telegramWelcomeParams = {
      memberName: member.nickname,
      groupName: group.name,
      groupId: group.id,
      serviceName: group.service.name,
      adminName: adminUser?.name ?? "The group admin",
      billingSummary: buildBillingSummary(group),
      paymentPlatform: group.payment.platform,
      paymentLink: group.payment.link ?? null,
      paymentInstructions: group.payment.instructions ?? null,
      isPublic: isPublicAppUrl(appUrlSetting),
      appUrl: appUrlSetting?.trim() || null,
      telegramBotUsername: null,
      telegramInviteLink: null,
      unsubscribeUrl,
      accentColor: group.service?.accentColor ?? null,
      theme: group.service?.emailTheme ?? "clean",
      magicLoginUrl
    };
    const emailHtml = buildTelegramWelcomeEmailHtml(telegramWelcomeParams);
    const emailParams = group.notifications?.saveEmailParams === true ? { template: "telegram_welcome", ...telegramWelcomeParams } : void 0;
    await sendNotification(
      {
        email: user.email,
        telegramChatId: null,
        userId: user.id,
        preferences: {
          email: sendEmail2,
          telegram: false
        }
      },
      {
        type: "invite",
        subject: `Welcome to ${group.name}`,
        emailHtml,
        telegramText: `Welcome to ${group.name}`,
        groupId: group.id,
        emailParams
      }
    );
    await ctx.reply(
      "\u2705 Account linked! Check your email for a secure sign-in link to open your dashboard."
    );
    return;
  }
  await ctx.reply(
    "\u2705 Account linked! You\u2019ll receive payment reminders here when enabled for your groups."
  );
}
var init_handlers = __esm({
  "src/lib/telegram/handlers.ts"() {
    "use strict";
    init_storage();
    init_tokens();
    init_service();
    init_queue();
    init_run_notification_tasks();
    init_service2();
    init_group_invite();
    init_payment_details_text();
  }
});

// src/lib/telegram/bot.ts
async function getBot() {
  const token = await getSetting("telegram.botToken");
  if (!token) {
    throw new Error("telegram.botToken setting is not configured");
  }
  if (bot && botToken === token) {
    return bot;
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    const instance = new import_grammy2.Bot(token);
    registerHandlers(instance);
    await instance.init();
    botToken = token;
    bot = instance;
    initPromise = null;
    return instance;
  })();
  return initPromise;
}
async function isTelegramEnabled() {
  if (bot && botToken) {
    return true;
  }
  const token = await getSetting("telegram.botToken");
  return !!token;
}
var import_grammy2, bot, botToken, initPromise;
var init_bot = __esm({
  "src/lib/telegram/bot.ts"() {
    "use strict";
    import_grammy2 = require("grammy");
    init_handlers();
    init_service();
    bot = null;
    botToken = null;
    initPromise = null;
  }
});

// src/lib/telegram/polling.ts
var polling_exports = {};
__export(polling_exports, {
  pollOnce: () => pollOnce,
  startPolling: () => startPolling
});
function getPollingLockPath() {
  return import_path9.default.join(getDataDir(), "telegram-polling.lock");
}
function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function readLockPid() {
  const lockPath = getPollingLockPath();
  if (!import_fs7.default.existsSync(lockPath)) return null;
  const raw = import_fs7.default.readFileSync(lockPath, "utf-8").trim();
  const pid = Number(raw);
  if (!Number.isFinite(pid) || pid <= 0) {
    import_fs7.default.rmSync(lockPath, { force: true });
    return null;
  }
  if (!isPidAlive(pid)) {
    import_fs7.default.rmSync(lockPath, { force: true });
    return null;
  }
  return pid;
}
function claimPollingLock() {
  const existingPid = readLockPid();
  if (existingPid) {
    return existingPid === process.pid;
  }
  import_fs7.default.mkdirSync(getDataDir(), { recursive: true });
  import_fs7.default.writeFileSync(getPollingLockPath(), String(process.pid), "utf-8");
  return true;
}
function releasePollingLock() {
  const existingPid = readLockPid();
  if (existingPid === process.pid) {
    import_fs7.default.rmSync(getPollingLockPath(), { force: true });
  }
}
async function pollOnce() {
  const activePid = readLockPid();
  if (activePid && activePid !== process.pid) {
    console.log(`[telegram] skipping pollOnce because pid ${activePid} is already polling`);
    return 0;
  }
  const bot2 = await getBot();
  const config = readConfig();
  const lastUpdateId = config?.notifications.channels.telegram?.lastUpdateId;
  const offset = lastUpdateId !== void 0 ? lastUpdateId + 1 : void 0;
  const updates = await bot2.api.getUpdates({ offset, timeout: 0, limit: 100 });
  if (updates.length === 0) return 0;
  for (const update of updates) {
    try {
      await bot2.handleUpdate(update);
    } catch (e) {
      console.error("[polling] error handling update:", update.update_id, e);
    }
  }
  const lastId = updates[updates.length - 1].update_id;
  if (config?.notifications.channels.telegram) {
    updateConfig({
      notifications: {
        ...config.notifications,
        channels: {
          ...config.notifications.channels,
          telegram: {
            ...config.notifications.channels.telegram,
            lastUpdateId: lastId
          }
        }
      }
    });
  }
  return updates.length;
}
async function startPolling() {
  if (!claimPollingLock()) {
    const activePid = readLockPid();
    console.log(
      `[telegram] skipping long-polling because pid ${activePid ?? "unknown"} already holds the lock`
    );
    return;
  }
  const bot2 = await getBot();
  console.log("[telegram] starting long-polling...");
  process.on("SIGINT", async () => {
    await bot2.stop();
    releasePollingLock();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await bot2.stop();
    releasePollingLock();
    process.exit(0);
  });
  process.on("exit", () => {
    releasePollingLock();
  });
  try {
    await bot2.start({
      onStart: (info) => {
        console.log(`[telegram] polling as @${info.username}`);
      }
    });
  } finally {
    releasePollingLock();
  }
}
var import_fs7, import_path9;
var init_polling = __esm({
  "src/lib/telegram/polling.ts"() {
    "use strict";
    import_fs7 = __toESM(require("fs"));
    import_path9 = __toESM(require("path"));
    init_manager();
    init_bot();
  }
});

// src/lib/notifications/member-email.ts
function normalizeMemberEmailForAggregation(email) {
  return email.trim().toLowerCase();
}
var init_member_email = __esm({
  "src/lib/notifications/member-email.ts"() {
    "use strict";
  }
});

// src/jobs/enqueue-reminders.ts
var enqueue_reminders_exports = {};
__export(enqueue_reminders_exports, {
  enqueueReminders: () => enqueueReminders
});
async function enqueueReminders() {
  const store = await db();
  const now2 = /* @__PURE__ */ new Date();
  const aggregateReminders = await getSetting("notifications.aggregateReminders") === "true";
  let enqueued = 0;
  const periodsRaw = await store.getOpenBillingPeriods({
    asOf: now2,
    unpaidOnly: true
  });
  const periods = periodsRaw.filter(
    (period) => period.payments.some(
      (p7) => p7.status === "pending" || p7.status === "overdue"
    )
  );
  if (aggregateReminders) {
    const byEmail = /* @__PURE__ */ new Map();
    for (const period of periods) {
      const group = await store.getGroup(period.groupId);
      if (!group || !group.isActive) continue;
      if (group.notifications?.remindersEnabled === false) continue;
      const graceDays = group.billing.gracePeriodDays ?? 3;
      const collectionOpensAt = resolveCollectionOpensAt(period);
      const firstReminderAt = getFirstReminderEligibleAt(collectionOpensAt, graceDays);
      if (now2 < firstReminderAt) continue;
      const groupId = group.id;
      const billingPeriodId = period.id;
      for (const payment of period.payments) {
        if (payment.status !== "pending" && payment.status !== "overdue") continue;
        const bucketKey = normalizeMemberEmailForAggregation(payment.memberEmail);
        const ref = {
          groupId,
          billingPeriodId,
          memberId: payment.memberId,
          paymentId: payment.id,
          memberEmail: payment.memberEmail
        };
        const list = byEmail.get(bucketKey) ?? [];
        list.push(ref);
        byEmail.set(bucketKey, list);
      }
    }
    for (const [, refs] of byEmail) {
      if (refs.length === 0) continue;
      const memberEmail = refs[0].memberEmail;
      const payments = refs.map((r) => ({
        groupId: r.groupId,
        billingPeriodId: r.billingPeriodId,
        memberId: r.memberId,
        paymentId: r.paymentId
      }));
      const task = await enqueueTask({
        type: "aggregated_payment_reminder",
        runAt: now2,
        payload: { memberEmail, payments }
      });
      if (task) enqueued++;
    }
    return enqueued;
  }
  for (const period of periods) {
    const group = await store.getGroup(period.groupId);
    if (!group || !group.isActive) continue;
    if (group.notifications?.remindersEnabled === false) continue;
    const graceDays = group.billing.gracePeriodDays ?? 3;
    const collectionOpensAt = resolveCollectionOpensAt(period);
    const firstReminderAt = getFirstReminderEligibleAt(collectionOpensAt, graceDays);
    if (now2 < firstReminderAt) continue;
    const groupId = group.id;
    const billingPeriodId = period.id;
    for (const payment of period.payments) {
      if (payment.status !== "pending" && payment.status !== "overdue") {
        continue;
      }
      const task = await enqueueTask({
        type: "payment_reminder",
        runAt: now2,
        payload: {
          groupId,
          billingPeriodId,
          memberId: payment.memberId,
          paymentId: payment.id
        }
      });
      if (task) enqueued++;
    }
  }
  return enqueued;
}
var init_enqueue_reminders = __esm({
  "src/jobs/enqueue-reminders.ts"() {
    "use strict";
    init_collection_window();
    init_service();
    init_member_email();
    init_queue();
    init_storage();
  }
});

// src/cli/index.ts
var import_fs11 = require("fs");
var import_path12 = require("path");
var import_commander = require("commander");

// src/cli/commands/configure.ts
var import_path2 = __toESM(require("path"));

// src/cli/wizard/clack-prompter.ts
var import_prompts = require("@clack/prompts");
function unwrapCancelled(value) {
  if ((0, import_prompts.isCancel)(value)) {
    (0, import_prompts.cancel)("Setup cancelled.");
    process.exit(0);
  }
  return value;
}
function createClackPrompter() {
  return {
    async intro(title) {
      (0, import_prompts.intro)(title);
    },
    async outro(message) {
      (0, import_prompts.outro)(message);
    },
    async note(message, title) {
      (0, import_prompts.note)(message, title);
    },
    async text(params) {
      const value = await (0, import_prompts.text)({
        message: params.message,
        placeholder: params.placeholder,
        initialValue: params.initialValue,
        validate: params.validate ? (input) => params.validate?.(input ?? "") : void 0
      });
      return unwrapCancelled(value);
    },
    async select(params) {
      const value = await (0, import_prompts.select)({
        message: params.message,
        initialValue: params.initialValue,
        options: params.options
      });
      return unwrapCancelled(value);
    },
    async confirm(params) {
      const value = await (0, import_prompts.confirm)({
        message: params.message,
        initialValue: params.initialValue
      });
      return unwrapCancelled(value);
    }
  };
}

// src/cli/wizard/finalize.ts
var import_crypto = __toESM(require("crypto"));
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_mongodb = require("mongodb");
function generateSecret(length = 32) {
  return import_crypto.default.randomBytes(length).toString("base64url");
}
async function loadCurrentConfig(rootDir) {
  const envPath = import_path.default.join(rootDir, ".env.local");
  const env = await readEnvFile(envPath);
  const mongoUri = env.MONGODB_URI || "mongodb://localhost:27017/substrack";
  const state = {
    bootstrapEnv: {
      MONGODB_URI: mongoUri,
      NEXTAUTH_SECRET: env.NEXTAUTH_SECRET || generateSecret(),
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || "",
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || "",
      NODE_ENV: env.NODE_ENV || "development"
    },
    settings: {
      "general.appUrl": "http://localhost:3054",
      "email.apiKey": "",
      "email.fromAddress": "sub5tr4cker <noreply@example.com>",
      "telegram.botToken": "",
      "telegram.webhookSecret": "",
      "security.confirmationSecret": generateSecret(),
      "security.telegramLinkSecret": "",
      "security.cronSecret": generateSecret()
    }
  };
  try {
    const client = new import_mongodb.MongoClient(mongoUri);
    await client.connect();
    const docs = await client.db().collection("settings").find({}).toArray();
    await client.close();
    for (const doc of docs) {
      if (typeof doc.key === "string" && typeof doc.value === "string") {
        if (doc.key in state.settings) {
          state.settings[doc.key] = doc.value;
        }
      }
    }
  } catch {
    return state;
  }
  return state;
}
async function writeBootstrapEnv(rootDir, state) {
  const envPath = import_path.default.join(rootDir, ".env.local");
  const content = [
    "# bootstrap values kept in env",
    `MONGODB_URI=${state.bootstrapEnv.MONGODB_URI}`,
    `NEXTAUTH_SECRET=${state.bootstrapEnv.NEXTAUTH_SECRET}`,
    `GOOGLE_CLIENT_ID=${state.bootstrapEnv.GOOGLE_CLIENT_ID}`,
    `GOOGLE_CLIENT_SECRET=${state.bootstrapEnv.GOOGLE_CLIENT_SECRET}`,
    `NODE_ENV=${state.bootstrapEnv.NODE_ENV}`,
    ""
  ].join("\n");
  await import_promises.default.writeFile(envPath, content, "utf8");
}
async function seedSettings(rootDir, state) {
  const client = new import_mongodb.MongoClient(state.bootstrapEnv.MONGODB_URI);
  await client.connect();
  const settingsCollection = client.db().collection("settings");
  const entries = Object.entries(state.settings);
  for (const [key, value] of entries) {
    const metadata = getSettingMetadata(key);
    await settingsCollection.updateOne(
      { key },
      {
        $set: {
          key,
          value: value || null,
          category: metadata.category,
          isSecret: metadata.isSecret,
          label: metadata.label,
          description: metadata.description,
          updatedAt: /* @__PURE__ */ new Date()
        },
        $setOnInsert: {
          createdAt: /* @__PURE__ */ new Date()
        }
      },
      { upsert: true }
    );
  }
  await client.close();
  await import_promises.default.mkdir(import_path.default.join(rootDir, ".cursor"), { recursive: true });
}
async function readEnvFile(filePath) {
  try {
    const content = await import_promises.default.readFile(filePath, "utf8");
    return Object.fromEntries(
      content.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return [line, ""];
        }
        return [
          line.slice(0, separatorIndex),
          line.slice(separatorIndex + 1)
        ];
      })
    );
  } catch {
    return {};
  }
}
function getSettingMetadata(key) {
  const metadata = {
    "general.appUrl": {
      category: "general",
      isSecret: false,
      label: "App URL",
      description: "Base URL used for links in emails, redirects, and callbacks."
    },
    "email.apiKey": {
      category: "email",
      isSecret: true,
      label: "Resend API key",
      description: "API key used to send transactional emails through Resend."
    },
    "email.fromAddress": {
      category: "email",
      isSecret: false,
      label: "From address",
      description: "Default sender shown on outgoing emails."
    },
    "telegram.botToken": {
      category: "telegram",
      isSecret: true,
      label: "Telegram bot token",
      description: "BotFather token used to receive webhook updates and send messages."
    },
    "telegram.webhookSecret": {
      category: "telegram",
      isSecret: true,
      label: "Telegram webhook secret",
      description: "Secret token used to validate webhook calls from Telegram."
    },
    "security.confirmationSecret": {
      category: "security",
      isSecret: true,
      label: "Confirmation token secret",
      description: "Secret used to sign member payment confirmation links."
    },
    "security.telegramLinkSecret": {
      category: "security",
      isSecret: true,
      label: "Telegram link secret",
      description: "Secret used to sign Telegram account-link tokens."
    },
    "security.cronSecret": {
      category: "cron",
      isSecret: true,
      label: "Cron secret",
      description: "Shared secret required by protected cron endpoints."
    }
  };
  return metadata[key];
}

// src/cli/wizard/steps/auth.ts
async function runAuthStep(prompter, state) {
  const generateNewSecret = await prompter.confirm({
    message: "Generate a fresh NEXTAUTH_SECRET?",
    initialValue: !state.bootstrapEnv.NEXTAUTH_SECRET
  });
  state.bootstrapEnv.NEXTAUTH_SECRET = generateNewSecret ? generateSecret() : await prompter.text({
    message: "NEXTAUTH_SECRET",
    initialValue: state.bootstrapEnv.NEXTAUTH_SECRET,
    validate: (value) => value.trim().length < 16 ? "Use a stronger secret (at least 16 characters)" : void 0
  });
  state.bootstrapEnv.GOOGLE_CLIENT_ID = await prompter.text({
    message: "Google client ID (optional)",
    initialValue: state.bootstrapEnv.GOOGLE_CLIENT_ID,
    placeholder: "Leave blank to skip Google login"
  });
  state.bootstrapEnv.GOOGLE_CLIENT_SECRET = await prompter.text({
    message: "Google client secret (optional)",
    initialValue: state.bootstrapEnv.GOOGLE_CLIENT_SECRET,
    placeholder: "Leave blank to skip Google login"
  });
}

// src/cli/wizard/steps/database.ts
var import_mongodb2 = require("mongodb");
async function runDatabaseStep(prompter, state) {
  const mongoUri = await prompter.text({
    message: "MongoDB URI",
    initialValue: state.bootstrapEnv.MONGODB_URI,
    placeholder: "mongodb://localhost:27017/substrack",
    validate: (value) => {
      if (!value.trim()) {
        return "MongoDB URI is required";
      }
      if (!value.startsWith("mongodb://") && !value.startsWith("mongodb+srv://")) {
        return "Use a mongodb:// or mongodb+srv:// connection string";
      }
    }
  });
  const client = new import_mongodb2.MongoClient(mongoUri, { serverSelectionTimeoutMS: 5e3 });
  try {
    await client.connect();
    await client.db().command({ ping: 1 });
  } finally {
    await client.close().catch(() => void 0);
  }
  state.bootstrapEnv.MONGODB_URI = mongoUri;
}

// src/cli/wizard/steps/email.ts
async function runEmailStep(prompter, state) {
  const enableEmail = await prompter.confirm({
    message: "Configure Resend email delivery now?",
    initialValue: !!state.settings["email.apiKey"]
  });
  if (!enableEmail) {
    state.settings["email.apiKey"] = "";
    return;
  }
  state.settings["email.apiKey"] = await prompter.text({
    message: "Resend API key",
    initialValue: state.settings["email.apiKey"],
    placeholder: "re_...",
    validate: (value) => !value.trim() ? "Resend API key is required" : void 0
  });
  state.settings["email.fromAddress"] = await prompter.text({
    message: "Default from address",
    initialValue: state.settings["email.fromAddress"],
    placeholder: "sub5tr4cker <noreply@yourdomain.com>",
    validate: (value) => !value.trim() ? "From address is required" : void 0
  });
}

// src/cli/wizard/steps/general.ts
async function runGeneralStep(prompter, state) {
  state.settings["general.appUrl"] = await prompter.text({
    message: "App URL",
    initialValue: state.settings["general.appUrl"],
    placeholder: "http://localhost:3054",
    validate: (value) => {
      try {
        new URL(value);
        return void 0;
      } catch {
        return "Enter a valid URL";
      }
    }
  });
  state.bootstrapEnv.NODE_ENV = await prompter.select({
    message: "Node environment",
    initialValue: state.bootstrapEnv.NODE_ENV,
    options: [
      { value: "development", label: "development" },
      { value: "production", label: "production" }
    ]
  });
  if (!state.settings["security.confirmationSecret"]) {
    state.settings["security.confirmationSecret"] = generateSecret(24);
  }
  if (!state.settings["security.cronSecret"]) {
    state.settings["security.cronSecret"] = generateSecret(24);
  }
}

// src/cli/wizard/steps/telegram.ts
async function validateTelegramToken(token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const json = await response.json();
  if (!json.ok) {
    throw new Error("Telegram rejected that bot token");
  }
}
async function runTelegramStep(prompter, state) {
  await prompter.note(
    [
      "1) Open Telegram and chat with @BotFather",
      "2) Run /newbot or open one of your existing bots",
      "3) Copy the bot token",
      "4) Add a webhook later from the app settings page or your deployment flow"
    ].join("\n"),
    "Telegram setup"
  );
  const enableTelegram = await prompter.confirm({
    message: "Configure Telegram now?",
    initialValue: !!state.settings["telegram.botToken"]
  });
  if (!enableTelegram) {
    state.settings["telegram.botToken"] = "";
    state.settings["telegram.webhookSecret"] = "";
    state.settings["security.telegramLinkSecret"] = "";
    return;
  }
  const token = await prompter.text({
    message: "Telegram bot token",
    initialValue: state.settings["telegram.botToken"],
    placeholder: "123456789:ABC...",
    validate: (value) => !value.trim() ? "Bot token is required" : void 0
  });
  await validateTelegramToken(token);
  state.settings["telegram.botToken"] = token;
  state.settings["telegram.webhookSecret"] = state.settings["telegram.webhookSecret"] || generateSecret(24);
  state.settings["security.telegramLinkSecret"] = state.settings["security.telegramLinkSecret"] || generateSecret(24);
}

// src/cli/commands/configure.ts
var sectionOptions = [
  {
    value: "database",
    label: "database",
    hint: "MongoDB connection string"
  },
  {
    value: "auth",
    label: "auth",
    hint: "NEXTAUTH secret and Google OAuth"
  },
  {
    value: "email",
    label: "email",
    hint: "Resend and sender details"
  },
  {
    value: "telegram",
    label: "telegram",
    hint: "Bot token and webhook secret"
  },
  {
    value: "general",
    label: "general",
    hint: "App URL and runtime defaults"
  }
];
async function runConfigureCommand(section) {
  const prompter = createClackPrompter();
  const rootDir = process.cwd();
  const state = await loadCurrentConfig(rootDir);
  const selectedSection = section || await prompter.select({
    message: "Which section do you want to configure?",
    options: sectionOptions
  });
  await prompter.intro(`SubsTrack configure: ${selectedSection}`);
  switch (selectedSection) {
    case "database":
      await runDatabaseStep(prompter, state);
      break;
    case "auth":
      await runAuthStep(prompter, state);
      break;
    case "email":
      await runEmailStep(prompter, state);
      break;
    case "telegram":
      await runTelegramStep(prompter, state);
      break;
    case "general":
      await runGeneralStep(prompter, state);
      break;
    default:
      throw new Error(`Unknown section: ${selectedSection}`);
  }
  await writeBootstrapEnv(rootDir, state);
  await seedSettings(rootDir, state);
  await prompter.outro(
    [
      `${selectedSection} configuration saved.`,
      `Bootstrap env updated at ${import_path2.default.join(rootDir, ".env.local")}.`,
      "MongoDB settings updated successfully."
    ].join("\n")
  );
}

// src/cli/commands/plugin.ts
var import_fs2 = __toESM(require("fs"));
var import_path4 = __toESM(require("path"));
var import_child_process = require("child_process");
init_loader();
init_manifest();
function readRegistry2() {
  const registryPath = getRegistryPathForCLI();
  try {
    const raw = import_fs2.default.readFileSync(registryPath, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function writeRegistry(entries) {
  const registryPath = getRegistryPathForCLI();
  const dir = import_path4.default.dirname(registryPath);
  if (!import_fs2.default.existsSync(dir)) {
    import_fs2.default.mkdirSync(dir, { recursive: true });
  }
  import_fs2.default.writeFileSync(
    registryPath,
    JSON.stringify(entries, null, 2),
    "utf-8"
  );
}
function parseRepo(repo) {
  const trimmed = repo.trim();
  if (trimmed.includes("/") && !trimmed.startsWith("http")) {
    const parts = trimmed.split("/").filter(Boolean);
    const slug = parts[parts.length - 1].replace(/^substrack-plugin-/, "");
    return {
      url: `https://github.com/${trimmed}.git`,
      slug: slug || "plugin"
    };
  }
  if (trimmed.startsWith("https://github.com/")) {
    const match = trimmed.match(/github\.com\/[^/]+\/([^/]+?)(?:\.git)?\/?$/);
    const slug = match ? match[1].replace(/^substrack-plugin-/, "") : "plugin";
    return { url: trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`, slug };
  }
  return { url: `https://github.com/${trimmed}.git`, slug: trimmed };
}
async function runPluginAddCommand(repo) {
  const pluginsDir = getPluginsDirForCLI();
  const registry = readRegistry2();
  const { url, slug } = parseRepo(repo);
  const pluginDir = import_path4.default.join(pluginsDir, slug);
  if (registry.some((e) => e.slug === slug)) {
    console.error(`Plugin "${slug}" is already installed.`);
    process.exit(1);
  }
  if (import_fs2.default.existsSync(pluginDir)) {
    console.error(`Directory already exists: ${pluginDir}`);
    process.exit(1);
  }
  console.log(`Cloning ${url} into ${pluginDir}...`);
  try {
    (0, import_child_process.execSync)(`git clone --depth 1 "${url}" "${pluginDir}"`, {
      stdio: "inherit"
    });
  } catch {
    console.error("Clone failed. Check the repo URL and network.");
    process.exit(1);
  }
  const manifestPath = import_path4.default.join(pluginDir, "substrack-plugin.json");
  if (!import_fs2.default.existsSync(manifestPath)) {
    console.error(
      `No substrack-plugin.json found in ${pluginDir}. Not a valid SubsTrack plugin.`
    );
    import_fs2.default.rmSync(pluginDir, { recursive: true });
    process.exit(1);
  }
  const raw = import_fs2.default.readFileSync(manifestPath, "utf-8");
  const result = validatePluginManifest(JSON.parse(raw));
  if (!result.success) {
    console.error(`Invalid manifest: ${result.error}`);
    import_fs2.default.rmSync(pluginDir, { recursive: true });
    process.exit(1);
  }
  registry.push({ slug, path: `plugins/${slug}` });
  writeRegistry(registry);
  console.log(`Installed plugin "${slug}" (${result.manifest.name}).`);
  console.log("Configure it from the dashboard Settings \u2192 Plugins.");
}
async function runPluginRemoveCommand(slug) {
  const pluginsDir = getPluginsDirForCLI();
  const registry = readRegistry2();
  const entry = registry.find((e) => e.slug === slug);
  if (!entry) {
    console.error(`Plugin "${slug}" is not installed.`);
    process.exit(1);
  }
  const pluginDir = import_path4.default.isAbsolute(entry.path) ? entry.path : import_path4.default.join(process.cwd(), entry.path);
  if (import_fs2.default.existsSync(pluginDir)) {
    import_fs2.default.rmSync(pluginDir, { recursive: true });
  }
  writeRegistry(registry.filter((e) => e.slug !== slug));
  console.log(`Removed plugin "${slug}".`);
}
async function runPluginListCommand() {
  const plugins = loadPlugins();
  if (plugins.length === 0) {
    console.log("No plugins installed.");
    return;
  }
  console.log("Installed plugins:\n");
  for (const p7 of plugins) {
    const status = p7.error ? ` (error: ${p7.error})` : "";
    console.log(`  ${p7.slug}  ${p7.manifest.name}@${p7.manifest.version}${status}`);
    if (p7.manifest.description) {
      console.log(`      ${p7.manifest.description}`);
    }
  }
}

// src/cli/commands/setup.ts
var import_fs3 = __toESM(require("fs"));
var import_path5 = __toESM(require("path"));
var MONGODB_DATA_DIR = ".mongodb-data";
async function runSetupCommand() {
  const prompter = createClackPrompter();
  const rootDir = process.cwd();
  const state = await loadCurrentConfig(rootDir);
  const mongoDataPath = import_path5.default.join(rootDir, MONGODB_DATA_DIR);
  import_fs3.default.mkdirSync(mongoDataPath, { recursive: true });
  await prompter.intro("SubsTrack setup");
  await prompter.note(
    "This wizard keeps only bootstrap values in .env.local and seeds the rest into the Settings collection.",
    "How setup works"
  );
  await runDatabaseStep(prompter, state);
  await runAuthStep(prompter, state);
  await runEmailStep(prompter, state);
  await runTelegramStep(prompter, state);
  await runGeneralStep(prompter, state);
  await writeBootstrapEnv(rootDir, state);
  await seedSettings(rootDir, state);
  await prompter.outro(
    [
      "Setup complete.",
      `Bootstrap env written to ${import_path5.default.join(rootDir, ".env.local")}.`,
      "Settings were seeded into MongoDB.",
      "Next steps:",
      "- run pnpm dev",
      "- open the dashboard settings page to verify the final values"
    ].join("\n")
  );
}

// src/cli/commands/local/init.ts
var p = __toESM(require("@clack/prompts"));
var import_crypto2 = __toESM(require("crypto"));
var import_path8 = __toESM(require("path"));
var import_child_process2 = require("child_process");
init_manager();
init_schema();
var import_fs6 = require("fs");

// src/cli/lib/pkg-root.ts
var import_path7 = require("path");
var import_fs5 = require("fs");
var _pkgRoot = null;
function getPackageRoot() {
  if (_pkgRoot) return _pkgRoot;
  let dir = (0, import_path7.dirname)(__filename);
  while (true) {
    const pkgPath = (0, import_path7.join)(dir, "package.json");
    if ((0, import_fs5.existsSync)(pkgPath)) {
      try {
        const pkg = JSON.parse((0, import_fs5.readFileSync)(pkgPath, "utf-8"));
        if (pkg.name === "sub5tr4cker") {
          _pkgRoot = dir;
          return dir;
        }
      } catch {
      }
    }
    const parent = (0, import_path7.dirname)(dir);
    if (parent === dir) break;
    dir = parent;
  }
  _pkgRoot = process.cwd();
  return _pkgRoot;
}

// src/cli/commands/local/init.ts
function getLocalCommandHint(command) {
  const pkgRoot = getPackageRoot();
  if (process.cwd() === pkgRoot) {
    return `pnpm s54r ${command}`;
  }
  return `s54r ${command}`;
}
async function runInitCommand() {
  console.clear();
  p.intro("  sub5tr4cker \u2014 local setup  ");
  if ((0, import_fs6.existsSync)(getConfigPath())) {
    const overwrite = await p.confirm({
      message: "A local installation already exists. Re-run setup?",
      initialValue: false
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Setup cancelled. Your existing configuration was not changed.");
      process.exit(0);
    }
  }
  const channel = await p.select({
    message: "How should sub5tr4cker notify people?",
    options: [
      { value: "email", label: "Email (via Resend)", hint: "recommended" },
      { value: "telegram", label: "Telegram (bot)" },
      { value: "both", label: "Both email and Telegram" }
    ]
  });
  if (p.isCancel(channel)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  let emailConfig;
  let telegramConfig;
  if (channel === "email" || channel === "both") {
    p.note(
      "You need a free Resend account to send emails.\nSign up at https://resend.com \u2014 the free tier sends 3,000 emails/month.",
      "Email setup"
    );
    const apiKey = await p.text({
      message: "Resend API key",
      placeholder: "re_...",
      validate: (v) => (v ?? "").startsWith("re_") ? void 0 : "Resend API keys start with 're_'"
    });
    if (p.isCancel(apiKey)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    const fromAddress = await p.text({
      message: "From address (e.g. Sub5tr4cker <noreply@yourdomain.com>)",
      placeholder: "Sub5tr4cker <noreply@example.com>",
      validate: (v) => (v ?? "").includes("@") ? void 0 : "Enter a valid email address or 'Name <email>'"
    });
    if (p.isCancel(fromAddress)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    emailConfig = { provider: "resend", apiKey, fromAddress };
  }
  if (channel === "telegram" || channel === "both") {
    p.note(
      "Create a Telegram bot:\n1. Open Telegram and message @BotFather\n2. Send /newbot and follow the instructions\n3. Copy the bot token it gives you",
      "Telegram setup"
    );
    const botToken2 = await p.text({
      message: "Telegram bot token",
      placeholder: "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ",
      validate: (v) => (v ?? "").includes(":") ? void 0 : "Paste the full bot token from @BotFather"
    });
    if (p.isCancel(botToken2)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    telegramConfig = { botToken: botToken2, pollingEnabled: true };
  }
  const adminEmail = await p.text({
    message: "Your email address (used as the admin account)",
    placeholder: "you@example.com",
    validate: (v) => (v ?? "").includes("@") ? void 0 : "Enter a valid email address"
  });
  if (p.isCancel(adminEmail)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const adminName = await p.text({
    message: "Your name (shown in notifications)",
    placeholder: "Your Name",
    defaultValue: "Admin"
  });
  if (p.isCancel(adminName)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  const s = p.spinner();
  s.start("Creating configuration...");
  const authToken = import_crypto2.default.randomBytes(32).toString("hex");
  const config = sub5tr4ckerConfigSchema.parse({
    mode: "local",
    port: 3054,
    authToken,
    adminEmail,
    adminName: adminName || "Admin",
    notifications: {
      channels: {
        email: emailConfig,
        telegram: telegramConfig
      },
      defaultChannel: channel === "both" ? "email" : channel
    }
  });
  writeConfig(config);
  s.stop("Configuration saved.");
  const pkgRoot = getPackageRoot();
  const standaloneServer = import_path8.default.join(pkgRoot, ".next", "standalone", "server.js");
  if (!(0, import_fs6.existsSync)(standaloneServer)) {
    const bs = p.spinner();
    bs.start("Building the dashboard (this may take a minute)...");
    try {
      const nextBin = import_path8.default.join(pkgRoot, "node_modules", ".bin", "next");
      (0, import_child_process2.execSync)(`"${nextBin}" build`, {
        stdio: "pipe",
        env: { ...process.env, SUB5TR4CKER_MODE: "local" },
        cwd: pkgRoot
      });
      copyStandaloneAssets(pkgRoot);
      bs.stop("Dashboard built.");
    } catch (e) {
      bs.stop("Build failed \u2014 you can retry later with 'pnpm build'.");
      p.log.warn(e instanceof Error ? e.message : String(e));
    }
  }
  p.note(
    [
      `Data directory : ${getDataDir()}`,
      `Config file    : ${getConfigPath()}`,
      `Port           : 3054`,
      `Channels       : ${[emailConfig && "email", telegramConfig && "telegram"].filter(Boolean).join(", ")}`
    ].join("\n"),
    "Setup complete"
  );
  p.note(
    `To start the dashboard:
  ${getLocalCommandHint("start")}

To enable automatic reminders (cron):
  ${getLocalCommandHint("cron-install")}

To run a manual notification check:
  ${getLocalCommandHint("notify")}`,
    "Next steps"
  );
  p.outro(`Ready. Run '${getLocalCommandHint("start")}' to open the dashboard.`);
}
function copyStandaloneAssets(pkgRoot) {
  const staticSrc = import_path8.default.join(pkgRoot, ".next", "static");
  const staticDst = import_path8.default.join(pkgRoot, ".next", "standalone", ".next", "static");
  if ((0, import_fs6.existsSync)(staticSrc)) {
    (0, import_fs6.mkdirSync)(import_path8.default.dirname(staticDst), { recursive: true });
    (0, import_fs6.cpSync)(staticSrc, staticDst, { recursive: true });
  }
  const publicSrc = import_path8.default.join(pkgRoot, "public");
  const publicDst = import_path8.default.join(pkgRoot, ".next", "standalone", "public");
  if ((0, import_fs6.existsSync)(publicSrc)) {
    (0, import_fs6.cpSync)(publicSrc, publicDst, { recursive: true });
  }
}

// src/cli/commands/local/start.ts
var p2 = __toESM(require("@clack/prompts"));
var import_path10 = __toESM(require("path"));
var import_child_process3 = require("child_process");
init_manager();
var import_fs8 = require("fs");
async function runStartCommand(options = {}) {
  const config = readConfig();
  if (!config) {
    p2.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  const port = options.port ?? config.port ?? 3054;
  const pkgRoot = getPackageRoot();
  const standaloneServer = import_path10.default.join(pkgRoot, ".next", "standalone", "server.js");
  const buildId = import_path10.default.join(pkgRoot, ".next", "BUILD_ID");
  if (!(0, import_fs8.existsSync)(buildId)) {
    p2.log.error("No Next.js build found. Run 's54r init' first, or 'pnpm build'.");
    process.exit(1);
  }
  p2.intro(`  sub5tr4cker \u2014 starting on http://localhost:${port}  `);
  p2.log.info(`Data directory: ${getDbPath()}`);
  p2.log.info(`Press Ctrl+C to stop.`);
  const env = {
    ...process.env,
    SUB5TR4CKER_MODE: "local",
    SUB5TR4CKER_DATA_PATH: getDbPath(),
    SUB5TR4CKER_AUTH_TOKEN: config.authToken ?? "",
    // Auth.js requires a secret even in local mode (where we bypass it);
    // reuse the existing auth token so it never throws MissingSecret
    AUTH_SECRET: config.authToken ?? "sub5tr4cker-local-fallback",
    PORT: String(port),
    HOSTNAME: "localhost",
    NEXTAUTH_URL: `http://localhost:${port}`
  };
  const nextBin = import_path10.default.join(pkgRoot, "node_modules", ".bin", "next");
  let child;
  if ((0, import_fs8.existsSync)(nextBin)) {
    child = (0, import_child_process3.spawn)(nextBin, ["start", "--port", String(port)], {
      env,
      stdio: "inherit",
      cwd: pkgRoot
    });
  } else if ((0, import_fs8.existsSync)(standaloneServer)) {
    child = (0, import_child_process3.spawn)("node", [standaloneServer], {
      env,
      stdio: "inherit",
      cwd: import_path10.default.join(pkgRoot, ".next", "standalone")
    });
  } else {
    p2.log.error(
      "No Next.js start path found. Install dependencies (pnpm install) and run s54r init / pnpm build."
    );
    process.exit(1);
  }
  child.on("error", (e) => {
    p2.log.error(`Failed to start server: ${e.message}`);
    process.exit(1);
  });
  if (config.notifications.channels.telegram?.botToken) {
    p2.log.info("Starting Telegram long-polling...");
    const { startPolling: startPolling2 } = await Promise.resolve().then(() => (init_polling(), polling_exports));
    startPolling2().catch((e) => {
      p2.log.warn(`Telegram polling error: ${e instanceof Error ? e.message : String(e)}`);
    });
  }
  setTimeout(() => {
    void openBrowser(`http://localhost:${port}`);
  }, 1500);
  process.on("SIGINT", () => {
    child.kill("SIGINT");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
    process.exit(0);
  });
  await new Promise((resolve) => {
    child.on("exit", (code) => {
      if (code && code !== 0) {
        p2.log.error(`Server exited with code ${code}`);
      }
      resolve();
    });
  });
}
async function openBrowser(url) {
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  const child = (0, import_child_process3.spawn)(command, [url], {
    detached: true,
    stdio: "ignore",
    shell: platform === "win32"
  });
  child.unref();
}

// src/cli/commands/local/notify.ts
init_manager();
async function runNotifyCommand() {
  process.env.SUB5TR4CKER_MODE = "local";
  const config = readConfig();
  if (!config) {
    console.error("[notify] no local configuration found \u2014 run 's54r init' first");
    process.exit(1);
  }
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();
  const { getAdapter: getAdapter2, resetAdapter: resetAdapter2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  resetAdapter2();
  const adapter = getAdapter2();
  await adapter.initialize();
  if (config.notifications.channels.telegram?.botToken) {
    try {
      const { pollOnce: pollOnce2 } = await Promise.resolve().then(() => (init_polling(), polling_exports));
      await pollOnce2();
      console.log("[notify] telegram polling done");
    } catch (e) {
      console.error("[notify] telegram polling error:", e);
    }
  }
  try {
    const { runNotificationTasks: runNotificationTasks2 } = await Promise.resolve().then(() => (init_run_notification_tasks(), run_notification_tasks_exports));
    const result = await runNotificationTasks2();
    console.log("[notify] tasks done:", result);
  } catch (e) {
    console.error("[notify] task runner error:", e);
  }
  try {
    const { enqueueReminders: enqueueReminders2 } = await Promise.resolve().then(() => (init_enqueue_reminders(), enqueue_reminders_exports));
    const count = await enqueueReminders2();
    console.log("[notify] enqueued reminders:", count);
  } catch (e) {
    console.error("[notify] enqueue reminders error:", e);
  }
  await adapter.close();
  process.exit(0);
}

// src/cli/commands/local/export-import.ts
var p3 = __toESM(require("@clack/prompts"));
var import_fs9 = __toESM(require("fs"));
var import_path11 = __toESM(require("path"));
init_manager();
async function runExportCommand(options = {}) {
  process.env.SUB5TR4CKER_MODE = "local";
  const config = readConfig();
  if (!config) {
    p3.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();
  const s = p3.spinner();
  s.start("Exporting data...");
  const { getAdapter: getAdapter2, resetAdapter: resetAdapter2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  resetAdapter2();
  const adapter = getAdapter2();
  await adapter.initialize();
  const bundle = await adapter.exportAll();
  await adapter.close();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = options.output ?? import_path11.default.join(getDataDir(), `export-${timestamp}.json`);
  import_fs9.default.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf-8");
  s.stop(`Data exported to ${outputPath}`);
  p3.note(
    [
      `Groups         : ${bundle.data.groups.length}`,
      `Billing periods: ${bundle.data.billingPeriods.length}`,
      `Notifications  : ${bundle.data.notifications.length}`,
      `Price history  : ${bundle.data.priceHistory.length}`
    ].join("\n"),
    "Export summary"
  );
  p3.outro(`Export complete: ${outputPath}`);
}
async function runImportCommand(filePath, options = {}) {
  process.env.SUB5TR4CKER_MODE = "local";
  if (!import_fs9.default.existsSync(filePath)) {
    p3.log.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  p3.intro("  sub5tr4cker \u2014 import data  ");
  let bundle;
  try {
    bundle = JSON.parse(import_fs9.default.readFileSync(filePath, "utf-8"));
  } catch (e) {
    p3.log.error(`Failed to parse export file: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  const exportBundle = bundle;
  p3.note(
    [
      `File           : ${filePath}`,
      `Schema version : ${exportBundle.version ?? "unknown"}`,
      `Groups         : ${exportBundle.data?.groups?.length ?? 0}`,
      `Billing periods: ${exportBundle.data?.billingPeriods?.length ?? 0}`
    ].join("\n"),
    "Import preview"
  );
  if (options.dryRun) {
    p3.outro("Dry run \u2014 no data was written.");
    return;
  }
  const confirm7 = await p3.confirm({
    message: "Proceed with import? Existing records with the same ID will be skipped.",
    initialValue: true
  });
  if (p3.isCancel(confirm7) || !confirm7) {
    p3.cancel("Import cancelled.");
    process.exit(0);
  }
  const config = readConfig();
  if (!config) {
    p3.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();
  const s = p3.spinner();
  s.start("Importing data...");
  const { getAdapter: getAdapter2, resetAdapter: resetAdapter2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  resetAdapter2();
  const adapter = getAdapter2();
  await adapter.initialize();
  const result = await adapter.importAll(bundle);
  await adapter.close();
  s.stop("Import complete.");
  if (result.errors.length > 0) {
    p3.log.warn(`${result.errors.length} error(s) during import:`);
    result.errors.slice(0, 10).forEach((e) => p3.log.warn(`  - ${e}`));
    if (result.errors.length > 10) p3.log.warn(`  ... and ${result.errors.length - 10} more`);
  }
  p3.note(
    [
      `Groups imported        : ${result.groups}`,
      `Billing periods        : ${result.billingPeriods}`,
      `Notifications          : ${result.notifications}`,
      `Price history entries  : ${result.priceHistory}`
    ].join("\n"),
    "Import results"
  );
  p3.outro("Import complete.");
}

// src/cli/commands/local/migrate.ts
var p4 = __toESM(require("@clack/prompts"));
init_manager();
async function runMigrateCommand() {
  p4.intro("  sub5tr4cker \u2014 migrate to advanced mode  ");
  const config = readConfig();
  if (!config) {
    p4.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  if (config.mode === "advanced") {
    p4.log.warn("Already running in advanced mode.");
    process.exit(0);
  }
  p4.note(
    "This will:\n1. Export all your local data from SQLite\n2. Import it into a MongoDB database\n3. Switch your config to advanced mode\n\nYour SQLite database will NOT be deleted.",
    "What will happen"
  );
  const mongoUri = await p4.text({
    message: "MongoDB connection string",
    placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/sub5tr4cker",
    validate: (v) => (v ?? "").startsWith("mongodb") ? void 0 : "Must start with mongodb:// or mongodb+srv://"
  });
  if (p4.isCancel(mongoUri)) {
    p4.cancel("Migration cancelled.");
    process.exit(0);
  }
  const confirm7 = await p4.confirm({
    message: `Ready to migrate to ${mongoUri}. Continue?`,
    initialValue: false
  });
  if (p4.isCancel(confirm7) || !confirm7) {
    p4.cancel("Migration cancelled.");
    process.exit(0);
  }
  const s = p4.spinner();
  s.start("Exporting from SQLite...");
  process.env.SUB5TR4CKER_MODE = "local";
  process.env.SUB5TR4CKER_DATA_PATH = getDbPath();
  const { getAdapter: getAdapter2, resetAdapter: resetAdapter2, setAdapter: setAdapter2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  const { SqliteAdapter: SqliteAdapter2 } = await Promise.resolve().then(() => (init_sqlite_adapter(), sqlite_adapter_exports));
  const { MongooseAdapter: MongooseAdapter2 } = await Promise.resolve().then(() => (init_mongoose_adapter(), mongoose_adapter_exports));
  resetAdapter2();
  const sqliteAdapter = new SqliteAdapter2(getDbPath());
  await sqliteAdapter.initialize();
  setAdapter2(sqliteAdapter);
  const bundle = await sqliteAdapter.exportAll();
  s.stop(`Exported ${bundle.data.groups.length} groups, ${bundle.data.billingPeriods.length} periods.`);
  s.start("Importing into MongoDB...");
  process.env.MONGODB_URI = mongoUri;
  process.env.SUB5TR4CKER_MODE = "advanced";
  resetAdapter2();
  const mongoAdapter = new MongooseAdapter2();
  await mongoAdapter.initialize();
  setAdapter2(mongoAdapter);
  const result = await mongoAdapter.importAll(bundle);
  await mongoAdapter.close();
  s.stop("Import complete.");
  if (result.errors.length > 0) {
    p4.log.warn(`${result.errors.length} import error(s):`);
    result.errors.slice(0, 5).forEach((e) => p4.log.warn(`  - ${e}`));
  }
  updateConfig({
    mode: "advanced",
    mongodb: { uri: mongoUri }
  });
  await sqliteAdapter.close();
  p4.note(
    [
      `Groups migrated        : ${result.groups}`,
      `Billing periods        : ${result.billingPeriods}`,
      `Notifications          : ${result.notifications}`,
      `Price history          : ${result.priceHistory}`,
      "",
      "Next step: add your MONGODB_URI to .env.local and restart the server."
    ].join("\n"),
    "Migration complete"
  );
  p4.outro("Migration successful. You are now in advanced mode.");
}

// src/cli/commands/local/cron-install.ts
var p5 = __toESM(require("@clack/prompts"));
var import_os = __toESM(require("os"));
var import_child_process4 = require("child_process");
init_manager();
function getPlatform() {
  const platform = import_os.default.platform();
  if (platform === "darwin") return "darwin";
  if (platform === "linux") return "linux";
  if (platform === "win32") return "windows";
  return "other";
}
function findS54rBin() {
  try {
    return (0, import_child_process4.execSync)("which s54r", { encoding: "utf-8" }).trim();
  } catch {
    return "npx s54r";
  }
}
async function runCronInstallCommand() {
  p5.intro("  sub5tr4cker \u2014 install cron job  ");
  const config = readConfig();
  if (!config) {
    p5.log.error("No local configuration found. Run 's54r init' first.");
    process.exit(1);
  }
  const platform = getPlatform();
  if (platform === "windows") {
    await installWindowsCron();
    return;
  }
  const method = platform === "darwin" ? await p5.select({
    message: "How would you like to run scheduled reminders?",
    options: [
      { value: "launchd", label: "launchd (recommended on macOS)", hint: "runs even when terminal is closed" },
      { value: "crontab", label: "crontab", hint: "simpler, runs when logged in" }
    ]
  }) : "crontab";
  if (p5.isCancel(method)) {
    p5.cancel("Cancelled.");
    process.exit(0);
  }
  const interval = await p5.select({
    message: "How often should it check for reminders?",
    options: [
      { value: "*/30 * * * *", label: "Every 30 minutes (recommended)" },
      { value: "0 * * * *", label: "Every hour" },
      { value: "0 9 * * *", label: "Once daily at 9am" }
    ]
  });
  if (p5.isCancel(interval)) {
    p5.cancel("Cancelled.");
    process.exit(0);
  }
  const bin = findS54rBin();
  if (method === "launchd") {
    await installLaunchd(bin, interval);
  } else {
    await installCrontab(bin, interval);
  }
  updateConfig({ cron: { installed: true, method, interval } });
}
async function installCrontab(bin, interval) {
  const cronLine = `${interval} ${bin} notify >> ~/.sub5tr4cker/logs/notify.log 2>&1`;
  const confirm7 = await p5.confirm({
    message: `Add to crontab:
  ${cronLine}

Proceed?`,
    initialValue: true
  });
  if (p5.isCancel(confirm7) || !confirm7) {
    p5.cancel("Cancelled.");
    process.exit(0);
  }
  const s = p5.spinner();
  s.start("Installing crontab entry...");
  try {
    let existing = "";
    try {
      existing = (0, import_child_process4.execSync)("crontab -l 2>/dev/null", { encoding: "utf-8" });
    } catch {
    }
    const filtered = existing.split("\n").filter((l) => !l.includes("s54r notify") && !l.includes("substrack notify")).join("\n");
    const updated = `${filtered}
${cronLine}
`.trimStart();
    const tmp = `/tmp/sub5tr4cker-cron-${Date.now()}`;
    const { writeFileSync } = await import("fs");
    writeFileSync(tmp, updated);
    (0, import_child_process4.execSync)(`crontab ${tmp}`);
    (0, import_child_process4.execSync)(`rm ${tmp}`);
    s.stop("Crontab entry added.");
    p5.note(`Entry added:
  ${cronLine}`, "Crontab installed");
    p5.outro("Cron job installed. Run 's54r cron-uninstall' to remove it.");
  } catch (e) {
    s.stop("Failed to install crontab.");
    p5.log.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    p5.note(`To install manually, run:
  crontab -e

And add:
  ${cronLine}`, "Manual install");
    process.exit(1);
  }
}
async function installLaunchd(bin, interval) {
  const intervalSeconds = cronToSeconds(interval);
  const plistPath = `${import_os.default.homedir()}/Library/LaunchAgents/com.sub5tr4cker.notify.plist`;
  const logDir = `${import_os.default.homedir()}/.sub5tr4cker/logs`;
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.sub5tr4cker.notify</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bin}</string>
    <string>notify</string>
  </array>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>StandardOutPath</key>
  <string>${logDir}/notify.log</string>
  <key>StandardErrorPath</key>
  <string>${logDir}/notify-error.log</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`;
  const confirm7 = await p5.confirm({
    message: `Install launchd agent at:
  ${plistPath}

This will run 's54r notify' every ${intervalSeconds}s.
Proceed?`,
    initialValue: true
  });
  if (p5.isCancel(confirm7) || !confirm7) {
    p5.cancel("Cancelled.");
    process.exit(0);
  }
  const s = p5.spinner();
  s.start("Installing launchd agent...");
  try {
    const { writeFileSync, mkdirSync: mkdirSync2 } = await import("fs");
    mkdirSync2(logDir, { recursive: true });
    mkdirSync2(`${import_os.default.homedir()}/Library/LaunchAgents`, { recursive: true });
    writeFileSync(plistPath, plist);
    try {
      (0, import_child_process4.execSync)(`launchctl unload ${plistPath} 2>/dev/null`);
    } catch {
    }
    (0, import_child_process4.execSync)(`launchctl load ${plistPath}`);
    s.stop("launchd agent installed and loaded.");
    p5.note(
      [
        `Agent file: ${plistPath}`,
        `Log file  : ${logDir}/notify.log`,
        "",
        "To stop:    launchctl unload ~/Library/LaunchAgents/com.sub5tr4cker.notify.plist",
        "To uninstall: s54r cron-uninstall"
      ].join("\n"),
      "launchd installed"
    );
    p5.outro("Cron job installed via launchd.");
  } catch (e) {
    s.stop("Failed to install launchd agent.");
    p5.log.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
async function installWindowsCron() {
  const bin = findS54rBin();
  const taskName = "sub5tr4cker-notify";
  p5.note(
    `Windows Task Scheduler setup requires elevated permissions.

Run the following command in PowerShell as Administrator:

  $action = New-ScheduledTaskAction -Execute "${bin}" -Argument "notify"
  $trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -Once -At (Get-Date)
  Register-ScheduledTask -TaskName "${taskName}" -Action $action -Trigger $trigger -RunLevel Highest

Or use Task Scheduler GUI:
1. Open Task Scheduler
2. Create Basic Task named 'sub5tr4cker-notify'
3. Set trigger: Daily, repeat every 30 minutes
4. Set action: Start a program \u2192 '${bin}' with argument 'notify'`,
    "Windows setup instructions"
  );
  const copied = await p5.confirm({
    message: "Did you set up the scheduled task?",
    initialValue: false
  });
  if (!p5.isCancel(copied) && copied) {
    updateConfig({ cron: { installed: true, method: "task-scheduler", interval: "*/30 * * * *" } });
    p5.outro("Cron job marked as installed.");
  } else {
    p5.outro("You can run these instructions again with 's54r cron-install'.");
  }
}
function cronToSeconds(cron) {
  if (cron === "*/30 * * * *") return 1800;
  if (cron === "0 * * * *") return 3600;
  if (cron === "0 9 * * *") return 86400;
  return 1800;
}

// src/cli/commands/local/uninstall.ts
var p6 = __toESM(require("@clack/prompts"));
var import_os2 = __toESM(require("os"));
var import_child_process5 = require("child_process");
var import_fs10 = __toESM(require("fs"));
init_manager();
async function runUninstallCommand() {
  p6.intro("  sub5tr4cker \u2014 uninstall  ");
  const config = readConfig();
  const wantsBackup = await p6.confirm({
    message: "Would you like to export your data before uninstalling?",
    initialValue: true
  });
  if (p6.isCancel(wantsBackup)) {
    p6.cancel("Cancelled.");
    process.exit(0);
  }
  if (wantsBackup) {
    const backupPath = `${import_os2.default.homedir()}/sub5tr4cker-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    await runExportCommand({ output: backupPath });
    p6.log.success(`Backup saved to ${backupPath}`);
  }
  const dataDir = getDataDir();
  const confirm7 = await p6.confirm({
    message: `This will permanently delete:
  - ${dataDir}/
  - Cron job entries

Are you sure?`,
    initialValue: false
  });
  if (p6.isCancel(confirm7) || !confirm7) {
    p6.cancel("Uninstall cancelled. Nothing was deleted.");
    process.exit(0);
  }
  const s = p6.spinner();
  s.start("Removing cron job...");
  if (config?.cron?.installed) {
    try {
      if (config.cron.method === "launchd") {
        const plistPath = `${import_os2.default.homedir()}/Library/LaunchAgents/com.sub5tr4cker.notify.plist`;
        try {
          (0, import_child_process5.execSync)(`launchctl unload ${plistPath} 2>/dev/null`);
        } catch {
        }
        if (import_fs10.default.existsSync(plistPath)) import_fs10.default.rmSync(plistPath);
      } else if (config.cron.method === "crontab") {
        try {
          const existing = (0, import_child_process5.execSync)("crontab -l 2>/dev/null", { encoding: "utf-8" });
          const filtered = existing.split("\n").filter((l) => !l.includes("s54r notify") && !l.includes("substrack notify")).join("\n");
          const tmp = `/tmp/sub5tr4cker-remove-${Date.now()}`;
          import_fs10.default.writeFileSync(tmp, filtered);
          (0, import_child_process5.execSync)(`crontab ${tmp}`);
          import_fs10.default.rmSync(tmp);
        } catch {
        }
      }
    } catch (e) {
      p6.log.warn(`Could not remove cron job: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  s.stop("Cron job removed.");
  s.start(`Deleting ${dataDir}...`);
  try {
    if (import_fs10.default.existsSync(dataDir)) {
      import_fs10.default.rmSync(dataDir, { recursive: true, force: true });
    }
    s.stop("Data directory deleted.");
  } catch (e) {
    s.stop("Warning: could not fully delete data directory.");
    p6.log.warn(`Error: ${e instanceof Error ? e.message : String(e)}`);
    p6.log.warn(`You may need to manually delete: ${dataDir}`);
  }
  if (import_fs10.default.existsSync(getConfigPath())) {
    try {
      import_fs10.default.rmSync(getConfigPath());
    } catch {
    }
  }
  p6.note(
    [
      "sub5tr4cker has been uninstalled.",
      "",
      "To fully remove the npm package:",
      "  npm uninstall -g sub5tr4cker",
      "  # or",
      "  pnpm remove -g sub5tr4cker"
    ].join("\n"),
    "Uninstall complete"
  );
  p6.outro("Goodbye!");
}

// src/cli/index.ts
function getVersion() {
  if (process.env.npm_package_version) return process.env.npm_package_version;
  try {
    const pkg = JSON.parse((0, import_fs11.readFileSync)((0, import_path12.join)(getPackageRoot(), "package.json"), "utf-8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
async function main() {
  const program = new import_commander.Command();
  program.name("s54r").description("sub5tr4cker \u2014 manage shared subscriptions locally or self-hosted").version(getVersion());
  program.command("init").description("Set up local mode (SQLite + notification channels)").action(async () => {
    await runInitCommand();
  });
  program.command("start").description("Start the dashboard web server on localhost:3054 (foreground)").option("-p, --port <port>", "Port to listen on", (v) => parseInt(v, 10)).action(async (options) => {
    await runStartCommand(options);
  });
  program.command("notify").description("Poll Telegram + send due payment reminders (run from cron)").action(async () => {
    await runNotifyCommand();
  });
  program.command("export").description("Export all local data to a portable JSON file").option("-o, --output <path>", "Output file path").action(async (options) => {
    await runExportCommand(options);
  });
  program.command("import <file>").description("Import data from a JSON export file").option("--dry-run", "Preview what would be imported without writing").action(async (file, options) => {
    await runImportCommand(file, options);
  });
  program.command("migrate").description("Migrate local SQLite data to MongoDB (upgrade to advanced mode)").action(async () => {
    await runMigrateCommand();
  });
  program.command("cron-install").description("Install OS-native scheduled task for automatic reminders").action(async () => {
    await runCronInstallCommand();
  });
  program.command("uninstall").description("Remove all local data and cron entries (prompts for backup first)").action(async () => {
    await runUninstallCommand();
  });
  program.command("setup").description("Run the first-time setup wizard (advanced MongoDB mode)").action(async () => {
    await runSetupCommand();
  });
  program.command("configure").description("Re-run a specific setup section (advanced mode)").option(
    "--section <section>",
    "Section to update: database, auth, email, telegram, or general"
  ).action(async (options) => {
    await runConfigureCommand(options.section);
  });
  const pluginCmd = program.command("plugin").description("Manage SubsTrack plugins (templates and notification channels)");
  pluginCmd.command("add <repo>").description(
    "Install a plugin from a GitHub repo (e.g. owner/repo or owner/substrack-plugin-slack)"
  ).action(async (repo) => {
    await runPluginAddCommand(repo);
  });
  pluginCmd.command("remove <slug>").description("Uninstall a plugin by slug").action(async (slug) => {
    await runPluginRemoveCommand(slug);
  });
  pluginCmd.command("list").description("List installed plugins").action(async () => {
    await runPluginListCommand();
  });
  await program.parseAsync(process.argv);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
