import { jsPDF } from 'jspdf'
import { mkdirSync } from 'node:fs'

mkdirSync('public/resume', { recursive: true })

const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
const margin = 48
let y = 148

const text = (value, size = 10, bold = false, color = '#1f2937') => {
  pdf.setFont('helvetica', bold ? 'bold' : 'normal')
  pdf.setFontSize(size)
  pdf.setTextColor(color)
  pdf.text(value, margin, y)
  y += size * 1.45
}

pdf.setFillColor(9, 11, 16)
pdf.rect(0, 0, 595, 120, 'F')
pdf.setTextColor(244, 245, 248)
pdf.setFont('helvetica', 'bold')
pdf.setFontSize(28)
pdf.text('MUIZ LAWAL', margin, 64)
pdf.setFontSize(12)
pdf.setFont('helvetica', 'normal')
pdf.text('Software Developer | AI & Cybersecurity Enthusiast', margin, 88)

text('CONTACT', 11, true, '#6d28d9')
text('abdulmuizlawal208@gmail.com', 10)
text('github.com/Muiz-Lawal  |  linkedin.com/in/muiz-lawal-a5862b274', 10)
text('Nigeria', 10)
y += 10
text('EDUCATION', 11, true, '#6d28d9')
text('Obafemi Awolowo University', 12, true)
text('Computer Science — Five-year programme', 10)
y += 10
text('TECHNICAL SKILLS', 11, true, '#6d28d9')
text('Python, JavaScript, TypeScript, Kotlin, React, Vite', 10)
text('Git, GitHub, Linux, networking, application-security foundations, Android development', 10)
y += 10
text('SELECTED PROJECT', 11, true, '#6d28d9')
text('SEN104 Scientific Calculator — Kotlin Android application', 12, true)
text('Expression evaluation, matrix operations, descriptive statistics, calculation history', 10)
text('Technology: Kotlin, Android, exp4j, SharedPreferences, Material Components', 10)
y += 10
text('ACTIVITIES & CONTRIBUTIONS', 11, true, '#6d28d9')
text('Innovation Syndicate participation', 10, true)
text('Educational technology exploration and introductory Python teaching', 10)
text('University technology collaboration and communication/publicity support', 10)
y += 10
text('PROFESSIONAL DIRECTION', 11, true, '#6d28d9')
text('Developing toward secure AI systems engineering, with interests in', 10)
text('cybersecurity, software engineering, machine learning and systems development.', 10)

pdf.save('public/resume/muiz-lawal-cv.pdf')
