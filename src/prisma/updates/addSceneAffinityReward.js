import prisma from '../../services/prismaClient.js';

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE character_scenes ADD COLUMN IF NOT EXISTS affinity_reward INT NOT NULL DEFAULT 0 AFTER chaos_factor');
  console.log('character_scenes.affinity_reward is ready.');
}

main()
  .catch((error) => {
    console.error('addSceneAffinityReward failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
