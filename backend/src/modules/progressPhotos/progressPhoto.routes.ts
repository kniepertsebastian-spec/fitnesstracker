import { createReadStream } from "node:fs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../../errors/httpErrors.js";
import {
  deletePhoto,
  getPhotoFileForUser,
  listPhotos,
  saveUploadedPhoto,
} from "./progressPhoto.service.js";
import { toProgressPhotoDto } from "./progressPhoto.types.js";

const idParamSchema = z.object({ id: z.string().uuid() });
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function progressPhotoRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/progress-photos", async (request, reply) => {
    const photos = await listPhotos(fastify.prisma, request.user.sub);
    return reply.send({ items: photos.map(toProgressPhotoDto) });
  });

  fastify.post("/progress-photos", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ message: "No file uploaded" });
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return reply.code(400).send({ message: "Unsupported file type" });
    }

    const buffer = await file.toBuffer();
    const takenAtField = file.fields.takenAt;
    const takenAtValue =
      takenAtField && !Array.isArray(takenAtField) && takenAtField.type === "field"
        ? takenAtField.value
        : undefined;
    const takenAt = typeof takenAtValue === "string" && takenAtValue ? new Date(takenAtValue) : undefined;

    // `saveUploadedPhoto` re-derives the real mimetype from the decoded image bytes — the
    // client-declared `file.mimetype` above is only a cheap early reject, never trusted as fact.
    const photo = await saveUploadedPhoto(fastify.prisma, request.user.sub, buffer, takenAt);
    return reply.code(201).send(toProgressPhotoDto(photo));
  });

  fastify.get("/progress-photos/:id/file", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      const { filePath, mimeType } = await getPhotoFileForUser(fastify.prisma, request.user.sub, id);
      // Defense in depth alongside the re-encode-on-upload step in the service: even if a
      // browser tried to sniff the response body against its declared type, this forbids it.
      reply.header("X-Content-Type-Options", "nosniff");
      reply.type(mimeType);
      return reply.send(createReadStream(filePath));
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });

  fastify.delete("/progress-photos/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    try {
      await deletePhoto(fastify.prisma, request.user.sub, id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.code(error.statusCode).send({ message: error.message });
      }
      throw error;
    }
  });
}
