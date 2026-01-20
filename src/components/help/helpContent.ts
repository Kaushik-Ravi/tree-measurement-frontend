/**
 * Contextual Help Content Data
 * 
 * This file contains all help content for different screens/contexts
 * in the Tree Measurement app.
 * 
 * IMPORTANT: Media files are served from /public/help/ folder
 */

export type HelpContentType = 'text' | 'gif' | 'image' | 'video';

export interface HelpStep {
  title: string;
  description: string;
  type: HelpContentType;
  mediaUrl?: string;
  youtubeId?: string;
  tip?: string;
}

export interface HelpContent {
  id: string;
  title: string;
  subtitle?: string;
  steps: HelpStep[];
  quickTips?: string[];
}

// Media files are served from public/help/ folder
const MEDIA_PATH = '/help';

export const helpContentData: Record<string, HelpContent> = {
  // ============================================
  // PHOTO CAPTURE / CAMERA SCREEN
  // ============================================
  'photo-capture': {
    id: 'photo-capture',
    title: 'Taking the Perfect Tree Photo',
    subtitle: 'Get accurate measurements with proper framing',
    steps: [
      {
        title: 'Frame the Entire Tree',
        description: 'Make sure the complete tree is visible - from the base (where trunk meets ground) to the very top of the crown.',
        type: 'image',
        mediaUrl: `${MEDIA_PATH}/photo-framing.jpeg`,
        tip: 'Step back if needed to fit the whole tree in frame',
      },
      {
        title: 'Hold Phone Level',
        description: 'Keep your phone perfectly vertical and straight. Tilted photos cause measurement errors.',
        type: 'text',
        tip: 'Enable grid lines in your camera settings for guidance',
      },
      {
        title: 'Good Lighting',
        description: 'Avoid harsh shadows or backlit conditions. Overcast days work best for tree photography.',
        type: 'text',
        tip: 'Morning or late afternoon light is ideal',
      },
    ],
    quickTips: [
      'Include the full tree from base to crown',
      'Hold phone straight and level',
      'Stand far enough back to fit everything',
      'Avoid cropping the top or bottom of tree',
    ],
  },

  // ============================================
  // CALIBRATION SCREEN
  // ============================================
  'calibration': {
    id: 'calibration',
    title: 'Calibration Guide',
    subtitle: 'Set the scale for accurate measurements',
    steps: [
      {
        title: 'Watch the Tutorial',
        description: 'This short video explains the complete calibration process step by step.',
        type: 'video',
        youtubeId: 'WMnTqh3H4zs',
      },
      {
        title: 'Select Reference Object',
        description: 'Choose a reference object with a known width. Credit cards work great (85.6mm standard width).',
        type: 'text',
        tip: 'Credit cards are the most accurate reference',
      },
      {
        title: 'Mark Both Edges',
        description: 'Tap precisely on the left and right edges of your reference object. Use the magnifier for accuracy.',
        type: 'text',
        tip: 'Zoom in and use the magnifier for precise marking',
      },
    ],
    quickTips: [
      'Credit card = 85.6mm width',
      'Use magnifier for precise marking',
      'Calibrate once per photo session',
      'Use actual measurements, not estimates',
    ],
  },

  // ============================================
  // MANUAL MARKING SCREEN
  // ============================================
  'manual-marking': {
    id: 'manual-marking',
    title: 'Manual Marking Guide',
    subtitle: 'Mark tree points in the correct order',
    steps: [
      {
        title: 'Follow the H-C-G Order',
        description: 'Always mark in this sequence: Height (base → top), Canopy (left → right), then Girth (left → right on trunk).',
        type: 'gif',
        mediaUrl: `${MEDIA_PATH}/manual-marking.gif`,
      },
      {
        title: 'Height Points',
        description: 'First point: Base of tree where trunk meets ground. Second point: Very top of the tree crown.',
        type: 'text',
        tip: 'Zoom in for precise base placement',
      },
      {
        title: 'Canopy Points',
        description: 'Mark the widest left and right edges of the tree crown.',
        type: 'text',
        tip: 'Look for the outermost leaves',
      },
      {
        title: 'Girth Points',
        description: 'Mark the left and right edges of the trunk at breast height (1.3m). The cyan band helps guide you.',
        type: 'gif',
        mediaUrl: `${MEDIA_PATH}/dbh-magnifier-use.gif`,
      },
    ],
    quickTips: [
      'Order: Height → Canopy → Girth',
      'Use magnifier for precision',
      'Green crosshair = snapped to DBH line',
      'White crosshair = free movement',
    ],
  },

  // ============================================
  // DBH / GIRTH MEASUREMENT
  // ============================================
  'dbh-girth': {
    id: 'dbh-girth',
    title: 'Understanding DBH',
    subtitle: 'Diameter at Breast Height explained',
    steps: [
      {
        title: 'What is DBH?',
        description: 'DBH stands for "Diameter at Breast Height" - the international forestry standard for measuring tree trunk width.',
        type: 'image',
        mediaUrl: `${MEDIA_PATH}/DBH image.png`,
        tip: 'Used worldwide for scientific consistency',
      },
      {
        title: 'The 1.3m Standard',
        description: 'DBH is always measured at exactly 1.3 meters (4.5 feet) from ground level. This is roughly chest/breast height for an average adult.',
        type: 'text',
        tip: 'The cyan band shows this exact height',
      },
      {
        title: 'Using the Magnetic Band',
        description: 'When marking girth points, you\'ll see a cyan horizontal band at the 1.3m line. Your crosshair will "snap" to this line for accuracy.',
        type: 'gif',
        mediaUrl: `${MEDIA_PATH}/dbh-magnifier-use.gif`,
      },
      {
        title: 'Green Crosshair = Perfect!',
        description: 'When your crosshair turns GREEN, it\'s snapped to the DBH line. This ensures your measurement is scientifically valid.',
        type: 'text',
        tip: 'Always aim for the green crosshair',
      },
    ],
    quickTips: [
      'DBH = 1.3 meters from ground',
      'Cyan band = measurement zone',
      'Green crosshair = correctly aligned',
      'Used for scientific forestry worldwide',
    ],
  },

  // ============================================
  // MAGNIFIER TOOL
  // ============================================
  'magnifier': {
    id: 'magnifier',
    title: 'Using the Magnifier',
    subtitle: 'Precision placement made easy',
    steps: [
      {
        title: 'Activate the Magnifier',
        description: 'Touch and hold anywhere on the tree image. A magnified view will appear above your finger.',
        type: 'gif',
        mediaUrl: `${MEDIA_PATH}/dbh-magnifier-use.gif`,
      },
      {
        title: 'Drag to Position',
        description: 'While holding, drag your finger to the exact point you want to mark. The magnifier follows your movement.',
        type: 'text',
        tip: 'Move slowly for best accuracy',
      },
      {
        title: 'Release to Place',
        description: 'When the crosshair is exactly where you want it, lift your finger to place the point.',
        type: 'text',
        tip: 'Take your time - accuracy matters!',
      },
    ],
    quickTips: [
      'Long-press to activate',
      'Drag slowly for precision',
      'Release to confirm placement',
      'Works on all marking screens',
    ],
  },

  // ============================================
  // WALK-BACK DISTANCE TECHNIQUE
  // ============================================
  'walk-back': {
    id: 'walk-back',
    title: 'Measuring Distance',
    subtitle: 'How to measure your distance from the tree',
    steps: [
      {
        title: 'Why Distance Matters',
        description: 'To calculate tree height from your photo, we need to know how far away you were when you took it.',
        type: 'text',
      },
      {
        title: 'The Walk-Back Method',
        description: 'Stand at your photo location. Use a measuring tape, AR app, or count your paces to measure the distance to the tree base.',
        type: 'gif',
        mediaUrl: `${MEDIA_PATH}/walk-back.gif`,
        tip: 'Walk in a straight line to the tree',
      },
      {
        title: 'Using AR Measurement',
        description: 'The "Measure with AR" button uses your phone\'s camera to measure distance automatically. Just point at the tree base.',
        type: 'text',
        tip: 'Works best on flat ground with good lighting',
      },
    ],
    quickTips: [
      'Measure from camera position to tree base',
      'Walk in a straight line',
      'AR works best on flat surfaces',
      'Measuring tape is most accurate',
    ],
  },

  // ============================================
  // AI PROCESSING / WAITING
  // ============================================
  'ai-processing': {
    id: 'ai-processing',
    title: 'AI Analysis',
    subtitle: 'What happens during processing',
    steps: [
      {
        title: 'Image Processing',
        description: 'Our AI (SAM - Segment Anything Model) analyzes your tree photo to detect the trunk, crown, and boundaries.',
        type: 'text',
        tip: 'This usually takes 30-60 seconds',
      },
      {
        title: 'Boundary Detection',
        description: 'The AI identifies the exact edges of the tree, separating it from the background.',
        type: 'text',
      },
      {
        title: 'Measurement Calculation',
        description: 'Using your calibration and distance data, the AI calculates height, canopy spread, and DBH.',
        type: 'text',
        tip: 'Answer quiz questions to earn SP while waiting!',
      },
    ],
    quickTips: [
      'Typical wait: 30-60 seconds',
      'Answer quiz questions to earn points',
      'Don\'t close the app while processing',
      'Complex trees may take longer',
    ],
  },

  // ============================================
  // SPECIES IDENTIFICATION
  // ============================================
  'species-id': {
    id: 'species-id',
    title: 'Species Identification',
    subtitle: 'Identify your tree species',
    steps: [
      {
        title: 'Search by Name',
        description: 'Start typing the tree species name. Suggestions will appear as you type.',
        type: 'text',
        tip: 'Common names and scientific names both work',
      },
      {
        title: 'Browse Categories',
        description: 'Not sure of the name? Browse by category - Deciduous, Coniferous, Tropical, etc.',
        type: 'text',
      },
      {
        title: 'Confirm Selection',
        description: 'Tap on a species to select it. You can always change it later if needed.',
        type: 'text',
      },
    ],
    quickTips: [
      'Type common or scientific name',
      'Check leaf shape if unsure',
      'Take a leaf photo for reference',
      '"Unknown" is okay if unsure',
    ],
  },

  // ============================================
  // RESULTS / CO2 CALCULATION
  // ============================================
  'results': {
    id: 'results',
    title: 'Understanding Results',
    subtitle: 'What the measurements mean',
    steps: [
      {
        title: 'Tree Height',
        description: 'The total height from ground level to the top of the crown, measured in meters.',
        type: 'text',
      },
      {
        title: 'Canopy Spread',
        description: 'The width of the tree\'s crown at its widest point. Important for shade and coverage calculations.',
        type: 'text',
      },
      {
        title: 'DBH (Trunk Diameter)',
        description: 'Diameter at Breast Height - the trunk width at 1.3m. Key for biomass and age estimation.',
        type: 'text',
        tip: 'Used to estimate tree age and carbon storage',
      },
      {
        title: 'CO₂ Sequestration',
        description: 'Estimated annual carbon dioxide absorbed by this tree. Larger trees store more carbon!',
        type: 'text',
        tip: 'Based on species-specific allometric equations',
      },
    ],
    quickTips: [
      'Height = base to crown top',
      'DBH = trunk width at 1.3m',
      'CO₂ varies by species and size',
      'Save results to contribute to research',
    ],
  },

  // ============================================
  // GENERAL / GETTING STARTED
  // ============================================
  'getting-started': {
    id: 'getting-started',
    title: 'Getting Started',
    subtitle: 'Your first tree measurement',
    steps: [
      {
        title: 'Take a Photo',
        description: 'Photograph your tree with the full height visible, holding your phone level.',
        type: 'image',
        mediaUrl: `${MEDIA_PATH}/photo-framing.jpeg`,
      },
      {
        title: 'Calibrate',
        description: 'Use a credit card or known object to set the measurement scale.',
        type: 'text',
      },
      {
        title: 'Enter Distance',
        description: 'Tell us how far you were from the tree when you took the photo.',
        type: 'text',
      },
      {
        title: 'Get Results',
        description: 'The AI analyzes your photo and calculates height, canopy, DBH, and CO₂ storage.',
        type: 'text',
      },
    ],
    quickTips: [
      'Full tree in frame',
      'Phone held level',
      'Credit card for calibration',
      'Know your distance from tree',
    ],
  },
};

// Helper function to get help content by ID
export function getHelpContent(id: string): HelpContent | undefined {
  return helpContentData[id];
}

// Get all available help content IDs
export function getAllHelpContentIds(): string[] {
  return Object.keys(helpContentData);
}
