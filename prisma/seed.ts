import { PrismaClient, Role, BloodGroup, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const password = "ChangeMe123!";
  const hashedPassword = await bcrypt.hash(password, 12);

  // 1. Seed Admin
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@blooddonation.app";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Platform Admin",
      email: adminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
      isEmailVerified: true,
      isActive: true,
    },
  });
  console.log(`Seeded admin user: ${admin.email}`);

  // 2. Seed Donor User & Donor Profile
  const donorEmail = "donor@example.com";
  const donorUser = await prisma.user.upsert({
    where: { email: donorEmail },
    update: {},
    create: {
      name: "Demo Donor",
      email: donorEmail,
      phone: "+8801700000001",
      password: hashedPassword,
      role: Role.DONOR,
      isEmailVerified: true,
      isActive: true,
      donorProfile: {
        create: {
          bloodGroup: BloodGroup.O_POSITIVE,
          gender: Gender.MALE,
          dateOfBirth: new Date("1995-01-01"),
          weightKg: 70,
          address: "Dhanmondi, Dhaka",
          city: "Dhaka",
          latitude: 23.7461,
          longitude: 90.3742,
          isAvailable: true,
        },
      },
    },
  });
  console.log(`Seeded donor user: ${donorUser.email}`);

  // 3. Seed Hospital User & Hospital Profile
  const hospitalEmail = "hospital@example.com";
  const hospitalUser = await prisma.user.upsert({
    where: { email: hospitalEmail },
    update: {},
    create: {
      name: "Square Hospital Admin",
      email: hospitalEmail,
      phone: "+8801700000002",
      password: hashedPassword,
      role: Role.HOSPITAL,
      isEmailVerified: true,
      isActive: true,
      hospitalProfile: {
        create: {
          hospitalName: "Square Hospital Dhaka",
          registrationNumber: "REG-123456",
          address: "18/F Bir Uttam Qazi Nuruzzaman Sarak, Dhaka 1205",
          city: "Dhaka",
          latitude: 23.7529,
          longitude: 90.3816,
          isVerified: true,
        },
      },
    },
  });
  console.log(`Seeded hospital user: ${hospitalUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });