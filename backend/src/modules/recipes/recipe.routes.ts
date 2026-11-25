import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { calculateRecipeSchema, upsertRecipeSchema } from "@fitnesstracker/shared";
import { computeRecipe, deleteRecipe, getRecipe, listRecipes, toCalculationDto, upsertRecipe } from "./recipe.service.js";

const idParams = z.object({ id: z.string().uuid() });

export default async function recipeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/nutrition/recipes", async (request) => ({ items: await listRecipes(fastify.prisma, request.user.sub) }));

  // Preview while editing: nothing is stored.
  fastify.post("/nutrition/recipes/calculate", async (request) => {
    const input = calculateRecipeSchema.parse(request.body);
    return toCalculationDto(await computeRecipe(fastify.prisma, request.user.sub, input));
  });

  fastify.get("/nutrition/recipes/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return getRecipe(fastify.prisma, request.user.sub, id);
  });

  fastify.put("/nutrition/recipes/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return upsertRecipe(fastify.prisma, request.user.sub, id, upsertRecipeSchema.parse(request.body));
  });

  fastify.delete("/nutrition/recipes/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await deleteRecipe(fastify.prisma, request.user.sub, id);
    return reply.code(204).send();
  });
}
