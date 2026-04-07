import { Injectable } from '@nestjs/common';

export interface NextStep {
  type: 'menu' | 'suggestion' | 'confirmation' | 'error_recovery';
  message: string;
  options?: { key: string; label: string; action: string }[];
}

export interface ActionResult<T = any> {
  success: boolean;
  data: T;
  error?: string;
  action: string;
  message?: string;
  requires_authorization?: boolean;
  requires_clarification?: boolean;
  requires_confirmation?: boolean;
  options?: any[];
  actionId?: string;
  // Compatibility fields for legacy check
  companyId?: string;
  tenantId?: string;
  unitId?: string;
  propertyId?: string;
}

@Injectable()
export class NextStepOrchestrator {
  /**
   * Computes the next logical step based on what action was just performed.
   */
  computeNextStep(
    result: ActionResult,
    context: {
      companyName?: string;
      propertyCount?: number;
      collectionRate?: number;
      language: 'en' | 'sw';
    },
  ): NextStep | null {
    const { action, success } = result;
    const isSw = context.language === 'sw';

    if (!success) return null; // Error recovery is handled separately

    switch (action) {
      case 'select_company': {
        const companyName = context.companyName || 'the company';
        const isEmpty = (context.propertyCount || 0) === 0;

        if (isSw) {
          return {
            type: 'menu',
            message: isEmpty
              ? `✅ Umehamia kampuni ya ${companyName}.\n\nKampuni hii haina mali yoyote bado. Hebu tuanze:`
              : `✅ Umehamia kampuni ya ${companyName}.\n\n📊 Mali ${context.propertyCount} · ${context.collectionRate}% ya kodi imekusanywa mwezi huu.`,
            options: isEmpty
              ? [
                  { key: '1', label: 'Ongeza mali', action: 'create_property' },
                  {
                    key: '2',
                    label: 'Ingiza wapangaji kutoka spreadsheet',
                    action: 'import_tenants',
                  },
                  {
                    key: '3',
                    label: 'Rudi kwa kampuni zote',
                    action: 'list_companies',
                  },
                ]
              : [
                  {
                    key: '1',
                    label: 'Angalia hali ya kodi',
                    action: 'get_portfolio_arrears',
                  },
                  {
                    key: '2',
                    label: 'Onyesha wapangaji',
                    action: 'list_tenants',
                  },
                  {
                    key: '3',
                    label: 'Tengeneza ripoti',
                    action: 'generate_report_file',
                  },
                  {
                    key: '4',
                    label: 'Rudi kwa kampuni zote',
                    action: 'list_companies',
                  },
                ],
          };
        }

        return {
          type: 'menu',
          message: isEmpty
            ? `✅ Switched to ${companyName}.\n\nThis company has no properties yet. Let's get started:`
            : `✅ Switched to ${companyName}.\n\n📊 ${context.propertyCount} properties · ${context.collectionRate}% collected this month.`,
          options: isEmpty
            ? [
                {
                  key: '1',
                  label: 'Add a property',
                  action: 'create_property',
                },
                {
                  key: '2',
                  label: 'Import tenants from spreadsheet',
                  action: 'import_tenants',
                },
                {
                  key: '3',
                  label: 'Back to all companies',
                  action: 'list_companies',
                },
              ]
            : [
                {
                  key: '1',
                  label: 'Check rent collection',
                  action: 'get_portfolio_arrears',
                },
                { key: '2', label: 'View tenants', action: 'list_tenants' },
                {
                  key: '3',
                  label: 'Generate report',
                  action: 'generate_report_file',
                },
                {
                  key: '4',
                  label: 'Back to all companies',
                  action: 'list_companies',
                },
              ],
        };
      }

      case 'generate_report':
      case 'generate_mckinsey_report': {
        if (isSw) {
          return {
            type: 'suggestion',
            message: `Ripoti imekamilika. Ungependa:\n\n1. Kuituma kwa Landlord\n2. Kupakua (Download) pekee\n3. Kupanga utumaji kila mwezi`,
            options: [
              {
                key: '1',
                label: `Tuma kwa Landlord`,
                action: 'send_report_landlord',
              },
              { key: '2', label: 'Pakua pekee', action: 'download_report' },
              {
                key: '3',
                label: 'Panga kila mwezi',
                action: 'schedule_report',
              },
            ],
          };
        }
        return {
          type: 'suggestion',
          message: `Report ready. Would you like to:\n\n1. Send to the Landlord\n2. Download only\n3. Schedule monthly delivery`,
          options: [
            {
              key: '1',
              label: `Send to Landlord`,
              action: 'send_report_landlord',
            },
            { key: '2', label: 'Download only', action: 'download_report' },
            { key: '3', label: 'Schedule monthly', action: 'schedule_report' },
          ],
        };
      }

      case 'send_bulk_reminder': {
        const sentCount = result.data?.sentCount || 0;
        const failedCount = result.data?.failedCount || 0;
        if (isSw) {
          return {
            type: 'confirmation',
            message:
              failedCount > 0
                ? `✅ Vikumbusho ${sentCount} vimetumwa. ${failedCount} vimeshindwa kuwasilishwa.\n\nUngependa nijaribu tena vilivyoshindwa?`
                : `✅ Vikumbusho ${sentCount} vimetumwa kwa mafanikio.\n\nUngependa kutengeneza ripoti ya hali ya makusanyo sasa hivi?`,
            options:
              failedCount > 0
                ? [
                    {
                      key: '1',
                      label: 'Jaribu tena',
                      action: 'retry_reminders',
                    },
                    { key: '2', label: 'Imetosha', action: 'dismiss' },
                  ]
                : [
                    {
                      key: '1',
                      label: 'Ndiyo, tengeneza ripoti',
                      action: 'generate_report_file',
                    },
                    { key: '2', label: 'Sio sasa', action: 'dismiss' },
                  ],
          };
        }
        return {
          type: 'confirmation',
          message:
            failedCount > 0
              ? `✅ ${sentCount} reminders sent. ${failedCount} failed to deliver.\n\nWould you like me to retry the failed ones?`
              : `✅ ${sentCount} reminders sent successfully.\n\nWould you like to generate a collection status report now?`,
          options:
            failedCount > 0
              ? [
                  {
                    key: '1',
                    label: 'Retry failed',
                    action: 'retry_reminders',
                  },
                  { key: '2', label: 'Done', action: 'dismiss' },
                ]
              : [
                  {
                    key: '1',
                    label: 'Yes, generate report',
                    action: 'generate_report_file',
                  },
                  { key: '2', label: 'Not now', action: 'dismiss' },
                ],
        };
      }

      case 'create_property': {
        const propName = result.data?.name || 'the property';
        if (isSw) {
          return {
            type: 'suggestion',
            message: `✅ Mali "${propName}" imeongezwa. Ungependa:\n\n1. Kuongeza Unit (Chumba)\n2. Kuweka mpangaji mtarajiwa\n3. Kurudi kwenye list ya mali`,
            options: [
              { key: '1', label: 'Ongeza Unit', action: 'create_unit' },
              { key: '2', label: 'Weka Mpangaji', action: 'create_tenant' },
              { key: '3', label: 'List ya Mali', action: 'list_properties' },
            ],
          };
        }
        return {
          type: 'suggestion',
          message: `✅ Property "${propName}" created. Would you like to:\n\n1. Add a Unit\n2. Register a Tenant\n3. Back to Property List`,
          options: [
            { key: '1', label: 'Add Unit', action: 'create_unit' },
            { key: '2', label: 'Register Tenant', action: 'create_tenant' },
            { key: '3', label: 'Property List', action: 'list_properties' },
          ],
        };
      }

      case 'list_properties': {
        const count = result.data?.length || 0;
        if (count === 1) {
          const prop = result.data[0];
          if (isSw) {
            return {
              type: 'menu',
              message: `Umechagua "${prop.name}". Kitendo gani kifuatao?`,
              options: [
                {
                  key: '1',
                  label: 'Angalia Arrears',
                  action: 'get_property_arrears',
                },
                {
                  key: '2',
                  label: 'Majina ya Wapangaji',
                  action: 'list_tenants',
                },
                {
                  key: '3',
                  label: 'Tengeneza Statement',
                  action: 'generate_property_statement',
                },
              ],
            };
          }
          return {
            type: 'menu',
            message: `You've selected "${prop.name}". What's next?`,
            options: [
              {
                key: '1',
                label: 'Check Arrears',
                action: 'get_property_arrears',
              },
              { key: '2', label: 'List Tenants', action: 'list_tenants' },
              {
                key: '3',
                label: 'Generate Statement',
                action: 'generate_property_statement',
              },
            ],
          };
        }
        return null;
      }

      case 'get_property_details': {
        const id = result.data?.id;
        const name = result.data?.name || 'this property';
        if (isSw) {
          return {
            type: 'menu',
            message: `Pata huduma zaidi kwa ${name}:`,
            options: [
              { key: '1', label: 'Ongeza Chumba', action: `create_unit:${id}` },
              {
                key: '2',
                label: 'Ripoti ya Madeni',
                action: `get_property_arrears:${id}`,
              },
              {
                key: '3',
                label: 'Statement ya Mali',
                action: `generate_report_file:${id}`,
              },
              {
                key: '4',
                label: 'Badili Habari',
                action: `update_property:${id}`,
              },
            ],
          };
        }
        return {
          type: 'menu',
          message: `Quick Actions for ${name}:`,
          options: [
            { key: '1', label: 'Add a Unit', action: `create_unit:${id}` },
            {
              key: '2',
              label: 'Arrears Report',
              action: `get_property_arrears:${id}`,
            },
            {
              key: '3',
              label: 'Financial Statement',
              action: `generate_report_file:${id}:Financial`,
            },
            {
              key: '4',
              label: 'Edit Details',
              action: `update_property:${id}`,
            },
          ],
        };
      }

      case 'get_unit_details': {
        const unitNo = result.data?.unitNumber || 'this unit';
        if (isSw) {
          return {
            type: 'menu',
            message: `Kitendo kwa chumba ${unitNo}:`,
            options: [
              { key: '1', label: 'Weka Mpangaji', action: 'create_tenant' },
              { key: '2', label: 'Ongeza Expense', action: 'create_expense' },
              { key: '3', label: 'Angalia Mpango', action: 'get_unit_leases' },
            ],
          };
        }
        return {
          type: 'menu',
          message: `Action for unit ${unitNo}:`,
          options: [
            { key: '1', label: 'Register Tenant', action: 'create_tenant' },
            { key: '2', label: 'Add Expense', action: 'create_expense' },
            { key: '3', label: 'View Leases', action: 'get_unit_leases' },
          ],
        };
      }

      case 'get_tenant_details': {
        const id = result.data?.id;
        const leaseId = result.data?.leases?.[0]?.id; // Prefer active lease if available
        const name = result.data?.firstName || 'this tenant';
        if (isSw) {
          return {
            type: 'menu',
            message: `Chagua huduma kwa ajili ya ${name}:`,
            options: [
              {
                key: '1',
                label: 'Tuma Statement',
                action: `get_tenant_statement:${id}`,
              },
              {
                key: '2',
                label: 'Toza Penalti',
                action: `create_penalty:${leaseId || id}`,
              },
              {
                key: '3',
                label: 'Badili Habari',
                action: `update_tenant:${id}`,
              },
              {
                key: '4',
                label: 'Ilani ya Kisheria',
                action: `create_maintenance_request:${id}:LEGAL`,
              },
            ],
          };
        }
        return {
          type: 'menu',
          message: `Quick Actions for ${name}:`,
          options: [
            {
              key: '1',
              label: 'Payment Report',
              action: `get_tenant_statement:${id}`,
            },
            {
              key: '2',
              label: 'Charge Penalty',
              action: `create_penalty:${leaseId || 'none'}`,
            },
            { key: '3', label: 'Edit Details', action: `update_tenant:${id}` },
            {
              key: '4',
              label: 'Legal Notice',
              action: `create_maintenance_request:${id}:LEGAL`,
            },
          ],
        };
      }

      default:
        return null;
    }
  }

  /**
   * Helper to format a NextStep into a string for WhatsApp
   */
  formatNextStep(step: NextStep): string {
    let output = `\n\n${step.message}`;
    // If not using buttons, append the options as a numbered list
    if (step.options && step.options.length > 0) {
      output +=
        '\n\n' + step.options.map((o) => `*${o.key}.* ${o.label}`).join('\n');
    }
    return output;
  }
}
