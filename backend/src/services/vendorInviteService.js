import bcrypt from "bcrypt";
import prisma from "../prisma.js";
import { generateRefreshTokenValue, hashRefreshToken } from "../utils/tokens.js";

const SALT_ROUNDS = 12;
const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function createInvite({ vendorId }) {
  const rawToken = generateRefreshTokenValue();
  const tokenHash = hashRefreshToken(rawToken);

  await prisma.vendorInviteToken.create({
    data: {
      vendorId,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  return { rawToken };
}

export async function verifyInviteToken({ token }) {
  const tokenHash = hashRefreshToken(token);

  const invite = await prisma.vendorInviteToken.findUnique({
    where: { tokenHash },
    include: {
      vendor: {
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

  if (!invite.vendor || invite.vendor.status !== "ACTIVE") {
    const err = new Error("This vendor account is inactive or no longer exists.");
    err.status = 403;
    throw err;
  }

  return {
    phoneNumber: invite.vendor.phoneNumber,
    name: invite.vendor.name,
    companyName: invite.vendor.company?.name,
    companySlug: invite.vendor.company?.slug,
  };
}

export async function acceptInvite({ token, password }) {
  const tokenHash = hashRefreshToken(token);

  const invite = await prisma.vendorInviteToken.findUnique({
    where: { tokenHash },
    include: { vendor: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    const err = new Error("This invite link is invalid or has expired.");
    err.status = 400;
    throw err;
  }

  if (!invite.vendor || invite.vendor.status !== "ACTIVE") {
    const err = new Error("This vendor account is inactive or no longer exists.");
    err.status = 403;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.update({
      where: { id: invite.vendorId },
      data: { passwordHash, isEmailVerified: true },
    });

    await tx.vendorInviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return vendor;
  });
}