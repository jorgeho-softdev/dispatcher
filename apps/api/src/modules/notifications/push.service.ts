import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_LOCALE, isLocale } from '@dispatcher/i18n';
import { formatMessage } from '@dispatcher/i18n/server';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type PushTemplate =
  'sendApproval' | 'bookingApproval' | 'booked' | 'rejected' | 'failed';

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Push notifications through the Expo Push HTTP API (expo-server-sdk v8 is
 * ESM-only; see docs/adr/0014-jobs-and-push.md). Texts come from the shared
 * catalogs (push.*) in each user's language. Never throws: a failed push
 * must not break a negotiation.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly accessToken?: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.accessToken = config.get('EXPO_ACCESS_TOKEN', { infer: true });
  }

  async notifyUser(
    userId: string,
    template: PushTemplate,
    params: Record<string, string | number>,
    data: Record<string, string>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { devices: true },
      });
      if (!user || user.devices.length === 0) return;
      const locale = isLocale(user.locale) ? user.locale : DEFAULT_LOCALE;
      const title = formatMessage(locale, `push.${template}.title`, params);
      const body = formatMessage(locale, `push.${template}.body`, params);

      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(this.accessToken && {
            authorization: `Bearer ${this.accessToken}`,
          }),
        },
        body: JSON.stringify(
          user.devices.map((d) => ({
            to: d.token,
            title,
            body,
            data,
            sound: 'default',
          })),
        ),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}`);
        return;
      }
      const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
      // Forget tokens of uninstalled apps.
      const dead = user.devices.filter(
        (_d, i) => tickets[i]?.details?.error === 'DeviceNotRegistered',
      );
      if (dead.length > 0) {
        await this.prisma.deviceToken.deleteMany({
          where: { id: { in: dead.map((d) => d.id) } },
        });
      }
    } catch (error) {
      this.logger.warn(`Push failed: ${String(error)}`);
    }
  }
}
