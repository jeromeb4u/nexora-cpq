-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SALES_REP', 'SALES_MANAGER', 'PRICING_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('MANUFACTURING', 'FINANCIAL_SERVICES', 'HEALTHCARE', 'RETAIL', 'LOGISTICS', 'PUBLIC_SECTOR', 'TECHNOLOGY', 'ENERGY_UTILITIES', 'PROFESSIONAL_SERVICES', 'EDUCATION');

-- CreateEnum
CREATE TYPE "Serviceability" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'PENDING_CHECK');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('CONNECTIVITY', 'SD_WAN', 'SECURITY', 'HARDWARE', 'VOICE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('PER_UNIT', 'FLAT', 'PER_SITE');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('REQUIRES', 'INCOMPATIBLE', 'RECOMMENDS', 'MUTUALLY_EXCLUSIVE', 'MIN_CONTRACT_TERM', 'REQUIRES_SERVICEABILITY');

-- CreateEnum
CREATE TYPE "RuleTriggerKind" AS ENUM ('PRODUCT_SELECTED', 'CATEGORY_SELECTED', 'BANDWIDTH_AT_LEAST', 'CONTRACT_TERM_AT_LEAST', 'ALWAYS');

-- CreateEnum
CREATE TYPE "RuleEffectKind" AS ENUM ('REQUIRES_PRODUCT', 'REQUIRES_ONE_OF', 'INCOMPATIBLE_WITH_PRODUCT', 'RECOMMENDS_PRODUCT', 'AT_MOST_ONE_OF', 'MIN_CONTRACT_MONTHS', 'MIN_SERVICEABILITY');

-- CreateEnum
CREATE TYPE "ValidationSeverity" AS ENUM ('ERROR', 'WARNING', 'REQUIRED', 'RECOMMENDATION', 'INFORMATION');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'CONFIGURING', 'READY_FOR_REVIEW', 'APPROVAL_REQUIRED', 'APPROVED', 'REJECTED', 'SENT_TO_CUSTOMER', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalReason" AS ENUM ('DISCOUNT_EXCEEDS_THRESHOLD', 'CONTRACT_VALUE_THRESHOLD', 'NON_STANDARD_TERM', 'MANUAL_ESCALATION');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'LOCATION_CREATED', 'LOCATION_UPDATED', 'QUOTE_CREATED', 'QUOTE_UPDATED', 'QUOTE_STATUS_CHANGED', 'QUOTE_VERSION_CREATED', 'QUOTE_VERSION_RESTORED', 'PRODUCT_ADDED', 'PRODUCT_REMOVED', 'DISCOUNT_CHANGED', 'APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'APPROVAL_REJECTED', 'QUOTE_SENT', 'QUOTE_DOCUMENT_GENERATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'AUTH_SIGNED_IN', 'AUTH_SIGN_IN_FAILED', 'AUTH_SIGNED_OUT', 'ACCESS_DENIED');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('CUSTOMER', 'CUSTOMER_LOCATION', 'QUOTE', 'QUOTE_VERSION', 'QUOTE_ITEM', 'QUOTE_APPROVAL', 'PRODUCT', 'USER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'APPROVAL_REJECTED', 'QUOTE_ACCEPTED', 'QUOTE_EXPIRING');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SALES_REP',
    "jobTitle" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "industry" "Industry" NOT NULL,
    "vatNumber" TEXT NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'PROSPECT',
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "notes" TEXT,
    "accountOwnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'DE',
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "existingConnectivity" TEXT,
    "serviceability" "Serviceability" NOT NULL DEFAULT 'PENDING_CHECK',
    "maxBandwidthMbps" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "setupPriceCents" INTEGER NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'FLAT',
    "minContractMonths" INTEGER NOT NULL DEFAULT 12,
    "maxDiscountBps" INTEGER NOT NULL DEFAULT 2000,
    "bandwidthMbps" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rule" (
    "id" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "severity" "ValidationSeverity" NOT NULL DEFAULT 'ERROR',
    "message" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerKind" "RuleTriggerKind" NOT NULL,
    "triggerProductId" TEXT,
    "triggerCategory" "ProductCategory",
    "triggerThreshold" INTEGER,
    "effectKind" "RuleEffectKind" NOT NULL,
    "effectProductId" TEXT,
    "effectThreshold" INTEGER,
    "effectServiceability" "Serviceability",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_rule_target" (
    "ruleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "product_rule_target_pkey" PRIMARY KEY ("ruleId","productId")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "ownerId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_version" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "quoteId" TEXT NOT NULL,
    "contractMonths" INTEGER NOT NULL DEFAULT 36,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "grossMonthlyCents" INTEGER NOT NULL DEFAULT 0,
    "grossSetupCents" INTEGER NOT NULL DEFAULT 0,
    "discountMonthlyCents" INTEGER NOT NULL DEFAULT 0,
    "mrrCents" INTEGER NOT NULL DEFAULT 0,
    "otcCents" INTEGER NOT NULL DEFAULT 0,
    "tcvCents" INTEGER NOT NULL DEFAULT 0,
    "effectiveDiscountBps" INTEGER NOT NULL DEFAULT 0,
    "configSnapshot" JSONB,
    "supersededAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_item" (
    "id" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitMonthlyCents" INTEGER NOT NULL,
    "unitSetupCents" INTEGER NOT NULL,
    "monthlyCents" INTEGER NOT NULL,
    "setupCents" INTEGER NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_approval" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "reason" "ApprovalReason" NOT NULL,
    "requestedDiscountBps" INTEGER NOT NULL,
    "allowedDiscountBps" INTEGER NOT NULL,
    "mrrCentsSnapshot" INTEGER NOT NULL,
    "justification" TEXT NOT NULL,
    "decisionNote" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_managerId_idx" ON "user"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "customer_vatNumber_key" ON "customer"("vatNumber");

-- CreateIndex
CREATE INDEX "customer_accountOwnerId_idx" ON "customer"("accountOwnerId");

-- CreateIndex
CREATE INDEX "customer_status_idx" ON "customer"("status");

-- CreateIndex
CREATE INDEX "customer_industry_idx" ON "customer"("industry");

-- CreateIndex
CREATE INDEX "customer_companyName_idx" ON "customer"("companyName");

-- CreateIndex
CREATE INDEX "customer_location_customerId_idx" ON "customer_location"("customerId");

-- CreateIndex
CREATE INDEX "customer_location_serviceability_idx" ON "customer_location"("serviceability");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE INDEX "product_category_isActive_idx" ON "product"("category", "isActive");

-- CreateIndex
CREATE INDEX "product_isActive_sortOrder_idx" ON "product"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "product_rule_isActive_priority_idx" ON "product_rule"("isActive", "priority");

-- CreateIndex
CREATE INDEX "product_rule_triggerProductId_idx" ON "product_rule"("triggerProductId");

-- CreateIndex
CREATE INDEX "product_rule_effectProductId_idx" ON "product_rule"("effectProductId");

-- CreateIndex
CREATE INDEX "product_rule_target_productId_idx" ON "product_rule_target"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_quoteNumber_key" ON "quote"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quote_currentVersionId_key" ON "quote"("currentVersionId");

-- CreateIndex
CREATE INDEX "quote_ownerId_status_idx" ON "quote"("ownerId", "status");

-- CreateIndex
CREATE INDEX "quote_customerId_idx" ON "quote"("customerId");

-- CreateIndex
CREATE INDEX "quote_status_updatedAt_idx" ON "quote"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "quote_updatedAt_idx" ON "quote"("updatedAt");

-- CreateIndex
CREATE INDEX "quote_version_quoteId_idx" ON "quote_version"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_version_quoteId_versionNumber_key" ON "quote_version"("quoteId", "versionNumber");

-- CreateIndex
CREATE INDEX "quote_item_quoteVersionId_idx" ON "quote_item"("quoteVersionId");

-- CreateIndex
CREATE INDEX "quote_item_productId_idx" ON "quote_item"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_item_quoteVersionId_productId_key" ON "quote_item"("quoteVersionId", "productId");

-- CreateIndex
CREATE INDEX "quote_approval_decision_createdAt_idx" ON "quote_approval"("decision", "createdAt");

-- CreateIndex
CREATE INDEX "quote_approval_quoteId_idx" ON "quote_approval"("quoteId");

-- CreateIndex
CREATE INDEX "quote_approval_quoteVersionId_idx" ON "quote_approval"("quoteVersionId");

-- CreateIndex
CREATE INDEX "audit_event_entity_entityId_createdAt_idx" ON "audit_event"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_event_actorId_createdAt_idx" ON "audit_event"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_event_createdAt_idx" ON "audit_event"("createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_accountOwnerId_fkey" FOREIGN KEY ("accountOwnerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_location" ADD CONSTRAINT "customer_location_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_rule" ADD CONSTRAINT "product_rule_triggerProductId_fkey" FOREIGN KEY ("triggerProductId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_rule" ADD CONSTRAINT "product_rule_effectProductId_fkey" FOREIGN KEY ("effectProductId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_rule_target" ADD CONSTRAINT "product_rule_target_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "product_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_rule_target" ADD CONSTRAINT "product_rule_target_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "customer_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote" ADD CONSTRAINT "quote_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "quote_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_version" ADD CONSTRAINT "quote_version_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_version" ADD CONSTRAINT "quote_version_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "quote_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_approval" ADD CONSTRAINT "quote_approval_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_approval" ADD CONSTRAINT "quote_approval_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "quote_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_approval" ADD CONSTRAINT "quote_approval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_approval" ADD CONSTRAINT "quote_approval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
