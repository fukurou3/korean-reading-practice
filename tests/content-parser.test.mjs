import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseKoreanPracticeMarkdown } from "../scripts/content-parser.mjs";

test("parses the current Korean practice markdown content", async () => {
  const markdown = await readFile(new URL("../content/korean-practice.md", import.meta.url), "utf8");
  const content = parseKoreanPracticeMarkdown(markdown);

  assert.equal(content.stats.vocabularyCount, 25);
  assert.equal(content.stats.lessonCount, 14);
  assert.equal(content.stats.exampleCount, 100);
  assert.equal(content.vocabularyCategories[0].title, "人");
  assert.equal(content.lessons[0].title, "은/는（〜は）");
  assert.match(content.lessons[0].notes[0], /文法パターン/);
  assert.equal(content.lessons[5].groups.length, 2);
});

test("rejects rows with empty Korean or Japanese cells", () => {
  const markdown = [
    "# 登場単語一覧",
    "",
    "## 人",
    "",
    "| 韓国語 | 日本語 |",
    "| --- | --- |",
    "| 저 | |",
  ].join("\n");

  assert.throws(() => parseKoreanPracticeMarkdown(markdown), /empty 韓国語 or 日本語/);
});
