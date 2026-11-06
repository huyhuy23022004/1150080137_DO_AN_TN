import { createOwnerRef, isValidOwnerRef } from '../../src/utils/owner-ref';

describe('owner reference', () => {
  it('creates identifiers accepted by the backend contract', () => {
    const ownerRef = createOwnerRef();

    expect(ownerRef.length).toBeGreaterThanOrEqual(8);
    expect(ownerRef.length).toBeLessThanOrEqual(50);
    expect(isValidOwnerRef(ownerRef)).toBe(true);
  });

  it('creates distinct values across rapid calls', () => {
    const values = new Set(Array.from({ length: 100 }, () => createOwnerRef()));

    expect(values.size).toBe(100);
  });

  it('rejects invalid owner references', () => {
    expect(isValidOwnerRef('short')).toBe(false);
    expect(isValidOwnerRef('invalid value with spaces')).toBe(false);
    expect(isValidOwnerRef('a'.repeat(51))).toBe(false);
  });
});
