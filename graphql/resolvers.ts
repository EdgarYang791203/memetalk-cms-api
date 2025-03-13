import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const resolvers = {
  // Query: {
  //   users: async () => {
  //     return prisma.user.findMany();
  //   },
  // },
  // Mutation: {
  //   createUser: async (_: any, { data }) => {
  //     return prisma.user.create({ data });
  //   },
  // },
}