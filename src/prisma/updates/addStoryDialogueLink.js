import prisma from '../../services/prismaClient.js';

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE stories ADD COLUMN IF NOT EXISTS dialogue_session_id INT NULL AFTER skill_check');
  await prisma.$executeRawUnsafe('ALTER TABLE stories ADD COLUMN IF NOT EXISTS dialogue_message_ids LONGTEXT NULL AFTER dialogue_session_id');
  console.log('stories.dialogue_session_id and stories.dialogue_message_ids are ready.');
}

main()
  .catch((error) => {
    console.error('addStoryDialogueLink failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
