import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'Maison & Habitat',
    slug: 'maison-habitat',
    children: [
      { name: 'Ménage & Nettoyage', slug: 'menage-nettoyage' },
      { name: 'Jardinage & Espaces verts', slug: 'jardinage-espaces-verts' },
      { name: 'Bricolage & Petits travaux', slug: 'bricolage-petits-travaux' },
      { name: 'Plomberie', slug: 'plomberie' },
      { name: 'Électricité', slug: 'electricite' },
      { name: 'Peinture & Décoration', slug: 'peinture-decoration' },
      { name: 'Déménagement & Transport', slug: 'demenagement-transport' },
      { name: 'Garde de maison', slug: 'garde-maison' },
    ],
  },
  {
    name: 'Technologie & Numérique',
    slug: 'technologie-numerique',
    children: [
      { name: 'Dépannage informatique', slug: 'depannage-informatique' },
      { name: 'Installation & Configuration', slug: 'installation-configuration' },
      { name: 'Développement web & mobile', slug: 'developpement-web-mobile' },
      { name: 'Design graphique', slug: 'design-graphique' },
      { name: 'Réseaux sociaux & Marketing', slug: 'reseaux-sociaux-marketing' },
      { name: 'Formation informatique', slug: 'formation-informatique' },
      { name: 'Récupération de données', slug: 'recuperation-donnees' },
    ],
  },
  {
    name: 'Cours & Formation',
    slug: 'cours-formation',
    children: [
      { name: 'Soutien scolaire', slug: 'soutien-scolaire' },
      { name: 'Langues étrangères', slug: 'langues-etrangeres' },
      { name: 'Musique & Instruments', slug: 'musique-instruments' },
      { name: 'Sport & Fitness', slug: 'sport-fitness' },
      { name: 'Arts & Loisirs créatifs', slug: 'arts-loisirs-creatifs' },
      { name: 'Cuisine', slug: 'cuisine' },
      { name: 'Code & Permis de conduire', slug: 'code-permis-conduire' },
    ],
  },
  {
    name: 'Bien-être & Santé',
    slug: 'bien-etre-sante',
    children: [
      { name: 'Massage & Relaxation', slug: 'massage-relaxation' },
      { name: 'Coaching sportif', slug: 'coaching-sportif' },
      { name: 'Nutrition & Diététique', slug: 'nutrition-dietetique' },
      { name: 'Aide à domicile', slug: 'aide-domicile' },
      { name: 'Garde de personnes âgées', slug: 'garde-personnes-agees' },
      { name: 'Accompagnement & Soutien', slug: 'accompagnement-soutien' },
    ],
  },
  {
    name: 'Animaux',
    slug: 'animaux',
    children: [
      { name: "Garde d'animaux", slug: 'garde-animaux' },
      { name: 'Promenade de chiens', slug: 'promenade-chiens' },
      { name: 'Toilettage', slug: 'toilettage' },
      { name: 'Dressage & Éducation', slug: 'dressage-education' },
      { name: "Transport d'animaux", slug: 'transport-animaux' },
    ],
  },
  {
    name: 'Événements & Célébrations',
    slug: 'evenements-celebrations',
    children: [
      { name: 'Photographie', slug: 'photographie' },
      { name: 'Vidéo & Montage', slug: 'video-montage' },
      { name: 'Animation & DJ', slug: 'animation-dj' },
      { name: 'Traiteur & Cuisine', slug: 'traiteur-cuisine' },
      { name: 'Décoration événementielle', slug: 'decoration-evenementielle' },
      { name: "Organisation d'événements", slug: 'organisation-evenements' },
    ],
  },
  {
    name: 'Automobile & Transport',
    slug: 'automobile-transport',
    children: [
      { name: 'Mécanique & Réparation', slug: 'mecanique-reparation' },
      { name: 'Nettoyage auto', slug: 'nettoyage-auto' },
      { name: 'Covoiturage', slug: 'covoiturage' },
      { name: 'Livraison & Courses', slug: 'livraison-courses' },
      { name: 'Déplacement de véhicules', slug: 'deplacement-vehicules' },
    ],
  },
  {
    name: 'Services administratifs',
    slug: 'services-administratifs',
    children: [
      { name: 'Aide administrative', slug: 'aide-administrative' },
      { name: 'Comptabilité & Fiscalité', slug: 'comptabilite-fiscalite' },
      { name: 'Traduction', slug: 'traduction' },
      { name: 'Rédaction & Correction', slug: 'redaction-correction' },
      { name: 'Conseils juridiques', slug: 'conseils-juridiques' },
    ],
  },
  {
    name: 'Mode & Beauté',
    slug: 'mode-beaute',
    children: [
      { name: 'Coiffure', slug: 'coiffure' },
      { name: 'Maquillage', slug: 'maquillage' },
      { name: 'Couture & Retouches', slug: 'couture-retouches' },
      { name: 'Stylisme & Conseil en image', slug: 'stylisme-conseil-image' },
      { name: 'Manucure & Soins', slug: 'manucure-soins' },
    ],
  },
  {
    name: 'Enfants & Famille',
    slug: 'enfants-famille',
    children: [
      { name: 'Baby-sitting', slug: 'baby-sitting' },
      { name: 'Aide aux devoirs', slug: 'aide-devoirs' },
      { name: 'Animation enfants', slug: 'animation-enfants' },
      { name: 'Garde périscolaire', slug: 'garde-periscolaire' },
      { name: 'Accompagnement activités', slug: 'accompagnement-activites' },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding categories...');

  // Clear existing categories
  await prisma.category.deleteMany();

  // Create categories with children
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

    console.log(`   └─ Created ${category.children.length} subcategories`);
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
