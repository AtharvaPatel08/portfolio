export interface ProjectItem {
  id: string;
  index: string;
  name: string;
  subtitle: string;
  category: string;
  yearNote: string;
  description: string;
  architectureNote: string;
  technologies: string[];
  githubUrl?: string;
  liveUrl?: string;
  /** Replace with a real project preview asset path when available */
  previewImage?: string;
  plateCaption: string;
  plateGeometry: "scratch" | "batalarm" | "qr" | "data";
}

export interface ExpertiseGroup {
  index: string;
  title: string;
  subtitle: string;
  items: string[];
}

export interface ExperienceItem {
  organization: string;
  legalEntity: string;
  position: string;
  type: string;
  duration: string;
  /** Leave empty until verified responsibilities are ready to publish */
  notes: string[];
}

export const PORTFOLIO_DATA = {
  identity: {
    name: "ATHARVA PATEL",
    shortName: "Atharva Patel",
    headlineStart: "Building",
    headlineAccent: "Intelligent",
    headlineEnd: "Products Through Creativity, Code & AI.",
    intro:
      "I’m a technology enthusiast, creative problem solver, and aspiring AI/ML engineer exploring the intersection of artificial intelligence, design, and digital experiences.",
    location: "Bhopal, India",
    exploringStatus: "Exploring AI, Machine Learning & Creative Technology",
    email: "hire.atharvapatel@gmail.com",
    github: "https://github.com/AtharvaPatel08",
    linkedin: "https://www.linkedin.com/in/atharva-patel-2b4b8b3b4",
  },

  navLinks: [
    { label: "About", href: "#about" },
    { label: "Expertise", href: "#expertise" },
    { label: "Selected Work", href: "#work" },
    { label: "Experience", href: "#experience" },
    { label: "Contact", href: "#contact" },
  ],

  about: {
    label: "01 / ABOUT",
    heading: "Curiosity is where everything begins.",
    philosophicalQuote:
      "The most compelling tools are born where analytical reasoning meets creative intent.",
    paragraphs: [
      "I’m a second-year B.Tech student in Artificial Intelligence and Machine Learning at LNCT, Bhopal, drawn toward understanding how technology works beneath the surface.",
      "Rather than treating engineering and design as separate disciplines, I enjoy experimenting with emerging AI workflows, prototyping concepts from scratch, and paying close attention to how digital products feel to use.",
      "Most of my growth comes from independent exploration—questioning how systems are structured, testing modern AI-assisted development tools, and turning raw ideas into tangible digital experiences.",
    ],
    ledger: [
      { label: "Discipline", value: "Artificial Intelligence & Machine Learning" },
      { label: "Practice", value: "AI-Assisted Development & Creative Problem-Solving" },
      { label: "Institution", value: "LNCT, Bhopal" },
      { label: "Location", value: "Bhopal, Madhya Pradesh, India" },
    ],
  },

  expertise: {
    label: "02 / EXPERTISE",
    heading: "Things I work with.",
    note: "A practical toolkit shaped by hands-on experimentation, rapid product prototyping, and ongoing technical study.",
    groups: [
      {
        index: "01",
        title: "Programming & Data",
        subtitle: "Core logic, numerical computation, and structured data analysis",
        items: ["Python", "Pandas", "NumPy"],
      },
      {
        index: "02",
        title: "AI & Development",
        subtitle: "AI-assisted building, iterative reasoning, and vibe coding workflows",
        items: ["Google AI Studio", "Cursor", "Claude", "ChatGPT"],
      },
      {
        index: "03",
        title: "Design & Creative Tools",
        subtitle: "Interface composition, typographic hierarchy, and visual exploration",
        items: ["Figma", "AI-assisted design tools"],
      },
      {
        index: "04",
        title: "Development Ecosystem",
        subtitle: "Version control, documentation, and open experimentation",
        items: ["GitHub"],
      },
    ] as ExpertiseGroup[],
  },

  projects: {
    label: "03 / SELECTED WORK",
    heading: "Ideas made tangible.",
    subtitle:
      "Selected builds spanning deployed web products, standalone utilities, and self-directed data exploration.",
    items: [
      {
        id: "scrth",
        index: "01",
        name: "Scratch / SCRTH",
        subtitle: "SCRTH — START FROM SCRATCH.",
        category: "Web Product · AI-Assisted Build",
        yearNote: "Live Deployment",
        description:
          "An original personal concept taken from a blank slate to a live web application using AI-assisted development and vibe coding—focused on turning a clear idea into a deployed, usable experience.",
        architectureNote:
          "Published as a live web application on Vercel with source tracked publicly on GitHub. Visual preview asset slot is ready to accept real product captures.",
        technologies: ["TypeScript", "AI-Assisted Development"],
        githubUrl: "https://github.com/AtharvaPatel08/Tracker",
        liveUrl: "https://tracker-teal-two-19.vercel.app/",
        plateCaption: "Live Web Application · Replaceable Preview Plate",
        plateGeometry: "scratch",
      },
      {
        id: "batalarm",
        index: "02",
        name: "Batalarm",
        subtitle: "Battle Alarm Application",
        category: "Application · End-to-End Prototype",
        yearNote: "AI Pair-Programmed",
        description:
          "A functional alarm application designed and shipped through AI pair-programming workflows—combining creative concepting with end-to-end ownership across ideation, architecture, implementation, and testing.",
        architectureNote:
          "Built to explore how modern AI development environments accelerate turning an original product concept into a working application without losing architectural intent.",
        technologies: ["AI-Assisted Development"],
        plateCaption: "Application Build · Replaceable Preview Plate",
        plateGeometry: "batalarm",
      },
      {
        id: "qr-code-generator",
        index: "03",
        name: "QR Code Generator",
        subtitle: "Python Utility",
        category: "Utility · Python Ecosystem",
        yearNote: "Standalone Tool",
        description:
          "A standalone QR code generation utility built independently using Python’s library ecosystem, applying core programming fundamentals across data structures, file I/O, and error handling.",
        architectureNote:
          "Scoped and executed independently from initial requirements through a clean, reliable Python utility.",
        technologies: ["Python"],
        plateCaption: "Python Utility · Replaceable Preview Plate",
        plateGeometry: "qr",
      },
      {
        id: "data-analysis",
        index: "04",
        name: "Data Analysis Mini-Projects",
        subtitle: "Exploratory Analytics Pipelines",
        category: "Data Exploration · Self-Directed",
        yearNote: "Python · NumPy · Pandas",
        description:
          "Self-directed analytical explorations focused on data manipulation, cleaning, transformation, and descriptive statistics pipelines over structured datasets.",
        architectureNote:
          "Built as a series of focused notebooks and scripts to strengthen practical intuition for tabular workflows and exploratory data analysis.",
        technologies: ["Python", "NumPy", "Pandas"],
        plateCaption: "Exploratory Data Pipelines · Replaceable Preview Plate",
        plateGeometry: "data",
      },
    ] as ProjectItem[],
  },

  experience: {
    label: "04 / EXPERIENCE",
    heading: "Where ideas meet execution.",
    items: [
      {
        organization: "GlobalCert",
        legalEntity: "GlobalCert Pte. Ltd.",
        position: "Founder’s Office Intern",
        type: "Remote Internship",
        duration: "19 May 2026 – 30 August 2026",
        notes: [],
      },
    ] as ExperienceItem[],
  },

  education: {
    label: "05 / EDUCATION",
    institution: "LNCT — Lakshmi Narain College of Technology, Bhopal",
    shortInstitution: "LNCT, Bhopal",
    degree: "B.Tech in Artificial Intelligence and Machine Learning",
    currentYear: "Second Year",
    expectedGraduation: "2029",
  },

  exploring: {
    label: "06 / CURRENTLY EXPLORING",
    heading: "Always learning. Always experimenting.",
    topics: [
      {
        index: "01",
        title: "Machine Learning",
        note: "Foundational algorithms, statistical reasoning, and understanding how models learn from structured data.",
      },
      {
        index: "02",
        title: "Artificial Intelligence",
        note: "Applied reasoning workflows and thoughtful, human-centered AI interfaces.",
      },
      {
        index: "03",
        title: "AI-Assisted Development",
        note: "Using modern AI coding environments to move rapidly from conceptual sketch to working software.",
      },
      {
        index: "04",
        title: "Creative Coding",
        note: "Treating software as a creative medium where logic, composition, and interaction converge.",
      },
      {
        index: "05",
        title: "UI/UX Design",
        note: "Editorial typography, visual restraint, spatial hierarchy, and calm interaction design.",
      },
      {
        index: "06",
        title: "Digital Product Development",
        note: "Understanding how ambiguous ideas evolve into coherent, meaningful products from first principles.",
      },
    ],
  },

  beyondCode: {
    label: "07 / BEYOND THE CODE",
    heading: "Technology is only one part of the story.",
    quote:
      "Good products rarely start with syntax—they start with paying attention to how people think, decide, and feel.",
    pillars: [
      {
        index: "I",
        title: "Psychology & Human Thinking",
        detail:
          "Drawing on curiosity about how people perceive, decide, and interact with ideas—bringing psychological clarity into technical problem-solving.",
      },
      {
        index: "II",
        title: "Product Thinking",
        detail:
          "Looking past isolated features to examine intent, usability, and how small design choices shape an entire digital experience.",
      },
      {
        index: "III",
        title: "Startup Ecosystems",
        detail:
          "Studying how independent thinkers and small teams navigate ambiguity and turn original questions into enduring products.",
      },
    ],
  },

  contact: {
    label: "08 / CONNECT",
    heading: "Have an interesting idea? Let’s talk.",
    message:
      "Whether you’re a recruiter, founder, engineer, designer, or simply someone exploring thoughtful ideas in AI and technology—my inbox is open for genuine conversations.",
  },

  footer: {
    tagline: "Quiet sophistication. Timeless typography. Creative thinking.",
    copyrightYear: "2026",
  },
} as const;
