import { Injectable } from '@nestjs/common';

export interface WaVcSummary {
  versionId: string;
  action: string;
  entityType?: string;
  changedFields?: string[];
}

@Injectable()
export class WaCrudButtonsService {
  /**
   * Build a WhatsApp interactive button message for post-CRUD diff actions.
   * Fires AFTER the text response — gives user quick access to diff/rollback.
   */
  buildCrudButtons(vc: WaVcSummary, lang: string): any {
    const fields =
      vc.changedFields && vc.changedFields.length > 0
        ? vc.changedFields.slice(0, 3).join(', ')
        : '';

    const actionLabel =
      {
        CREATE: lang === 'sw' ? 'Imeundwa' : 'Created',
        UPDATE: lang === 'sw' ? 'Imesasishwa' : 'Updated',
        DELETE: lang === 'sw' ? 'Imefutwa' : 'Deleted',
        ROLLBACK: lang === 'sw' ? 'Imerejeshwa' : 'Rolled back',
      }[vc.action?.toUpperCase()] || vc.action;

    const entity = vc.entityType
      ? vc.entityType.charAt(0).toUpperCase() +
        vc.entityType.slice(1).toLowerCase()
      : 'Record';

    const bodyParts = [
      `📋 *${entity} ${actionLabel}*`,
      fields
        ? lang === 'sw'
          ? `Mabadiliko: ${fields}`
          : `Changed: ${fields}`
        : '',
      lang === 'sw'
        ? 'Ungependa kuona mabadiliko kamili au kurejesha hali ya awali?'
        : 'Would you like to view the full diff or rollback this change?',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      type: 'button',
      body: { text: bodyParts },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: `view_diff:${vc.versionId}`,
              title: lang === 'sw' ? '📋 Tofauti' : '📋 View Diff',
            },
          },
          {
            type: 'reply',
            reply: {
              id: `rollback:${vc.versionId}`,
              title: lang === 'sw' ? '↩️ Rejesha' : '↩️ Rollback',
            },
          },
        ],
      },
    };
  }

  /**
   * Build a WhatsApp interactive button message for plan approval.
   * Fires BEFORE executing complex / ORCHESTRATED tasks.
   */
  buildPlanButtons(planSummary: string, lang: string): any {
    const truncated =
      planSummary.length > 900
        ? planSummary.substring(0, 897) + '...'
        : planSummary;

    return {
      type: 'button',
      body: { text: truncated },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'plan_approve',
              title: lang === 'sw' ? '✅ Kubali' : '✅ Approve',
            },
          },
          {
            type: 'reply',
            reply: {
              id: 'plan_cancel',
              title: lang === 'sw' ? '❌ Kataa' : '❌ Cancel',
            },
          },
        ],
      },
    };
  }
}
