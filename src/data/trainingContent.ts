import { BookOpen, Camera, Ruler, Sun, Smartphone, CheckCircle, AlertTriangle, MapPin, Settings } from 'lucide-react';

export interface TrainingSlide {
  title: string;
  content: string;
  icon?: any; // Lucide icon component
  actionLabel?: string; // Optional button text (e.g., "Go to Settings")
  actionId?: string; // ID to trigger an action
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
        title: 'Welcome to the Team!',
        content: "Before you head out, let's tune your instrument. Your phone is about to become a scientific tool. This setup only takes 5 minutes and you usually only do it once.",
        icon: BookOpen
      },
      {
        title: '1. Create Your Account',
        content: "Make sure you are logged in. This ensures every tree you measure is credited to you on the leaderboard. You'll earn 'Sapling Points' for every contribution!",
        icon: CheckCircle
      },
      {
        title: '2. Critical Permissions',
        content: "We need access to 3 things:\n\n• Location: To pin trees on the map.\n• Camera: To see the trees.\n• Sensors (Compass): To measure angles.\n\nIf asked, please click 'Allow'.",
        icon: MapPin
      },
      {
        title: '3. The "One-Time" Calibration',
        content: "Every camera is different. If the app asks you to calibrate, you'll need a standard A4 paper.\n\n1. Tape it to a wall or put it on a table.\n2. Stand back and take a photo.\n3. Enter '29.7' for the height.\n\nIf the app asks for 'Distance to Tree', you are already calibrated!",
        icon: Ruler
      },
      {
        title: 'Ready for the Field?',
        content: "Checklist:\n✅ Logged In\n✅ GPS On\n✅ Sensors Allowed\n✅ Calibration Checked\n\nNow let's learn how to take the perfect photo.",
        icon: CheckCircle
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
        title: 'The "Perpendicular Phone" Rule',
        content: "This is the #1 rule. Hold your phone STRAIGHT (parallel to the tree trunk). Do not tilt it up or down excessively. Tilting distorts the height measurement.",
        icon: Smartphone
      },
      {
        title: 'The Perfect Frame',
        content: "1. Portrait Mode (Vertical) only!\n2. Fit the WHOLE tree: Base to Top.\n3. Leave 'breathing room' (sky above, ground below).\n4. Ensure no cars or people block the view.",
        icon: Camera
      },
      {
        title: 'The "Statue Stance"',
        content: "1. Take the Photo.\n2. FREEZE. Do not move your feet.\n3. Measure the distance.\n\nIf you move between the photo and the measurement, the math will be wrong!",
        icon: AlertTriangle
      },
      {
        title: 'Lighting Matters',
        content: "Sunlight is your friend! Best time is mid-morning to late afternoon.\n\nAvoid:\n❌ Night/Dusk (Too grainy)\n❌ Backlighting (Sun directly behind the tree)",
        icon: Sun
      },
      {
        title: 'Precision Clicking',
        content: "When analyzing:\n• Use the Magnifier bubble.\n• Click the very tip of the top leaf.\n• Click the center of the base.\n• Click the widest points for the canopy.",
        icon: CheckCircle
      }
    ]
  }
];
