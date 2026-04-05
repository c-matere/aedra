import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import * as formatters from './ai.formatters';

describe('WhatsAppFormatterService', () => {
  it('strips Markdown links to plain URLs', () => {
    const svc = new WhatsAppFormatterService();
    const input =
      'Here is your report: [https://example.com/doc.csv](https://example.com/doc.csv)';
    const { text } = svc.formatResult('unknown_action', input, 'en');
    expect(text).toBe('Here is your report: https://example.com/doc.csv');
  });

  it('includes tenant search query when attached on array', () => {
    const tenants: any[] = [];
    (tenants as any).__query = 'Mary Atieno';
    const text = formatters.formatTenantList(tenants);
    expect(text).toContain('Mary Atieno');
    expect(text.toLowerCase()).toContain("didn't find");
  });
});
