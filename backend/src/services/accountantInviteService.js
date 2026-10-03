import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import { generateRefreshTokenValue, hashRefreshToken } from "../utils/tokens.js";

const SALT_ROUNDS = 12;
const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function createInvite({ accountantId }) {
  const rawToken = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(rawToken);

  await prisma.accountantInviteToken.create({
    data: {
      accountantId,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  return { rawToken };
}

export async function verifyInviteToken({ token }) {
  const tokenHash = hashRefreshToken(token);

  const invite = await prisma.accountantInviteToken.findUnique({
    where: { tokenHash },
    include: {
      accountant: {
        include: {
          company: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    const err = new Error("This invite link is invalid or has expired.");
    err.status = 400;
    throw err;
  }

  if (!invite.accountant || invite.accountant.status !== "ACTIVE") {
    const err = new Error("This accountant account is inactive or no longer exists.");
    err.status = 403;
    throw err;
  }

  return {
    email: invite.accountant.email,
    name: invite.accountant.name,
    companyName: invite.accountant.company?.name,
    companySlug: invite.accountant.company?.slug,
  };
}

export async function acceptInvite({ token, password }) {
  const tokenHash = hashRefreshToken(token);

  const invite = await prisma.accountantInviteToken.findUnique({
    where: { tokenHash },
    include: { accountant: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    const err = new Error("This invite link is invalid or has expired.");
    err.status = 400;
    throw err;
  }

  if (!invite.accountant || invite.accountant.status !== "ACTIVE") {
    const err = new Error("This accountant account is inactive or no longer exists.");
    err.status = 403;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const accountant = await tx.accountant.update({
      where: { id: invite.accountantId },
      data: { passwordHash, isEmailVerified: true },
    });

    await tx.accountantInviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return accountant;
  });
}
