import fp from "fastify-plugin";
export default fp(async (fastify) => {
    fastify.decorate("authenticate", async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch {
            reply.code(401).send({ message: "Unauthorized" });
        }
    });
});
//# sourceMappingURL=auth.hooks.js.map