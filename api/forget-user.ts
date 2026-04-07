import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const phone = '254705660625';
  const rawPhone = '0705660625';
  
  console.log(`Looking for records with phone: ${phone} or ${rawPhone}...`);
  
  const user = await prisma.user.findFirst({ where: { phone: { in: [phone, rawPhone] } } });
  if (user) {
    console.log(`Found user: ${user.id}. Deleting...`);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  } else {
    console.log('No user found with that phone.');
  }
  
  // Wipe tenants directly
  await prisma.tenant.deleteMany({ where: { phone: { in: [phone, rawPhone] } } }).catch(() => {});
  // Wipe landlords
  await prisma.landlord.deleteMany({ where: { phone: { in: [phone, rawPhone] } } }).catch(() => {});
  // Wipe staff
  

  // Delete chat histories
  const chats = await prisma.chatHistory.deleteMany({
    where: { waPhone: { in: [phone, rawPhone] } },
  }).catch(() => ({count: 0}));

  console.log(`Deleted ${chats.count} chat histories/sessions.`);
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
