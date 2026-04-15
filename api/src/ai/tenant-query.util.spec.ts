import { inferTenantQueryFromMessage } from './tenant-query.util';

describe('inferTenantQueryFromMessage', () => {
  it('extracts name from "mary atieno profile"', () => {
    expect(inferTenantQueryFromMessage('mary atieno profile')).toBe(
      'mary atieno',
    );
  });

  it('extracts name from "profile Mary Atieno"', () => {
    expect(inferTenantQueryFromMessage('profile Mary Atieno')).toBe(
      'mary atieno',
    );
  });

  it('prefers digits when phone-like present', () => {
    expect(inferTenantQueryFromMessage('find tenant 0712345679 profile')).toBe(
      '0712345679',
    );
  });

  it('returns null for empty/stopwords only', () => {
    expect(inferTenantQueryFromMessage('profile details')).toBeNull();
  });
});
