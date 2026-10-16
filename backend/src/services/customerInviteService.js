import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import { generateRefreshTokenValue, hashRefreshToken } from "../utils/tokens.js";

const SALT_ROUNDS = 12;
const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function createInvite({ customerId }) {
  const rawToken = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(rawToken);

  await prisma.customerInviteToken.create({
    data: {
      customerId,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  return { rawToken };
}

export async function verifyInviteToken({ token }) {
  const tokenHash = hashRefreshToken(token);

  const invite = await prisma.customerInviteToken.findUnique({
    where: { tokenHash },
    include: {
      customer: {
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

  if (!invite.customer || invite.customer.status !== "ACTIVE") {
    const err = new Error("This customer account is inactive or no longer exists.");
    err.status = 403;
    throw err;
  }

  return {
    phoneNumber: invite.customer.phoneNumber,
    name: invite.customer.name,
    companyName: invite.customer.company?.name,
    companySlug: invite.customer.company?.slug,
  };
}

export async function acceptInvite({ token, password }) {
  const tokenHash = hashRefreshToken(token);

  const invite = await prisma.customerInviteToken.findUnique({
    where: { tokenHash },
    include: { customer: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    const err = new Error("This invite link is invalid or has expired.");
    err.status = 400;
    throw err;
  }

  if (!invite.customer || invite.customer.status !== "ACTIVE") {
    const err = new Error("This customer account is inactive or no longer exists.");
    err.status = 403;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.update({
      where: { id: invite.customerId },
      data: { passwordHash, isEmailVerified: true },
    });

    await tx.customerInviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return customer;
  });
}