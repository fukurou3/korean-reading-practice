import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseKoreanPracticeMarkdown } from "./content-parser.mjs";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(rootDirectory, "content", "korean-practice.md");
const outputPath = path.join(rootDirectory, "src", "generated", "practice-content.json");

const markdown = await readFile(sourcePath, "utf8");
const content = parseKoreanPracticeMarkdown(markdown);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");

console.log(
  `Generated ${path.relative(rootDirectory, outputPath)}: ` +
    `${content.stats.vocabularyCount} words, ` +
    `${content.stats.lessonCount} lessons, ` +
    `${content.stats.exampleCount} examples.`,
);
