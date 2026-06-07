const TABLE_SEPARATOR_PATTERN = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/;

export function parseKoreanPracticeMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content = {
    schemaVersion: 1,
    sourceFormat: "markdown-table-v1",
    vocabularyCategories: [],
    lessons: [],
    stats: {
      vocabularyCount: 0,
      lessonCount: 0,
      exampleCount: 0,
    },
  };

  let mode = "idle";
  let currentVocabularyCategory = null;
  let currentLesson = null;
  let currentGroup = null;
  let pendingOrderHint = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line || line === "---") {
      continue;
    }

    if (line.startsWith("※")) {
      if (currentLesson) {
        currentLesson.notes.push(stripMarkdown(line.replace(/^※\s*/, "")));
      }
      continue;
    }

    if (line.startsWith("順番")) {
      const orderHint = stripMarkdown(line);
      if (mode === "lesson" && currentGroup) {
        currentGroup.orderHint = orderHint;
      } else {
        pendingOrderHint = orderHint;
      }
      continue;
    }

    if (line.startsWith("# ")) {
      const title = line.replace(/^#\s+/, "").trim();
      currentVocabularyCategory = null;
      currentGroup = null;
      pendingOrderHint = null;

      if (title.includes("登場単語一覧")) {
        mode = "vocabulary";
        currentLesson = null;
        continue;
      }

      mode = "lesson";
      currentLesson = createLesson(title, content.lessons.length + 1);
      content.lessons.push(currentLesson);
      continue;
    }

    if (line.startsWith("## ")) {
      const title = line.replace(/^##\s+/, "").trim();
      pendingOrderHint = null;

      if (mode === "vocabulary") {
        currentVocabularyCategory = {
          id: `vocabulary-${content.vocabularyCategories.length + 1}`,
          title,
          words: [],
        };
        content.vocabularyCategories.push(currentVocabularyCategory);
        continue;
      }

      if (mode === "lesson" && currentLesson) {
        currentGroup = createGroup(currentLesson, title, null);
        continue;
      }
    }

    if (isMarkdownTableStart(lines, index)) {
      const table = readMarkdownTable(lines, index);
      handleTable({
        table,
        mode,
        content,
        currentVocabularyCategory,
        currentLesson,
        currentGroup,
        pendingOrderHint,
      });
      if (mode === "lesson" && currentLesson && !currentGroup) {
        currentGroup = currentLesson.groups[currentLesson.groups.length - 1] ?? null;
      }
      pendingOrderHint = null;
      index = table.endIndex;
    }
  }

  content.stats.vocabularyCount = content.vocabularyCategories.reduce(
    (total, category) => total + category.words.length,
    0,
  );
  content.stats.lessonCount = content.lessons.length;
  content.stats.exampleCount = content.lessons.reduce(
    (total, lesson) =>
      total + lesson.groups.reduce((groupTotal, group) => groupTotal + group.examples.length, 0),
    0,
  );

  validateContent(content);
  return content;
}

function createLesson(rawTitle, fallbackNumber) {
  const match = rawTitle.match(/^(\d+)\.\s*(.+)$/);
  const number = match ? Number(match[1]) : fallbackNumber;
  const title = match ? match[2].trim() : rawTitle;

  return {
    id: `lesson-${String(number).padStart(2, "0")}`,
    number,
    title,
    groups: [],
    notes: [],
  };
}

function createGroup(lesson, title, orderHint) {
  const group = {
    id: `${lesson.id}-group-${lesson.groups.length + 1}`,
    title,
    orderHint,
    examples: [],
  };
  lesson.groups.push(group);
  return group;
}

function isMarkdownTableStart(lines, index) {
  const line = lines[index]?.trim();
  const nextLine = lines[index + 1]?.trim();
  return Boolean(line?.startsWith("|") && nextLine && TABLE_SEPARATOR_PATTERN.test(nextLine));
}

function readMarkdownTable(lines, startIndex) {
  const headers = splitTableRow(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length && lines[index].trim().startsWith("|")) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  return {
    headers,
    rows,
    startIndex,
    endIndex: index - 1,
  };
}

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripMarkdown(cell.trim()));
}

function stripMarkdown(value) {
  return value.replace(/\*\*/g, "").trim();
}

function handleTable({
  table,
  mode,
  currentVocabularyCategory,
  currentLesson,
  currentGroup,
  pendingOrderHint,
}) {
  const koreanIndex = table.headers.findIndex((header) => header === "韓国語");
  const japaneseIndex = table.headers.findIndex((header) => header === "日本語");

  if (koreanIndex === -1 || japaneseIndex === -1) {
    throw new Error(`Table at line ${table.startIndex + 1} must have 韓国語 and 日本語 columns.`);
  }

  if (mode === "vocabulary") {
    if (!currentVocabularyCategory) {
      throw new Error(`Vocabulary table at line ${table.startIndex + 1} is missing a category heading.`);
    }

    table.rows.forEach((row, rowIndex) => {
      const entry = readEntry(row, koreanIndex, japaneseIndex, table.startIndex, rowIndex);
      currentVocabularyCategory.words.push({
        id: `${currentVocabularyCategory.id}-word-${currentVocabularyCategory.words.length + 1}`,
        korean: entry.korean,
        japanese: entry.japanese,
      });
    });
    return;
  }

  if (mode === "lesson") {
    if (!currentLesson) {
      throw new Error(`Lesson table at line ${table.startIndex + 1} is missing a lesson heading.`);
    }

    const group = currentGroup ?? createGroup(currentLesson, "基本", pendingOrderHint);
    if (!group.orderHint && pendingOrderHint) {
      group.orderHint = pendingOrderHint;
    }

    table.rows.forEach((row, rowIndex) => {
      const entry = readEntry(row, koreanIndex, japaneseIndex, table.startIndex, rowIndex);
      group.examples.push({
        id: `${group.id}-example-${group.examples.length + 1}`,
        korean: entry.korean,
        japanese: entry.japanese,
      });
    });
  }
}

function readEntry(row, koreanIndex, japaneseIndex, tableStartIndex, rowIndex) {
  const korean = row[koreanIndex] ?? "";
  const japanese = row[japaneseIndex] ?? "";
  const lineNumber = tableStartIndex + rowIndex + 3;

  if (!korean || !japanese) {
    throw new Error(`Table row at line ${lineNumber} has an empty 韓国語 or 日本語 cell.`);
  }

  return { korean, japanese };
}

function validateContent(content) {
  const errors = [];
  const seenIds = new Set();

  if (content.vocabularyCategories.length === 0) {
    errors.push("No vocabulary categories were parsed.");
  }

  if (content.lessons.length === 0) {
    errors.push("No lessons were parsed.");
  }

  for (const category of content.vocabularyCategories) {
    requireUniqueId(seenIds, category.id, errors);
    if (category.words.length === 0) {
      errors.push(`Vocabulary category "${category.title}" has no words.`);
    }
    for (const word of category.words) {
      requireUniqueId(seenIds, word.id, errors);
    }
  }

  for (const lesson of content.lessons) {
    requireUniqueId(seenIds, lesson.id, errors);
    if (lesson.groups.length === 0) {
      errors.push(`Lesson "${lesson.title}" has no groups.`);
    }
    for (const group of lesson.groups) {
      requireUniqueId(seenIds, group.id, errors);
      if (group.examples.length === 0) {
        errors.push(`Group "${group.title}" in lesson "${lesson.title}" has no examples.`);
      }
      for (const example of group.examples) {
        requireUniqueId(seenIds, example.id, errors);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function requireUniqueId(seenIds, id, errors) {
  if (seenIds.has(id)) {
    errors.push(`Duplicate id: ${id}`);
  }
  seenIds.add(id);
}
