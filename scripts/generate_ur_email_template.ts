import * as fs from "node:fs";
import * as path from "node:path";

type Args = Record<string, string>;

const parseArgs = (argv: string[]) => {
  const out: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const trimmed = raw.replace(/^--/, "");
    if (!trimmed) continue;
    if (trimmed.includes("=")) {
      const [key, value] = trimmed.split("=");
      out[key.replace(/-/g, "_").toUpperCase()] = value ?? "";
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[trimmed.replace(/-/g, "_").toUpperCase()] = next;
      i += 1;
    } else {
      out[trimmed.replace(/-/g, "_").toUpperCase()] = "true";
    }
  }
  return out;
};

const parseSections = (content: string) => {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const header = line.match(/^##\s+(.*)$/);
    if (header) {
      current = header[1].trim();
      sections[current] = [];
      continue;
    }
    if (!current) continue;
    sections[current].push(line);
  }
  return sections;
};

const cleanBullet = (line: string) => line.replace(/^-+\s*/, "").trim();

const extractBullets = (lines: string[]) =>
  lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map(cleanBullet)
    .filter(Boolean);

const extractSubject = (lines: string[]) => {
  const match = lines.find((line) => line.trim().startsWith("Subject:"));
  return match ? match.replace(/^Subject:\s*/, "").trim() : "";
};

const extractBodyLines = (lines: string[]) => {
  const out: string[] = [];
  let inBody = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBody && trimmed.startsWith("Body:")) {
      inBody = true;
      continue;
    }
    if (!inBody) continue;
    if (!trimmed) continue;
    out.push(trimmed.startsWith("-") ? cleanBullet(trimmed) : trimmed);
  }
  return out;
};

const replacePlaceholders = (value: string, replacements: Record<string, string>) => {
  let next = value;
  for (const [key, replacement] of Object.entries(replacements)) {
    next = next.replaceAll(key, replacement);
  }
  return next;
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const get = (key: string, fallback = "") => args[key] ?? process.env[key] ?? fallback;

  const profileRaw = get("PROFILE", "GENERIC").toUpperCase();
  const profile = ["GENERIC", "IOP", "PHP", "MAT"].includes(profileRaw)
    ? profileRaw
    : "GENERIC";

  const clinicName = get("CLINIC_NAME");
  const clientDisplayId = get("CLIENT_DISPLAY_ID");
  const periodStart = get("PERIOD_START");
  const periodEnd = get("PERIOD_END");
  const bundleFilename = get("BUNDLE_FILENAME");
  const outPath = get("OUT");

  const missing = [
    ["CLINIC_NAME", clinicName],
    ["CLIENT_DISPLAY_ID", clientDisplayId],
    ["PERIOD_START", periodStart],
    ["PERIOD_END", periodEnd],
    ["BUNDLE_FILENAME", bundleFilename],
  ].filter(([, value]) => !value);

  if (missing.length) {
    const keys = missing.map(([key]) => key).join(", ");
    throw new Error(`Missing required args: ${keys}`);
  }

  const repoRoot = path.resolve(__dirname, "..");
  const acceptancePath = path.join(repoRoot, "docs", "ur", "ACCEPTANCE_LANGUAGE_TEMPLATES.md");
  const emailPath = path.join(repoRoot, "docs", "ur", "UR_SUBMISSION_EMAIL_TEMPLATES.md");

  const acceptanceRaw = fs.readFileSync(acceptancePath, "utf8");
  const emailRaw = fs.readFileSync(emailPath, "utf8");

  const acceptanceSections = parseSections(acceptanceRaw);
  const emailSections = parseSections(emailRaw);

  const acceptanceSectionKey =
    profile === "IOP"
      ? "IOP (Intensive Outpatient Program)"
      : profile === "PHP"
        ? "PHP (Partial Hospitalization Program)"
        : profile === "MAT"
          ? "MAT (Medication-Assisted Treatment)"
          : "Generic (Default)";

  const emailSectionKey =
    profile === "IOP"
      ? "IOP Submission"
      : profile === "PHP"
        ? "PHP Submission"
        : profile === "MAT"
          ? "MAT Submission"
          : "Generic Submission";

  const acceptanceLines = [
    ...extractBullets(acceptanceSections[acceptanceSectionKey] ?? []),
    ...extractBullets(acceptanceSections["Always Include"] ?? []),
  ];

  const emailLines = emailSections[emailSectionKey] ?? [];
  const subjectTemplate = extractSubject(emailLines) || `AER Submission – <Clinic> – <Client> – <Period>`;
  const bodyLines = extractBodyLines(emailLines);

  const replacements = {
    "<Clinic>": clinicName,
    "<Client>": clientDisplayId,
    "<Period>": `${periodStart} to ${periodEnd}`,
  };

  const subject = replacePlaceholders(subjectTemplate, replacements);
  const body = bodyLines.map((line) => replacePlaceholders(line, replacements));

  const output = [
    `Subject: ${subject}`,
    "",
    `Client: ${clientDisplayId}`,
    `Period: ${periodStart} to ${periodEnd}`,
    `Bundle: ${bundleFilename}`,
    "",
    "Body:",
    ...body.map((line) => `- ${line}`),
    "",
    "Acceptance Language:",
    ...acceptanceLines.map((line) => `- ${line}`),
    "",
  ].join("\n");

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output, "utf8");
    return;
  }

  process.stdout.write(output);
}

main();
