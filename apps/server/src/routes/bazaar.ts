import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ESSENCE_IDS } from "@weave/shared";
import type { Ctx } from "../services/context";
import { activeCharacterId } from "../services/character";
import {
  bazaarView,
  buyOffer,
  contractsView,
  fulfillContract,
  makeProphecy,
  resolveProphecy,
  sellArtifact,
  tradeEssence,
  useCurrency,
} from "../services/market";

export function registerBazaarRoutes(app: FastifyInstance, ctx: Ctx) {
  app.get("/api/bazaar", async () => bazaarView(ctx, activeCharacterId(ctx)));

  app.post("/api/bazaar/buy", async (req) => {
    const body = z
      .discriminatedUnion("assetType", [
        z.object({ assetType: z.literal("essence"), assetId: z.enum(ESSENCE_IDS), quantity: z.number().int().positive() }),
        z.object({ assetType: z.literal("artifact"), assetId: z.string() }),
      ])
      .parse(req.body);
    const charId = activeCharacterId(ctx);
    if (body.assetType === "essence") return tradeEssence(ctx, charId, body.assetId, "buy", body.quantity);
    return buyOffer(ctx, charId, body.assetId);
  });

  app.post("/api/bazaar/sell", async (req) => {
    const body = z
      .discriminatedUnion("assetType", [
        z.object({ assetType: z.literal("essence"), assetId: z.enum(ESSENCE_IDS), quantity: z.number().int().positive() }),
        z.object({ assetType: z.literal("artifact"), assetId: z.string(), mode: z.enum(["produce", "salvage"]).default("produce") }),
      ])
      .parse(req.body);
    const charId = activeCharacterId(ctx);
    if (body.assetType === "essence") return tradeEssence(ctx, charId, body.assetId, "sell", body.quantity);
    return sellArtifact(ctx, charId, body.assetId, body.mode);
  });

  app.get("/api/contracts", async () => contractsView(ctx, activeCharacterId(ctx)));
  app.post<{ Params: { id: string } }>("/api/contracts/:id/fulfill", async (req) => {
    const { artifactId } = z.object({ artifactId: z.string() }).parse(req.body);
    return fulfillContract(ctx, activeCharacterId(ctx), decodeURIComponent(req.params.id), artifactId);
  });

  app.post("/api/prophecies", async (req) => {
    const body = z.object({ essence: z.enum(ESSENCE_IDS), probability: z.number() }).parse(req.body);
    return makeProphecy(ctx, activeCharacterId(ctx), body.essence, body.probability);
  });
  app.post<{ Params: { id: string } }>("/api/prophecies/:id/resolve", async (req) => resolveProphecy(ctx, activeCharacterId(ctx), req.params.id));

  app.post<{ Params: { id: string } }>("/api/items/:id/use", async (req) => useCurrency(ctx, activeCharacterId(ctx), req.params.id));
}
