const PROJECTS = {
  'ai-powered-automated-waste-sorting-system': {
    summary: 'A vision system beside a conveyor that recognises recyclable waste in real time on a Raspberry Pi and hands every decision to the line over ROS2.',
    role: 'Lead developer',
    status: 'Completed',
    duration: '4 months',
    problem: 'Sorting mixed recyclable waste by hand is slow and inconsistent. The goal was a system that recognises each item on a moving conveyor and tells the line where it belongs — on low-cost hardware that can sit right next to the belt.',
    approach: 'I trained custom CNN models on a dataset of more than 12,000 images covering five waste categories, then optimised them to run on a Raspberry Pi. A ROS2 bridge streams each prediction to the conveyor control units in real time, so the camera and the machine work as one system.',
    challenges: [
      { problem: 'A model accurate enough to sort reliably was too heavy to run in real time on a Raspberry Pi.', solution: 'Optimised the model\'s memory footprint for edge deployment while keeping 97.69% accuracy across five waste streams.' },
      { problem: 'Each prediction had to reach the conveyor without delay, or the item would already have passed.', solution: 'Built a ROS2 communication bridge that streams every inference directly to the conveyor control units.' }
    ],
    results: ['97.69% classification accuracy across 5 waste streams', 'Runs in real time on a Raspberry Pi', 'Connected to the physical conveyor automation over ROS2']
  },
  'brain-tumor-mri-analysis-system': {
    summary: 'A deep learning platform that classifies brain tumours and outlines the lesion on MRI scans.',
    role: 'Computer vision developer',
    status: 'Completed',
    duration: '3 months',
    problem: 'Reading MRI scans for tumours is slow, specialised work. The aim was an end-to-end system that classifies tumours automatically and marks the lesion region, accurately enough to serve as a reliable second opinion.',
    approach: 'I curated and preprocessed 2,867 high-resolution clinical MRI scans, enhanced soft-tissue contrast with OpenCV filters, and trained CNN models in PyTorch with spatial attention for tumour classification and lesion segmentation. Performance was benchmarked on precision and recall against standard medical datasets.',
    challenges: [
      { problem: 'With a few thousand images, a deep model can memorise the training set instead of learning from it.', solution: 'Applied robust data augmentation during training to prevent overfitting.' },
      { problem: 'Soft-tissue boundaries have low contrast in raw MRI scans.', solution: 'Added OpenCV image-processing filters that enhance contrast before training.' }
    ],
    results: ['98.43% peak tumour-classification accuracy', 'Trained and evaluated on 2,867 clinical MRI scans', 'Precision and recall benchmarked against standard medical datasets']
  },
  'foldable-wing-autonomous-drone': {
    summary: 'A foldable-wing autonomous UAV carrying a multi-sensor payload to track air quality — funded by TÜBİTAK 2209-A.',
    role: 'Principal developer',
    status: 'Funded · TÜBİTAK 2209-A',
    duration: '6 months',
    problem: 'Fixed ground stations measure air quality at single points, which says little about how pollution spreads across an area. The project set out to measure it from the air, in real time.',
    approach: 'I designed a foldable-wing autonomous UAV built around a Pixhawk flight controller, carrying a multi-sensor payload for real-time air-quality tracking. Machine learning algorithms parse the telemetry data to predict local environmental pollution patterns.',
    results: ['TÜBİTAK 2209-A research funding as principal developer', 'Real-time air-quality tracking from a multi-sensor payload', 'Machine-learning prediction of local pollution patterns from telemetry']
  }
};

const EXPERIENCE = {
  'imax-elektronic-embedded-software-engineer': {
    summary: 'Firmware, hardware and app work for a photoelectric smoke detector product line.',
    problem: 'A smoke detector has to react to real fire immediately, stay quiet for steam and cooking smoke, and run for years on very little power.',
    approach: 'I write production firmware in Embedded C for STM32 microcontrollers, interface the smoke sensors over I2C and SPI, build UART and LoRa layers for wireless alarm networks, and designed a fuzzy logic alarm decision algorithm. I also contribute to the hardware revisions and co-develop the companion Flutter app.',
    results: ['Fuzzy logic alarm decision that materially reduces false alarms', 'Wireless alarm networking and remote device status over LoRa', 'Firmware validated on new boards after each hardware revision']
  },
  'selcuk-university-ai-robotics-intern': {
    summary: 'Led the computer vision pipeline behind the automated waste sorting system.',
    problem: 'The university needed recyclable waste classified automatically, in real time, on inexpensive hardware connected to a real conveyor.',
    approach: 'I led an end-to-end computer vision pipeline on Raspberry Pi that classifies waste into five categories, optimised the edge AI models for deployment, and integrated the recognition software with the physical conveyor automation.',
    results: ['97.69% real-time classification accuracy', '5 waste categories classified on a Raspberry Pi', 'Integrated with physical conveyor automation']
  },
  'selcuk-university-computer-vision-ai-intern': {
    summary: 'Deep learning for medical image analysis — the brain tumour MRI system.',
    problem: 'Tumour classification on MRI needed to be accurate and robust, from a limited set of clinical images.',
    approach: 'I designed and trained CNN architectures for medical image analysis, curated and preprocessed 2,867 high-resolution MRI images with robust augmentation, and benchmarked precision and recall against standard medical datasets.',
    results: ['98.43% tumour-classification accuracy', '2,867 MRI images curated and preprocessed', 'Overfitting prevented through robust augmentation']
  },
  'mizan-mekatronik-automation-department-intern': {
    summary: 'Hands-on industrial automation: PLC programming, HMI design and control panels.',
    problem: 'Industrial systems must be programmed, wired and commissioned so that they run reliably from day one.',
    approach: 'I programmed PLC systems and designed HMI screens in Siemens TIA Portal, assembled and wired industrial control panels and sensor distribution networks, and diagnosed hardware and software faults during commissioning.',
    results: ['PLC programs and HMI screens built in Siemens TIA Portal', 'Control panels and sensor networks assembled and wired', 'Faults found and fixed during system commissioning']
  }
};

const CASE_FIELDS = ['summary', 'role', 'status', 'duration', 'team', 'quote', 'problem', 'approach', 'challenges', 'results', 'reflection'];

const slugify = (s) => String(s || '').toLowerCase()
  .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

const empty = (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.filter((x) => x && (typeof x !== 'object' || x.problem || x.solution)).length);

function fill(item, defaults) {
  if (!item || !defaults) return item;
  const out = { ...item };
  for (const k of CASE_FIELDS) if (defaults[k] !== undefined && empty(out[k])) out[k] = defaults[k];
  return out;
}

function withCaseDefaults(content) {
  if (!content || typeof content !== 'object') return content;
  const c = { ...content };
  if (Array.isArray(c.projects)) c.projects = c.projects.map((p) => (p && p.title ? fill(p, PROJECTS[slugify(p.slug || p.title)]) : p));
  if (Array.isArray(c.experience)) c.experience = c.experience.map((e) => (e && (e.role || e.company) ? fill(e, EXPERIENCE[slugify(e.slug || `${e.company || ''} ${String(e.role || '').trim()}`)]) : e));
  return c;
}

module.exports = { withCaseDefaults, PROJECTS, EXPERIENCE };
