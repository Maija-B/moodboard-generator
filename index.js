const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { createClient } = require('@supabase/supabase-js')

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

app.post('/generate', async (req, res) => {
  const { prompt } = req.body

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const fullPrompt = `
    You are a senior UI/UX design director. Given an app description, 
    return ONLY a valid JSON object with exactly this structure, no markdown, no backticks, no explanation:

    {
      "name": "mood board name",
      "rationale": "one paragraph design rationale",
      "colors": [
        { "hex": "#1A1A2E", "role": "background" },
        { "hex": "#E94560", "role": "accent" },
        { "hex": "#FFFFFF", "role": "primary text" },
        { "hex": "#A8A8B3", "role": "secondary text" },
        { "hex": "#16213E", "role": "surface" }
      ],
      "fonts": [
        { "name": "Inter", "role": "body", "weight": "400" },
        { "name": "Playfair Display", "role": "heading", "weight": "700" }
      ],
      "keywords": ["minimal", "dark", "modern", "bold", "clean"],
      "components": {
        "borderRadius": "8px",
        "buttonStyle": "filled with sharp corners",
        "spacing": "generous whitespace"
      }
    }

    App description: ${prompt}
  `

  const result = await model.generateContent(fullPrompt)
  const text = result.response.text()
  const json = JSON.parse(text)

  const { data, error } = await supabase
    .from('boards')
    .insert({ prompt, current: json, history: [json] })
    .select()
    .single()

  res.json({ id: data.id, board: json })
})

app.post('/edit', async (req, res) => {
  const { currentBoard, editInstruction, boardId } = req.body

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const fullPrompt = `
    You are a senior UI/UX design director. You are evolving an existing mood board based on feedback.
    
    Here is the current mood board:
    ${JSON.stringify(currentBoard)}
    
    The user wants this change: "${editInstruction}"
    
    Rules:
    - Only change what the user asked to change
    - Preserve everything else exactly
    - Return ONLY a valid JSON object in the exact same structure
    - No markdown, no backticks, no explanation
  `

  const result = await model.generateContent(fullPrompt)
  const text = result.response.text()
  const json = JSON.parse(text)

  const { data, error } = await supabase
    .from('boards')
    .update({ current: json })
    .eq('id', boardId)
    .select()
    .single()

  res.json({ id: data.id, board: json })
})

app.get('/board/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('boards')
    .select()
    .eq('id', req.params.id)
    .single()

  res.json(data)
})

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})