import { BookOpen, Camera, Ruler, Sun, Smartphone, CheckCircle, AlertTriangle, MapPin, Settings, FileText, Youtube, Image as ImageIcon, ListChecks, Footprints, ScanLine, MousePointer2, Maximize, GitFork, Target, Users, Lock, Clock, ShieldCheck, Zap, Send, Home, ClipboardCheck, PenTool, Leaf, Map } from 'lucide-react';

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
        type: 'text',
        title: 'Ready for Science?',
        content: 'Your device is your scientific instrument. A proper setup ensures every measurement counts.\n\nIn this module:\n• 🔐 Permissions: Why we need Location & Camera.\n• ⚙️ Calibration: Tuning your sensors for sub-meter accuracy.\n• 👤 Account: Syncing your hard work to the cloud.',
        icon: BookOpen
      },
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
        type: 'text',
        title: 'The Art of Capture',
        content: 'Garbage in, garbage out. Even the best AI cannot fix a bad photo. Learn the professional field protocols.\n\nYou will master:\n• 📐 Angles: Why "Perpendicular" is non-negotiable.\n• ☀️ Lighting: Avoiding silhouettes and shadows.\n• 🦶 Stance: Stability techniques for sharp images.',
        icon: BookOpen
      },
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
        title: 'Precision Walking',
        content: 'Distance is the most critical variable in the height formula. A 10% error here means a 10% error in your final result.\n\nThe Workflow:\n• 🎯 The Reticle: Reading the AR feedback loop.\n• 🚶 The Walk-Back: Our unique verification technique.\n• 🛡️ Drift Control: How to spot and fix AR errors.',
        icon: BookOpen
      },
      {
        type: 'image',
        title: 'Visual Guide',
        content: 'Study this diagram to understand the "Walk-Back" technique.',
        src: '/assets/training/AR Distance.png',
        icon: ImageIcon
      },
      {
        type: 'video',
        title: 'Video Tutorial',
        content: 'Watch how to properly measure distance using AR.',
        src: 'https://www.youtube.com/embed/9Qvo0-jp4mw',
        icon: Youtube
      },
      {
        type: 'checklist',
        title: 'The "Walk-Back" Technique',
        content: 'Confirm you understand the steps:',
        checklistItems: [
          '1. Stand still at the capture spot.',
          '2. Point camera at ground, wait for solid reticle.',
          '3. Mark Point A directly below your phone.',
          '4. Walk slowly to the tree base (Point B).',
          '5. Mark Point B at the trunk.',
          '6. CRITICAL: Walk back to Point A to verify the line.',
          '7. Confirm only when back at the start.'
        ],
        icon: Footprints
      }
    ]
  },
  {
    id: 'manual-marking',
    title: 'Chapter 4: Manual Marking',
    description: 'Learn to manually annotate trees for 100% precision.',
    icon: MousePointer2,
    slides: [
      {
        type: 'text',
        title: 'Human-in-the-Loop',
        content: 'AI is fast, but you are the expert. Learn the "Gold Standard" marking protocols for complex trees.\n\nSkills Covered:\n• 📍 H-C-G System: The standard annotation order.\n• 🧲 Magnetic Band: Ensuring scientifically valid DBH.\n• 🌳 Complex Trees: Handling forks and dense canopies.',
        icon: BookOpen
      },
      {
        type: 'image',
        title: 'Reference Guide',
        content: 'The H-C-G Point System explained.',
        src: '/assets/training/Manual Marking.png',
        icon: ImageIcon
      },
      {
        type: 'video',
        title: 'Marking Tutorial',
        content: 'See how to mark Height, Canopy, and Girth correctly.',
        src: 'https://www.youtube.com/embed/F4tqh3zvZY4',
        icon: Youtube
      },
      {
        type: 'checklist',
        title: 'Marking Rules',
        content: 'I promise to follow these rules:',
        checklistItems: [
          'H1 (Base): Mark exactly where trunk meets ground.',
          'H2 (Top): Mark the very highest leaf tip.',
          'C1/C2: Mark the widest points of the crown.',
          'Girth: Use the Cyan Magnetic Band at 1.3m.',
          'Forked Trees: Mark all stems before calculating.'
        ],
        icon: ListChecks
      }
    ]
  },
  {
    id: 'workflow-quick',
    title: 'Chapter 5: Workflow A - Quick Capture',
    description: 'The "Speed Run" mode. Capture now, analyze later. Perfect for mapping large areas quickly.',
    icon: Zap,
    slides: [
      {
        type: 'text',
        title: 'The Strategy: Speed & Volume',
        content: 'Field time is precious. This workflow reduces time-per-tree to ~45 seconds.\n\nProcess:\n1. Capture Photo\n2. Measure Distance\n3. Submit to Community\n\nGoal: Map as many trees as possible while the light is good.',
        icon: BookOpen
      },
      {
        type: 'image',
        title: 'Workflow Visual',
        content: 'Follow the "Submit to Community" path.',
        src: '/assets/training/Option 1.png',
        icon: ImageIcon
      },
      {
        type: 'video',
        title: 'Field Demo',
        content: 'Watch the Quick Capture process in action.',
        src: 'https://www.youtube.com/embed/qQ2FwFCB2SE',
        icon: Youtube
      },
      {
        type: 'checklist',
        title: 'Quick Capture Checklist',
        content: 'Confirm the steps:',
        checklistItems: [
          '1. Permissions & Location ON.',
          '2. Capture Tree (Perpendicular, Breathing Space).',
          '3. Measure Distance (Walk-Back Technique).',
          '4. Select "Submit for Community".',
          '5. Capture Close-up (Leaf/Bark).',
          '6. Submit & Move to next tree.'
        ],
        icon: Send
      }
    ]
  },
  {
    id: 'workflow-pending',
    title: 'Chapter 6: Completing Pending Analysis',
    description: 'Finish what you started. How to revisit and finalize "Quick Capture" trees.',
    icon: Clock,
    slides: [
      {
        type: 'text',
        title: 'The Follow-Up',
        content: 'Quick Capture gets the tree on the map. Now, someone needs to finish the job.\n\nProcess:\n1. Select "Pending" Tree\n2. Verify Existing Data\n3. Complete Manual Analysis\n\nGoal: Upgrade "Pending" records to "Verified".',
        icon: BookOpen
      },
      {
        type: 'video',
        title: 'Tutorial: Pending Analysis',
        content: 'Watch how to access and complete pending tree analyses.',
        src: 'https://www.youtube.com/embed/BXXQhiJH7BY',
        icon: Youtube
      },
      {
        type: 'checklist',
        title: 'Completion Checklist',
        content: 'Steps to finalize a record:',
        checklistItems: [
          '1. Locate "Pending" tree on Map.',
          '2. Select "Complete Analysis".',
          '3. Verify Photo & Distance.',
          '4. Perform Manual Marking (H-C-G).',
          '5. Add Species & Details.',
          '6. Final Submit.'
        ],
        icon: ListChecks
      }
    ]
  },
  {
    id: 'workflow-full',
    title: 'Chapter 7: Workflow B - Full Analysis',
    description: 'The "Scientist" mode. Complete the entire data lifecycle on the spot.',
    icon: ClipboardCheck,
    slides: [
      {
        type: 'text',
        title: 'The Strategy: Depth & Detail',
        content: 'Zero backlog. When you leave the tree, the work is done.\n\nProcess:\n1. Capture & Distance\n2. Manual Measure (H-C-G)\n3. Species ID & Details\n\nTime: ~3 minutes per tree.',
        icon: BookOpen
      },
      {
        type: 'image',
        title: 'Workflow Visual',
        content: 'Follow the "Analyze Myself" path.',
        src: '/assets/training/placeholder.png', // TODO: User to update
        icon: ImageIcon
      },
      {
        type: 'video',
        title: 'Field Demo',
        content: 'Watch the Full Analysis process in action.',
        src: 'https://www.youtube.com/embed/PLACEHOLDER', // TODO: User to update
        icon: Youtube
      },
      {
        type: 'checklist',
        title: 'Full Analysis Checklist',
        content: 'Confirm the steps:',
        checklistItems: [
          '1. Capture & Distance (Standard).',
          '2. Select "Analyze Myself" -> "Manual".',
          '3. Mark Points (Base, Top, Canopy, Girth).',
          '4. Identify Species (Close-up).',
          '5. Add Details (Condition, Ownership).',
          '6. Submit & Verify on Map.'
        ],
        icon: Map
      }
    ]
  },
  {
    id: 'community-grove',
    title: 'Chapter 8: The Community Grove',
    description: 'Join the global team of citizen scientists. Verify trees and build the database.',
    icon: Users,
    slides: [
      {
        type: 'text',
        title: 'Citizen Science',
        content: 'The Grove is where "Quick Capture" trees go to mature. You are not just a user; you are a Ranger helping to verify data from around the world.\n\nKey Concepts:\n• 🤝 The Power of 5: Consensus verification.\n• 🔐 The Lock: 10-minute analysis window.\n• 👑 Owner Privilege: Instant verification.',
        icon: BookOpen
      },
      {
        type: 'image',
        title: 'The Grove Ecosystem',
        content: 'Understand how your contributions fit into the global verification network.',
        src: '/assets/training/Community Grove.png',
        icon: ImageIcon
      },
      {
        type: 'video',
        title: 'Grove Tutorial',
        content: 'Watch how to claim, analyze, and verify trees in the Community Grove.',
        src: 'https://www.youtube.com/embed/MmNOhseAL9I',
        icon: Youtube
      },
      {
        type: 'checklist',
        title: 'Ranger\'s Oath',
        content: 'I accept the responsibility of the Grove:',
        checklistItems: [
          'I will only claim trees I intend to finish.',
          'I understand the 10-minute timer.',
          'I know my analysis contributes to the "Consensus of 5".',
          'I will be precise, even with strangers\' trees.'
        ],
        icon: ListChecks
      }
    ]
  }
];
