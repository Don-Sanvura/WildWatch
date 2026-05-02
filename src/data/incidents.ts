export type Severity = "critical" | "high" | "medium" | "low";
export type Status = "active" | "investigating" | "resolved";

export type Incident = {
  id: string;
  animal: string;
  emoji: string;
  severity: Severity;
  status: Status;
  location: string;
  reporter: string;
  reportedAt: string; // ISO
  description: string;
  responders: number;
};

export const initialIncidents: Incident[] = [
  {
    id: "INC-2041",
    animal: "Leopard Sighting",
    emoji: "🐆",
    severity: "critical",
    status: "active",
    location: "Trail behind Residence Hall B",
    reporter: "M. Thompson",
    reportedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    description:
      "Adult leopard spotted near the running trail. Stay indoors and avoid the wooded area until cleared.",
    responders: 4,
  },
  {
    id: "INC-2040",
    animal: "Chacma Baboon Troop",
    emoji: "🐒",
    severity: "high",
    status: "investigating",
    location: "Parking Lot 7, North Campus",
    reporter: "K. Patel",
    reportedAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
    description:
      "Troop raiding bins and car interiors. Conservation officer en route.",
    responders: 2,
  },
  {
    id: "INC-2039",
    animal: "Black-backed Jackal",
    emoji: "🦊",
    severity: "medium",
    status: "active",
    location: "Athletics Field perimeter",
    reporter: "J. Rivera",
    reportedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    description: "Two jackals circling the field. Keep small pets on leash.",
    responders: 1,
  },
  {
    id: "INC-2038",
    animal: "Vervet Monkey",
    emoji: "🐵",
    severity: "low",
    status: "investigating",
    location: "Library East entrance",
    reporter: "S. Chen",
    reportedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    description: "Vervet approaching students for food. Likely habituated.",
    responders: 1,
  },
  {
    id: "INC-2037",
    animal: "African Honey Bee Swarm",
    emoji: "🐝",
    severity: "medium",
    status: "resolved",
    location: "Engineering courtyard",
    reporter: "T. Nguyen",
    reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    description: "Large swarm relocated by campus apiary team.",
    responders: 2,
  },
];

export const animalTypes = [
  { label: "Leopard", emoji: "🐆" },
  { label: "Chacma Baboon", emoji: "🐒" },
  { label: "Vervet Monkey", emoji: "🐵" },
  { label: "Black-backed Jackal", emoji: "🦊" },
  { label: "Caracal", emoji: "🐈" },
  { label: "Cape Cobra", emoji: "🐍" },
  { label: "Puff Adder", emoji: "🐍" },
  { label: "African Honey Bee Swarm", emoji: "🐝" },
  { label: "Stray Dog", emoji: "🐕" },
  { label: "Hadeda Ibis", emoji: "🦤" },
  { label: "Other", emoji: "🐾" },
];

export const emergencyContacts = [
  { label: "Campus Security (24/7)", value: "10111", icon: "🚨" },
  { label: "Ambulance / Medical", value: "10177", icon: "🏥" },
  { label: "SANParks Emergency", value: "+27 13 735 4325", icon: "🌳" },
  { label: "African Snakebite Institute", value: "+27 82 494 2039", icon: "🐍" },
];

export type SafetyResource = {
  title: string;
  desc: string;
  icon: string;
  severity: "critical" | "high" | "medium" | "low";
  steps: string[];
  doNot: string[];
  call: string;
  link: { label: string; href: string };
};

export const safetyResources: SafetyResource[] = [
  {
    title: "Leopard Encounter",
    desc: "Stay big, stay loud, never run.",
    icon: "🐆",
    severity: "critical",
    steps: [
      "Stop. Pick up small children and pets immediately.",
      "Make yourself look large — raise arms, open jacket.",
      "Maintain eye contact and speak in a firm, loud voice.",
      "Back away slowly; give the leopard a clear escape route.",
      "If attacked, fight back aggressively — aim for eyes and face.",
    ],
    doNot: ["Do NOT run or turn your back", "Do NOT crouch or play dead"],
    call: "10111",
    link: {
      label: "SANParks — Predator Safety",
      href: "https://www.sanparks.org/conservation/scientific/safety",
    },
  },
  {
    title: "Chacma Baboon Troop",
    desc: "Do not feed; secure food and never make eye contact with males.",
    icon: "🐒",
    severity: "high",
    steps: [
      "Avoid direct eye contact — it is read as a threat.",
      "Drop nothing edible; keep bags zipped and held tight.",
      "Move calmly indoors or to a vehicle and close windows.",
      "If approached, back away — do not turn and run.",
      "Report bold/aggressive troops to local Baboon Monitors or SPCA.",
    ],
    doNot: ["Do NOT feed baboons", "Do NOT smile or bare teeth", "Do NOT corner the troop"],
    call: "10111",
    link: {
      label: "Cape Town Baboon Hotline",
      href: "https://www.capetown.gov.za/Family%20and%20home/Pets-and-animals/baboons",
    },
  },
  {
    title: "Snake Bite (Cape Cobra / Puff Adder / Mamba)",
    desc: "Most SA snakes are harmless — but the deadly ones need fast action.",
    icon: "🐍",
    severity: "critical",
    steps: [
      "Move calmly out of striking range (≥3 m).",
      "Keep the patient still — movement spreads venom faster.",
      "Remove rings, watches, tight clothing before swelling starts.",
      "Apply a pressure bandage for mamba/cobra (neurotoxic) bites — NOT for puff adder.",
      "Get to hospital with antivenom immediately. Note time of bite & snake description.",
    ],
    doNot: [
      "Do NOT cut the wound or suck out venom",
      "Do NOT apply ice or a tourniquet",
      "Do NOT give alcohol, food or caffeine",
      "Do NOT try to catch or kill the snake",
    ],
    call: "10177",
    link: {
      label: "African Snakebite Institute",
      href: "https://www.africansnakebiteinstitute.com/",
    },
  },
  {
    title: "Black-backed Jackal / Caracal",
    desc: "Haze them — keep them wary of humans.",
    icon: "🦊",
    severity: "high",
    steps: [
      "Stand tall, wave arms, shout aggressively.",
      "Throw sticks or stones toward (not at) the animal.",
      "Pick up small pets and children immediately.",
      "Maintain eye contact and back away slowly once it retreats.",
      "Report bold or denning behaviour to local conservation services.",
    ],
    doNot: ["Do NOT feed wildlife", "Do NOT turn your back or run"],
    call: "+27 13 735 4325",
    link: {
      label: "EWT — Living with Predators",
      href: "https://ewt.org.za/",
    },
  },
  {
    title: "African Honey Bee Swarm",
    desc: "Highly defensive — run in a straight line, cover your face.",
    icon: "🐝",
    severity: "high",
    steps: [
      "RUN — at least 100 m, straight line, do not stop.",
      "Cover face and head with a shirt; protect eyes and airway.",
      "Get indoors or into a vehicle; close all windows.",
      "Scrape stingers out sideways with a card; do not pinch.",
      "Call 10177 for >10 stings, facial swelling, breathing trouble, or known allergy.",
    ],
    doNot: [
      "Do NOT swat or wave arms — releases more alarm pheromone",
      "Do NOT jump in water — bees wait at the surface",
      "Do NOT shelter in dense bush",
    ],
    call: "10177",
    link: {
      label: "ER24 — Bee Sting First Aid",
      href: "https://www.er24.co.za/",
    },
  },
  {
    title: "Vervet Monkey",
    desc: "Clever, fast, and food-motivated — secure everything.",
    icon: "🐵",
    severity: "medium",
    steps: [
      "Do not make eye contact with adult males.",
      "Drop food only as a last resort to escape; never hand-feed.",
      "Close doors and windows; vervets enter homes easily.",
      "Stand tall and clap loudly to move a single animal away.",
      "Report habituated troops to local conservation or SPCA.",
    ],
    doNot: ["Do NOT feed monkeys", "Do NOT corner one — they bite hard"],
    call: "+27 82 494 2039",
    link: {
      label: "Vervet Monkey Foundation",
      href: "https://www.vervets.co.za/",
    },
  },
  {
    title: "Injured Wildlife",
    desc: "Do not handle — call a licensed rescue.",
    icon: "🦌",
    severity: "low",
    steps: [
      "Keep a safe distance — injured animals are unpredictable and may bite.",
      "Note exact location, species, and visible injuries.",
      "Keep pets and bystanders well away.",
      "Photograph from distance if safe; do not approach.",
      "Call SANParks or local SPCA Wildlife Unit before acting.",
    ],
    doNot: ["Do NOT feed or water the animal", "Do NOT attempt to capture it yourself"],
    call: "+27 13 735 4325",
    link: {
      label: "NSPCA Wildlife Unit",
      href: "https://nspca.co.za/what-we-do/wildlife-protection-unit/",
    },
  },
];


export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
