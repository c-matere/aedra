import { selectModelKey } from './ai.router';

describe('selectModelKey', () => {
    it('routes by explicit prefix', () => {
        expect(selectModelKey('/write create tenant')).toBe('write');
        expect(selectModelKey('/report revenue summary')).toBe('report');
        expect(selectModelKey('/read list properties')).toBe('read');
    });

    it('routes by intent hints', () => {
        expect(selectModelKey('create a tenant')).toBe('write');
        expect(selectModelKey('monthly revenue report')).toBe('report');
        expect(selectModelKey('what properties do we have')).toBe('read');
    });
});
