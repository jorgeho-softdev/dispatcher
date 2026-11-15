import { Injectable } from '@nestjs/common';
import type { AiSettingsDto, AiSettingsUpdateInput } from '@dispatcher/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AiSettings } from '../../generated/prisma/client';

function toDto(s: AiSettings): AiSettingsDto {
  return {
    autonomyLevel: s.autonomyLevel,
    minRatePerKm: s.minRatePerKm.toNumber(),
    minMarginPct: s.minMarginPct.toNumber(),
    maxCounterOfferPct: s.maxCounterOfferPct.toNumber(),
    maxDeadheadKm: s.maxDeadheadKm,
    preferredProvinces: s.preferredProvinces,
    avoidProvinces: s.avoidProvinces,
  };
}

/**
 * Carrier preferences that drive matching today and the AI agent's limits
 * in Phase 2 (one row per organization, created at registration).
 */
@Injectable()
export class AiSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string): Promise<AiSettingsDto> {
    // upsert keeps older organizations (created before settings existed) working.
    const settings = await this.prisma.aiSettings.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
    return toDto(settings);
  }

  async update(
    organizationId: string,
    input: AiSettingsUpdateInput,
  ): Promise<AiSettingsDto> {
    const settings = await this.prisma.aiSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...input },
      update: input,
    });
    return toDto(settings);
  }
}
