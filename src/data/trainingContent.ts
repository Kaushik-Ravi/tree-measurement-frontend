import { BookOpen, Camera, Ruler, Sun, Smartphone, CheckCircle, AlertTriangle, MapPin, Settings, FileText, Youtube, Image as ImageIcon, ListChecks, Footprints, ScanLine, MousePointer2, Maximize, GitFork, Target } from 'lucide-react';

export type SlideType = 'text' | 'pdf' | 'video' | 'image' | 'checklist';

export interface TrainingSlide {
  type: SlideType;
  title: string;
  content?: string; // For text slides or description
  src?: string; // For PDF, Image, Video URL
  checklistItems?: string[]; // For checklist slides
  icon?: any; // Lucide icon component
}

export interface TrainingChapter {
  id: string;
  title: string;
  description: string;
  icon: any;
  slides: TrainingSlide[];
}

export const trainingModules: TrainingChapter[] = [
  {
    id: 'setup',
    title: 'Chapter 1: The Setup',
    description: 'Get your device ready for science! Permissions, accounts, and calibration.',
    icon: Settings,
    slides: [
      {
        type: 'pdf',
        title: 'The Field Setup Guide',
        content: 'Please read through the official setup guide. You can view it fullscreen for better readability.',
        src: '/assets/training/setup-guide.pdf',
        icon: FileText
      },
      {
        type: 'video',
        title: 'Video Tutorial',
        content: 'Watch this quick video to understand the calibration process.',
        src: 'https://www.youtube.com/embed/rFaSLIfHgrM',
        icon: Youtube
      },
      {
        type: 'checklist',
        title: 'Ready for the Field?',
        content: 'Please confirm you have completed the setup steps:',
        checklistItems: [
          'I have created my account and logged in.',
          'I have enabled Location & Camera permissions.',
          'I have checked if my device needs calibration (or calibrated it).',
          'I have enabled Motion Sensors (if using Chrome/Safari).'
        ],
        icon: ListChecks
      }
    ]
  },
  {
    id: 'best-practices',
    title: 'Chapter 2: Golden Rules',
    description: 'Garbage in, garbage out. Learn how to take photos that yield accurate data.',
    icon: Camera,
    slides: [
      {
        type: 'image',
        title: 'Best Practices Infographic',
        content: 'Study this infographic carefully. These rules ensure your data is scientifically valid.',
        src: '/assets/training/infographic.png',
        icon: ImageIcon
      },
      {
        type: 'checklist',
        title: 'Commitment to Quality',
        content: 'I promise to follow these golden rules:',
        checklistItems: [
          'I will hold my phone PERPENDICULAR (no tilting).',
          'I will ensure the WHOLE tree is in the frame.',
          'I will NOT move between taking the photo and measuring distance.',
          'I will check for good lighting (no backlighting).',
          'I will use the magnifier for precise clicking.'
        ],
        icon: ListChecks
      }
    ]
  },
  {
    id: 'distance-measurement',
    title: 'Chapter 3: Measuring Distance',
    description: 'Master the workflow for measuring distance - critical for accurate height.',
    icon: Ruler,
    slides: [
      {
        type: 'text',
        title: 'The Measurement Goal',
        content: 'After taking the photo, you must measure the distance from your standing position (Point A) to the tree base (Point B). \n\n• Android: Use our built-in AR Ruler.\n• iOS: Use the native "Measure" app.\n\nThe principle is identical for both.',
        icon: Ruler
      },
      {
        type: 'text',
        title: 'Understanding the Reticle',
        content: 'The "Reticle" is the target circle on your screen.\n\n• Hollow/Dotted: Searching. Move slowly.\n• Solid/Colored: Surface detected. Ready to mark.\n\nTip: Before starting, scan the ground slowly until the reticle tracks the surface reliably.',
        icon: ScanLine
      },
      {
        type: 'checklist',
        title: 'The "Walk-Back" Technique',
        content: 'For maximum accuracy, follow this specific path:',
        checklistItems: [
          '1. Stand still at the capture spot.',
          '2. Point camera at ground, wait for solid reticle.',
          '3. Mark Point A directly below your phone (between feet).',
          '4. Walk slowly to the tree base (Point B).',
          '5. Mark Point B at the trunk.',
          '6. CRITICAL: Walk back to Point A to verify the line.',
          '7. Confirm only when back at the start.'
        ],
        icon: Footprints
      },
      {
        type: 'checklist',
        title: 'Pro Tips',
        content: 'Ensure these conditions for best results:',
        checklistItems: [
          'Good lighting (avoid dark shadows).',
          'Move phone slowly to maintain tracking.',
          'Keep the reticle on the ground at all times.',
          'Use the "Redo" button if the line drifts.'
        ],
        icon: Sun
      }
    ]
  },
  {
    id: 'manual-marking',
    title: 'Chapter 4: Manual Marking',
    description: 'Learn to manually annotate trees for 100% precision, including complex forked trunks.',
    icon: MousePointer2,
    slides: [
      {
        type: 'text',
        title: 'The Point System',
        content: 'We use a strict 3-step marking process (H-C-G):\n\n1. Height (H): Base (H1) → Top (H2)\n2. Canopy (C): Left (C1) → Right (C2)\n3. Girth (G): Left (G1) → Right (G2)\n\nAlways follow this order for the math to work.',
        icon: Target
      },
      {
        type: 'checklist',
        title: 'Step-by-Step Guide',
        content: 'Follow these rules for perfect annotation:',
        checklistItems: [
          'H1 (Base): Mark exactly where trunk meets ground.',
          'H2 (Top): Mark the very highest leaf tip.',
          'C1/C2: Mark the widest points of the crown.',
          'Use the Magnifier to see through your finger.'
        ],
        icon: Maximize
      },
      {
        type: 'text',
        title: 'The Magnetic Band',
        content: 'For Girth (Diameter), the app draws a Cyan Guide Zone at exactly 1.3m (Breast Height).\n\n• Aim for this band.\n• The cursor will SNAP (turn Green) when locked to the correct height.\n• This ensures your DBH measurement is scientifically valid.',
        icon: ScanLine
      },
      {
        type: 'text',
        title: 'Advanced: Forked Trees',
        content: 'If the tree splits below 1.3m (Multi-Stem):\n\n1. Mark the first stem (G1-G2).\n2. Do NOT click Calculate yet.\n3. Mark the second stem (G3-G4).\n4. Repeat for all stems.\n5. Click "Calculate" only when done.\n\nThe app will combine them automatically.',
        icon: GitFork
      }
    ]
  }
];
