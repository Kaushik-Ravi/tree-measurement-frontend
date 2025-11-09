// Quiz questions for engaging users during SAM processing wait time
// Designed to be simple, educational, and suitable for all users

export interface QuizQuestion {
  id: number;
  question: string;
  options: [string, string]; // Always exactly 2 options (A/B format)
  correctIndex: 0 | 1; // 0 for option A, 1 for option B
  fact: string; // Encouraging fact shown after answer
  category: 'biology' | 'ecology' | 'climate' | 'history' | 'fun';
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: 'Which tree can live the longest?',
    options: [
      '🌳 Oak (up to 300 years)',
      '🌲 Bristlecone Pine (5,000+ years)'
    ],
    correctIndex: 1,
    fact: 'Bristlecone pines in California are Earth\'s oldest living organisms - some were saplings when the pyramids were built!',
    category: 'biology'
  },
  {
    id: 2,
    question: 'How many people can one mature tree provide oxygen for in a year?',
    options: [
      '👤 1 person',
      '👥 2 people'
    ],
    correctIndex: 1,
    fact: 'One large tree produces about 260 pounds of oxygen per year - enough for two people! Plant more trees to help your community breathe easier.',
    category: 'ecology'
  },
  {
    id: 3,
    question: 'How much CO₂ can a mature oak tree absorb per year?',
    options: [
      '📦 10 kg (22 lbs)',
      '🚗 100 kg (220 lbs)'
    ],
    correctIndex: 1,
    fact: 'A mature oak absorbs about 100kg of CO₂ annually - equivalent to driving a car 400km! Trees are nature\'s climate heroes.',
    category: 'climate'
  },
  {
    id: 4,
    question: 'Trees communicate with each other. How?',
    options: [
      '🔊 Sound waves through air',
      '🕸️ Underground fungal networks'
    ],
    correctIndex: 1,
    fact: 'Trees share nutrients and warning signals through "mycorrhizal networks" - scientists call it the "Wood Wide Web"! Nature is amazing.',
    category: 'biology'
  },
  {
    id: 5,
    question: 'What percentage of Earth\'s oxygen comes from trees?',
    options: [
      '🌍 28% (forests & plants)',
      '🌊 80% (ocean phytoplankton)'
    ],
    correctIndex: 0,
    fact: 'While trees produce 28% of oxygen, ocean phytoplankton produces 70%! Both forests and oceans are essential for life on Earth.',
    category: 'ecology'
  },
  {
    id: 6,
    question: 'How much water does a large tree release into the air daily?',
    options: [
      '💧 100 liters (26 gallons)',
      '🚰 400 liters (105 gallons)'
    ],
    correctIndex: 1,
    fact: 'Trees act as natural air conditioners, releasing up to 400 liters of water vapor daily through transpiration - cooling the environment naturally!',
    category: 'ecology'
  },
  {
    id: 7,
    question: 'Which tree produces wood used in violins?',
    options: [
      '🎻 Spruce',
      '🪵 Maple'
    ],
    correctIndex: 0,
    fact: 'Spruce is prized for violin soundboards because of its perfect strength-to-weight ratio and acoustic properties. Trees create music even after being cut!',
    category: 'fun'
  },
  {
    id: 8,
    question: 'How do urban trees affect crime rates?',
    options: [
      '📉 Reduce crime by 7%',
      '📈 No significant effect'
    ],
    correctIndex: 0,
    fact: 'Studies show neighborhoods with more trees have 7% less crime! Green spaces improve mental health and community wellbeing.',
    category: 'ecology'
  },
  {
    id: 9,
    question: 'What\'s the tallest tree species in the world?',
    options: [
      '🌲 Coastal Redwood (380 ft)',
      '🌳 Douglas Fir (300 ft)'
    ],
    correctIndex: 0,
    fact: 'California\'s coastal redwoods can reach 115 meters (380 feet) - taller than the Statue of Liberty! Some are over 2,000 years old.',
    category: 'biology'
  },
  {
    id: 10,
    question: 'How much can urban trees increase property values?',
    options: [
      '🏡 5%',
      '💰 15%'
    ],
    correctIndex: 1,
    fact: 'Homes with mature trees sell for up to 15% more! Trees beautify neighborhoods, reduce energy costs, and improve quality of life.',
    category: 'fun'
  },
  {
    id: 11,
    question: 'Which has more species living in it?',
    options: [
      '🌳 One oak tree (280+ species)',
      '🏠 Average house (50 species)'
    ],
    correctIndex: 0,
    fact: 'A single oak tree supports over 280 insect species, plus countless birds, mammals, and fungi! Trees are biodiversity hotspots.',
    category: 'ecology'
  },
  {
    id: 12,
    question: 'How long does it take for a tree to become "mature"?',
    options: [
      '⏱️ 10-20 years',
      '⏳ 30-50 years'
    ],
    correctIndex: 1,
    fact: 'Most trees take 30-50 years to reach maturity and provide maximum environmental benefits. Planting today creates a legacy for future generations!',
    category: 'biology'
  }
];

/**
 * Get a random subset of quiz questions
 * @param count Number of questions to return (default: 8)
 * @returns Array of randomly selected questions
 */
export const getRandomQuestions = (count: number = 8): QuizQuestion[] => {
  return [...quizQuestions]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
};
