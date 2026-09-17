import { describe, expect, it } from 'vitest';
import { approvalDecisionSchema } from './approval';
import { basisPointsSchema } from './common';
import { configurationSelectionSchema, saveConfigurationSchema } from './configuration';
import { createCustomerSchema, customerListQuerySchema } from './customer';
import { createLocationSchema } from './location';
import { createProductSchema } from './product';

const validCustomer = {
  companyName: 'Nexora Retail GmbH',
  legalName: 'Nexora Retail GmbH & Co. KG',
  industry: 'RETAIL',
  vatNumber: 'DE123456789',
  status: 'ACTIVE',
  email: 'contact@nexora-retail.example',
  phone: '+49 30 1234567',
  accountOwnerId: 'cjld2cjxh0000qzrmn831i7rn',
};

const validLocation = {
  name: 'Berlin HQ',
  addressLine1: 'Alexanderplatz 1',
  city: 'Berlin',
  postalCode: '10178',
  country: 'DE',
  contactName: 'Jane Doe',
  contactEmail: 'jane.doe@nexora-retail.example',
  serviceability: 'AVAILABLE',
  isPrimary: true,
  customerId: 'cjld2cjxh0000qzrmn831i7rn',
};

const validProduct = {
  sku: 'SDWAN-100M',
  name: 'SD-WAN 100 Mbps',
  description: 'Managed SD-WAN service at 100 Mbps.',
  category: 'SD_WAN',
  monthlyPriceCents: 25000,
  setupPriceCents: 50000,
  pricingModel: 'FLAT',
  minContractMonths: 36,
  maxDiscountBps: 2000,
  isActive: true,
  sortOrder: 1,
};

const validConfigurationSelection = {
  productId: 'cjld2cjxh0000qzrmn831i7rn',
  quantity: 3,
};

describe('createCustomerSchema', () => {
  it('accepts a valid payload', () => {
    const result = createCustomerSchema.safeParse(validCustomer);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = createCustomerSchema.safeParse({ ...validCustomer, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed VAT number', () => {
    const result = createCustomerSchema.safeParse({ ...validCustomer, vatNumber: '123' });
    expect(result.success).toBe(false);
  });
});

describe('createLocationSchema', () => {
  it('accepts a valid payload', () => {
    const result = createLocationSchema.safeParse(validLocation);
    expect(result.success).toBe(true);
  });

  it('rejects a non-2-letter country code', () => {
    const result = createLocationSchema.safeParse({ ...validLocation, country: 'DEU' });
    expect(result.success).toBe(false);
  });
});

describe('createProductSchema', () => {
  it('accepts a valid payload', () => {
    const result = createProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it('rejects a lowercase SKU with invalid characters', () => {
    const result = createProductSchema.safeParse({ ...validProduct, sku: 'sd wan!!' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative monthly price', () => {
    const result = createProductSchema.safeParse({ ...validProduct, monthlyPriceCents: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects a contract term not in CONTRACT_TERMS', () => {
    const result = createProductSchema.safeParse({ ...validProduct, minContractMonths: 18 });
    expect(result.success).toBe(false);
  });
});

describe('configurationSelectionSchema', () => {
  it('accepts a valid selection', () => {
    const result = configurationSelectionSchema.safeParse(validConfigurationSelection);
    expect(result.success).toBe(true);
  });

  it('rejects quantity 0', () => {
    const result = configurationSelectionSchema.safeParse({
      ...validConfigurationSelection,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects quantity 1000', () => {
    const result = configurationSelectionSchema.safeParse({
      ...validConfigurationSelection,
      quantity: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe('saveConfigurationSchema', () => {
  const base = {
    quoteId: 'cjld2cjxh0000qzrmn831i7rn',
    selections: [validConfigurationSelection],
    contractMonths: 36 as const,
    siteCount: 1,
  };

  it('rejects a discount > 0 with no discount reason', () => {
    const result = saveConfigurationSchema.safeParse({ ...base, requestedDiscountBps: 500 });
    expect(result.success).toBe(false);
  });

  it('rejects a discount > 0 with a too-short discount reason', () => {
    const result = saveConfigurationSchema.safeParse({
      ...base,
      requestedDiscountBps: 500,
      discountReason: 'too short',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a discount > 0 with a proper reason', () => {
    const result = saveConfigurationSchema.safeParse({
      ...base,
      requestedDiscountBps: 500,
      discountReason: 'Competitive displacement, matching incumbent pricing.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a zero discount with no reason', () => {
    const result = saveConfigurationSchema.safeParse({ ...base, requestedDiscountBps: 0 });
    expect(result.success).toBe(true);
  });
});

describe('approvalDecisionSchema', () => {
  const approvalId = 'cjld2cjxh0000qzrmn831i7rn';

  it('accepts a valid APPROVED payload', () => {
    const result = approvalDecisionSchema.safeParse({ approvalId, decision: 'APPROVED' });
    expect(result.success).toBe(true);
  });

  it('accepts APPROVED with no decisionNote', () => {
    const result = approvalDecisionSchema.safeParse({ approvalId, decision: 'APPROVED' });
    expect(result.success).toBe(true);
  });

  it('rejects REJECTED without a decisionNote', () => {
    const result = approvalDecisionSchema.safeParse({ approvalId, decision: 'REJECTED' });
    expect(result.success).toBe(false);
  });

  it('rejects REJECTED with a too-short decisionNote', () => {
    const result = approvalDecisionSchema.safeParse({
      approvalId,
      decision: 'REJECTED',
      decisionNote: 'no',
    });
    expect(result.success).toBe(false);
  });

  it('accepts REJECTED with a proper decisionNote', () => {
    const result = approvalDecisionSchema.safeParse({
      approvalId,
      decision: 'REJECTED',
      decisionNote: 'Discount exceeds policy for this contract term.',
    });
    expect(result.success).toBe(true);
  });
});

describe('basisPointsSchema', () => {
  it('accepts 0 and 10000', () => {
    expect(basisPointsSchema.safeParse(0).success).toBe(true);
    expect(basisPointsSchema.safeParse(10_000).success).toBe(true);
  });

  it('rejects 10001', () => {
    expect(basisPointsSchema.safeParse(10_001).success).toBe(false);
  });

  it('rejects negative values', () => {
    expect(basisPointsSchema.safeParse(-1).success).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(basisPointsSchema.safeParse(180.5).success).toBe(false);
  });
});

describe('customerListQuerySchema', () => {
  it('parses an empty object into sensible defaults, as a bare URL would produce', () => {
    const result = customerListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        status: [],
        industry: [],
        sortBy: 'companyName',
        sortDir: 'asc',
        page: 1,
        pageSize: 25,
      });
    }
  });

  it('parses comma-separated status filters from a query string', () => {
    const result = customerListQuerySchema.safeParse({ status: 'ACTIVE,PROSPECT' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(['ACTIVE', 'PROSPECT']);
    }
  });
});
