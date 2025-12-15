import { BookOpen, Camera, Ruler, Sun, Smartphone, CheckCircle, AlertTriangle, MapPin, Settings, FileText, Youtube, Image as ImageIcon, ListChecks } from 'lucide-react';

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
  }
];
