import type { FastifyInstance } from "fastify";
import { HttpError } from "../../errors/httpErrors.js";
import { analyzeBodyImage, listBodyAnalyses, saveBodyAnalysis, toBodyAnalysisDto } from "./bodyAnalysis.service.js";

export default async function bodyAnalysisRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/body-analyses/analyze", async (request, reply) => {
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ message: "Bitte ein Analysebild auswählen." });
    if (!["image/jpeg", "image/png", "image/webp"].includes(upload.mimetype)) {
      return reply.code(400).send({ message: "Unterstützt werden JPG-, PNG- und WebP-Bilder." });
    }
    const image = await upload.toBuffer();
    try {
      const result = await analyzeBodyImage(fastify.prisma, request.user.sub, upload.filename, upload.mimetype, image);
      return reply.send(result);
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });

  fastify.get("/body-analyses", async (request, reply) => {
    const items = await listBodyAnalyses(fastify.prisma, request.user.sub);
    return reply.send({ items: items.map(toBodyAnalysisDto) });
  });

  fastify.post("/body-analyses", async (request, reply) => {
    try {
      const saved = await saveBodyAnalysis(fastify.prisma, request.user.sub, request.body);
      return reply.code(201).send(toBodyAnalysisDto(saved));
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });
}
