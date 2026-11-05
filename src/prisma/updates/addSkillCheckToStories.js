import prisma from '../../services/prismaClient.js';

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE stories ADD COLUMN IF NOT EXISTS skill_check LONGTEXT NULL AFTER fate_check');
  console.log('stories.skill_check is ready.');
}

main()
  .catch((error) => {
    console.error('addSkillCheckToStories failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
