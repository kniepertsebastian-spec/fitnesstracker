import type { FastifyInstance } from "fastify";
import { getExerciseImage, isValidImagePath, mimeTypeFor, prefetchExerciseImages } from "./exerciseImage.js";

// Public on purpose: <img> tags can't send the access token, and these are the same public-domain
// pictures anyone can see on GitHub. Only whitelisted paths are served (see exerciseImage.ts).
export default async function exerciseImageRoutes(fastify: FastifyInstance) {
  fastify.get("/exercise-images/*", async (request, reply) => {
    const relative = (request.params as { "*": string })["*"];
    if (!isValidImagePath(relative)) return reply.code(404).send({ message: "Not found" });
    const image = await getExerciseImage(relative);
    if (!image) return reply.code(404).send({ message: "Not found" });
    return reply
      .header("Content-Type", mimeTypeFor(relative))
      // The file for a given path never changes, so browsers and the service worker may keep it.
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(image);
  });

  // Once the server is up, pull in whatever the catalog references and isn't stored yet.
  fastify.addHook("onReady", async () => {
    setTimeout(() => {
      void fastify.prisma.exercise
        .findMany({ where: { isActive: true }, select: { imageUrls: true } })
        .then((rows) => prefetchExerciseImages(rows.map((r) => r.imageUrls), fastify.log))
        .catch((error) => fastify.log.warn({ err: error }, "Exercise image prefetch failed"));
    }, 5_000).unref();
  });
}
