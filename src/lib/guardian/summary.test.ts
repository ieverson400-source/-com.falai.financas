import { describe, it, expect } from 'bun:test';
import { guardianMonth, summarizeGuardian } from './summary';
describe('Guardian privacy and actual totals', () => {
  it('projects only category totals, not transaction details', () => {
    const input = { category: 'Lazer', amount: 120, description: 'private', user_id: 'private', raw_transcript: 'private' };
    expect(summarizeGuardian([input], []).categories).toEqual([{ category: 'Lazer', total: 120, limit: 0, alert: 'ok' }]);
  });
  it('uses the Brazilian calendar month at UTC boundaries', () => {
    expect(guardianMonth(new Date('2026-11-01T01:00:00Z'))).toBe('2026-10-01');
  });
  it('sums actual expenses without rounding each row', () => {
    expect(summarizeGuardian([{ category: 'Lazer', amount: 10.1 }, { category: 'Lazer', amount: 20.2 }], []).total).toBe(30.3);
  });
});