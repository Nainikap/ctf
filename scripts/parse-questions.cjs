const fs = require('fs');
const path = require('path');

const mdPath = path.resolve(__dirname, '../ctf question bank.md');
const outDir = path.resolve(__dirname, '../src/data');
const outPath = path.join(outDir, 'questions.json');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const content = fs.readFileSync(mdPath, 'utf8');
const lines = content.split(/\r?\n/);

let currentTier = null;
let currentCategory = 'General';

const sections = {
  easy: [],
  medium: [],
  hard: []
};

let currentQuestion = null;
let state = 'IDLE';

function flushQuestion() {
  if (currentQuestion && currentTier && currentQuestion.question && currentQuestion.options.length > 0) {
    // Generate clean id
    currentQuestion.id = `${currentTier}-${sections[currentTier].length + 1}`;
    sections[currentTier].push(currentQuestion);
    currentQuestion = null;
  }
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  if (line === '**EASY**') {
    flushQuestion();
    currentTier = 'easy';
    currentCategory = 'General';
    continue;
  }
  if (line === '**MEDIUM**') {
    flushQuestion();
    currentTier = 'medium';
    currentCategory = 'General';
    continue;
  }
  if (line === '**HARD**') {
    flushQuestion();
    currentTier = 'hard';
    currentCategory = 'General';
    continue;
  }

  // Check category header
  const catMatch = line.match(/^\*\*([A-Za-z0-9 &,—\-:\(\)]+)\*\*$/);
  if (catMatch && !catMatch[1].startsWith('Q') && !catMatch[1].startsWith('Answer') && !catMatch[1].startsWith('A.') && !catMatch[1].startsWith('B.') && !catMatch[1].startsWith('C.') && !catMatch[1].startsWith('D.')) {
    currentCategory = catMatch[1].trim();
    continue;
  }

  // Check question start
  const qMatch = line.match(/^\*\*Q(\d+)\.\s*(.*)/);
  if (qMatch && currentTier) {
    flushQuestion();

    let qText = qMatch[2].replace(/\*\*/g, '').trim();
    currentQuestion = {
      id: '',
      number: parseInt(qMatch[1], 10),
      difficulty: currentTier,
      category: currentCategory,
      question: qText,
      options: [],
      answer: ''
    };
    state = 'QUESTION';
    continue;
  }

  if (!currentQuestion) continue;

  // Check for answer line
  const ansMatch = line.match(/^\*\*Answer:\s*(.+?)\*\*$/i) || line.match(/^Answer:\s*(.+)$/i);
  if (ansMatch) {
    currentQuestion.answer = ansMatch[1].replace(/\*\*/g, '').trim();
    state = 'ANSWER';
    continue;
  }

  // Check for options
  const cleanedLine = line.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
  const optMatches = cleanedLine.match(/[A-D]\.\s*[^A-D\n]+(?=(?:\s+[A-D]\.)|$)/g);
  if (optMatches && (cleanedLine.startsWith('A.') || cleanedLine.startsWith('B.') || cleanedLine.startsWith('C.') || cleanedLine.startsWith('D.'))) {
    for (const opt of optMatches) {
      currentQuestion.options.push(opt.trim());
    }
    state = 'OPTIONS';
    continue;
  } else if (/^[A-D]\.\s*/.test(cleanedLine)) {
    currentQuestion.options.push(cleanedLine);
    state = 'OPTIONS';
    continue;
  }

  // If multiline question
  if (state === 'QUESTION' && !cleanedLine.startsWith('Answer:')) {
    currentQuestion.question += ' ' + cleanedLine;
  }
}

flushQuestion();

console.log('Parsed Counts:');
console.log('Easy:', sections.easy.length);
console.log('Medium:', sections.medium.length);
console.log('Hard:', sections.hard.length);
console.log('Total:', sections.easy.length + sections.medium.length + sections.hard.length);

fs.writeFileSync(outPath, JSON.stringify(sections, null, 2), 'utf8');
console.log('Wrote parsed question bank to', outPath);
