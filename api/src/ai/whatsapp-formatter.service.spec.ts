import { WhatsAppFormatterService } from './whatsapp-formatter.service';

describe('WhatsAppFormatterService', () => {
  it('strips Markdown links to plain URLs', () => {
    const svc = new WhatsAppFormatterService();
    const input =
      'Here is your report: [https://example.com/doc.csv](https://example.com/doc.csv)';
    const { text } = svc.formatResult('unknown_action', input, 'en');
    expect(text).toBe('Here is your report: https://example.com/doc.csv');
  });
});

