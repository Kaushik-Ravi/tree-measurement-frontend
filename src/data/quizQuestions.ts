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
      '🌳 Oak Tree',
      '🌲 Bristlecone Pine'
    ],
    correctIndex: 1,
    fact: 'Bristlecone pines in California are Earth\'s oldest living organisms - some were saplings when the pyramids were built, living over 5,000 years!',
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
      '📦 About as much as a bookshelf',
      '🚗 About as much as a washing machine'
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
      '💧 Enough to fill a bathtub',
      '🚰 Enough to fill four bathtubs'
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
      '🌲 Coastal Redwood',
      '🌳 Douglas Fir'
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
      '🌳 One oak tree',
      '🏠 Average house'
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
  },
  {
    id: 13,
    question: 'Which tree has the strongest wood?',
    options: [
      '🌳 Oak',
      '🪵 Australian Buloke'
    ],
    correctIndex: 1,
    fact: 'Australian Buloke wood is so hard it\'s nearly twice as strong as oak! It\'s used for tool handles and can even blunt saw blades.',
    category: 'biology'
  },
  {
    id: 14,
    question: 'Can trees help reduce noise pollution?',
    options: [
      '🔇 Yes, by up to 50%',
      '🔊 No significant effect'
    ],
    correctIndex: 0,
    fact: 'Trees can reduce noise pollution by up to 50%! Their leaves, branches, and bark absorb sound waves, making neighborhoods quieter and more peaceful.',
    category: 'ecology'
  },
  {
    id: 15,
    question: 'What is the world\'s most abundant tree species?',
    options: [
      '🌲 Red Alder',
      '🌴 Coconut Palm'
    ],
    correctIndex: 0,
    fact: 'There are an estimated 347 billion Red Alder trees globally! This North American tree is crucial for forest ecosystems and nitrogen fixation.',
    category: 'ecology'
  },
  {
    id: 16,
    question: 'How much can trees reduce summer temperatures in cities?',
    options: [
      '🌡️ 1-2°C',
      '❄️ 5-10°C'
    ],
    correctIndex: 1,
    fact: 'Urban trees can reduce temperatures by 5-10°C through shade and transpiration! They\'re natural air conditioners fighting the urban heat island effect.',
    category: 'climate'
  },
  {
    id: 17,
    question: 'Which tree produces natural aspirin?',
    options: [
      '🌳 Willow Tree',
      '🌲 Pine Tree'
    ],
    correctIndex: 0,
    fact: 'Willow bark contains salicin, which the body converts to salicylic acid - the basis for aspirin! Ancient civilizations used it for pain relief.',
    category: 'history'
  },
  {
    id: 18,
    question: 'Do trees sleep at night?',
    options: [
      '😴 Yes, branches droop',
      '🌙 No, always active'
    ],
    correctIndex: 0,
    fact: 'Trees experience circadian rhythms! Studies show their branches droop at night and perk up before dawn, even in constant light conditions.',
    category: 'biology'
  },
  {
    id: 19,
    question: 'What percentage of Earth\'s land is covered by forests?',
    options: [
      '🌍 31%',
      '🌳 55%'
    ],
    correctIndex: 0,
    fact: 'Forests cover about 31% of Earth\'s land - roughly 4 billion hectares! But we lose 10 million hectares annually. Every tree planted matters!',
    category: 'ecology'
  },
  {
    id: 20,
    question: 'Which tree has the largest leaves?',
    options: [
      '🌴 Raffia Palm',
      '🍌 Banana Plant'
    ],
    correctIndex: 0,
    fact: 'Raffia Palm leaves can reach 25 meters long - longer than a bus! These African palms have the largest leaves in the plant kingdom.',
    category: 'biology'
  },
  {
    id: 21,
    question: 'Can trees warn each other about insect attacks?',
    options: [
      '🚨 Yes, through chemical signals',
      '❌ No, they can\'t communicate'
    ],
    correctIndex: 0,
    fact: 'Trees release volatile organic compounds when attacked by insects, warning nearby trees to produce defensive chemicals! It\'s chemical warfare.',
    category: 'biology'
  },
  {
    id: 22,
    question: 'Which famous tree lived through the Hiroshima bombing?',
    options: [
      '🌳 Ginkgo Tree',
      '🌸 Cherry Blossom'
    ],
    correctIndex: 0,
    fact: 'Six Ginkgo trees survived the Hiroshima atomic bomb, still alive today! They were just 1-2km from ground zero and symbolize resilience.',
    category: 'history'
  },
  {
    id: 23,
    question: 'How many trees does it take to make one ton of paper?',
    options: [
      '📄 8 trees',
      '📚 24 trees'
    ],
    correctIndex: 1,
    fact: 'It takes about 24 trees to make one ton of paper! Recycling one ton of paper saves 17 trees - always choose recycled when possible.',
    category: 'ecology'
  },
  {
    id: 24,
    question: 'Which tree produces rubber?',
    options: [
      '🌳 Rubber Tree (Hevea)',
      '🌴 Palm Tree'
    ],
    correctIndex: 0,
    fact: 'Hevea brasiliensis produces natural rubber latex! Discovered by indigenous Amazonians, it revolutionized industry and is still vital today.',
    category: 'history'
  },
  {
    id: 25,
    question: 'Can trees improve student test scores?',
    options: [
      '📈 Yes, by 10-14%',
      '📊 No proven effect'
    ],
    correctIndex: 0,
    fact: 'Students in classrooms with views of trees score 10-14% higher on tests! Green views improve concentration, reduce stress, and boost learning.',
    category: 'ecology'
  },
  {
    id: 26,
    question: 'What is the heaviest tree in the world?',
    options: [
      '🌲 Giant Sequoia',
      '🌳 Oak Tree'
    ],
    correctIndex: 0,
    fact: 'General Sherman, a Giant Sequoia, weighs about 2,000 tons - as much as 15 adult blue whales! It\'s also the largest living organism by volume.',
    category: 'biology'
  },
  {
    id: 27,
    question: 'Do trees grow faster in groups or alone?',
    options: [
      '🌳 Faster alone',
      '🌲🌲 Faster in groups'
    ],
    correctIndex: 1,
    fact: 'Trees in forests grow faster due to wind protection, shared nutrients through root networks, and cooperative microclimates! Community matters in nature.',
    category: 'biology'
  },
  {
    id: 28,
    question: 'Which continent has the most tree species?',
    options: [
      '🌎 South America',
      '🌍 Africa'
    ],
    correctIndex: 0,
    fact: 'South America, especially the Amazon rainforest, has over 11,000 tree species - nearly half of all tree species on Earth! Biodiversity hotspot!',
    category: 'ecology'
  },
  {
    id: 29,
    question: 'Can trees reduce hospital recovery time?',
    options: [
      '🏥 Yes, patients heal faster',
      '❌ No significant effect'
    ],
    correctIndex: 0,
    fact: 'Patients with views of trees recover 8-20% faster and need less pain medication! Hospitals are now planting "healing gardens" for this reason.',
    category: 'ecology'
  },
  {
    id: 30,
    question: 'Which tree can clone itself?',
    options: [
      '🌳 Aspen Tree',
      '🌲 Pine Tree'
    ],
    correctIndex: 0,
    fact: 'Pando, a quaking aspen in Utah, is actually 47,000 genetically identical trees sharing one root system - it\'s 80,000 years old!',
    category: 'biology'
  },
  {
    id: 31,
    question: 'How much energy can trees save in cooling costs?',
    options: [
      '💡 10%',
      '❄️ 30%'
    ],
    correctIndex: 1,
    fact: 'Properly placed trees can reduce home cooling costs by 30%! Shade on the west and south sides makes the biggest difference.',
    category: 'climate'
  },
  {
    id: 32,
    question: 'Which tree has the deepest roots?',
    options: [
      '🌳 Shepherd\'s Tree',
      '🌲 Redwood'
    ],
    correctIndex: 0,
    fact: 'A Shepherd\'s Tree in South Africa had roots 68 meters deep - deeper than a 20-story building! Desert trees dig deep for water.',
    category: 'biology'
  },
  {
    id: 33,
    question: 'Can trees remove pollution from air?',
    options: [
      '✅ Yes, filter pollutants',
      '❌ Only produce oxygen'
    ],
    correctIndex: 0,
    fact: 'Trees remove pollutants like ozone, nitrogen dioxide, and particulate matter! One tree removes 48 pounds of carbon and pollution annually.',
    category: 'ecology'
  },
  {
    id: 34,
    question: 'Which tree fruit is the largest?',
    options: [
      '🥥 Coconut',
      '🎃 Jackfruit'
    ],
    correctIndex: 1,
    fact: 'Jackfruit can weigh up to 55kg - the world\'s largest tree fruit! It\'s a sustainable meat alternative that feeds millions in tropical regions.',
    category: 'fun'
  },
  {
    id: 35,
    question: 'How many bird species depend on trees?',
    options: [
      '🐦 30%',
      '🦜 80%'
    ],
    correctIndex: 1,
    fact: 'About 80% of land-dwelling birds and animals depend on forests for survival! Trees are essential for biodiversity and ecosystem health.',
    category: 'ecology'
  },
  {
    id: 36,
    question: 'Which tree produces chocolate?',
    options: [
      '🌳 Cacao Tree',
      '🌴 Palm Tree'
    ],
    correctIndex: 0,
    fact: 'Theobroma cacao (meaning "food of the gods") produces cocoa pods for chocolate! Each tree yields enough for about 400 chocolate bars yearly.',
    category: 'fun'
  },
  {
    id: 37,
    question: 'Can trees predict earthquakes?',
    options: [
      '🌳 Some researchers say yes',
      '❌ Definitely not'
    ],
    correctIndex: 0,
    fact: 'Some scientists observe unusual tree behavior before quakes - leaf movements, sap flow changes! Trees may sense electromagnetic field changes.',
    category: 'biology'
  },
  {
    id: 38,
    question: 'How much stormwater can one tree absorb yearly?',
    options: [
      '💧 1,000 liters',
      '🌊 10,000 liters'
    ],
    correctIndex: 1,
    fact: 'A mature tree can intercept 10,000+ liters of stormwater annually! Trees reduce flooding, filter pollutants, and recharge groundwater.',
    category: 'ecology'
  },
  {
    id: 39,
    question: 'Which tree lives in the coldest climate?',
    options: [
      '❄️ Dahurian Larch',
      '🌲 Norway Spruce'
    ],
    correctIndex: 0,
    fact: 'Dahurian Larch survives -70°C temperatures in Siberia! It\'s the world\'s northernmost tree, growing where few plants can survive.',
    category: 'biology'
  },
  {
    id: 40,
    question: 'Do trees have a sense of taste?',
    options: [
      '👅 Yes, in their roots',
      '❌ No, plants can\'t taste'
    ],
    correctIndex: 0,
    fact: 'Tree roots can "taste" nutrients and chemicals in soil, growing toward beneficial compounds and away from toxins! It\'s chemical sensing.',
    category: 'biology'
  },
  {
    id: 41,
    question: 'How many years ago did trees first appear on Earth?',
    options: [
      '🌍 385 million years ago',
      '🦕 65 million years ago'
    ],
    correctIndex: 0,
    fact: 'The first tree-like plants appeared 385 million years ago in the Devonian period - before dinosaurs! They transformed Earth\'s atmosphere.',
    category: 'history'
  },
  {
    id: 42,
    question: 'Which tree produces the most fruit per year?',
    options: [
      '🥭 Mango Tree',
      '🍋 Lemon Tree'
    ],
    correctIndex: 0,
    fact: 'A mature mango tree can produce 500-1000 fruits per year! Mangoes originated in India 5,000 years ago and now grow in 100+ countries.',
    category: 'fun'
  },
  {
    id: 43,
    question: 'Can trees get cancer?',
    options: [
      '🌳 Yes, they get tumors',
      '❌ No, immune to cancer'
    ],
    correctIndex: 0,
    fact: 'Trees can develop tumor-like growths called burls, but they rarely die from them! Trees compartmentalize damage better than animals.',
    category: 'biology'
  },
  {
    id: 44,
    question: 'How much oxygen does the Amazon rainforest produce?',
    options: [
      '🌍 6% of Earth\'s oxygen',
      '🌳 20% of Earth\'s oxygen'
    ],
    correctIndex: 1,
    fact: 'The Amazon produces about 20% of Earth\'s oxygen - earning its title "Lungs of the Earth"! It also stores 150-200 billion tons of carbon.',
    category: 'ecology'
  },
  {
    id: 45,
    question: 'Which tree bark is used to make cork?',
    options: [
      '🍷 Cork Oak',
      '🌳 Regular Oak'
    ],
    correctIndex: 0,
    fact: 'Cork Oak bark can be harvested every 9 years without harming the tree! Portugal produces 50% of the world\'s cork from ancient cork forests.',
    category: 'history'
  },
  {
    id: 46,
    question: 'Can trees count days?',
    options: [
      '📅 Yes, they track seasons',
      '❌ No internal clock'
    ],
    correctIndex: 0,
    fact: 'Trees count warm and cold days to time bud burst perfectly! They use both temperature accumulation and photoperiod to track seasons.',
    category: 'biology'
  },
  {
    id: 47,
    question: 'How many trees are on Earth?',
    options: [
      '🌍 3 trillion trees',
      '🌳 500 billion trees'
    ],
    correctIndex: 0,
    fact: 'Scientists estimate about 3 trillion trees on Earth - roughly 400 per person! But we lose 15 billion trees yearly. Plant and protect!',
    category: 'ecology'
  },
  {
    id: 48,
    question: 'Which tree has been to the moon?',
    options: [
      '🌙 Loblolly Pine seeds',
      '🚀 No tree has'
    ],
    correctIndex: 0,
    fact: 'Apollo 14 carried 500 tree seeds to the moon! These "Moon Trees" were planted across the US and are growing strong today.',
    category: 'history'
  },
  {
    id: 49,
    question: 'Can trees improve mental health?',
    options: [
      '🧠 Yes, reduce stress by 28%',
      '❌ No proven effect'
    ],
    correctIndex: 0,
    fact: 'Spending time around trees reduces cortisol (stress hormone) by 28%! Forest bathing (Shinrin-yoku) is prescribed therapy in Japan.',
    category: 'ecology'
  },
  {
    id: 50,
    question: 'Which tree has the most valuable wood?',
    options: [
      '💎 African Blackwood',
      '🌳 Mahogany'
    ],
    correctIndex: 0,
    fact: 'African Blackwood can cost $10,000+ per cubic meter! Used for clarinets and oboes, it\'s one of the hardest and rarest woods.',
    category: 'fun'
  },
  {
    id: 51,
    question: 'Do trees have immune systems?',
    options: [
      '🛡️ Yes, they fight diseases',
      '❌ No defense system'
    ],
    correctIndex: 0,
    fact: 'Trees have sophisticated immune systems! They produce antimicrobial compounds, seal wounds, and can even remember past infections.',
    category: 'biology'
  },
  {
    id: 52,
    question: 'How many jobs worldwide depend on forests?',
    options: [
      '👔 86 million jobs',
      '💼 20 million jobs'
    ],
    correctIndex: 0,
    fact: 'Forests provide livelihoods for 86 million people globally! From timber to tourism, sustainable forestry is crucial for economies.',
    category: 'ecology'
  },
  {
    id: 53,
    question: 'Which tree can survive fire?',
    options: [
      '🔥 Eucalyptus',
      '🌲 Pine'
    ],
    correctIndex: 0,
    fact: 'Eucalyptus trees have evolved with fire - thick bark insulates them, and they even produce flammable oils to trigger regenerative fires!',
    category: 'biology'
  },
  {
    id: 54,
    question: 'Can trees reduce diabetes risk?',
    options: [
      '🌳 Yes, by 15-20%',
      '❌ No connection'
    ],
    correctIndex: 0,
    fact: 'Living in tree-rich neighborhoods reduces diabetes risk by 15-20%! Green spaces encourage exercise and reduce stress-related illness.',
    category: 'ecology'
  },
  {
    id: 55,
    question: 'Which tree produces the world\'s strongest natural fiber?',
    options: [
      '🌳 Ramie Plant',
      '🌴 Bamboo'
    ],
    correctIndex: 1,
    fact: 'Bamboo fiber is stronger than steel by weight! Technically a grass, bamboo grows up to 91cm per day - the fastest-growing plant on Earth.',
    category: 'biology'
  }
];

/**
 * Get a random subset of quiz questions
 * @param count Number of questions to return (default: 12)
 * @returns Array of randomly selected and shuffled questions
 */
export const getRandomQuestions = (count: number = 12): QuizQuestion[] => {
  return [...quizQuestions]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
};
