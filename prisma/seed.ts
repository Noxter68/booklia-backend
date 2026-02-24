import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'Coiffeur',
    slug: 'coiffeur',
    children: [],
  },
  {
    name: 'Barbier',
    slug: 'barbier',
    children: [],
  },
  {
    name: 'Manucure',
    slug: 'manucure',
    children: [],
  },
  {
    name: 'Institut de beauté',
    slug: 'institut-de-beaute',
    children: [
      { name: 'Soins du visage', slug: 'soins-du-visage' },
      { name: 'Épilation', slug: 'epilation' },
      { name: 'Maquillage', slug: 'maquillage' },
    ],
  },
  {
    name: 'Bien-être',
    slug: 'bien-etre',
    children: [
      { name: 'Massage', slug: 'massage' },
      { name: 'Sophrologie', slug: 'sophrologie' },
      { name: 'Réflexologie', slug: 'reflexologie' },
      { name: 'Hypnothérapie', slug: 'hypnotherapie' },
      { name: 'Naturopathie', slug: 'naturopathie' },
      { name: 'Aromathérapie', slug: 'aromatherapie' },
      { name: 'Reiki', slug: 'reiki' },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding categories...');

  // Clear existing categories (children first due to FK)
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();

  for (const category of categories) {
    const parent = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
      },
    });

    console.log(`✅ Created category: ${parent.name}`);

    for (const child of category.children) {
      await prisma.category.create({
        data: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id,
        },
      });
    }

    if (category.children.length > 0) {
      console.log(`   └─ Created ${category.children.length} subcategories`);
    }
  }

  const totalCategories = await prisma.category.count();
  console.log(`\n🎉 Seeding completed! Total categories: ${totalCategories}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
