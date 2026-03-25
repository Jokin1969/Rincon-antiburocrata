import {
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from 'docx'
import { MOH_QUESTIONS } from '../src/data/mohQuestionsData.js'

// ── Design constants ──────────────────────────────────────────────────────────

const FONT = 'Calibri'
const SIZE = 20      // 10pt
const SIZE_TITLE = 28 // 14pt

const BORDER_SINGLE = { style: BorderStyle.SINGLE, size: 1, color: '000000' }
const ALL_BORDERS = {
  top: BORDER_SINGLE, bottom: BORDER_SINGLE,
  left: BORDER_SINGLE, right: BORDER_SINGLE,
}
const CELL_MARGIN = { top: 100, bottom: 100, left: 130, right: 130 }
const GRAY_FILL = { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE, ...opts })
}

function p(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)]
  return new Paragraph({
    children,
    alignment: opts.alignment,
    spacing: { before: opts.before ?? 60, after: opts.after ?? 60 },
  })
}

function emptyLine() {
  return new Paragraph({ children: [t('')], spacing: { before: 40, after: 40 } })
}

function makeCell(paragraphs, opts = {}) {
  return new TableCell({
    children: paragraphs,
    borders: opts.borders ?? ALL_BORDERS,
    shading: opts.shading,
    columnSpan: opts.columnSpan,
    margins: opts.margins ?? CELL_MARGIN,
  })
}

/** Render an answer that may contain newlines as multiple paragraphs */
function answerParagraphs(text) {
  return text
    .split('\n')
    .map(line => p([t(line.trim())]))
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateMohQuestions(answers) {
  const children = [
    // ── Title ────────────────────────────────────────────────────────────────
    new Paragraph({
      children: [t('Singapore Ministry of Health (MOH)', { bold: true, size: SIZE_TITLE })],
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [t('List of Questions', { bold: true, size: SIZE_TITLE })],
      spacing: { before: 0, after: 400 },
    }),

    // ── Q&A table ─────────────────────────────────────────────────────────────
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: MOH_QUESTIONS.flatMap(({ key, label, question }, i) => {
        const answer = answers[key] ?? ''
        return [
          // Question row (gray header)
          new TableRow({
            children: [
              makeCell(
                [p([t(`${label}. ${question}`, { bold: true })])],
                { shading: GRAY_FILL }
              ),
            ],
          }),
          // Answer row
          new TableRow({
            children: [
              makeCell(answerParagraphs(answer)),
            ],
          }),
          // Spacer row between Q&A pairs (except last)
          ...(i < MOH_QUESTIONS.length - 1
            ? [new TableRow({
                children: [
                  makeCell([p('')], {
                    borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    },
                    margins: { top: 40, bottom: 40, left: 0, right: 0 },
                  }),
                ],
              })]
            : []),
        ]
      }),
    }),
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left:   convertInchesToTwip(1.18),
            right:  convertInchesToTwip(1.18),
          },
        },
      },
      children,
    }],
  })

  return Packer.toBuffer(doc)
}
