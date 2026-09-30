import type { FastifyInstance } from "fastify";
import { HttpError } from "../../errors/httpErrors.js";
import { analyzeExerciseForm } from "./formAnalysis.service.js";

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export default async function formAnalysisRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/form-analysis", async (request, reply) => {
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ message: "Kein Video hochgeladen" });
    if (!ALLOWED_VIDEO_TYPES.has(upload.mimetype)) {
      return reply.code(400).send({ message: "Unterstützt werden MP4-, WebM- und MOV-Videos" });
    }
    const rawExerciseName = upload.fields.exerciseName;
    const exerciseName = rawExerciseName && "value" in rawExerciseName
      ? String(rawExerciseName.value).trim()
      : "";
    if (!exerciseName || exerciseName.length > 120) {
      return reply.code(400).send({ message: "Bitte eine gültige Übung angeben" });
    }
    const video = await upload.toBuffer();
    try {
      return reply.send(await analyzeExerciseForm(
        fastify.prisma,
        request.user.sub,
        exerciseName,
        upload.mimetype,
        video,
      ));
    } catch (error) {
      if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
      throw error;
    }
  });
}
